import * as React from 'react';

function UserItem(props) {
  return (
    <li>
      <div 
        className='message'
        onClick={ev => props.onLoadTimeline(props.user)}
      >{props.user}</div>
    </li>
  );
}



export function OtherUsers(props) {

  if (props.users === 'loading') {
    return <div>Loading...</div>;
  } if ( !props.users || props.users.length == 0 ){
    return <div>No matchs</div>;
  }else {
    let usersList = props.users.map( user => 
        (<UserItem 
            key={user} 
            user={user} 
            onLoadTimeline={props.onLoadTimeline}
        /> ) );
    if ( usersList && usersList.length > 0 )
        return (<ul className='chirp-list' >{usersList}</ul>);
    else return (<div>No users</div>)
  }
}

