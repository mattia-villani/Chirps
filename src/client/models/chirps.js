import * as axios from 'axios'
import cookie from 'react-cookie';


export function getTokenFromCookies(){
	if (cookie)	
		return createToken(cookie.load('user'), cookie.load('password'));
	else return createToken(undefined,undefined);}
export function createToken(user, password){
	return (token = {
		user: user,
		password: password,
	});}
export function isTokenAuth(){return token && token.user && token.password;}
export function getToken(){return token;}
export function saveToken(){
	cookie.save('user', token.user, { path: '/' });
	cookie.save('password', token.password, { path: '/' });
}
var token = getTokenFromCookies();


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

export async function checkCredentialsValidity(token) {
	if ( token && token.user && token.password ){
		let res = await axios.get('/api/validCredentials/'+token.user, token.password);
		alert ( res );
		if ( res.status != 200 )
			throw new Error( res.statusText );
		return res.data;
	}else throw new Error( "Empty credentials" );
}
