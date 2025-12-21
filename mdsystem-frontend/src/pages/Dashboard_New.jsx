import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/layout';
import DashboardHome from '../modules/dashboard/dashboard-home';

const Dashboard = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/record-update" element={<div>Record Update - Coming Soon</div>} />
        <Route path="/appointments" element={<div>Appointments - Coming Soon</div>} />
        <Route path="/medicine-request" element={<div>Medicine Request - Coming Soon</div>} />
        <Route path="/e-consultation" element={<div>E-Consultation - Coming Soon</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default Dashboard;
