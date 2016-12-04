import * as axios from 'axios';
import cookie from 'react-cookie';

export function removeLoginValues(){
	cookie.remove('loginValues_user');
	cookie.remove('loginValues_password');
}
export function saveLoginValues( obj ){
	if ( ! obj || obj == null || ! obj.user || ! obj.password ) removeLoginValues();
	else {
		cookie.save('loginValues_user', obj.user);
		cookie.save('loginValues_password', obj.password);
	}
}
export function getLoginValues( ){
	let user = cookie.load('loginValues_user');
	let pass = cookie.load('loginValues_password');
	if ( user && pass ){
		axios.defaults.headers.common['Authorization'] = JSON.stringify({user:user, password:pass});
		return {user:user, password:pass};
	}
	return undefined;
}

export function getRegistration(args){
	return axios.post('/api/register/', args)
		.then( response => {
			if ( response.status != 201 )
				throw "Error registrating "+response.status+" with data "+response.data;
			else response.body;
		})
}

export function getAuthentification(args) {
	return axios.post('/api/validCredentials/', args , auth({user:args.user, password:args.password}))
		.then( response => { 	
				if ( response.status != 200 )
    				throw "Error loggin "+response.status+" with data "+response.data;
				return response.body;
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
							password:credentials.password}
					)).toString('base64'))
			}
		}
	else auth = {}
	return auth
}

export async function getTimeline() {
	let response = await axios.get('/api/timeline', auth());
	return response.data;
}

export async function getTimelineForUser(user) {
	let response = await axios.get(`/api/timeline/${user}`, auth());
	return response.data;
}

export async function saveChirp(chirp) {
	let res = await axios.post('/api/chirps', chirp, auth());
	return res.data;
}

export function getUsersByKey( key ){
	return axios.get(`/api/search/${key}`, auth())
		.then( response => response.data )
}

export function setFollow( following , who ){
	if ( following )
		return mirror(axios.put('/api/followers/'+who, {},auth() ))
	else 
		return mirror(axios.delete('/api/followers/'+who, auth() ))	
}

export function getRelation(user){
	return axios.get('/api/relation/'+user,auth())
		.then( response => mirror(response.data) )
}

export function getReplays ( chirp ){
	let id = chirp.id ? chirp.id : (chirp.user+chirp.time)
	return mirror(axios.get('/api/replays/'+id, auth())
		.then( reponse => reponse.data ))
}

export function postReplay( replay ){
	return axios.post('/api/replays', replay, auth())
		.then( reponse => reponse.data )
}