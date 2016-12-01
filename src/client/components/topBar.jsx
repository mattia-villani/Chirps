import * as React from 'react';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';



export class TopBar extends React.Component {

  constructor() {
    super();
    this.state = {
        ready: true,
        my_user: api.getLoginValues().user,
        searching: undefined
    }
  }

  logout(){
    api.removeLoginValues();
    browserHistory.push('/login');
  }

  render() {
    return 
        (<ul className="topBar">
            <li><a href="/">Home</a></li>
            <li><h2>{this.state.my_user}</h2></li>
            <li><a href="#" onClick={this.logout.bind(this)}>About</a></li>
        </ul>);
  }
}
