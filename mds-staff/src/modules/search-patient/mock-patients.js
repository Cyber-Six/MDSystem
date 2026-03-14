export const MOCK_PATIENTS = [
  {
    id: 'mock-2310346',
    identifier: '2310346',
    branch: 'Manila',
    sex: 'Male',
    first_name: 'King Rey',
    last_name: 'Samarita',
    middle_name: '',
    suffix: '',
    profile_type: 'Student',
    program: 'BSIT',
    year: '3rd Year',
    department: null,
    role: null,
    latest_ticket_id: 'MOCK-TKT-001',
    latest_status: 'Approved',
    latest_scope: 'Both',
    latest_updated_at: new Date().toISOString(),
  },
  {
    id: 'mock-2310345',
    identifier: '2310345',
    branch: 'QuezonCity',
    sex: 'Male',
    first_name: 'Random',
    last_name: 'Guy',
    middle_name: '',
    suffix: '',
    profile_type: 'Employee',
    program: null,
    year: null,
    department: 'Admin Office',
    role: 'Staff',
    latest_ticket_id: 'MOCK-TKT-002',
    latest_status: 'Pending',
    latest_scope: 'Medical',
    latest_updated_at: new Date().toISOString(),
  },
];

export function getMockPatients(searchTerm) {
  const normalized = String(searchTerm || '').trim().toLowerCase();
  if (!normalized) return [];

  return MOCK_PATIENTS.filter((patient) => {
    const full = `${patient.first_name || ''} ${patient.last_name || ''}`.toLowerCase();
    const reverse = `${patient.last_name || ''}, ${patient.first_name || ''}`.toLowerCase();

    return (
      String(patient.identifier || '').toLowerCase().includes(normalized) ||
      String(patient.first_name || '').toLowerCase().includes(normalized) ||
      String(patient.last_name || '').toLowerCase().includes(normalized) ||
      full.includes(normalized) ||
      reverse.includes(normalized)
    );
  });
}
