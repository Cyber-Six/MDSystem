import React from 'react';
import UserCard from './UserCard';
import './UserList.css';

const users = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' },
];

const UserList = () => (
  <div className="user-list">
    {users.map((user) => (
      <UserCard key={user.email} name={user.name} email={user.email} />
    ))}
  </div>
);

export default UserList;
