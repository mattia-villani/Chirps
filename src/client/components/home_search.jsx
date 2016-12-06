import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import { OtherUsers } from './otherUsers';
import { Replays } from './replays';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';



export class HomeSeach extends React.Component {

  constructor() {
    this.state = {
        status : 'ready',

    }
    super();
  }

  async onSearchUser(key){
    if ( key != "" ){
      this.setState( {searching:true} )
      let users = await api.getUsersByKey(key)
      this.setState(   {userViews:( users?users:[] )}   )
    } else this.setState(   {userViews:undefined, searching:false}   )
  }

  render() {
    let body;

    if (this.state.status == 'ready') {
      if ( this.state.userViews !== undefined )
        body = <OtherUsers 
                    users={this.state.userViews} 
                    onLoadTimeline={this.loadChirps.bind(this)}
                  />
    } else if (this.state.status == 'loading') {
      body = <div>Loading ...</div>;
    } else if (this.state.status == 'failed') {
      body = <div>Could not search</div>;
    } else {
      throw new Error();
    }
    

    return (
      <div className='app'>
        <Header 
            showAddChirpButton={ this.state.seeingTimelineOf == this.state.me && !this.state.seeingAtSinglePost && !this.state.userViews }
            onChirpAdded={this.addChirp.bind(this)} 
            
            onSearchUser={this.onSearchUser.bind(this)}
            iAmFollowing={this.state.it_is_followed_by_me}
            iAmFollowed={this.state.it_is_following_me}
            displayedUser={this.state.seeingTimelineOf}
            notifyChange={this.reloadRelation.bind(this)}
            onLoadTimeline={this.loadChirps.bind(this)}
            onBackButton={this.state.seeingAtSinglePost ? this.hideSinglePost.bind(this) : undefined}
            textToShow={
              this.state.seeingAtSinglePost ? "Replay"
              :(this.state.searching?"searching":(this.state.seeingTimelineOf+"'s Chirps"))}/>
        {body}
      </div>
    );
  }
}
