import * as React from 'react';
import { ChirpItem as ChirpItem } from './chirp_item';

export function Chirps(props) {
  if (props.chirps === 'loading') {
    return <div>Loading...</div>;
  } else {
    let chirps = props.chirps.map(function (chirp, i) {
      return <ChirpItem 
              key={chirp.id ? chirp.id : chirp.user+chirp.time} 
              chirp={chirp}  
          />
    });
    if ( chirps && chirps.length > 0 )
      return (<ul className='chirp-list' >{chirps}</ul>);
    else return (<div>No chirps</div>);
  }
}
