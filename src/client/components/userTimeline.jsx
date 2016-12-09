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
      userId: props.userId
    }
    this.loadRelation();
  }

  async loadRelation(setFollow=undefined){
    let This = this;
    if ( this.state.status!='loading') this.setState({status:'loading', relation:undefined})
    await ( setFollow===undefined ? 
                api.getRelation(this.state.userId) :
                api.setFollow( setFollow, this.state.userId)  
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
              <h1>{this.state.userId}'s chirps</h1>
          </div>
      </header>);
  }
}

// ------------------------------  Main component here  -------------------------------------- // 

export class UserTimeline extends React.Component {

  constructor(props) {
    super(props);
    
    const userId = props.params.userId;

    this.state = {
      status: 'loading',
      userId: userId,
      chirps: []
    }
    this.loadChirps()
  }

  async loadChirps() {
    let This = this;
    await api.getTimelineForUser(this.state.userId)
      .then( chirps => This.setState({status:'ready', chirps:chirps}) )
      .catch( e => This.setState({status:'failed', chirps:[]}))
  }

  render() {
    let body;
    if ( this.state.status == 'ready' )
      body = (<Chirps 
                chirps={this.state.chirps} 
                onLoadTimeline={this.loadChirps.bind(this)}
              />) //                 onLoadTopic={this.onLoadTopic.bind(this)} 

    else if (this.state.status == 'loading') 
      body = <div>Loading ...</div>;
    else if (this.state.status == 'failed') 
      body = <div>Could not load messages</div>;
    else 
      throw new Error();
    
    return (
      <div className='app'>
        <OtherUserTimeLineHeader 
          userId={this.state.userId} 
        />
        {body}
      </div>
    );
  }
}
