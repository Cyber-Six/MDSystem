import React from 'react';
import { Navigate } from 'react-router-dom';

// Example usage: <PrivateRoute isAuthenticated={true}><Dashboard /></PrivateRoute>
const PrivateRoute = ({ isAuthenticated, children }) => {
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default PrivateRoute;
