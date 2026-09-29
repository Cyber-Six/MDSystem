const { serverContract } = require('./test-support/server-contract.cjs');
serverContract('staff.js', {
  portal: 'staff', defaultPort: 3001, portVariable: 'MEDICAL_PORT',
  requiredRoutes: ['/auth/login', '/auth/password', '/auth/email', '/auth/refresh', '/auth/logout', '/auth/oauth', '/info/consent', '/staff', '/dashboard/rest', '/media', '/announcement', '/analytics', '/documents', '/settings/totp', '/settings/password', '/settings', '/econsultation/chat'],
  initializers: ['initMedicalEMRGraphQL', 'initStaffEMRGraphQL', 'initMedicalProfileGraphQL', 'initMedicalAppointmentGraphQL', 'initMedicalConsultationGraphQL', 'initMedicalInventoryGraphQL', 'initMedicalMedicineRequestGraphQL', 'initPrescriptionGraphQL', 'initMedicalHealthChatGraphQL', 'initRoleManagementGraphQL', 'initDashboardGraphQL'],
});
