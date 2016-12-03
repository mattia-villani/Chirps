import * as React from 'react';

export function ChirpItem(props) {
  let chirp = props.chirp;
  let style = {
    background: 'url(' + chirp.avatar + ')',
    backgroundSize: '52px 52px'
  };

  return (
    <li>
      <div className='avatar' 
        style={style}
        onClick={(ev)=>props.onLoadTimeline(chirp.user)}
      >{chirp.user}</div>
      <div className='message'>{chirp.message}</div>
    </li>
  );
}

