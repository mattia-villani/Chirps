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
let user2mail = antidote.map("user2mail")

// each user has a timeline with the Chirps he can read
let timeline = (user) => antidote.set(`timeline_${user}`);


//------
/**
 *  description
 *  -> userSet = antidote.set("users") 
 *    made of records of the type :
 *      { 
 *        userID: <unique identifier: <number>_user>,
 *        name: <user\' name>,    
 *        password: <password>,
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
    user2mail.register('Donald').set('donald@mail.com'),    
  ])
    .then(_=>console.log('Inserted entry Donald,passwd,donald@mail.com'))
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
      .then(r => res.send(r))
      .catch(next)
  };  
}

/**
 * Gives a list of all user-names in the system
 */
server.get('/api/users', handle(async req => {
  return await userSet.read();
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
    let mail = data.mail;

    let a_user = { 
      userID: Date.now()+user,
      name: user,    
      password: password,
      email: email
    }
    // validation
    var err = undefined;
    if ( !user || !password || !mail ) 
      err = {status:406, mesg :"Empty values"};
//    req.assert(mail, {status:406, mesg :'valid email required'}).isEmail();

    if ( err )
      return res
          .status(e.status?e.status:500)
          .send(e.mesg ? e.mesg : e);

    // 
    console.log("starting to register "+JSON.stringify(data) );
    try{
        /*
        let users = await tx.set('users').read()
          .catch(e=>{throw {status:500, mesg :"Failled to read users"}});
        if ( user in users )
          throw {status:400, mesg :"User already registred"};
          */ // no es atomic. 
        await antidote.update([
              userSet.add(user),
              user2pass.register(user).set(password),
              user2mail.register(user).set(mail)    
        ])
        .then(_=>{res.status(201).send(JSON.stringify({user:user}))})
        .catch(e=>{throw {status:500, mesg :"Failled to add user"}})
    }catch( e ){
        res
          .status(e.status?e.status:500)
          .send(e.mesg ? e.mesg : e);
        console.error(e)
        if ( e.stack )
          console.error("STACK TRACE :" + e.stack)
    }
} ) )

/**
 * check if the credentials are corrected, if not, this fails
 */
server.post('/api/validCredentials/', handleWithRes(async (req, res) => {
  let credentials = req.body
  let user = credentials.user;
  let password = credentials.password;
  if ( !user || !password ) 
    res.status(401).send("empty credentials")
  (antidote
    .map("user2pass")
    .register(user)
    .read()
      .then( storedPasswd => {
        if ( storedPasswd == password )
          res.send(JSON.stringify({user:user}));
        else   
            res.status(403).send("invalid credentials");
      } )
      .catch(e=>{
          res
            .status(401)
            .send("bad login " + e)
          console.log(e);
      }))
}));


// ----- start server -----
http.createServer(server).listen(server.get('port'), function () {
  console.log("Express server listening on port " + server.get('port'));
})