import * as React from 'react';
import * as api from '../models/chirps';
import { ChirpItem } from './chirp_item';
import {ChirpItemById} from './chirp_item';
import { Header } from './header';
import { Router, Route, Link, browserHistory } from 'react-router';

// ------------------------------  Component  -------------------------------------- // 


class ReplaysHeader extends Header {
  constructor(props){
      super(props)
  }
  render(){
      return (
        <header>
            <div className='topBar'>
                <div className='button' onClick={browserHistory.goBack}>Back</div>          
                <div className='button' onClick={super.logout.bind(this)}>Logout</div>          
            </div>
            <div className='header'>
                <h1>Replay</h1>
            </div>
        </header>);
  }
}

// ------------------------------  Component  -------------------------------------- // 

function Replay(props) {
  return (
    <li>
      <div className='message replay' >
        <p className='author' onClick={ev => browserHistory.push('/timeline/'+props.replay.user)}>
            {props.replay.body.user}
        </p>
        {props.replay.body.text}
        </div>
    </li>
  );
}

// ------------------------------  Main Component here  -------------------------------------- // 


export class Replays extends React.Component {

  constructor(props) {
    super(props);
    let chirpId = props.params.chirpId
    let me = api.getLoginValues().user
    this.state = {
      status: 'loading',
      replays: [],
      me: me,
      chirpId: chirpId,
      chirpItem: (<ChirpItemById chirpId={chirpId}/>)
    }
    this.loadReplays();
  }

  async postReplay(){
      this.setState({status: 'loading'})
      let replay = {
          chirpId: this.state.chirpId,
          user: this.state.me,
          text: this.refs.repl.value
      }
      await api.postReplay(replay, this.state.chirpId)
        .then( rep => this.setState({
            status: 'ready', 
            replays: this.state.replays.concat([rep])
        }) )
        .catch(e => {
            console.error("Failled to replay "+(e.stack? e.stack: e))
            this.setState({status: 'failled'})
        })
      this.refs.repl.value = "";
  }

  async loadReplays(){
    if ( this.state.status != 'loading' )
        this.setState({status: 'loading',replays: []})
    await api.getReplays( this.state.chirpId )
        .then( replays => 
            this.setState({replays: replays, status: 'ready'})
        ).catch( e => {
            console.error("failled to load replays: "+(e.stack?e.stack:e))
            this.setState({status: 'failled'})
        });
  }

  render(){
    let body;
    
    let chirp = this.props.post;
    let replays = this.state.replays;

    if (this.status === 'loading') 
        body = (<div>Loading replays...</div>);
    else if ( this.status === 'failled')
        body = (<div>Can not load replays</div>);
    else {
        let list ;
        if ( replays.length == 0 ) 
            list = (<li>No comments yet</li>)
        else list = replays.map( (replay,i) => 
            (<Replay replay={replay} key={JSON.stringify(replay)}/> ) );
        body = (<div>
            <ul className='chirp-list' >
                {this.state.chirpItem}
                {list}
                <li>
                    <div className='replay-form'>
                        <input type="text" ref="repl" placeholder="Write your replay" />
                        <input type="submit" value="replay" onClick={this.postReplay.bind(this)} />
                    </div>
                </li>
            </ul>
        </div>)
    }

    return (
    <div className='app'>
        <ReplaysHeader />
        {body}
    </div>);
  }
}
