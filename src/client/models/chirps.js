import * as axios from 'axios';
import cookie from 'react-cookie';

export function removeLoginValues(){
	cookie.save(null);
	cookie.remove('loginValues');
}
export function saveLoginValues( obj ){
	cookie.save('loginValues', JSON.stringify(obj), {path:'/'});
}
export function getLoginValues( ){
	let vars = cookie.load('loginValues');
	if ( vars ){ 
		let parsed = vars;
		if ( parsed && parsed.user && parsed.password )
			return parsed;
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
	return axios.post('/api/validCredentials/', args)
		.then( response => { 	
				if ( response.status != 200 )
    				throw "Error loggin "+response.status+" with data "+response.data;
				return response.body;
 			})
}

function extendsWithCredentials( datos ){
	let credentials = getLoginValues();
	if ( credentials ){
		datos.user = credentials.user,
		datos.password = credentials.password
	}
	return datos;
}

export async function getTimeline() {
	let response = await axios.get('/api/timeline', extendsWithCredentials({}));
	return response.data;
}

export async function getTimelineForUser(user) {
	let response = await axios.get(`/api/timeline${user}`, extendsWithCredentials({}));
	return response.data;
}

export async function saveChirp(chirp) {
	let res = await axios.post('/api/chirps', extendsWithCredentials(chirp));
	return res.data;
}
