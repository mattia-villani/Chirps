import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import { Home } from './home';
import { Login } from './Login';
import { UserTimeline } from './userTimeline';
import { Router, Route, Link, browserHistory } from 'react-router'
import * as api from '../models/chirps';


export class App extends React.Component {
  constructor() {
    super();
    this.state = {
      page: 'home'
    };
  }

  gotoPageIfCondition( condition, page, nextState, replaceState ){
    if ( condition )
      replaceState({
            pathname: page,
            state: { nextPathname: nextState.location.pathname }
          })

  }
  requireAuth(nextState, replaceState) {
    this.gotoPageIfCondition( !api.getLoginValues(), '/login', nextState, replaceState )  
  }
  redirectToHomeIfLogged(nextState, replaceState){
    this.gotoPageIfCondition(  api.getLoginValues(), '/', nextState, replaceState )  
  }


  render() {
    return (
      <Router history={browserHistory}>
        <Route path="/" component={Home} onEnter={this.requireAuth.bind(this)}/>
        <Route path="/timeline/:userId" component={UserTimeline} onEnter={this.requireAuth.bind(this)}/>
        <Route path="login" component={Login} onEnter={this.redirectToHomeIfLogged.bind(this)} />
      </Router>
    );
  }
}
