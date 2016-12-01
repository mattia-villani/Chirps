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
	let response = await axios.get(`/api/timeline${user}`, auth());
	return response.data;
}

export async function saveChirp(chirp) {
	let res = await axios.post('/api/chirps', chirp, auth());
	return res.data;
}
