import * as React from 'react';
import { Chirps } from './chirps';
import * as api from '../models/chirps'
import { Header } from './header';
import { Router, Route, Link, browserHistory } from 'react-router';


// ------------------------------  Component  -------------------------------------- // 

class OtherUserTimeLineHeader extends Header{
  constructor(props){
    super(props)
    this.state={
      status:'loading',
      relation:undefined,
      getUserId: props.getUserId,
      user:props.user
    }
    this.loadRelation();
  }

  async loadRelation(setFollow=undefined){
    let This = this;
    if ( this.state.status!='loading') this.setState({status:'loading', relation:undefined})
    await ( setFollow===undefined ? 
                api.getRelation(this.state.getUserId()) :
                api.setFollow( setFollow, this.state.getUserId())  
      ).then( raw => { 
        if ( ! raw || raw.it_is_followed_by_me === undefined || raw.it_is_following_me === undefined )
          throw "Badly formed response "+JSON.stringify(raw);
        else return {
          iAmFollowing: raw.it_is_followed_by_me ? true : false,
          iAmFollowed: raw.it_is_following_me ? true : false
        }
      } )
      .then( relation => This.setState({status:'ready', relation:relation}))
      .catch( e => {
        console.error(e);
        This.setState({status:'failed', relation:undefined})
        throw e;
      })
  }


  async unfollow(){this.loadRelation(false)}
  async follow(){this.loadRelation(true)}

  render(){
    let followedStatus;
    let followButton;
    if ( this.state.status == 'loading' ){
       followedStatus = (<div>loading</div>) 
       followButton = (<div>loading</div>) 
    }else if ( this.state.status == 'failed' || this.state.relation == undefined ){
      followedStatus = (<div>Err</div>)
      followButton = (<div>Err</div>)
    }else {
      if ( this.state.relation.iAmFollowing === false )
        followButton = (<div className='button' onClick={this.follow.bind(this)}>Follow</div>)    
      else followButton = (<div className='button' onClick={this.unfollow.bind(this)}>Unfollow</div>)
      
      if ( this.state.relation.iAmFollowed === false )
        followedStatus = (<div className="relation">not following you</div>)
      else followedStatus = (<div className="relation">following you</div>)      
    }

    return (
      <header>
          <div className='topBar'>
              {followedStatus}
              {followButton}
              <div className='button' onClick={ (_) => browserHistory.push('/') }>Home</div>
              <div className='button' onClick={super.logout.bind(this)}>Logout</div>          
          </div>
          <div className='header'>
              <h1>{this.state.user}'s chirps</h1>
          </div>
      </header>);
  }
}

// ------------------------------  Main component here  -------------------------------------- // 

export class UserTimeline extends React.Component {

  constructor(props) {
    super(props);
    
    this.state = {
      status: 'loading',
      userId: undefined,
      chirps: []
    }
    this.loadChirps()
  }

  async loadChirps() {
    api.getIdOfUser(this.props.params.user)
      .then( id => this.setState({userId:id}) )
      .then( _ => api.getTimelineForUser(this.state.userId) )
      .then( chirps => this.setState({status:'ready', chirps:chirps}) )
      .catch(_=> this.setState({status:'failed', userId:undefined, chirp:[]}))
  }

  render() {
    let body;
    if ( this.state.status == 'ready' )
      body = (<Chirps 
                chirps={this.state.chirps} 
                onLoadTimeline={this.loadChirps.bind(this)}
              />) //                 onLoadTopic={this.onLoadTopic.bind(this)} 

    else if (this.state.status == 'loading') 
      return body = <div>Loading ...</div>;
    else if (this.state.status == 'failed') 
      return body = <div>Could not load messages</div>;
    else 
      throw new Error();
    
    return (
      <div className='app'>
        <OtherUserTimeLineHeader 
          user={this.props.params.user} 
          getUserId = {() => this.state.userId }
        />
        {body}
      </div>
    );
  }
}
