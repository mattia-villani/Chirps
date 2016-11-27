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
    };
  }

  render() {
    var router = (
      <Router history={browserHistory}>
        <Route path="/" component={Home} />
        <Route path="/timeline/:userId" component={UserTimeline} />
        <Route path="/login" component={Login} />
      </Router>
    );
    if ( ! api.isTokenAuth() )
      router.transitionTo('login');
    return router;
  }

}
