import { useState, useEffect } from 'react';
import axiosRequest from '../services/axiosRequestHandler';
import { logout } from '../services/refreshTokenService';
import mdSystemLogo from '../assets/MDSystem.png';
import '../modules/dashboard/dashboard.module.css';
// import DemoButton from '../components/Demo/DemoButton'; // Commented out - component doesn't exist yet

const Dashboard = ({ isHome, isAuthenticated, setIsAuthenticated }) => {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    // Load user data on mount
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userResponse = await axiosRequest.get('/auth/me');
      setUser(userResponse.data);

      // Load appointments - backend determines correct data based on user role
      const apptsResponse = await axiosRequest.get('/appointments');
      setAppointments(apptsResponse.data);
    } catch (error) {
      console.error('Failed to load user data:', error);
    }
  };

  return (
    <div className="dashboard-container" style={{ paddingTop: '80px' }}>
      <div className="dashboard-header">
        <img src={mdSystemLogo} className="logo" alt="MDSystem logo" />
        <h1>
          Dashboard
          {user && <span> - Welcome, {user.name}</span>}
        </h1>
      </div>
      
      <div className="card">
        {/*<DemoButton -- commented for the meantime since it results a conflict which DemonButton does not exist yet>*/}
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
          {/*<DemoButton -- commented for the meantime since it results a conflict which DemonButton does not exist yet>*/}
        </button>
        {/*<DemoButton -- commented for the meantime since it results a conflict which DemonButton does not exist yet>*/}
        {setIsAuthenticated && (
          <button onClick={() => {
            if (isAuthenticated) {
              // SECURITY: Proper logout - clears tokens and redirects
              logout(true);
            } else {
              // Simulate login (for demo purposes)
              setIsAuthenticated((v) => !v);
            }
          }}>
            {isAuthenticated ? 'Logout' : 'Login (simulate)'}
          </button>
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
    </div>
  );
};

export default Dashboard;
