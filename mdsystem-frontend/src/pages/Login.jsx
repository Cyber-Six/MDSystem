import React from 'react';
import '../features/auth/login.module.css';

const Login = () => {
  return (
    <form className="login-form">
      <h2>Login Page (Public)</h2>
      <input type="text" placeholder="Username" />
      <input type="password" placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  );
};

export default Login;
