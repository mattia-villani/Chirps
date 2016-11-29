import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import * as api from '../models/chirps';
import linkState from 'react-link-state';
import * as axios from 'axios'
import { Router, Route, Link, browserHistory } from 'react-router';

export class Login extends React.Component { 
  
  
  constructor() {
    super();
    this.state = {
       user: '',
       password: '',
       error: undefined,
       regError : undefined,
       sending : false
    };
    api.removeLoginValues();
  }


  async sendLoginRequest(username, password) {
    let This = this;
    this.setState({sending:true});
    return await axios
        .post('/api/validCredentials/', {user:username, password:password})
        .then(function(response) {
            if ( response.status != 200 ){
                This.setState({password:'', sending:false});
                saveLoginValues(null);
                throw "Error loggin "+response.status;
            }
            api.saveLoginValues( {
                user:username, 
                password:password,
                response: response
            });
            browserHistory.push('/');
            return true;
        });
  }

  async sendRegisterRequest(username, password, password2, mail) {
    let This = this;
    if ( password != password2 ) throw "Unmatching password";
    this.setState({sending:true});
    return await axios
        .post('/api/register/', 
            {
                user:username, 
                password:password, 
                mail:mail
            })
        .then(function(response) {
            if ( response.status != 201 ){
                This.setState({reg_password:'', reg_password2:'', sending:false});
                saveLoginValues(null);
                throw "Error loggin "+response.status;
            }
            api.saveLoginValues( {
                user:username, 
                password:password,
                response: response
            });
            browserHistory.push('/');
            return true;
        });
  }


  login(e) {
    let This = this;
    e.preventDefault();
    this.sendLoginRequest(this.state.user, this.state.password)
      .catch(function(err) {
        This.setState({regError:JSON.stringify({
            status: err.response.status,
            message: err.response.data,
            text: err.response.statusText})});
        console.log('Error logging in', err);
      });
  }

  register(e) {
    let This = this;
    e.preventDefault();
    this.sendRegisterRequest(
        this.state.reg_user, 
        this.state.reg_password,
        this.state.reg_password2,
        this.state.reg_mail
      ).catch(err => {
        This.setState({regError:
            (err && err.response) 
            ? JSON.stringify({
                status: err.response.status,
                message: err.response.data,
                text: err.response.statusText})
            : err
            });
        console.log('Error registering ', err);
      });
  }


  render() {
    let errorMessage = (this.state.error) 
      ? <div className="error">{this.state.error}</div> 
      : undefined;
    let regErrorMessage = (this.state.regError) 
      ? <div className="error">{this.state.regError}</div> 
      : undefined;

    if ( this.state.sending )
        return (<div className='app'> sending </div>);
    return (
        <div className='app'>
            
            <form role='form'>
                <div className='form-group'>
                    <input type='text' valueLink={linkState(this,'user')}placeholder='Username' />
                    <input type='password'valueLink={linkState(this,'password')} placeholder='Password' />
                </div>
                <button type='submit' onClick={this.login.bind(this)}>Submit</button>
                {errorMessage}
            </form>
            <div>
                <p> If you are not registred yet, you can do it here: </p>
                <form role='form'>
                    <div className='form-group'>
                        <input type='text' valueLink={linkState(this,'reg_user')}placeholder='Username' />
                        <input type='password'valueLink={linkState(this,'reg_password')} placeholder='Password' />
                        <input type='password'valueLink={linkState(this,'reg_password2')} placeholder='Repeat password' />
                        <input type='text' valueLink={linkState(this,'reg_mail')}placeholder='Email' />
                    </div>
                    <button type='submit' onClick={this.register.bind(this)}>Submit</button>
                    {regErrorMessage}
                </form>
            </div>

        </div>
    );
  }
}
