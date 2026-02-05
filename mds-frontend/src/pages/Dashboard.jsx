import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/layout/layout.jsx';
import DashboardHome from '../modules/dashboard/dashboard-home.jsx';
import RecordUpdateForm from '../modules/record-forms/update-record/record-update-form.jsx';
import AppointmentPage from '../modules/appointment/appointment-page.jsx';
import MedicineRequestPage from '../modules/medicine-request/medicine-request-page.jsx';
import EConsultation from '../modules/e-consultation/e-consultation.jsx';

const Dashboard = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/record-update" element={<RecordUpdateForm />} />
        <Route path="/appointments" element={<AppointmentPage />} />
        <Route path="/medicine-request" element={<MedicineRequestPage />} />
        <Route path="/e-consultation" element={<EConsultation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

export default Dashboard;
