import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import * as api from '../models/chirps';
import { Router, Route, Link, browserHistory } from 'react-router'



export class Login extends React.Component {

  constructor() {
    super();
    this.state = {
      status: 'checking',
      user: undefined,
      password: undefined
    }
    this.validateCredentials();
  }

  async validateCredentials() {
    try {
      let res = await api.checkCredentialsValidity( api.getToken() );
      console.log("Got "+res);
      api.saveToken();
      browserHistory.push('/');
    } catch (e) {
      console.log(e);
      try{
          this.setState({status:'failed'});
      }catch(e){}
    }
  }
  onSubmitCredentials(){
    let user = document.getElementById('user').value;
    let password = document.getElementById('password').value;
    api.createToken(user,password);
    this.validateCredentials();   
  }

  render() {
    if ( this.state.status == 'checking' )
        return (<div>checking...</div>);
    return (<div>
                <div className='header'>
                    <h1>Login</h1>
                </div>
                <div className='add-chirp-form'>
                    <form onSubmit={this.onSubmitCredentials.bind(this)}>
                        <input id='user' type='text' className='user' placeholder='User'/>
                        <br/>
                        <input id='password' type='password' className='password' placeholder='Password'/>
                        <br/>
                        <input type='submit' value='LOG IN!'/>
                    </form>
                </div>
                <ul>
                    <li>
                        You are not registred yet ? Press here to register! ...
                    </li>
                </ul>
            </div>);
  }
}
