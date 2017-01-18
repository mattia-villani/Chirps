"use strict"

let express = require('express');
let http = require('http');
let path = require('path');
let antidoteClient = require( 'antidote_ts_client');
let errorhandler = require('errorhandler');
let morgan = require('morgan');
let bodyParser = require('body-parser');
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

let justThrow = e => { throw e }


//-----
// Database Schema:
/**
 * user name has to be unique but because of distribution, an id will be used instead.
 * "users" map is a map that goes from user name to the set of identifier of user that have that user name. 
 * In specific moments it is possible to have two users with the same user name
 *//**
 * map userId to an object that contains a map of usefull information about the user.
 *  userId -> {
 *              email : <register of email>
 *              password : <register of password>
 *              time : <register of time>
 *              writtenChirps : <set of written chirpIds>
 *              writtenReplays : <set of written replayIds to chirpIds>
 *              followers : <set of userIds of users that follow this user>
 *              following : <set of userIds of users that are followed by this>
 *              timeline : <set of chirpIds that are pushed to this user timeline>
 *            }
 *//**
 * chirpId -> {
 *              chirpId : <this id ( the key in the map)>
 *              userId : <register of userId of the writer user>
 *              body : <register of the body of the chirp>
 *              time : <register of the time when the chirp was added>
 *              replays : <set of replayIds>
 *            }
 *//**
 * replayId -> {
 *                replayId: <this id ( the key in the map)>
 *                userId : <register of userId of the writer user>
 *                chirpId : <register of chirpId which the replays is directed to>
 *                time : <register of the time when the replay was added>
 *                body : <register of the body of the chirp>
 *             }
 */

let dbSchema = {
  name2ids: [
          ["ids",               "set"],
        ],
  id2names: [
          ["names",             "set"],
        ],
  user : [
          ["email",             "register"],
          ["password",          "register"],
          ["time",              "register"],
          ["writtenChirps",     "set"],
          ["writtenReplays",    "set"],
          ["followers",         "set"], // following this
          ["following",         "set"], // the ones this is following
          ["timeline",          "set"],
          ["chirpIdToBePulled", "set"],
          ["chirpIdPushed",     "set"],
          ["lastPullableChirp", "register"],
          ["lastPushedChirp",   "register"],
        ],
  chirp : [
          ["chirpId",           "register"],
          ["userId",            "register"],
          ["body",              "register"],
          ["time",              "register"],
          ["replays",           "set"],
        ],
  replay : [
          ["replayId",          "register"],
          ["userId",            "register"],
          ["chirpId",           "register"],
          ["time",              "register"],
          ["body",              "register"],
        ],
  id2Ids : [ // the map's key for the pair (u,v) an the attribute att (not set), is u$$v
          ["mergedTo",          "register"], // this means that the key was merged to the content value
          ["lastPull",          "register"], // (u,v)'last pull is the time when v has pulled for the last time u 
          ["lastPush",          "register"], // (u,v)'last pull is the time when u has pushed for the last time to v
          ["followingFrom",     "register"], // (u,v)'last pull is the time when u was followed by v
  ]
}

function getCombinedId( idA, idB ) { return idA+"$$"+idB }

let dbTableIds = [];
let dbMaps = [];
function db_id( schemaEntity, attributeName, type ){
  return schemaEntity+"_"+attributeName+"_"+type
}
// generating the maps and the ids.
(() => {
  for ( var k in dbSchema ){
    let arr = dbSchema[k]
    for ( var i in arr ){
      let dbId = db_id( k , arr[i][0], arr[i][1] )
      dbTableIds.push( dbId )
      dbMaps[dbId] = antidote.map(dbId)
    }
  }
  console.log("The db will contain the following ids ")
  for ( var i in dbTableIds )
    console.log("\t"+dbTableIds[i])
})()

function getCrdtMap( schemaEntity, attributeName, type, tx=undefined ){
  let id = db_id( schemaEntity, attributeName, type )
  if ( dbTableIds.indexOf(id) == -1 ) throw "Invalid db id "+id
  else return tx ? tx.map(id) : dbMaps[id]
}

function getObject( identifier, entity, tx=undefined ){
  let fields = dbSchema[entity]
  var obj = {}
  for ( var i in fields )
    obj[fields[i][0]] = getCrdtMap(entity, fields[i][0],fields[i][1],tx)[fields[i][1]](identifier)
  /*console.log("Object "+identifier+" of "+entity+" { ")
  for ( var att in obj )
    console.log("\t\t"+att+": "+Object.keys(obj[att]))
  console.log("\t}") */
  return obj; 
}

async function readEntity( identifier, entity, tx=undefined ){
  let obj = getObject(identifier, entity, tx)
  var ret = {}
  try{
    for ( var i in obj )  
      ret[i] = await obj[i].read()
  }catch( e ){ 
    throw mirror("error reading entity:",e)
  }
  return ret
}

function getUser2ids ( tx = undefined ){ return getCrdtMap( "name2ids", "ids", "set",tx ); }
function getId2users ( tx = undefined ){ return getCrdtMap( "id2names", "names", "set",tx ); }
let user2ids = getUser2ids()
let id2users = getId2users()

function getUserSet() { 
  return user2ids.read()
    .then( crdt => crdt.toJsObject() )
    .then( js => Object.keys(js) )
}

/**
 * properties = array of  [ <entity>, <attribute>, <type> ]
 */
function readPropertiesFromIds( ids, properties, tx=undefined ){  
  return antidoteReadBatch( 
      properties.map( (e,i) => {
        console.log(" --- --- --- read << CrdtMap "+e[0]+"."+e[1]+"."+e[2]+"("+ids[i]+")")
        return getCrdtMap(e[0], e[1], e[2], tx)[e[2]](ids[i]) 
      })
    ).then( vals => {
      console.log("Reading properties ids.length=("+ids.length+"), properties.length=("+properties.length+"):")
      ids.map( (id,i) => console.log("\t\tProperty("+properties[i]+")("+id+")  :=  "+vals[i])) 
      return vals;
    })
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
  console.log("registring "+user+", "+password+", "+email)
  return user2ids.set(user).read()
    .then( idset => {
 ///*
      if ( idset && idset.length && idset.length >= 1 ) 
        throw "User already in use";
      else // */ 
        return antidote.startTransaction();
    })
    .then( tx => {
      let userId = createId("user")
      let userObj = getObject(userId, "user", tx)      
      let time = Date.now()
      return tx.update( [ 
        getUser2ids(tx).set(user).add(userId),
        getId2users(tx).set(userId).add(user),
        userObj.password.set(password),
        userObj.email.set(email),
        userObj.time.set( time ),
        userObj.followers.add( userId ),
        userObj.following.add( userId ),
        userObj.lastPullableChirp.set( time ),
        userObj.lastPushedChirp.set( time ),
      ].concat( 
          getAddRelationUpdate( userId, userId, getCombinedId(userId,userId), time ) 
      ))
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
      let chirpObj = getObject( chirpId, "chirp", tx )
      return tx.update( [
        getObject( userId, "user", tx ).writtenChirps.add(chirpId),
        chirpObj.chirpId.set(chirpId),
        chirpObj.userId.set(userId),
        chirpObj.body.set(body),
        chirpObj.time.set(Date.now())
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
      let replayObj = getObject( replayId, 'replay', tx )
      return tx.update( [
        replayObj.replayId.set(replayId),
        replayObj.userId.set(userId),
        replayObj.chirpId.set(chirpId),
        replayObj.body.set(body),
        replayObj.time.set(Date.now()),
        getObject( userId, "user", tx ).writtenReplays.add(replayId),
        getObject( chirpId, "chirp", tx ).replays.add(replayId)
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
  let entities = ['user','chirp','replay'];
  for ( var i in entities )
    if ( id.indexOf(entities[i]) == 0 )
      return getObject( id, entities[i] ).time.read()
        .then( time => {
          if ( time && time > 0 )
            return id;
          else throw "Invalid "+entities[i]+" id "+id
        })
        .then( resolveId )
  throw "Invalid id "+id;
}
/**
 * Function to dispatch a chirpId to the followers of a userId
 */
async function dispatchChirpId ( chirpId, userId ){
  console.log("/// /// DISTPATCHING \\\\\\ \\\\\\");
  userId = await resolveId( userId ).catch(justThrow)
  let tx = await antidote.startTransaction().catch(justThrow)
  
  let user = getObject( userId, "user", tx )
  let followers = await user.followers.read().then( us => resolveIds(us, tx)).catch(justThrow)

  let chirpTime = await getObject(chirpId, "chirp", tx).time.read().catch(justThrow)

  let pull = //Math.floor((Math.random() * 10) + 1)% 2 == 0;
    followers && followers.length && limitOfFollowersForPushing < followers.length

  let promis;
  if ( !pull ){
    console.log( "||| -- pushing -- "); 
    console.log( "||| \t lastPullableChirp "+chirpTime ); 
    console.log( "||| \t chirpIdPushed "+chirpId );  
    console.log( "||| \t Followers "+followers );
    console.log( "||| \t LastPush updated at "+chirpTime+" for "+ followers.map( e => getCombinedId(userId,e) ) );     
    promis = tx.update( // pushing
      followers.map( e => getObject( e, "user", tx ).timeline.add(chirpId) )
      .concat( followers.map( e => getObject( getCombinedId(userId,e), "id2Ids", tx ).lastPush.set(chirpTime) ) )
      .concat( [ user.chirpIdPushed.add(chirpId) ] )
      .concat( [ user.lastPushedChirp.set( chirpTime ) ] )
    )
  }else{
    console.log( "||| -- pulling -- "); 
    console.log( "||| \t lastPullableChirp "+chirpTime ); 
    console.log( "||| \t chirpIdToBePulled "+chirpId ); 
    promis = tx.update([ 
        user.lastPullableChirp.set(chirpTime),
        user.chirpIdToBePulled.add(chirpId),
      ]);
  }
  console.log("\\\\\\ \\\\\\ DISTPATCHED /// ///");
  return promis.then( _ => tx.commit() ).catch(justThrow)
}
/**
 * Collects the chirps from the list of chirp of the followed user 
 */
async function collect( userId_ToBeVerified ){
  console.log("collecting chirps for user "+userId_ToBeVerified)
  let chirpIdToBePulledProp = ['user','chirpIdToBePulled','set']
  let chirpIdPushedProp = ['user','chirpIdPushed','set']
  let lastPullableProp = ['user','lastPullableChirp','register']
  let lastPushedProp = ['user','lastPushedChirp','register']
  let lastPullProp = ['id2Ids','lastPull','register']
  let lastPushProp = ['id2Ids','lastPush','register']
  let followingFrom = ['id2Ids','followingFrom','register']
 
  let collectFrom = async ( tx, userId, followedId, lastTime, followingFromTime, chirpId_prop, last_prop ) => {
    console.log("COLLECTING CHIRPS:"
      +"\n\tUserId "+ userId
      +"\n\tFollowedId "+followedId
      +"\n\tLastTime "+lastTime
      +"\n\tFollowingFromTime "+followingFromTime
      +"\n\tChirpId(toBePulled|pushed)Prop "+chirpId_prop
      +"\n\tLast(Pull|Push)Prop "+last_prop+"\n\t....")
    let cIds = await getCrdtMap( chirpId_prop[0], chirpId_prop[1], chirpId_prop[2], tx )[chirpId_prop[2]](followedId).read()
    cIds = cIds ? cIds : [];
    console.log("\tQueried chirp ids "+cIds);
    let chirpTimes =await readPropertiesFromIds(cIds, cIds.map( i => ['chirp','time','register']), tx )
    console.log("\tQueried chirp's times "+chirpTimes);
    let composed = getCombinedId( followedId, userId )
    console.log("\tComposed Id "+composed);
    let maxTime = chirpTimes.reduce( (t1, t2) => t1>t2 ? t1: t2, lastTime )
    console.log("\tRecentest time "+maxTime);
    let newIds = cIds.filter( (id,i) => chirpTimes[i] > followingFromTime)
    console.log("\tFiltered ids "+newIds);
    let timelineCrdt = getObject( userId, "user", tx ).timeline;
    return tx.update(
       newIds.map( i => timelineCrdt.add(i) )
       .concat( [ 
                 getCrdtMap( last_prop[0], last_prop[1], last_prop[2], tx )[last_prop[2]](composed).set(maxTime) 
          ] )
      ).then( _ => newIds )
      .catch( e => { console.error("Error collecting chirps "+e); return []; });
  }

  return resolveId( userId_ToBeVerified )
  .then( userId => 
    antidote.startTransaction()
    .then( tx => getObject( userId, "user", tx ).following.read()
      .then( us => resolveIds(us, tx))
      .then( following => {
        let collectFromPull = ( followedId, lastTime, followingFromTime) => 
          collectFrom( tx, userId, followedId, lastTime, followingFromTime, chirpIdToBePulledProp, lastPullProp)
        let collectFromPush = ( followedId, lastTime, followingFromTime) => 
          collectFrom( tx, userId, followedId, lastTime, followingFromTime, chirpIdPushedProp, lastPushProp)

        let composed = following.map( u => getCombinedId(u,userId) )
        console.log("IDS>> following ids:"+following)    
        return readPropertiesFromIds(
          following.concat(following).concat(composed).concat(composed).concat(composed),
          following.map( e => lastPullableProp )
          .concat( following.map( e => lastPushedProp ) )
          .concat( composed.map( e => lastPullProp ) )
          .concat( composed.map( e => lastPushProp ) )
          .concat( composed.map( e => followingFrom) )
          ,tx)
        .then( props => {
          console.log("Read props :"+props)

          let chirpPromises = []
          let n = following.length
          let d = 5
          for ( var i = 0 ; i<n; i++ ){
            let followedId = following[i]
            let lastPullable = props[i] 
            let lastPushed = props[i+n] 
            let lastPull = props[i+n*2]
            let lastPush = props[i+n*3]
            let followingFromTime = props[i+n*4]

            if ( lastPullable != lastPull ) 
              chirpPromises=chirpPromises.concat(collectFromPull(followedId, lastPull, followingFromTime))
            if ( lastPushed  != lastPush ) 
              chirpPromises=chirpPromises.concat(collectFromPush(followedId, lastPush, followingFromTime))
          }
          return Promise.all(chirpPromises)
        })
    })
    .then( chirps => { tx.commit(); return chirps; } )
  ))
  .catch(justThrow)
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
  console.log("Verifing credentials "+JSON.stringify(credentials))
  return resolveId( credentials.userId ).then( userId => 
    id2users.set(userId).read()
      .then( set => {
        if( ! set || set.length == 0) throw "UserId unknown"
        if(set.indexOf(user) == -1) throw "UserId Unmatching with the user name"
        return getObject( userId, "user" ).password.read()
      })
      .then( readPassword => {
        if ( password != readPassword) throw "Invalid password"
        return userId
      })
  )
  .catch(e => {throw "Unable to authentify user "+user+":"+userId+" ("+e+")";} )
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
  let f_ers = await resolveIds( await getObject( userIdFollowed, "user" ).followers.read())
  let f_ing = await resolveIds( await getObject( mineId, "user" ).followers.read())
  return (el => {
    console.log("The relation is "+ JSON.stringify(el));
    return el;
  })({
        it_is_followed_by_me: f_ers.indexOf(mineId) != -1, 
        it_is_following_me: f_ing.indexOf(userIdFollowed) != -1
    });
}
/**
 * This function add the relation userIdFollowing is following userIdFollowed
 */
function getAddRelationUpdate( userIdFollowed, userIdFollowing, id2id, time ){
  return [
    getObject( userIdFollowed, "user" ).followers.add(userIdFollowing),
    getObject( userIdFollowing, "user" ).following.add(userIdFollowed),
    getObject( id2id, "id2Ids" ).lastPull.set(time),
    getObject( id2id, "id2Ids" ).lastPush.set(time),
    getObject( id2id, "id2Ids" ).followingFrom.set(time),
  ];
}
function addRelalation( userIdFollowed, userIdFollowing ){
  console.log("Adding relation "+userIdFollowing+" following "+userIdFollowed)
  let time = Date.now()
  let id2id = getCombinedId( userIdFollowed, userIdFollowing )
  return antidote.update(
    getAddRelationUpdate( userIdFollowed, userIdFollowing, id2id, time )
  ).then(_ =>console.log("Relation updated (added)"))
}
/**
 * This function remove the relation userIdFollowing is following userIdFollowed
 */
function removeRelalation( userIdFollowed, userIdFollowing ){
  let id2id = getCombinedId( userIdFollowed, userIdFollowing )
  return getObject(userIdFollowed,"user").followers.read()
    .then( fs => 
      (fs.indexOf(userIdFollowing) == -1) ? 
      console.log("removing relation between "+userIdFollowed+" and "+userIdFollowing+" that does not exists"):
      (antidote.update([
        getObject( userIdFollowed, "user" ).followers.remove(userIdFollowing),
        getObject( userIdFollowing, "user" ).following.remove(userIdFollowed),
        getObject( id2id, "id2Ids" ).lastPull.set(undefined),
        getObject( id2id, "id2Ids" ).lastPush.set(undefined),
      ]).then(_=> console.log("Relation updated (deleted)")))
    )
}

// helper to have a batch reading from antidote. It gets a map Key->antodoteObject and returns a map Key -> result.
function antidoteReadBatch( arr ){
   return antidote.readBatch( arr )
  // JUST FOR DEBUG
  //return Promise.all(arr.map( (obj) => obj.read() ))
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
async function getSortedChirpSetFromChirpIdSet( chirpIds ){
  if (!chirpIds || chirpIds.length == 0) return [];
  var chirps = []
  for ( var i in chirpIds )
    chirps.push( await readEntity(chirpIds[i],"chirp") )
  chirps.sort((x, y) => y.time - x.time)
  return chirps;
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
  var string;
  var str = "-- dump of db --";
  console.log( str ) 
  string = str
  let maps = dbMaps ;
  for ( var mapId in maps )
    await maps[mapId].read()
      .then( crdt_map => crdt_map.toJsObject() )
      .then( map => {
        str = ">> "+mapId+": "
        console.log(str)
        string += "<br/>"+str 
        for ( var v in map ){
           str = "\t"+v+": "+JSON.stringify(map[v]) 
           console.log(str)
           string += "<br/>"+str 
        }
      })
  str = "-- end of dump --" 
  console.log(str)
  string += "<br/>"+str 
  return string
}
//------------------------------------------------------------------
//------------------------------------------------------------------
//------------------------------------------------------------------
// clear the db
async function clearDB() {
  console.log("-- Clearing db --")
  for ( var entity in dbSchema ){
    console.log("cleanning "+entity)
    for ( var i in dbSchema[entity] ){
      let field = dbSchema[entity][i][0]
      let type = dbSchema[entity][i][1]
      let map = getCrdtMap( entity, field, type )
      let mapId = db_id( entity, field, type )
      console.log("removing from map "+mapId+" ")
      await map.read()
        .then( crdt_map => crdt_map.toJsObject() )
        .then( js_map => Object.keys(js_map) ) 
        .then( keys => 
          antidote.update(
            keys.map( k => map.remove(map[type](k) ) )
          )
        ).catch( e => console.error(e) )
    }
  }
  console.log("-- end of clearing --"); 
  return dumpDB();
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
function resolveId( id, tx = undefined ) { return resolveIds( [id] ).then( vals => vals[0] ) }
function resolveIds( ids, tx = undefined ){
  return readPropertiesFromIds( ids, ids.map( m => ['id2Ids','mergedTo','register']), tx )
    .then( vals => 
      vals.map( (id, i) => id ? id : ids[i] )
    ).catch( e => {
      console.error("Error resolving ids "+ids+": "+e)
      throw e
    })
}
/**
 * function that chose which id is unified.
 */
function mergeRequest( idA, idB ){
  let olderId 
  let yungerId 
  let names 
  let timeProp = ['user', 'time', 'register'];
  return antidote.startTransaction()
    .then( tx => readPropertiesFromIds(
        [idA, idB, idA, idB],[ 
          timeProp, 
          timeProp, 
          ['id2names','names','set'],
          ['id2names','names','set'],
        ], tx
      ).then( vals => {
        var toBeMerge = false
        if ( vals[0] < vals[1] ) { 
          olderId = idA; 
          yungerId = idB;
          names = vals[3];
        }else {
          olderId = idB; 
          yungerId = idA;
          names = vals[2];
        }
        return tx.update([
            getCrdtMap('id2Ids','mergedTo','register').register(yungerId).set(olderId),
          ].concat( names.map( n => 
            getCrdtMap('name2ids','ids','set').set(n).remrove(yungerId)
          )).concat( names.map( n => 
            getCrdtMap('name2ids','ids','set').set(n).add(olderId)
          )).concat( names.mpa( n => 
            getCrdtMap('id2names','names','set').set(yungerId).remove(n),
          )).concat( names.mpa( n => 
            getCrdtMap('id2names','names','set').set(olderId).add(n),
          ))        
        )
      })
      .then( _ => tx.commit().then( _=> olderId ) )
    )
}
/**
 * function called when a user try to log in 
 * returns {
 *  status : <'ok'|'toBeChanged'>,
 *  userId : <userId>
 * }
 */
function resolveUserDuplication( idSet, email ){
  return readPropertiesFromIds( idSet.concat(idSet), 
      idSet.map( e => ['user','time','register'] ).concat(
        idSet.map( e => ['user','email','register'] )
      ) )
      .then( vals => {
        let length = idSet.length
        let times = vals.slice(0,length)
        let emails = vals.slice(length, length*2)
        // was the same email used twice ? 
        for ( var i = 0; email && email.length && i<email.length - 1 ; i++ )
          for ( var j = i +1 ; j<email.length; j++ )
            if ( emails[i] == emails[j] )
              return mergeRequest( idSet[i], idSet[j] )
                .then( newId => 
                  resolveUserDuplication(
                    idSet.filter( (id,I) => I!=i && I!=j ).concat( [ newId ] ), 
                    email.filter( (em,I) => I!=i && I!=j ).concat( [ emails[i] ] )
                  )
                )
        let indexOfEmail = emails.indexOf( email )
        if ( indexOfEmail == -1 ) throw "Unkown email"
        let userId = idSet[indexOfEmail] 
        let minTimeIndex = Object.keys(times).reduce( (i,j) => ( (times[i]<times[j]) ? i : j ) , 0)
        return mirror("Resolving duplication ",{
          status : ((minTimeIndex==indexOfEmail)?'ok':'toBeChanged'),
          userId : userId
        })
      })
}
/** 
 * given the old credentials, the userId which they are refering to and a new username, it replace the username
 */
function resetUserName( userId, user, email, password, newUser ){
  let values = [
    [userId, ['id2names', "names", "set"]],
    [userId, ['user', "email", "register"]],
    [userId, ['user', "password", "register"]],
    [newUser, ['name2ids', "ids", "set"]],
  ]
  return readPropertiesFromIds( values.map( arr => arr[0]), values.map( arr=> arr[1]) )
    .then( vals =>{
      if ( !vals[0] || vals[0].indexOf(user) == -1 ) throw "User name "+user+" not associated with id "+userId  
      if ( email != vals[1] ) throw "Un matching email"
      if ( password != vals[2] ) throw "Un matching password"
      vals[3] = vals[3] ? vals[3].filter( id => userId != id ) : []
      if ( vals[3] && vals[3].length>=1 )throw "New user name "+newUser+" already in use by "+vals[3]
      return antidote.update([
        id2users.set(userId).remove(user),
        id2users.set(userId).add(newUser),
        user2ids.set(user).remove(userId),
        user2ids.set(newUser).add(userId),
      ]).catch( e =>{ throw mirror("Error updating: "+e, e.stack) })
    })
    .catch( e =>{ throw mirror( "Error resetting user: "+e, e.stack) })
}
/**
 * given a userId and a user, remove the associations 
 *  (userId,u) for each u different from user
 */
function resolveNameDuplication(userId, nameSet, user){
  let names = nameSet.filter( u => u!=user )
  return antidote.update(
    names.map( n => user2ids.set(n).remove(userId) ).concat(
      names.map( n => id2users.set(userId).remove(n) )
    )
  )
}

async function validatePasswordUserId( password, userId ){
  return getObject( userId, "user" ).password.read()
    .then( p => {
      if ( p==password ) return userId;
      else throw "Unmatching password"
    })
}






/*user2ids.set("Donald").read()
  .then( ids => antidote.update(ids.map( id => id2users.set(id).add("Roger"))) ) // */

// insert dummy user
//insertDummyUsers()
//.then( _=> dumpDB() )
/*clearDB()
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
  return await dumpDB()
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
      .then( _ => readEntity(chirpId, "chirp") )
      .then( entity => { console.log("Created chirp "+JSON.stringify(entity)); return entity;})
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
    .then( id => readEntity(id, "chirp") )
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
      .then( id => getObject(id,"chirp").replays.read() )
      .then( async (replayIds) => { 
        console.log("Going to load replays "+replayIds)
        if ( !replayIds || replayIds.length == 0 ) return []
        var ret = []
        for ( var i in replayIds )
          await readEntity(replayIds[i], "replay")
            .then( ent => ret.push(ent) )
            .catch( e => mirror("Failled to load entity", e) )
        ret.sort((x, y) => x.time - y.time)
        return ret;
      })
))
/**
 * Insert a replay to a chirp whose chirpId is passed through the get params.
 * The user id is provided by authentication
 * the replay body is the request body.
 */
server.post('/api/replays/:chirpId', handleWithAuth( async (req,userId) => 
    await validateId(req.params.chirpId)
      .then( id => createReplay(userId, id, req.body ) )
      .then( id => readEntity(id,"replay") )
))
/**
 * Register user to the server
 */
server.post('/api/register/', handle( async req => 
  registerUser( req.body.user, req.body.password, req.body.mail )
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
    .then( id => addRelalation( id, mineId ).then( _ => getRelation(id, mineId)) )
));
server.delete('/api/followers/:userId', handleWithAuth(async (req, mineId) => 
  await validateId(req.params.userId)
    .then( id => removeRelalation( id, mineId ).then( _ => getRelation(id, mineId)) )
));
/**
 * Gives the timeline for the current user
 */
server.get('/api/timeline', handleWithAuth(async (req, userId) => 
  await collect( userId )
    .then( ids =>{ 
      mirror("The following chirp ids were added: ", ids)
      return getObject(userId,"user").timeline.read()
    }).then( chirpIds => getSortedChirpSetFromChirpIdSet( chirpIds ) )
));
/**
 * Gives the timeline for a specific user
 */
server.get('/api/timeline/:userId', handle(async req => 
  await validateId(req.params.userId)
    .then( id => getObject(id,"user").writtenChirps.read() )
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
    return await id2users.set(userId).read()
      .then( nameSet => {
        if ( !nameSet || nameSet.length == 0 ) throw "Internal error (storage user name)"
        else if ( nameSet.length > 1 ) return ({duplicatedName:nameSet, userId:userId})
        else return validatePasswordUserId( password, userId )
                      .then( id => ({userId:id}) )
      })
  } else return ({duplicatedUser:true})
}));
/**
 * resolve a conflict of one id associated with two names.
 * the req.body is meant to be an object like
 * {
 *    user: <...>,
 *    password: <...>,
 *    email: <...>,
 *    userId: <...>,
 *    newUser: <...>
 * }.
 * if the email is associated at the oldest user, this function works as a login and returns the id.
 * otherwise, it will be asked to the user to change the name
 */
server.post('/api/rename/', handle(async req => {
  let user = req.body.user
  let password = req.body.password
  let email = req.body.email
  let newUser = req.body.newUser
  let userId = req.body.userId
  console.log ( `Re-naming ${userId}.(${user}, ${password}, ${email}) to ${newUser}` )
  if ( user && password && email && newUser && userId )
    return await resetUserName( userId, user, email, password, newUser )
      .then( _=> ({userId:userId}))
      .catch( _=> ({
        toBeChanged: true,
        userId : userId,
        user: user,
        email : email,
        password : password
      }) )
    else throw "One of the fields is empty"
}))

/**
 * resolve a conflict of names.
 * the req.body is meant to be an object like
 * {
 *    user: <...>,
 *    password: <...>,
 *    email: <...>
 * }.
 * if the email is associated at the oldest user, this function works as a login and returns the id.
 * otherwise, it will be asked to the user to change the name
 */
server.post('/api/conflict/', handle(async req => {
  let user = req.body.user
  let password = req.body.password
  let email = req.body.email
  let idSet = await user2ids.set(user).read()
  let userId;
  if ( ! idSet || idSet.length==0 ) throw "User unknown";
  else if ( idSet.length > 1 ){ 
    let result = await resolveUserDuplication( idSet, email )
    if ( result.status == "ok" ) userId = result.userId
    else return mirror (" --- --- Conflict >>",{ // ask the user to chose another name.
      toBeChanged: true,
      userId : result.userId,
      user: user,
      email : email,
      password : password
    })
  }else userId = idSet[0]
  return await validatePasswordUserId( password, userId )
    .then( id => id2users.set(id).read() )
    .then( nameSet => {
      if ( !nameSet || nameSet.length == 0 ) throw "Internal error (storage user name)"
      if ( nameSet.length > 1 ) resolveNameDuplication(userId, nameSet, user)        
      return {userId:userId}
    })
}));
/**
 * returns the id associated with the user name provided as a param.
 * if the user is multiplied, the older one will be returned
 */
server.get('/api/userId/:userName', handle( async req => 
  await user2ids.set( mirror("Searching user",req.params.userName) ).read()
    .then( idSet => {
      mirror("Matchs :", idSet )
      if ( ! idSet || idSet.length == 0 ) throw "Unknow user name"
      else if ( idSet.length > 1 ) idSet.sort( (x,y) => x.localeCompare(y)) 
      return idSet[0]
    })
))

// ----- start server -----
http.createServer(server).listen(server.get('port'), function () {
  console.log("Express server listening on port " + server.get('port'));
})