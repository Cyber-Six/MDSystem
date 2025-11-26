

import reactLogo from '../assets/react.svg';
import viteLogo from '/vite.svg';
import React, { useState } from 'react';
import '../features/dashboard/dashboard.module.css';
import DemoButton from '../components/Demo/DemoButton';

const Dashboard = ({ isHome, isAuthenticated, setIsAuthenticated }) => {
  const [count, setCount] = useState(0);

  return (
    <div className="dashboard-container">
      <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
        <img src={viteLogo} className="logo" alt="Vite logo" />
      </a>
      <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
        <img src={reactLogo} className="logo react" alt="React logo" />
      </a>
      <h1>Vite + React</h1>
      <div className="card">
        <DemoButton onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </DemoButton>
        {setIsAuthenticated && (
          <DemoButton onClick={() => setIsAuthenticated((v) => !v)}>
            {isAuthenticated ? 'Logout' : 'Login (simulate)'}
          </DemoButton>
        )}
        <p>
          Edit <code>src/pages/Dashboard.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      {isHome && (
        <p>
          <a href="/dashboard">Go to Dashboard (Protected)</a>
        </p>
      )}
    </div>
  );
};

export default Dashboard;
