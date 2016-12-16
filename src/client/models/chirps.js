import * as axios from 'axios';
import cookie from 'react-cookie';
import { Router, Route, Link, browserHistory } from 'react-router'

export function removeLoginValues(){
	cookie.remove('loginValues_user');
	cookie.remove('loginValues_password');
	cookie.remove('loginValues_userId');
}
export function saveLoginValues( obj ){
	if ( ! obj || obj == null || ! obj.user || ! obj.password || ! obj.userId ) 
		removeLoginValues();
	else {
		cookie.save('loginValues_user', obj.user);
		cookie.save('loginValues_password', obj.password);
		cookie.save('loginValues_userId', obj.userId);
	}
}
export function getLoginValues( ){
	let user = cookie.load('loginValues_user');
	let pass = cookie.load('loginValues_password');
	let userId = cookie.load('loginValues_userId');
	if ( user && pass && userId ){
		axios.defaults.headers.common['Authorization'] = JSON.stringify({user:user, password:pass});
		return {user:user, password:pass, userId:userId};
	}
	return undefined;
}

export function getRegistration(args){
	return axios.post('/api/register/', args)
		.then( response => {
			if ( response.status != 200 && response.status != 201 )
				throw "Error registrating "+response.status+" with data "+response.data;
			else response.body;
		})
}

export function getAuthentification(args) {
	return axios.post('/api/login/', args , auth({user:args.user, password:args.password}))
		.then( response => { 	
				if ( response.status != 200 )
    				throw "Error loggin "+response.status+" with data "+response.data;
				else return mirror( response.data )
 			})
}
function mirror( something ){
	console.log( JSON.stringify(something) )
	return something;
}
function auth( values ){
	let credentials = values ? values : getLoginValues();
	var auth ;
	if ( credentials )
		auth = {
			headers: {
        		'Authorization': 'Basic ' + 
					(new Buffer(
						JSON.stringify({
							user:credentials.user, 
							password:credentials.password,
							userId:credentials.userId
						}
					)).toString('base64'))
			}
		}
	else auth = {}
	return auth
}


function authenticatedRequest(type, path, arg=undefined){
	return ( 
			(type=='post'||type=='put') ?
				axios[type]( path, arg, auth() ):
				axios[type]( path, auth() )
		)
		.catch( e => {
			if (e.response.status == 400){ // checking the validity of token
				console.error("Error authenticating "+ e)
				removeLoginValues();
				browserHistory.push('/login');						
			}else {
				console.log("error occourred "+e )
				throw e;
			}
		})
		.then( response => {
			console.log("Request "+type+" to "+path+" with arg "+arg+" -->> "+JSON.stringify(response.data))
			return response.data;
		})
}



export let getTimeline = () => 
	authenticatedRequest( 'get', '/api/timeline' );

export let getTimelineForUser = (user) =>
	authenticatedRequest( 'get', `/api/timeline/${user}` );

export let getChripById = (chirpId) =>
	authenticatedRequest( 'get', '/api/chirp/'+chirpId );

export let saveChirp = (chirp) =>
	authenticatedRequest( 'post', '/api/chirps', chirp);

export let getUsersByKey = (key) =>
	authenticatedRequest( 'get', `/api/search/${key}` );

export let setFollow = ( following , who ) =>
	authenticatedRequest( following ? 'put' : 'delete' , '/api/followers/'+who );

export let getRelation = (user) =>
	authenticatedRequest( 'get', '/api/relation/'+user ) ;

export let getReplays = ( chirpId ) =>
	authenticatedRequest( 'get', '/api/replays/'+chirpId ) ;

export let postReplay = ( replay, chirpId ) =>
	authenticatedRequest( 'post', '/api/replays/'+chirpId, replay ) ;

export let getIdOfUser = ( userName ) =>
	authenticatedRequest( 'get', '/api/userId/'+userName);