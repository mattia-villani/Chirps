"use strict"

let express = require('express');
let http = require('http');
let path = require('path');
let antidoteClient = require( 'antidote_ts_client');
let errorhandler = require('errorhandler');
let morgan = require('morgan');
let bodyParser = require('body-parser');
let validator = require('validator');
let CircularJSON = require('circular-json')

let server = express();

let publicDir = path.join(__dirname, '../../public');

server.set('port', process.env.PORT || 1337);
server.use(morgan('combined')); // Logger
server.use(bodyParser.json());

server.use(express.static(publicDir));

if (process.env.NODE_ENV === 'development') {
  server.use(errorhandler());
}

// Antidote connection setup
let antidote = antidoteClient.connect(process.env.ANTIDOTE_PORT || 8087, process.env.ANTIDOTE_HOST || "localhost");
antidote.defaultBucket = "chirps";

//-----
// Database Schema:

// global set of all user ids
let userSet = antidote.set("users")
let registrationsSet = antidote.set("registrations")
let user2pass = antidote.map("user2pass")

// each user has a timeline with the Chirps he can read
let timeline = (user) => antidote.set(`timeline_${user}`);
// each user has a timeline of chirps he wrote
let written = (user) => antidote.set(`written_${user}`);
// each user has follower and he follows
let followers = (user) => antidote.set(`followers_${user}`);
let following = (user) => antidote.set(`following_${user}`);
let replays = (chirpSID) => antidote.set('replays_'+chirpSID);


// this maps contains the values U->X where X = true <=> U is too expensive. X is undefined otherwise
let tooExpensiveUsers = antidote.map('tooExpensiveUsers'); 
let isUserTooExpensive = async (user) => ( await tooExpensiveUsers.register(user).read() ) != undefined;
let numberOfFollowersBeforeBeingConsideredExpensive = 2;

async function addFollowerToUser(user, follower){
  antidote.startTransaction()
    .then( async tx => {
      let f_ers = await tx.set('followers_'+user)
      let f_ing = await tx.set('following_'+follower)
      tx.update([
        f_ers.add(follower),
        f_ing.add(user)
      ]).catch( e => { tx.commit(); throw e; })
      return f_ers.read().then( async flls => {
        if ( flls.length && flls.length && flls.length >= numberOfFollowersBeforeBeingConsideredExpensive ){
          let too = await tx.map('tooExpensiveUsers');          
          tx.update(too.register(user).set(true))
            .then( _ => tx.commit())
            .catch( e => {console.error("Failled to update transaction"); return tx.commit()})
        }else return tx.commit();
      })
      .catch( e => { tx.commit(); throw e; })
    })
}

async function removeFollowerToUser(user, follower){
  antidote.startTransaction()
    .then( async tx => {
      let f_ers = await tx.set('followers_'+user)
      let f_ing = await tx.set('following_'+follower)
      tx.update([
        f_ers.remove(follower),
        f_ing.remove(user)
      ]).catch( e => { tx.commit(); throw e; })
      return f_ers.read().then( async flls => {
        if ( flls.length && flls.length && flls.length < numberOfFollowersBeforeBeingConsideredExpensive ){
          let too = await tx.map('tooExpensiveUsers');          
          tx.update(too.register(user).set(undefined))
            .then( _ => tx.commit())
            .catch( e => {console.error("Failled to update transaction"); return tx.commit()})
        }else return tx.commit();
      })
      .catch( e => { tx.commit(); throw e; })
    })
}

//-----
// utilitis over antidotes
// helper function for async handlers:
function handle(handler) {
  return (req, res, next) => {
    handler(req)
      .then(r => res.send(r))
      .catch(next)
  };
}
function handleWithRes(handler) {
  return (req, res, next) => {
    handler(req,res)
      .catch(next)
  };  
}
function assertOrThrow(condition,code, msg, e=undefined) {
  if ( condition ) 
    throw {status:code, mesg :msg, rawError:e}
}
function catchHandler(code, msg){ return (e) => assertOrThrow(true, code, msg, e) }
function sendAndNotifyError(res, e){
  console.error(e)
  if ( e.stack )
    console.error("STACK TRACE :" + e.stack) 
  if (e.rawError ) console.error(e.rawError)     
  return res
    .status(e.status?e.status:500)
    .send(e.mesg ? e.mesg : "");
}

async function register(user, password, email){
    let a_user = { 
      time: Date.now(),
      user: user,    
      email: email
    }
    // start transaction... What about the abort transaction ? 
    let tx = await antidote.startTransaction().catch(catchHandler(500, "startTransaction"))

    let u2p = await tx.map('user2pass')
    let regSet = await tx.set('registrations')
    let uSet = await tx.set('users')

    await uSet.read()
      .then( us => assertOrThrow(user in us, 406, "User "+user+" already registered") )
      .catch( catchHandler(500, "Failled to read current users") )

    await tx.update( regSet.add(a_user) ).catch(catchHandler(500,"update user set failled"))
    
    let regs = await regSet.read()
      .catch( catchHandler(500, "registrations set failled") )
    let olderUsers = regs.filter(s=>(a_user.user == s.user && s.time && a_user.time > s.time)) 
    
    // stronger check over the already presency 
    if (olderUsers && olderUsers.length > 0){
      await tx.update( regSet.remove(a_user) ).catch(catchHandler(500,"update remove user set failled"))
      await tx.commit().catch(catchHandler(500, "abort commit 2"))
      assertOrThrow(true, 406, "This user was already registered");
    }

    await tx.update( [ 
      u2p.register(user).set(password), 
      uSet.add(user),
      followers(user).add(user),
      following(user).add(user)
    ] ).catch(catchHandler(500,"update"))

    return tx.commit().catch(catchHandler(500, "commit"))
}

async function addSomeUsers(){
    return register("Alice", "p_alice", "alice@here.com")
      .then ( _=> register("Bob", "p_bob", "bob@here.com") )
      .then ( _=> register("Claudia", "p_claudia", "claudia@here.com") )
      .then ( _=> register("Donald", "passwd", "donald@here.com") )
      .then ( _=> registrationsSet.read() )
      .then ( regs=> 
            regs.map(u=> console.log("Insterted entry "+JSON.stringify(u) ) )
      ).catch(e => console.error( "Could not insert the users: "+ (e.stack?e.stack:JSON.stringify(e)) ) )
}  


//------
/**
 *  description
 *  -> registrationsSet = antidote.set("registrations") 
 *    made of records of the type :
 *      { 
 *        time: <registration's timestamp>,
 *        user: <user\' name>,    
 *        email: <email>
 *      }
 */


//---
// Demo setup:


// insert dummy user
addSomeUsers()

function currentUser(request) {
  assertOrThrow ( !request.headers.authorization.startsWith("Basic "), 400, "Authorization un-readable")
  let based64 = request.headers.authorization.replace("Basic ","")
  let credentials = JSON.parse(new Buffer(based64,'base64').toString('ascii'))
  assertOrThrow(!credentials || credentials == {}, 400, "Badly formatted request")
  let user = credentials.user;
  let password = credentials.password;
  assertOrThrow(! user || ! password, 400, "Invalid request"  )
  return ( 
    user2pass
        .register(user)
        .read()
        .then( readPass => { 
          if ( readPass != password ) assertOrThrow(true, 403, "Invalid credentials")
          console.log("User "+JSON.stringify(user));
          return user;
        } )
        .catch(e => {assertOrThrow(true, 500, "Unable to read user "+user)} )
   )
}


// ----- APP ----- //
server.get('/', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get('/login', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get(/^\/(timeline)\/.*/, function (req, res, next) {
  res.sendfile('public/index.html');
});


// API
/**
 * Gives a list of all user-names in the system
 */
server.get('/api/users', handle(async req => {
  return await userSet.read().then( 
    us => user2pass.read().then( ps => 
      "userSet "+us.map(i=>JSON.stringify(i))+" <br/>user2pass "+JSON.stringify(ps.toJsObject())
  ))
}));

/**
 * Adds a new Chirp for the current user (see currentUser function).
 * 
 * Expects a Chirp in the following format:
 * {
 *   message: string;
 *   avatar: string;
 * }
 * 
 * The new Chirp will be saved to the timeline of every user in the system
 * 
 */
server.post('/api/chirps', handle(async req => {
  var chirp = req.body;
  // add a timestamp for sorting
  chirp.time = Date.now();
  // store current user
  let cur_user = await currentUser(req);
  chirp.user = cur_user;
  // id 
  chirp.id = cur_user+chirp.time
  console.log("Adding chirp "+JSON.stringify(chirp))

  // get all users following the creator 
  let users = await followers(cur_user).read();
  // add new Chirp to the timeline of every user
  if (users.length == 0) {
    console.log("Warning: No users found to see the new chirp: "+users+" has no followers")
  } else {
    await antidote.update(
      users.map(u => timeline(u).add(chirp))
    );
  }
  return chirp;
}));

/**
 * Fetches the timeline for a given user
 */
async function getTimeline(user) {
  let chirps = await timeline(user).read();

  let followed = await following(user).read();
  followed.map( async u => { 
    if ( isUserTooExpensive(u) )
      chirps = chiprs.concat(await written(u)) 
  })
  
  if ( chirps && chirps.length > 0 )
    chirps.sort((x, y) => y.time - x.time);
  else chirps = []
  return chirps;
}
/**
 * fetches the replays of a chirps
 */
function getReplays(chirpSID){
  return replays(chirpSID)
    .read()
    .then( replays => { replays.sort((x, y) => x.time - y.time); return replays; })
}
/**
 * Gives the timeline for the current user
 */
server.get('/api/timeline', handle(async req => {
  return await currentUser(req).then( u => getTimeline(u) );
}));

/**
 * Gives the timeline for a specific user
 */
server.get('/api/timeline/:user', handle(async req => {
  let user = req.params.user;
  return await written(user).read().then(cs => {
    if ( cs && cs.length > 0 ) cs.sort((x,y) => y.time - x.time)
    else cs = []
    return cs
  })
}));

// function to delete everything (for demos and debugging)
// e.g.: curl -d "" http://localhost:1337/api/clearChirps
server.post('/api/clearChirps', handle(async req => {
  async function clearUser(u) {
    let chirps = await timeline(u).read();
    let f_ers = await followers(u).read();
    let f_ing = await following(u).read();
    return antidote.update([
      userSet.remove(u),
      timeline(u).removeAll(chirps),
      followers(u).removeAll(f_ers),
      following(u).removeAll(f_ing)
    ]);
  }

  let users = await userSet.read(); 
  console.log(`Clearing users ${users}`);
  if (users.length > 0) 
      await Promise.all(users.map(u => clearUser(u)))
        .then( _ =>  console.log('userSet cleared')  )
        .catch( e => console.error( "Failed to clear users: "+e.stack ))
  await registrationsSet.read()
      .then( set => registrationsSet.removeAll(set) )
      .then( up => antidote.update(up) )
      .then( _ => console.log( "registrations cleared" ) )
      .catch( e => console.error( "Failed to clear registrations: " + e.stack ))
  await user2pass.read()
      .then( entries => 
          Object.keys(entries.toJsObject())
            .map( key => user2pass.remove( user2pass.register(key) ) )
      ) 
      .then( up => antidote.update(up) )
      .then( _ => console.log( "passwords cleared" ) )
      .catch( e => console.error( "Failed to clear passwords: " + e.stack ))

  console.log(`Adding new users`);
  // add some users:
  addSomeUsers();
  return "database cleared\n";
}));
/**
 * search user
 */
server.get('/api/search/:key', handle(async req => {
  let key = req.params.key.toLowerCase();
  return (await userSet.read())
  .filter( user=> user.toLowerCase().search(key) != -1 )
}));
/**
 * tells if the user is following and it is followed by the params
 */
server.get('/api/relation/:user', handleWithRes(async (req, res) => {
    try{
      let user = req.params.user;
      let me = await currentUser(req);
      let relation = { 
        it_is_followed_by_me: 
          await followers(user).read().then( followersOfUser => ( followersOfUser.indexOf(me)!=-1 ) ),
        it_is_following_me: 
          await following(user).read().then( userIsFollowing => ( userIsFollowing.indexOf(me)!=-1 ) )
      }
      console.log("Relation with "+user+": "+JSON.stringify(relation) )
      return res.status(200).send( relation )
    }catch(e){ return sendAndNotifyError(res,e); }
}));
/**
 * Manages the follower of a user 
 */
server.get('/api/followers/:user', handle(async req => {
  let user = req.params.user;
  return await followers(user).read()
}));
server.put('/api/followers/:user', handle(async req => {
  let user = req.params.user;
  return await userSet.read()
      .then( users =>{ 
            if ( users.indexOf(user) != -1 ) 
              return currentUser(req); 
            throw "User "+req.params.user+" unknown in collection "+users; 
      } ).then( me =>addFollowerToUser(req.params.user, me ) )
}));
server.delete('/api/followers/:user', handle(async req => {
  let user = req.params.user;
  return await currentUser(req)
      .then( me => removeFollowerToUser(req.params.user, me ) );
}));

/**
 * Register user to the server
 */
server.post('/api/register/', handleWithRes( async (req, res) => {
    let data = req.body
    let user = data.user;
    let password = data.password;
    let email = data.mail;
    return register(user, password, mail)
      .then( _ => res.status(201).send({user:user}) )
      .catch( e => sendAndNotifyError(res,e) )
} ) )

/**
 * check if the credentials are corrected, if not, this fails
 */
server.post('/api/validCredentials/', handleWithRes(async (req, res) => {
    return await currentUser(req)
      .then(user=>res.status(200).send({user:user}))
      .catch( e => sendAndNotifyError(res,e) )
}));

server.get('/api/replays/:chirp', handle( async (req) => {
    return await getReplays(req.params.chirp)
}))
server.post('/api/replays', handle( async (req) => {
    let replay = req.body;
    replay.time = Date.now()
    if ( replay.user == await currentUser(req) )
      return await antidote.update(replays(replay.chirpID).add(replay)).then(_=>replay)
    else throw "Replay of a different user than the logged one"
}))


// ----- start server -----
http.createServer(server).listen(server.get('port'), function () {
  console.log("Express server listening on port " + server.get('port'));
})