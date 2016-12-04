import * as React from 'react';
import * as api from '../models/chirps';
import { ChirpItem as ChirpItem } from './chirp_item';

function Replay(props) {
  return (
    <li>
      <div 
        className='message replay'
      >
        <p className='author' onClick={ev => props.onLoadTimeline(props.replay.user)}>
            {props.replay.user}
        </p>
        {props.replay.text}
        </div>
    </li>
  );
}


export class Replays extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      status: 'loading',
      replays: []
    };
    this.loadReplays();
  }

  async postReplay(){
      this.setState({status: 'loading'})
      let replay = {
          chirpID: this.props.post.id,
          user: api.getLoginValues().user,
          text: this.refs.repl.value
      }
      await api.postReplay(replay)
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
    await api.getReplays( this.props.post )
        .then( replays => 
            this.setState({replays: replays, status: 'ready'})
        ).catch( e => {
            console.error("failled to load replays: "+(e.stack?e.stack:e))
            this.setState({status: 'failled'})
        });
  }

  render(){
    let chirp = this.props.post;
    let replays = this.state.replays;
    if (this.status === 'loading') 
        return <div>Loading replays...</div>;
    else if ( this.status === 'failled')
        return <div>Can not load replays</div>;
    else {
      var replaysList ;
      if ( replays.length == 0 )
        replaysList = <div>No comments yet</div>;
      else replaysList = replays.map( (replay,i) => 
          (<Replay 
            onLoadTimeline={this.props.onLoadTimeline}
            replay={replay}
            key={i}
          /> ) );
      let replayField = (<li>
          <div className='replay-form'>
              <input type="text" ref="repl" placeholder="Write your replay" />
              <input type="submit" value="replay" onClick={this.postReplay.bind(this)} />
          </div>
      </li>)
      let chirpItem = <ChirpItem chirp={chirp}  onLoadTimeline={this.props.onLoadTimeline} onLoadTopic={_=>{}} />
      return (<ul className='chirp-list' >{chirpItem}{replaysList}{replayField}</ul>);
    }
  }
}
