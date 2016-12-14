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


let getAttribute = ( id, map, attribute ) => 
  map.map(id).read()
  .then( a_map => a_map.toJsObject() )
  .then( js_map => js_map[attribute] )

//-----
// Database Schema:
/**
 * user name has to be unique but because of distribution, an id will be used instead.
 * "users" map is a map that goes from user name to the set of identifier of user that have that user name. 
 * In specific moments it is possible to have two users with the same user name
 */
let user2ids = antidote.map("user2ids")
let id2users = antidote.map("id2users")
// the set of user is the set of key from the map user2ids
let getUserSet = () => user2ids.read().then( map => Object.keys( map.toJsObject() ) )
/**
 * map userId to an object that contains a map of usefull information about the user.
 *  userId -> {
 *              email : <register of email>
 *              password : <register of password>
 *              time : <register of time>
 *              writtenChirps : <set of written chirpIds>
 *              writtenReplays : <set of written replayIds to chirpIds>
 *              followers : <set of userIds of users that follow this user>
 *              followerCounter : <counter of followers that this user has>
 *              following : <set of userIds of users that are followed by this>
 *              timeline : <set of chirpIds that are pushed to this user timeline>
 *            }
 */ 
let usersMapName = "userId2userRecord"
let userId2userRecord = antidote.map(usersMapName)
// utility methods 
let getEmailRegisterOfUser = (userId, map=userId2userRecord) => map.map(userId).register('email');
let getPasswordRegisterOfUser = (userId, map=userId2userRecord) => map.map(userId).register('password');
let getTimeRegisterOfUser = (userId, map=userId2userRecord) => map.map(userId).register('time');
let getWrittenChirpsSetOfUser = (userId, map=userId2userRecord) => map.map(userId).set('writtenChirps');
let getWrittenReplaysSetOfUser = (userId, map=userId2userRecord) => map.map(userId).set('writtenReplays');
let getFollowersSetOfUser = (userId, map=userId2userRecord) => map.map(userId).set('followers');
let getFollowerCounterCounterOfUser = (userId, map=userId2userRecord) => map.map(userId).counter('followerCounter');
let getFollowingSetOfUser = (userId, map=userId2userRecord) => map.map(userId).set('following');
let getTimelineSetOfUser = (userId, map=userId2userRecord) => map.map(userId).set('timeline');

let readTimeline = (userId, map=userId2userRecord) => getAttribute(userId, map, "timeline" )
let readWritten = (userId, map=userId2userRecord) => getAttribute(userId, map, "writtenChirps" )
let readFollowers = (userId, map=userId2userRecord) => getAttribute(userId, map, "followers" )
let readFollowing = (userId, map=userId2userRecord) => getAttribute(userId, map, "following" )

// class style user
function User (userId, map=userId2userRecord) {
  return { 
    getEmail : () => getEmailRegisterOfUser(userId, map),
    getPassword : () => getPasswordRegisterOfUser(userId, map),
    getTime : () => getTimeRegisterOfUser(userId, map),
    getWrittenChirps : () => getWrittenChirpsSetOfUser(userId, map),
    getWrittenReplays : () => getWrittenReplaysSetOfUser(userId, map),
    getFollowers : () => getFollowersSetOfUser(userId, map),
    getFollowerCounter : () => getFollowerCounterCounterOfUser(userId, map),
    getFollowing : () => getFollowingSetOfUser(userId, map),
    getTimeline : () => getTimelineSetOfUser(userId, map)
  }
}

/**
 * chirpId -> {
 *              chirpId : <this id ( the key in the map)>
 *              userId : <register of userId of the writer user>
 *              body : <register of the body of the chirp>
 *              time : <register of the time when the chirp was added>
 *              replays : <set of replayIds>
 *            }
 */
let chirpsMapName = "chirpId2chirp"
let chirpId2chirp = antidote.map(chirpsMapName)
// utility methods
let getChirpIdRegisterOfChirp = (chirpId, map=chirpId2chirp) => map.map(chirpId).register('chirpId');
let getUserIdRegisterOfChirp = (chirpId, map=chirpId2chirp) => map.map(chirpId).register('userId');
let getBodyRegisterOfChirp = (chirpId, map=chirpId2chirp) => map.map(chirpId).register('body');
let getTimeRegisterOfChirp = (chirpId, map=chirpId2chirp) => map.map(chirpId).register('time');
let getReplaysSetOfChirp = (chirpId, map=chirpId2chirp) => map.map(chirpId).set('repelays');
// class style chirp
function Chirp (chirpId, map=chirpId2chirp) {
  return {
    getChirpId : () => getChirpIdRegisterOfChirp(chirpId, map),    
    getUserId : () => getUserIdRegisterOfChirp(chirpId, map),
    getBody : () => getBodyRegisterOfChirp(chirpId, map),
    getTime : () => getTimeRegisterOfChirp(chirpId, map),
    getReplays : () => getReplaysSetOfChirp(chirpId, map)
  }
}

let readReplays = (chirpId, map=chirpId2chirp) => getAttribute(chirpId, map, "repelays" )


/**
 * replayId -> {
 *                replayId: <this id ( the key in the map)>
 *                userId : <register of userId of the writer user>
 *                chirpId : <register of chirpId which the replays is directed to>
 *                time : <register of the time when the replay was added>
 *                body : <register of the body of the chirp>
 *             }
 */
let replaysMapName = "replayId2replay"
let replayId2replay = antidote.map(replaysMapName)
// utility methods
let getReplayIdRegisterOfReplay = (replayId, map=replayId2replay) => map.map(replayId).register('replayId');
let getUserIdRegisterOfReplay = (replayId, map=replayId2replay) => map.map(replayId).register('userId');
let getChirpIdOfReplay = (replayId, map=replayId2replay) => map.map(replayId).register('chirpId');
let getBodyRegisterOfReplay = (replayId, map=replayId2replay) => map.map(replayId).register('body');
let getTimeRegisterOfReplay = (replayId, map=replayId2replay) => map.map(replayId).register('time');
// class style chirp
function Replay (replayId, map=replayId2replay) {
  return {
    getReplayId : () => getReplayIdRegisterOfReplay(replayId, map),
    getUserId : () => getUserIdRegisterOfReplay(replayId, map),
    getChirpId : () => getChirpIdOfReplay(replayId, map),
    getTime : () => getTimeRegisterOfReplay(replayId, map),
    getBody : () => getBodyRegisterOfReplay(replayId, map)
  }
}

/**
 * utility values 
 */
// limitOfFollowersForPushing indicates the maximun number of followers for a user for having this to push the chirps
let limitOfFollowersForPushing = 2;
/**
 * Function to manage the database
 */
// returns just a generated id
function createId(prefix){
  return prefix + "$" + (Date.now()) + "$" + (Math.random().toString(16))
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// register a user. returns the userId or throw an exception 
function registerUser ( user, password, email ){
  if ( !user || !password || !email ) throw "At leat one of the field is invalid"
  return user2ids.set( user ).read()
    .then( idset => {
      if ( idset && idset.length && idset.length >= 1 ) 
        throw "User already in use";
      else return antidote.startTransaction();
    })
    .then( tx => {
      let userId = createId("user")
      let userObj = User(userId, tx.map(usersMapName))      
      return tx.update( [ 
        tx.map("user2ids").set(user).add(userId),
        tx.map("id2users").set(userId).add(user),
        userObj.getPassword().set(password),
        userObj.getEmail().set(email),
        userObj.getTime().set( Date.now() ),
        userObj.getFollowers().add( userId ),
        userObj.getFollowing().add( userId ),
        userObj.getFollowerCounter().increment(1)
      ] )
      .then( _ => tx.commit() )
      .then ( _ => userId )
      .catch( e => { tx.commit(); throw e;})
    })
    .catch ( e => { console.error("Error with the registration " + e ); throw e; } )
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// insert a chirp in the database and returns the chirpId
function createChirp ( userId, body ){
  if ( ! body ) throw "empty body"
  return antidote.startTransaction()
    .then( tx => {
      let chirpId = createId("chirp")
      let chirpObj = Chirp( chirpId, tx.map(chirpsMapName) )
      return tx.update( [
        getWrittenChirpsSetOfUser(userId, tx.map(usersMapName)).add(chirpId),
        chirpObj.getChirpId().set(chirpId),
        chirpObj.getUserId().set(userId),
        chirpObj.getBody().set(body),
        chirpObj.getTime().set(Date.now())
      ] )
      .then( _ => tx.commit() )
      .then ( _ => chirpId )
      .catch( e => { tx.commit(); console.error("Error updating the transaction during chirp creation"); throw e;})      
    })
    .catch ( e => { console.error("Error with the chirp creation " + e ); throw e; } )
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// insert a replay in the database and returns the replayId
function createReplay ( userId, chirpId, body ){
  if ( ! body ) throw "empty body"
  return antidote.startTransaction()
    .then( tx => {
      let replayId = createId("replay")
      let replayObj = Replay( replayId, tx.map(replaysMapName) )
      return tx.update( [
        replayObj.getReplayId().set(replayId),
        replayObj.getUserId().set(userId),
        replayObj.getChirpId().set(chirpId),
        replayObj.getBody().set(body),
        replayObj.getTime().set(Date.now()),
        getWrittenReplaysSetOfUser(userId, tx.map(usersMapName)).add(replayId),
        getReplaysSetOfChirp(chirpId, tx.map(chirpsMapName)).add(replayId),
      ] )
      .then( _ => tx.commit() )
      .then ( _ => replayId )
      .catch( e => { tx.commit(); console.error("Error updating the transaction during replay creation"); throw e;})      
    })
    .catch ( e => { console.error("Error with the replay creation " + e ); throw e; } )
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * 
 * 
 * 
 * Utilitis functions:
 * 
 * 
 * 
 */
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * Validate an id ( this means, that it checks if the id is actually present in the db)
 */
async function validateId(id){
  if ( id.indexOf("user")==0 ) 
    return id2users.set(id).read()
        .then(set =>{ 
          if(set && set.length && set.length > 0) return id; 
          else throw "Invalid user id "+id+" ( got "+set+" )"; 
        })
  if ( id.indexOf("chirp")==0 ) 
    return chirpId2chirp.map(id).read()
        .then(map =>{ 
          if(map) return id; 
          else throw "Invalid chirp id "+id; 
        })
  if ( id.indexOf("replay")==0 ) 
    return replayId2replay.map(id).read()
        .then(map =>{ 
          if(map) return id; 
          else throw "Invalid replay id "+id; 
        })
  throw "Invalid id "+id;
}
/**
 * Function to dispatch a chirpId to the followers of a userId
 */
async function dispatchChirpId ( chirpId, userId ){
  if ( true ) // pushing
    return getFollowersSetOfUser( userId ).read()
      .then( set => antidote.update( 
          set.map( e => getTimelineSetOfUser(e).add(chirpId) )
      ))
}
/**
 * in the request has to be present an authorization object of the type 
 *    { 
 *      user : <user name of string>
 *      password: <password of string>
 *      userId : <userId of string>
 *    }
 */
function currentUser(request) {
  if ( !request.headers.authorization.startsWith("Basic ")) throw "Authorization un-readable"
  let based64 = request.headers.authorization.replace("Basic ","")
  let credentials = JSON.parse(new Buffer(based64,'base64').toString('ascii'))
  if (!credentials || credentials == {}) throw "Empty authorization"
  if (!credentials.user||!credentials.password||!credentials.userId) throw "Authorization badly formmated"
  let user = credentials.user;
  let password = credentials.password;
  let userId = credentials.userId;
  console.log("Verifing credentials "+JSON.stringify(credentials))
  return id2users.set(userId).read()
    .then( set => {
      if( ! set || set.length == 0) throw "UserId unknown"
      if(set.indexOf(user) == -1) throw "UserId Unmatching with the user name"
      return getPasswordRegisterOfUser(userId).read()
    })
    .then( readPassword => {
      if ( password != readPassword) throw "Invalid password"
      return userId
    })
    .catch(e => {throw "Unable to authentify user "+user+":"+userId;} )
}

/**
 * tells if the user is following and it is followed by the params
 * The outcome is an object 
 * { 
 *      it_is_followed_by_me: <true iff arg2 is following arg1> 
 *      it_is_following_me: <true iff arg1 is following arg2>
 *  }
 */
async function getRelation( userIdFollowed, mineId ){
  console.log("reading relation between "+userIdFollowed+" and me "+ mineId)
  let f_ers = await readFollowers( userIdFollowed )
  let f_ing = await readFollowing( mineId )
  return {
        it_is_followed_by_me: f_ers.indexOf(mineId) != -1, 
        it_is_following_me: f_ing.indexOf(userIdFollowed) != -1
    }
}
/**
 * This function add the relation userIdFollowing is following userIdFollowed
 */
function addRelalation( userIdFollowed, userIdFollowing ){
  return antidote.update([
    getFollowersSetOfUser(userIdFollowed).add(userIdFollowing),
    getFollowerCounterCounterOfUser(userIdFollowed).increment(1),
    getFollowingSetOfUser(userIdFollowing).add(userIdFollowed),
  ]).then(_ =>console.log("Relation updated (added)"))
}
/**
 * This function remove the relation userIdFollowing is following userIdFollowed
 */
function removeRelalation( userIdFollowed, userIdFollowing ){
  return getFollowersSetOfUser(userIdFollowed).read()
    .then( fs => 
      (fs.indexOf(userIdFollowing) == -1) ? 
      console.log("removing relation between "+userIdFollowed+" and "+userIdFollowing+" that does not exists"):
      (antidote.update([
        getFollowersSetOfUser(userIdFollowed).remove(userIdFollowing),
        getFollowerCounterCounterOfUser(userIdFollowed).increment(-1),
        getFollowingSetOfUser(userIdFollowing).remove(userIdFollowed),
      ]).then(_=> console.log("Relation updated (deleted)")))
    )
}

// helper to have a batch reading from antidote. It gets a map Key->antodoteObject and returns a map Key -> result.
async function antidoteReadBatch( arr ){
  // return antidote.readBatch( arr )
  // JUST FOR DEBUG
  let ret = []
  for ( var i in arr ){
    let val = await arr[i].read()
    ret.push( val )
  }
  return ret
}
function readBatch( map ){
  let index2property = []
  return antidote
      .readBatch( 
        Object.keys(map).map( (k, i) => {
          index2property[i] = k;
          return map[k];
        } )
      ).then( reads =>{
          let ret = [];
          reads.map( (v,i) => { ret[index2property[i]] = v; })
          return ret;
        })
}
/**
 * this function read batchly all the chirpId present in the arg set
 * returns a set of chirp of the type 
 * {
 *  userId : <....>
 *  time : <....>
 *  body: <....>
 * }
 */
function getSortedChirpSetFromChirpIdSet( chirpIds ){
  return (!chirpIds || chirpIds.length == 0) ? [] :
    antidoteReadBatch(
      mirror("sent to read batch", chirpIds).map( id => chirpId2chirp.map(id) )
    )
    .then( reps => reps.map(e => e.toJsObject()) )
    .then( reps => {reps.sort((x, y) => y.time - x.time); return reps})
}


// helper function for async handlers:
function handle(handler) {
  return (req, res, next) => {
    handler(req)
      .then(r => res.send(r))
      .catch( next )
  };
}
function handleWithAuth(handler) {
  return (req, res, next) => 
      currentUser(req)
        .then( userId => handle((req) => handler(req, userId))(req,res,next) )
        .catch( e => {
          console.error("Error authentifing "+e)
          res.status(400)
          return res.send(e)
        })
}
function mirror( txt, obj ){
  console.log(txt+" "+CircularJSON.stringify(obj))
  return obj
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * 
 * 
 * 
 * DEMO SET UP:
 * 
 * 
 * 
 */
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// creates 4 fake users
function insertDummyUsers (){
  return registerUser("Alice", "p_alice", "alice@here.com")
    .then ( _=> registerUser("Bob", "p_bob", "bob@here.com") )
    .then ( _=> registerUser("Claudia", "p_claudia", "claudia@here.com") )
    .then ( _=> registerUser("Donald", "passwd", "donald@here.com") )
    .then ( _=> console.log("Insterted entry Alice, Bob, Claudia, Donald") )
    .catch(e => console.error( "Could not insert the users: "+ (e.stack?e.stack:JSON.stringify(e)) ) )
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// print all the inserted values in the db
async function dumpDB() {
  console.log("-- dump of db --")
  let db = { 
      user2ids: user2ids, 
      id2users: id2users,
      userId2userRecord: userId2userRecord,
      chirpId2chirp: chirpId2chirp,
      replayId2replay: replayId2replay
    }
  return Promise.all( Object.keys( db ).map( key =>   
    (db[key]).read().then( map => map.toJsObject() )
      .then( map => {
              console.log( ">> " + key + ": " )
              for ( var v in map )
                console.log( "\t"+v+": "+JSON.stringify(map[v]) )
      })
  )).then( _=> console.log("-- end of dump --") )
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// clear the db
function clearDB() {
  console.log("-- Clearing db --")
  let db = { 
      user2ids: user2ids,
      id2users: id2users,
      userId2userRecord: userId2userRecord,
      chirpId2chirp: chirpId2chirp,
      replayId2replay: replayId2replay
    }
  return Promise.all( Object.keys( db ).map( key =>   
    (db[key]).read()
      .then( map => Object.keys(map.toJsObject()) )
      .then( keys => keys.map( k => (db[key])[(key=='user2ids'||key=='id2users')?'set':'map'](k) ) )
      .then( maps => maps.map( s => (db[key]).remove(s) ) )
      .then( removing => antidote.update( removing ) )
      .then( toBeWaited => { console.log("...map "+key+" cleared"); return toBeWaited; } )
      .catch( e => console.error(e) )
  )).then( _ => { console.log("-- end of clearing --"); return dumpDB(); } )
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * 
 * 
 * 
 * Conflict resolution
 * 
 * 
 * 
 */
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * function called when a user try to log in 
 */
function resolveConflict(){

}




















// insert dummy user
//insertDummyUsers()
//.then( _=> dumpDB() )
clearDB()
.then( _ => insertDummyUsers() )
.then( _ => dumpDB() ) // */
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * 
 * 
 * 
 * APP
 * 
 * 
 * 
 */
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
server.get('/', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get('/login', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get('/search/', function (req, res, next) {
  res.sendfile('public/index.html');
});
server.get('/search', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get('/replays/*', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get('/timeline', function (req, res, next) {
  res.sendfile('public/index.html');
});

server.get(/^\/(timeline)\/.*/, function (req, res, next) {
  res.sendfile('public/index.html');
});

//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * 
 * 
 * 
 * API
 * 
 * 
 * 
 */
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
/**
 * Gives a list of all user-names in the system
 */
server.get('/api/users', handle(async req => {
  return await getUserSet()
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
 * returns the chirp
 */
server.post('/api/chirps', handleWithAuth(async (req, userId) => 
  await createChirp( userId, req.body )
    .then( chirpId => 
      dispatchChirpId(chirpId, userId)
      .then( _ => chirpId2chirp.map(chirpId).read() )
      .then( map => map.toJsObject() ) 
    )
));

/**
 * returns the chirp with the format:
 *  { 
 *    body: <the body provided with post>
 *    time: <the time when the chirp was inserted>
 *    userId: <id of the creator of the chirp>
 *  }
 */
server.get('/api/chirp/:chirpId', handle( async req => 
  await validateId(req.params.chirpId)
    .then( id => chirpId2chirp.map(id).read() )
    .then( map => map.toJsObject() )
))
// function to delete everything (for demos and debugging)
// e.g.: curl -d "" http://localhost:1337/api/clearChirps
server.post('/api/clearChirps', handle(async req => 
  clearDB()
    .then( _ => insertDummyUsers() )
    .then( _ => dumpDB() )
));
/**
 * search user
 */
server.get('/api/search/:key', handle(async req => {
  let key = req.params.key.toLowerCase();
  return await getUserSet()
    .then( values => 
          values.filter( user=> 
                user.toLowerCase().search(key) != -1 
          )
    )
}));
/**
 * given a chirpId, returns a list of replays.
 * each replay has the format
 *    {
*        userId: <...>
 *       chirpId: <...>
 *       time: <...>
 *       body: <...> 
 *    }
 */
server.get('/api/replays/:chirpId', handle( async (req) => 
    await validateId(req.params.chirpId)
      .then( id => readReplays(id) )
      .then( replayIds => replayIds) 
      .then( replayIds => 
        ( !replayIds || replayIds.length == 0 ) ?
          [] : (
            antidoteReadBatch( replayIds.map( e => replayId2replay.map(e) ) )
            .then( maps => maps.map( e => e.toJsObject()) )
            .then( replays => {
              replays.sort((x, y) => x.time - y.time)
              return replays
            })
          )
      )
))
/**
 * Insert a replay to a chirp whose chirpId is passed through the get params.
 * The user id is provided by authentication
 * the replay body is the request body.
 */
server.post('/api/replays/:chirpId', handleWithAuth( async (req,userId) => 
    await validateId(req.params.chirpId)
      .then( id => createReplay(userId, id, req.body ) )
      .then( id => replayId2replay.map(id).read() )
      .then( map => map.toJsObject() )
))
/**
 * Register user to the server
 */
server.post('/api/register/', handle( async req => 
  registerUser( data.user, data.password, data.mail )
    .then( userId => ({userId:userId}) )
) )
/** 
 * returns a description of the relation between:
 * the user authenticated (me)
 * and the userId provided as a paramater.
 * The replay is an object of type
 *  { 
 *      it_is_followed_by_me: <true iff arg2 is following arg1> 
 *      it_is_following_me: <true iff arg1 is following arg2>
 *  }
 * 
 */
server.get('/api/relation/:userId', handleWithAuth(async (req, mineId) => 
  await validateId(req.params.userId)
    .then( id => getRelation( id, mineId ) )
));
/**
 * Manages the follower of a user 
 */
server.put('/api/followers/:userId', handleWithAuth(async (req, mineId) => 
  await validateId(req.params.userId)
    .then( id => addRelalation( id, mineId ).then( _ => getRelation(id)) )
));
server.delete('/api/followers/:userId', handleWithAuth(async (req, mineId) => 
  await validateId(req.params.userId)
    .then( id => removeRelalation( id, mineId ).then( _ => getRelation(id)) )
));
/**
 * Gives the timeline for the current user
 */
server.get('/api/timeline', handleWithAuth(async (req, userId) => 
  await readTimeline(userId)
    .then( chirpIds => getSortedChirpSetFromChirpIdSet( chirpIds ) )
));
/**
 * Gives the timeline for a specific user
 */
server.get('/api/timeline/:userId', handle(async req => 
  await validateId(req.params.userId)
    .then( id => readWritten(id) )
    .then( chirpIds => getSortedChirpSetFromChirpIdSet( chirpIds ) )
));
/**
 * check if the credentials are corrected, if not, this fails
 */
server.post('/api/login/', handle(async req => {
  let user = req.body.user
  let password = req.body.password
  let idSet = await user2ids.set(user).read()
  if ( ! idSet || idSet.length==0 ) throw "User unknown";
  else if ( idSet.length == 1 ) {
    let userId = idSet[0]
    return await getPasswordRegisterOfUser( userId ).read()
      .then( p => { 
          if (p==password) return ({userId:userId}) 
          else throw "Unmatching password"
      })
  } else return ({duplicatedUser:true})
}));
/**
 * returns the id associated with the user name provided as a param.
 * if the user is multiplied, the older one will be returned
 */
server.get('/api/userId/:userName', handle( async req => 
  user2ids.set( req.params.userName ).read()
    .then( idSet => {
      if ( ! idSet || idSet.length == 0 ) throw "Unknow user name"
      else if ( idSet.length > 1 ) idSet.sort( (x,y) => x.localeCompare(y)) 
      return idSet[0]
    })
))

// ----- start server -----
http.createServer(server).listen(server.get('port'), function () {
  console.log("Express server listening on port " + server.get('port'));
})