import { useState, useEffect } from 'react';
import { useDetectPortalFromSubdomain } from '../hooks/usePortal';
import axiosRequest from '../services/axiosRequest';
import reactLogo from '../assets/react.svg';
import viteLogo from '/vite.svg';
import '../features/dashboard/dashboard.module.css';
import DemoButton from '../components/Demo/DemoButton';

const Dashboard = ({ isHome, isAuthenticated, setIsAuthenticated }) => {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const role = useDetectPortalFromSubdomain();
  const { portal, isPatient, isMedical } = role;

  useEffect(() => {
    // Load user data on mount
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userResponse = await axiosRequest.get('/auth/me');
      setUser(userResponse.data);

      // Load appointments based on portal
      if (isPatient) {
        const apptsResponse = await axiosRequest.get('/appointments');
        setAppointments(apptsResponse.data);
      } else if (isMedical) {
        const apptsResponse = await axiosRequest.get('/staff/appointments');
        setAppointments(apptsResponse.data);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  return (
    <div className="dashboard-container">
      <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
        <img src={viteLogo} className="logo" alt="Vite logo" />
      </a>
      <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
        <img src={reactLogo} className="logo react" alt="React logo" />
      </a>
      
      <h1>
        {isPatient ? 'Patient Dashboard' : 'Staff Dashboard'}
        {user && <span> - Welcome, {user.name}</span>}
      </h1>
      
      <p>Portal: <strong>{portal}</strong></p>
      
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
      
      {appointments.length > 0 && (
        <div className="appointments-section">
          <h3>Upcoming Appointments</h3>
          <ul>
            {appointments.slice(0, 5).map((appt) => (
              <li key={appt.id}>{appt.date} - {appt.type}</li>
            ))}
          </ul>
        </div>
      )}
      
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
