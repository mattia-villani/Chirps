import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import { Home } from './home';
import { Login } from './login';
import { UserTimeline } from './userTimeline'
import { Router, Route, Link, browserHistory } from 'react-router'
import * as api from '../models/chirps'

export class App extends React.Component {

  constructor() {
    super();
    this.state = {
      page: 'home',
      login: api.getLoginValues()
    };
    console.log("loginValue : "+JSON.stringify(this.state.login));
  }

  requireAuth(nextState, replaceState) {
    if (!this.state.login)
        browserHistory.push('/login')
//    if (!this.state.login)
//      replaceState({ nextPathname: nextState.location.pathname }, '/login')
  }
  redirectToHomeIfLogged(nextState, replaceState){
    if( this.state.login )
      browserHistory.push('/');
  }

  render() {
    var router = (
        <Router history={browserHistory}>
          <Route path="/" component={Home} onEnter={this.requireAuth.bind(this)}/>
          <Route path="/timeline/:userId" component={UserTimeline} onEnter={this.requireAuth.bind(this)}/>
          <Route path="/login" component={Login} onEnter={this.redirectToHomeIfLogged.bind(this)}/>
        </Router>
      )
    return router;
  }

}
