import * as React from 'react';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';

export class ChirpItem extends React.Component {

  constructor(props) {
    super(props);
    let chirp = props.chirp;
    
    this.state = {
      chirp:chirp
    }

  }

  render(){
    let style = {
      background: 'url(' + this.state.chirp.avatar + ')',
      backgroundSize: '52px 52px'
    };

    return (
      <li>
        <div className='avatar' 
          style={style}
          onClick={(ev)=>browserHistory.push('/timeline/'+this.state.chirp.user)}
        ><div>{this.state.chirp.user}</div></div>
        <div className='message'
          onClick={(ev)=>browserHistory.push('/replays/'+this.state.chirp.id)}
        >{this.state.chirp.message}</div>
      </li>
    );
  }
}

export class ChirpItemById extends ChirpItem{
  constructor(props){
    super(props)
    this.state={
      status:'loading',
      chirp:undefined
    }
    api.getChripById(props.chirpId)
      .then( chirp => this.setState({status:'ready', chirp:chirp}) )
      .catch( e => { this.setState({status:'failed'}); console.error("Failed to load chirp " + e );})
  }

  render(){
    if ( this.state.status == 'loading' )
      return (<li>Loading...</li>)
    else if ( this.state.status == 'failed' )
      return (<li>Failed to load chirp</li>)
    else 
      return (<ChirpItem chirp={this.state.chirp} />)
  }
  
}