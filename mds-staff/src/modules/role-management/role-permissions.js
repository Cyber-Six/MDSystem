/**
 * Role Permission Constants & Defaults
 * Defines all modules, their actions, and default role templates
 */

// ─── Module action definitions ───────────────────────────────────────────
export const PERMISSION_MODULES = [
  {
    id: 'appointments',
    label: 'Appointments',
    icon: 'calendar',
    actions: [
      { id: 'view', label: 'View queue' },
      { id: 'confirm', label: 'Confirm appointment' },
      { id: 'cancel', label: 'Cancel appointment' },
      { id: 'noshow', label: 'Mark no-show' },
      { id: 'complete', label: 'Mark completed' },
    ],
  },
  {
    id: 'pendingRequests',
    label: 'Pending Requests',
    icon: 'pending',
    actions: [
      { id: 'view', label: 'View list' },
      { id: 'approveAppointment', label: 'Approve appointment requests' },
      { id: 'rejectAppointment', label: 'Reject appointment requests' },
      { id: 'approveMedicine', label: 'Approve medicine requests' },
      { id: 'rejectMedicine', label: 'Reject medicine requests' },
      { id: 'approveRecordUpdate', label: 'Approve record update requests' },
      { id: 'rejectRecordUpdate', label: 'Reject record update requests' },
    ],
  },
  {
    id: 'medicalRecords',
    label: 'Medical Records',
    icon: 'medical',
    actions: [
      { id: 'view', label: 'View records' },
      { id: 'edit', label: 'Edit / update records' },
      { id: 'addNotes', label: 'Add consultation notes' },
    ],
  },
  {
    id: 'dentalRecords',
    label: 'Dental Records',
    icon: 'dental',
    actions: [
      { id: 'view', label: 'View records' },
      { id: 'edit', label: 'Edit / update records' },
      { id: 'addNotes', label: 'Add dental notes' },
    ],
  },
  {
    id: 'patientSearch',
    label: 'Patient Search',
    icon: 'search',
    actions: [
      { id: 'view', label: 'Search & view patients' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'inventory',
    actions: [
      { id: 'view', label: 'View stock' },
      { id: 'add', label: 'Add / restock items' },
      { id: 'dispense', label: 'Dispense medicine' },
    ],
  },
  {
    id: 'roleManagement',
    label: 'Settings / Role Mgmt',
    icon: 'settings',
    actions: [
      { id: 'view', label: 'View roles & staff' },
      { id: 'edit', label: 'Edit roles & permissions' },
    ],
  },
];

// ─── Helper: build a permission map with all actions set to a value ──────
export const allActions = (val) => {
  const map = {};
  PERMISSION_MODULES.forEach((mod) => {
    map[mod.id] = {};
    mod.actions.forEach((a) => {
      map[mod.id][a.id] = val;
    });
  });
  return map;
};

// ─── Default Role Templates ─────────────────────────────────────────────
export const DEFAULT_ROLE_TEMPLATES = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full access to all system features',
    color: 'error',
    locked: true,
    permissions: allActions(true),
  },
  {
    id: 'doctor',
    name: 'Doctor',
    description: 'Medical appointments, records & pending requests',
    color: 'accent',
    locked: false,
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: true, noshow: true, complete: true },
      pendingRequests: { view: true, approveAppointment: true, rejectAppointment: true, approveMedicine: false, rejectMedicine: false, approveRecordUpdate: true, rejectRecordUpdate: true },
      medicalRecords: { view: true, edit: true, addNotes: true },
      dentalRecords: { view: false, edit: false, addNotes: false },
      patientSearch: { view: true },
      inventory: { view: false, add: false, dispense: false },
      roleManagement: { view: false, edit: false },
    },
  },
  {
    id: 'dentist',
    name: 'Dentist',
    description: 'Dental appointments, records & pending requests',
    color: 'primary',
    locked: false,
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: true, noshow: true, complete: true },
      pendingRequests: { view: true, approveAppointment: true, rejectAppointment: true, approveMedicine: false, rejectMedicine: false, approveRecordUpdate: true, rejectRecordUpdate: true },
      medicalRecords: { view: false, edit: false, addNotes: false },
      dentalRecords: { view: true, edit: true, addNotes: true },
      patientSearch: { view: true },
      inventory: { view: false, add: false, dispense: false },
      roleManagement: { view: false, edit: false },
    },
  },
  {
    id: 'nurse',
    name: 'Nurse',
    description: 'View records & appointments, limited actions',
    color: 'success',
    locked: false,
    permissions: {
      ...allActions(false),
      appointments: { view: true, confirm: true, cancel: false, noshow: false, complete: false },
      pendingRequests: { view: true, approveAppointment: false, rejectAppointment: false, approveMedicine: true, rejectMedicine: false, approveRecordUpdate: false, rejectRecordUpdate: false },
      medicalRecords: { view: true, edit: false, addNotes: false },
      dentalRecords: { view: false, edit: false, addNotes: false },
      patientSearch: { view: true },
      inventory: { view: true, add: false, dispense: true },
      roleManagement: { view: false, edit: false },
    },
  },
];

// ─── Helper: deep-clone permissions ──────────────────────────────────────
export const clonePermissions = (perms) => JSON.parse(JSON.stringify(perms));

// ─── Helper: check if permissions differ from role default ───────────────
export const hasCustomPermissions = (staffPerms, roleId, roles = DEFAULT_ROLE_TEMPLATES) => {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return true;
  return JSON.stringify(staffPerms) !== JSON.stringify(role.permissions);
};

// ─── Helper: detect which template a permissions object matches ───────────
export const detectRole = (staffPerms) => {
  for (const template of DEFAULT_ROLE_TEMPLATES) {
    if (JSON.stringify(staffPerms) === JSON.stringify(template.permissions)) {
      return template.id;
    }
  }
  return 'custom';
};

// ─── Available role colors ───────────────────────────────────────────────
export const ROLE_COLORS = ['error', 'accent', 'primary', 'success', 'purple', 'warning'];
