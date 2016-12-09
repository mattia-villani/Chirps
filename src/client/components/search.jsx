import * as React from 'react';
import * as api from '../models/chirps';
import { Header } from './header';
import { Router, Route, Link, browserHistory } from 'react-router';

// ------------------------------  Component  -------------------------------------- // 

function UserItem(props) {
  return (
    <li>
      <div 
        className='message'
        onClick={ev => props.loadTimeline(props.user)}
      >{props.user}</div>
    </li>
  );
}

// ------------------------------  Component  -------------------------------------- // 


function OtherUsers(props) {
  if ( !props.users || props.users.length == 0 )
    return <div>No matchs</div>;
  let usersList = props.users.map( user => 
      (<UserItem 
          key={user} 
          user={user} 
          loadTimeline={props.loadTimeline}
      /> ) );
  return (<ul className='chirp-list' >{usersList}</ul>);
}

// ------------------------------  Component  -------------------------------------- // 


export class SearchUser extends React.Component {
  constructor(props){
      super(props);
  }
  async onInputChange(ev) { 
    if ( this.props.enabled !== false ) 
        this.props.onSearchUser( ev.target.value )
    else console.log("unhandled onsearchUser");      
  }
  componentDidMount(){
      var value = this.props.initValue ? this.props.initValue : undefined;
      if ( value && !this.refs.input_search_user.value ){
        console.log("component mounted")
        this.refs.input_search_user.value = value;
        this.props.onSearchUser( value )
      }
  }
  render(){
    let onInputChange = this.onInputChange.bind(this)
    return (
        <div className='input'><input type='text' className='input' ref='input_search_user'
            onChange={onInputChange} 
            onKeyUp={onInputChange} 
            onCopy={onInputChange} 
            onPaste={onInputChange} 
            onCut={onInputChange} 
            placeholder='search' 
            autoFocus
            /></div>);
  }
}

// ------------------------------  Component  -------------------------------------- // 


class SearchHeader extends Header{
    constructor(props){
        super(props)
    }
    render(){
        return (
        <header>
            <div className='topBar'>
                <SearchUser onSearchUser={this.props.onSearchUser} enabled={this.props.status=='ready'} initValue={this.props.initValue}/>
                <div className='button' onClick={super.logout.bind(this)}>Logout</div>          
            </div>
            <div className='header'>
                <h1>Searching{this.props.status=='loading'?'...':undefined}</h1>
            </div>
        </header>);
    }
}

// ------------------------------ BODY HERE -------------------------------------- // 

export class Search extends React.Component {

  constructor(props) {
    super(props);
    let initialKey = (props.key && props.key != "") ? props.key : undefined ;
    this.state = {
        status : initialKey ? 'loading' : 'ready',
        users: [],
        key: "",
        me: api.getLoginValues().user
    }
    if ( initialKey )
        searchUser(key)
  }

  loadTimeline(user){
      if ( user == this.state.me )
        browserHistory.push('/timeline')
      else
        browserHistory.push('/timeline/'+user);
  }

  async searchUser(key){
    if ( !key || key == "" ) {
        this.setState( {users:[], status:'ready', key:''} )
        if (this.props.onKeyEreased) this.props.onKeyEreased();
    }else{ 
        let This = this;
        if ( this.state.status!='loading' ) this.setState( {status:'loading', key:key} )
        await 
            api.getUsersByKey(key)
                .then( users => This.setState( {users:(users?users:[]), status:'ready'} ) )
                .catch( e => { console.log('error'+e); This.setState({status:'failed', users:[]})})
    } 
  }

  render() {
    let body;

    if (this.state.status == 'failed') {
      body = <div>Could not search</div>;
    } else if ( this.state.key == '' )
        body = (<div>type something</div>)
    else
        body = <OtherUsers 
                users={this.state.users.filter(u => u!=this.state.me)} 
                loadTimeline={this.loadTimeline.bind(this)}
                />

    return (
      <div className='app'>
        <SearchHeader 
            status={ this.state.status }
            onSearchUser={this.searchUser.bind(this)}
            initValue={this.props.initValue}
            />
        {body}
      </div>
    );
  }
}
