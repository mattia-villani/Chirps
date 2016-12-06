import * as React from 'react';
import { AddChirp } from './add_chirp';
import { SearchUser } from './searchUser';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';


export class Header extends React.Component {

  constructor() {
    super();
    this.state = {
      addChirpShown: false,
      my_user: api.getLoginValues().user
    };
  }


  showAddChirp() {
    this.setState({ addChirpShown: true });
  }

  async onChirpAdded(chirp) {
    await this.props.onChirpAdded(chirp);
    this.setState({ addChirpShown: false });
  }

  async unfollow(){
    let props = this.props;
    api.setFollow( false, this.props.displayedUser ).then(_=>
      props.notifyChange()    
    )
  }
  async follow(){
    let props = this.props;
    api.setFollow( true, this.props.displayedUser ).then(_=>
      props.notifyChange()    
    )
  }

  goToHome(){ 
    this.props.onLoadTimeline();   
  }

  logout(){
    api.removeLoginValues();
    browserHistory.push('/login');
  }

  render() {
    var addChirp = undefined;
    var searchUser = undefined;
    var followedStatus = undefined;
    var followButton = undefined;
    var goToHomeButton = undefined;
    var plusButton = undefined;
    var backButton = undefined;

    console.log("Header props "+JSON.stringify(this.props) )


    if (this.state.addChirpShown) {
      addChirp = <AddChirp onChirpAdded={this.onChirpAdded.bind(this)} user={this.state.my_user} />;
    }

    if ( (this.props.iAmFollowed === false || this.props.iAmFollowed == "false") &&!this.props.onBackButton)
      followedStatus = (<div className="relation">not following you</div>)
    else if ( (this.props.iAmFollowed === true || this.props.iAmFollowed == "true") && !this.props.onBackButton )
      followedStatus = (<div className="relation">following you</div>)

    if ( this.props.displayedUser != this.state.my_user &&  ! this.props.onBackButton ){
      goToHomeButton = (<div className='button' onClick={this.goToHome.bind(this)}>{this.state.my_user}</div>)
      if ( this.props.iAmFollowing === false || this.props.iAmFollowing == "false" )
        followButton = (<div className='button' onClick={this.follow.bind(this)}>Follow</div>)
      else if ( this.props.iAmFollowing === true || this.props.iAmFollowing == "true" )
        followButton = (<div className='button' onClick={this.unfollow.bind(this)}>Unfollow</div>)
    }else{
      searchUser = (<SearchUser onSearchUser={this.props.onSearchUser}/>);
      if ( this.props.showAddChirpButton )
        plusButton = (<div className='add-chirp' onClick={this.showAddChirp.bind(this)}>+</div>);
      else if ( this.props.onBackButton !== undefined )
        backButton = ( <div className='button' onClick={this.props.onBackButton}>Back</div> )

    }


    return (
      <header>
        <div className='topBar'>
          {searchUser}
          {followedStatus}
          {followButton}
          {goToHomeButton}
          {backButton}
          <div className='button' onClick={this.logout.bind(this)}>Logout</div>          
        </div>
        <div className='header'>
          <h1>{this.props.textToShow}</h1>
          {plusButton}
        </div>
        {addChirp}
      </header>
    );
  }
}
