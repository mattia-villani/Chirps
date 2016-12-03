import * as React from 'react';
import * as api from '../models/chirps';



export class SearchUser extends React.Component {
  constructor() {
    super();
  }
  async onInputChange(ev) {
      this.props.onSearchUser( ev.target.value )
  }
  render() {      
    return (<div className='input'><input type='text' className='input' 
            onChange={this.onInputChange.bind(this)} 
            onKeyUp={this.onInputChange.bind(this)} 
            onCopy={this.onInputChange.bind(this)} 
            onPaste={this.onInputChange.bind(this)} 
            onCut={this.onInputChange.bind(this)} 
            placeholder='search' 
            /></div>);
  }
}
