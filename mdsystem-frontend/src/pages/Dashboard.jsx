import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/layout';
import DashboardHome from '../modules/dashboard/dashboard-home';
import RecordUpdateForm from '../modules/record-forms/update-record/record-update-form.jsx';
import AppointmentPage from '../modules/appointment/appointment-page';
import MedicineRequestPage from '../modules/medicine-request/medicine-request-page';

const Dashboard = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/record-update" element={<RecordUpdateForm />} />
        <Route path="/appointments" element={<AppointmentPage />} />
        <Route path="/medicine-request" element={<MedicineRequestPage />} />
        <Route path="/e-consultation" element={<div>E-Consultation - Coming Soon</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default Dashboard;
