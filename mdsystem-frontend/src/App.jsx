import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './routes/PrivateRoute.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';


function App() {
  // Simulate authentication state (replace with real auth logic)
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard isHome isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute isAuthenticated={isAuthenticated}>
            <Dashboard isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App
