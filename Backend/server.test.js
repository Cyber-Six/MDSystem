const { serverContract } = require('./test-support/server-contract.cjs');
serverContract('server.js', {
  portal: 'patient', defaultPort: 3000, portVariable: 'PATIENT_PORT',
  requiredRoutes: ['/auth/register', '/auth/login', '/auth/user', '/auth/password', '/auth/email', '/auth/refresh', '/auth/logout', '/auth/push-token', '/auth/oauth', '/info/consent', '/media', '/announcement', '/documents', '/settings', '/settings/totp', '/settings/password', '/econsultation/chat'],
  initializers: ['initPatientEMRGraphQL', 'initMedicalEMRGraphQL', 'initStaffEMRGraphQL', 'initPatientProfileGraphQL', 'initPatientAppointmentGraphQL', 'initMedicalAppointmentGraphQL', 'initPatientMedicineRequestGraphQL', 'initPrescriptionGraphQL', 'initPatientHealthChatGraphQL', 'initMedicalHealthChatGraphQL', 'initPatientDashboardGraphQL'],
});
