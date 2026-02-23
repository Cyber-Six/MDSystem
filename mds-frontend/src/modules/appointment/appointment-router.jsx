import React from 'react';
import { useRole } from '../../hooks/use-role';
import PatientAppointment from './patient/patient-appointment';
import StaffAppointment from './staff/staff-appointment';

const AppointmentPage = () => {
  const { role } = useRole();

  if (role === 'patient') return <PatientAppointment />;
  if (role === 'medical') return <StaffAppointment />;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-neutral-600 dark:text-neutral-400">You do not have permission to view this page.</p>
      </div>
    </div>
  );
};

export default AppointmentPage;
