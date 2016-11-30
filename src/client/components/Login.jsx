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
       sending : false
    };
    api.removeLoginValues();
  }

  invokeApi( requester, args ){
    try{
        this.setState({sending:true});
        let data = requester( args )
        api.saveLoginValues( {
            user:args.user, 
            password:args.password,
            response: JSON.stringify(data)
        });
        this.setState({sending:false});
        this.context.router.push('/');
    }catch(err){
        api.saveLoginValues(null);
        this.setState({error: err, sending:false});
        console.log('Error ' + err);
    }
  }

  login(e) {
    this.invokeApi( api.getAuthentification, {
        user:this.state.user,
        password:this.state.password
    });
  }

  register(e) {
    this.invokeApi( (args) => {
        if ( this.state.reg_password != this.state.reg_password2 ) throw "Unmatching password";
        else api.getAuthentification
    }, {
        user:this.state.reg_user,
        password:this.state.reg_password,
        mail:this.state.reg_mail
    });      
  }

  render() {
    let errorMessage = (this.state.error) 
      ? <div className="error">{this.state.error}</div> 
      : undefined;

    if ( this.state.sending )
        return (<div className='app'> sending </div>);
    return (
        <div className='app'>
            <div className='form-group'>
                <input type='text' valueLink={linkState(this,'user')}placeholder='Username' />
                <input type='password'valueLink={linkState(this,'password')} placeholder='Password' />
            </div>
            <button type='submit' onClick={this.login.bind(this)}>Submit</button>
            {errorMessage}
            <div>
                <p> If you are not registred yet, you can do it here: </p>
                <div className='form-group'>
                    <input type='text' valueLink={linkState(this,'reg_user')}placeholder='Username' />
                    <input type='password'valueLink={linkState(this,'reg_password')} placeholder='Password' />
                    <input type='password'valueLink={linkState(this,'reg_password2')} placeholder='Repeat password' />
                    <input type='text' valueLink={linkState(this,'reg_mail')}placeholder='Email' />
                </div>
                <button type='submit' onClick={this.register.bind(this)}>Submit</button>
            </div>
        </div>
    );
  }
}
