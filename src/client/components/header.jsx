import * as React from 'react';
import { AddChirp } from './add_chirp';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';


export class Header extends React.Component {
  constructor(props=undefined) {
    super(props);
  }

  logout(){
    api.removeLoginValues();
    browserHistory.push('/login');
  }
}
