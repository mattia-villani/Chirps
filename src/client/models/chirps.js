import * as axios from 'axios'
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


export async function getTimeline() {
	let response = await axios.get('/api/timeline');
	return response.data;
}

export async function getTimelineForUser(user) {
	let response = await axios.get(`/api/timeline${user}`);
	return response.data;
}

export async function saveChirp(chirp) {
	let res = await axios.post('/api/chirps', chirp);
	return res.data;
}
/*
export async function checkCredentialsValidity(token) {
	if ( token && token.user && token.password ){
		let res = await axios.get('/api/validCredentials/'+token.user, token.password);
		alert ( res );
		if ( res.status != 200 )
			throw new Error( res.statusText );
		return res.data;
	}else throw new Error( "Empty credentials" );
}*/
