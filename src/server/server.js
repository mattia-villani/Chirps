"use strict"

let express = require('express');
let http = require('http');
let path = require('path');
let antidoteClient = require( 'antidote_ts_client');
let errorhandler = require('errorhandler');
let morgan = require('morgan');
let bodyParser = require('body-parser');
let expressValidator = require('express-validator');

let server = express();

let publicDir = path.join(__dirname, '../../public');

server.set('port', process.env.PORT || 1337);
server.use(morgan('combined')); // Logger
server.use(bodyParser.json());
server.use(expressValidator());

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
let user2pass = antidote.map("user2pass")

// each user has a timeline with the Chirps he can read
let timeline = (user) => antidote.set(`timeline_${user}`);


//------
/**
 *  description
 *  -> userSet = antidote.set("users") 
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
antidote.update(userSet.add('Donald'))
  .then(_ => console.log(`Inserted dummy user`))
  .catch(err => console.log(`Could not insert dummy user `, err));
antidote.update(
  [
    user2pass.register('Donald').set('passwd'),
  ])
    .then(_=>console.log('Inserted entry Donald,passwd'))
    .catch(err => console.log('Could not insert user2pass or user2mail'))


function currentUser(request) {
  // return fake user
  return 'Donald';
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
  chirp.user = currentUser(req);

  // get all users 
  let users = await userSet.read();
  // add new Chirp to the timeline of every user
  if (users.length == 0) {
    console.log("Warning: No users found to see the new chirp.")
  } else {
    await antidote.update(
      users.map(u => timeline(u.user).add(chirp))
    );
  }
  return chirp;
}));

/**
 * Fetches the timeline for a given user
 */
async function getTimeline(user) {
  let chirps = await timeline(user).read();
  chirps.sort((x, y) => y.time - x.time);
  return chirps;
}

/**
 * Gives the timeline for the current user
 */
server.get('/api/timeline', handle(async req => {
  return getTimeline(currentUser(req))
}));

/**
 * Gives the timeline for a specific user
 */
server.get('/api/timeline/:user', handle(async req => {
  let user = req.params.user;
  return getTimeline(user)
}));

// function to delete everything (for demos and debugging)
// e.g.: curl -d "" http://localhost:1337/api/clearChirps
server.post('/api/clearChirps', handle(async req => {
  async function clearUser(u) {
    let chirps = await timeline(u).read();
    return antidote.update([
      userSet.remove(u),
      timeline(u).removeAll(chirps)
    ]);
  }

  let users = await userSet.read(); 
  console.log(`Clearing users ${users}`);
  if (users.length > 0) {
      await Promise.all(users.map(u => clearUser(u)))
  }
  console.log(`Adding new users`);
  // add some users:
  await antidote.update(
    userSet.addAll([
      "Alice",
      "Bob",
      "Claudia",
      "Donald"
    ])
  );
  return "database cleared\n";
}));

/**
 * Register user to the server
 */
server.post('/api/register/', handleWithRes( async (req, res) => {
    let data = req.body
    let user = data.user;
    let password = data.password;
    let email = data.mail;
    let a_user = { 
      time: Date.now(),
      name: user,    
      email: email
    }
    try{
      // validation
      assertOrThrow(!user || !password || !email, 406, "Empty values" )

      // start transaction
      let tx = await antidote.startTransaction().catch(catchHandler(500, "startTransaction"))
      let u2p = await tx.map('user2pass')
      let storedPasswd = await u2p.register(user).read()
            .catch(catchHandler(500, "Failled to read stored password"))
      assertOrThrow(storedPasswd && storedPasswd!="", 406, "User already registered" )
      let u_set = await tx.set('users')
      await tx.update( u_set.add(a_user) ).catch(catchHandler(500,"update user set failled"))
      let users = await u_set.read().catch(catchHandler(500, "read user set failled"))
      let olderUsers = users.filter(s=>(s.user && a_user.user == s.user && s.time && a_user.time > s.time)) 
      assertOrThrow( olderUsers && olderUsers.length > 0 , 406, "This user was already registered")
      await tx.update( u2p.register(user).set(password) ).catch(catchHandler(500,"update"))
      await tx.commit().catch(catchHandler(500, "commit"))
      return res.status(201).send({user:user})
    }catch( e ){ return sendAndNotifyError(res,e)}
} ) )

/**
 * check if the credentials are corrected, if not, this fails
 */
server.post('/api/validCredentials/', handleWithRes(async (req, res) => {
  let credentials = req.body
  let user = credentials.user;
  let password = credentials.password;
  try{
    //validation 
    assertOrThrow(!user || !password, 401, "Empty credentials" )
    let readPass = await user2pass.register(user).read().catch(catchHandler(403,"User not found"))
    assertOrThrow( readPass != password , 403, "Invalid credentials" )
    return res.status(200).send({user:user})
  }catch( e ){ return sendAndNotifyError(res,e)}
}));


// ----- start server -----
http.createServer(server).listen(server.get('port'), function () {
  console.log("Express server listening on port " + server.get('port'));
})