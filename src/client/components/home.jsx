import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import { OtherUsers } from './otherUsers';
import { Replays } from './replays';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';



export class Home extends React.Component {

  constructor() {
    super();
    this.loadChirps()
  }

  async loadChirps( ofWhose = undefined ) {
    let me = api.getLoginValues().user;
    try {
      let state = {
        status: 'loading',
        chirps: [],
        newChirps: [],
        // values to see another user page
        me: me,
        seeingTimelineOf: ofWhose?ofWhose:me,
        userViews : undefined,
        it_is_followed_by_me: undefined,
        it_is_following_me: undefined,
        searching: false,
        // values to see a single post and the replays
        seeingAtSinglePost: undefined,
      }
      if ( this.state ) this.setState(state); else this.state=state;

      var chirps = undefined;
      var relation = undefined;
      try{ 

        chirps = await ( ofWhose ? api.getTimelineForUser(ofWhose) : api.getTimeline() )
        relation = (ofWhose && ofWhose!=this.state.me) ? ( await api.getRelation(ofWhose) ) : undefined;

        console.log("informations about "+ofWhose+"\n -> relation : "+JSON.stringify(relation)+" \n -> chirps : "+JSON.stringify(chirps) )

      }catch(e){
        console.error("Un error occourred "+e+(e.stack?("\n"+e.stack):"") )
      }
      this.setState({
        status: 'ready',
        chirps: chirps ,
        it_is_followed_by_me: relation ? relation.it_is_followed_by_me : undefined,
        it_is_following_me: relation ? relation.it_is_following_me : undefined
      })

    } catch (e) {
      console.log("Failled to load timeline : "+(e.stack?e.stack:JSON.stringify(e)) )
      this.setState({
        status: 'failed',
        it_is_followed_by_me: undefined,
        it_is_following_me: undefined
      })
    }
  }
  async reloadRelation(){
    let ofWhose = this.state.seeingTimelineOf;
    this.setState({ status: 'loading' })
    let relation = (ofWhose && ofWhose!=this.state.me) ? ( 
        await api.getRelation(ofWhose).
          catch(err =>{ console.log("Error updating relation "+(err.stack?err.stack:err) ); return undefined;} ) 
      ) : undefined;   
    if ( relation ) 
    this.setState({
      status: 'ready',
      it_is_followed_by_me: relation ? relation.it_is_followed_by_me : undefined,
      it_is_following_me: relation ? relation.it_is_following_me : undefined
    })
  }

  async addChirp(chirp) {
    chirp.id = (await api.saveChirp(chirp)).id;
    // add chirp to current list of chirps
    this.setState({
      newChirps: [chirp].concat(this.state.newChirps)
    })
  }

  async onSearchUser(key){
    if ( key != "" ){
      this.setState( {searching:true} )
      let users = await api.getUsersByKey(key)
      this.setState(   {userViews:( users?users:[] )}   )
    } else this.setState(   {userViews:undefined, searching:false}   )
  }

  async onLoadTopic(chirp){
    let id = chirp.id ? chirp.id : (chirp.user+chirp.time);
    chirp.id = id;
    this.setState({
      seeingAtSinglePost: chirp,
    })
  }

  async hideSinglePost(ev){
    //ev.preventDefault();
    this.setState({seeingAtSinglePost:undefined})
  }

  render() {
    let body;

    if (this.state.status == 'ready') {
      if ( this.state.userViews !== undefined )
        body = <OtherUsers 
                    users={this.state.userViews} 
                    onLoadTimeline={this.loadChirps.bind(this)}
                  />
      else if ( this.state.seeingAtSinglePost !== undefined )
        body = <Replays 
                  post={this.state.seeingAtSinglePost}
                  onLoadTimeline={this.loadChirps.bind(this)}
                  />
      else{
        let chirps = this.state.newChirps.concat(this.state.chirps);
        body = <Chirps 
                  chirps={chirps} 
                  onLoadTimeline={this.loadChirps.bind(this)}
                  onLoadTopic={this.onLoadTopic.bind(this)}
                />
      } 
    } else if (this.state.status == 'loading') {
      body = <div>Loading ...</div>;
    } else if (this.state.status == 'failed') {
      body = <div>Could not load messages</div>;
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
