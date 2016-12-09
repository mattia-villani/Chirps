import * as React from 'react';
import { Header } from './header';
import { Chirps } from './chirps';
import { SearchUser as SearchUser } from './search';
import { Search } from './search';
import { AddChirp } from './add_chirp';
import * as api from '../models/chirps'
import { Router, Route, Link, browserHistory } from 'react-router';

// --------------------------------------- Component  ------------------------------------->>

class HomeHeader extends Header{
  constructor(props){
    super(props)
    this.state = {
      addChirpShown : false
    }
  }

  showAddChirp() {
    this.setState({ addChirpShown: true });
  }

  async onChirpAdded(chirp) {
    await this.props.onChirpAdded(chirp);
    this.setState({ addChirpShown: false });
  }


  render(){
    let addChirp;
    if (this.state.addChirpShown) {
      addChirp = <AddChirp onChirpAdded={this.onChirpAdded.bind(this)} user={this.props.userId} />;
    }

    return (
      <header>
        <div className='topBar'>
          <SearchUser onSearchUser={this.props.onSearchUser} />
          <div className='button' onClick={super.logout.bind(this)}>Logout</div>          
        </div>
        <div className='header'>
          <h1>Chirps</h1>
          <div className='add-chirp' onClick={this.showAddChirp.bind(this)}>+</div>
        </div>
        {addChirp}
      </header>
    ); 
  }
}

// --------------------------------------- MAIN Component here ------------------------>>

export class Home extends React.Component {

  constructor() {
    super();
    let me = api.getLoginValues().user;
    this.state = {
        status: 'loading',
        chirps: [],
        newChirps: [],
        me: me,
        showSearch: false,
        initValue:undefined
      }
    this.loadChirps()
  }

  async loadChirps() {
    if ( this.state.status != 'loading') this.setState({status:'loading'})
    await api.getTimeline()
      .then( chirps => this.setState({ status: 'ready', chirps: chirps }))
      .catch( e =>  {
          console.log("Failled to load timeline : "+(e.stack?e.stack:JSON.stringify(e)) )
          this.setState({ status: 'failed', chirps: [] })
      })
  }

  async addChirp(chirp) {
    chirp.id = await api.saveChirp(chirp)
    // add chirp to current list of chirps
    this.setState({ newChirps: [chirp].concat(this.state.newChirps) })
  }

  render() {
    let body;
    if (this.state.status == 'ready') {
      if ( ! this.state.showSearch ){
        let chirps = this.state.newChirps.concat(this.state.chirps);
        body = <Chirps chirps={chirps} />
      }else return (<Search onKeyEreased={()=>this.setState({showSearch:false})} initValue={this.state.initValue}/>)
    } else if (this.state.status == 'loading') {
      body = <div>Loading ...</div>;
    } else if (this.state.status == 'failed') {
      body = <div>Could not load messages</div>;
    } else {
      throw new Error();
    }

    return (
      <div className='app'>
        <HomeHeader 
            userId={this.state.me}
            onChirpAdded={this.addChirp.bind(this)} 
            onSearchUser={(key) => key && key != "" && this.setState({showSearch:true,initValue:key})}            
        />
        {body}
      </div>
    );
  }
}
