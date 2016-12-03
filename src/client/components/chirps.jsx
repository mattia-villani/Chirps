import * as React from 'react';
import { ChirpItem as ChirpItem } from './chirp_item';

export function Chirps(props) {
  if (props.chirps === 'loading') {
    return <div>Loading...</div>;
  } else {
    let chirps = props.chirps.map(function (chirp, i) {
      return <ChirpItem key={i} chirp={chirp}  onLoadTimeline={props.onLoadTimeline}
/>
    });
    if ( chirps && chirps.length > 0 )
      return (<ul className='chirp-list' >{chirps}</ul>);
    else return (<div>No chirps</div>);
  }
}
