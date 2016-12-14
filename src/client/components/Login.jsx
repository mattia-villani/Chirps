import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import * as api from '../models/chirps';
import linkState from 'react-link-state';
import * as axios from 'axios'
import { browserHistory, Router, Route, Link, withRouter } from 'react-router'


export const Login = withRouter(
    React.createClass( { 
    
    
    getInitialState() {
        return {
            error: undefined,
            sending : false
        }
    },

    invokeApi( requester, args ){
        this.setState({sending:true});
        return requester( args )
            .then(data => { 
                api.saveLoginValues( {
                    user:args.user, 
                    password:args.password,
                    userId:data.userId
                });
                this.setState({sending:false});
                return true;
            })
            .catch(err => {
                api.saveLoginValues(undefined);
                var errMsg = (typeof err === 'string') ? err : (
                    err.response ? ("E_"+err.response.status+": "+err.response.data) : "Error"
                )
                this.setState({error: errMsg, sending:false});
                console.log('Error ' + err + " " + JSON.stringify(err) + " " + err.stack);
                return false;
            })
    },

    goToHome(){
        console.log("redirecting to /")
        const { location } = this.props
        if (location.state && location.state.nextPathname) {
            this.props.router.replace(location.state.nextPathname)
        } else {
            this.props.router.replace('/')
        }
    },

    async login(e) {
        e.preventDefault()            
        
        const user = this.refs.user.value
        const pass = this.refs.pass.value
        
        await this.invokeApi( api.getAuthentification, {
            user:user,
            password:pass
        }).then( success => { if ( success ) this.goToHome(); } )

    },

    async register(e) {
        e.preventDefault()

        const user = this.refs.user_r.value
        const mail = this.refs.mail_r.value
        const pass = this.refs.pass_r.value
        const pas2 = this.refs.pas2_r.value

        if ( pass != pas2 )
            this.setState({error:"Not matching passwords"})
        else
            await this.invokeApi( api.getRegistration , {
                user:user,
                password:pass,
                mail:mail
            }).then( success => { if ( success ) this.goToHome(); } )
    },

    render() {

        if ( this.state.sending )
            return (<div className='app'> sending </div>);

        let errorMessage = 
            this.state.error ? (
            <div>
                <header>
                    <div className='header'>
                        <center><h2 className="error">{this.state.error}</h2></center>
                    </div>
                </header>
            </div>) : undefined
        
        let loginForm = (
            <form onSubmit={this.login} className='add-chirp-form'>
                <label><input className="message" ref="user" placeholder="username" /></label>
                <label><input className="message" ref="pass" type="password" placeholder="password" /></label>
                <button className="button post" type="submit">login</button>
            </form>)
        
        let registrationForm = (
            <form onSubmit={this.register} className='add-chirp-form'>
                <label><input className="message" ref="user_r" placeholder="username" /></label>
                <label><input className="message" ref="pass_r" type="password" placeholder="password" /></label>
                <label><input className="message" ref="pas2_r" type="password" placeholder="repeat password" /></label>
                <label><input className="message" ref="mail_r" placeholder="email" /></label>
                <button className="button post" type="submit">Registrer</button>
            </form>)

        return (
        <div className='app'>
            {errorMessage}
            <header>
                <div className='header'>
                    <h1>Login</h1>
                </div>
            </header>
            {loginForm}
            <header>
                <div className='header'>
                    <center><h2>or register here</h2></center>
                </div>
            </header>
            {registrationForm}
        </div>
        );
    }
}))
