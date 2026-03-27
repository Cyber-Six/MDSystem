/**
 * Role Permission Constants & Helpers
 * Granular permission keys grouped by modules, with default templates.
 * Keep MODULE_PERMISSION_MAP in sync with Backend/services/permit.js
 */

// ─── Module → Granular Key Mapping ───────────────────────────────────────
export const MODULE_PERMISSION_MAP = {
  patientSearch: ['profile_allow_view', 'emr_allow_view'],
  pendingRequests: ['emr_allow_approval', 'profile_allow_approval', 'appointment_allow_approval', 'medicine_request_allow_approve'],
  medicalRecords: ['emr_allow_view', 'emr_allow_edit', 'emr_allow_edit_catalogs', 'consultation_allow_view', 'consultation_allow_edit', 'profile_allow_view', 'profile_allow_edit'],
  dentalRecords: ['emr_allow_view', 'emr_allow_edit', 'emr_allow_set_dental_record', 'consultation_allow_view', 'consultation_allow_edit'],
  appointments: ['appointment_allow_approval', 'appointment_allow_view_records', 'appointment_allow_view_configuration', 'appointment_allow_edit_configuration'],
  inventory: ['inventory_allow_view', 'inventory_allow_edit', 'inventory_allow_dispense', 'inventory_allow_manage_requests', 'inventory_allow_prescribe'],
  healthChat: ['health_chat_allow_access', 'health_chat_allow_manage'],
  analytics: ['analytics_allow_view', 'analytics_allow_export'],
  roleManagement: ['role_management_allow_access', 'role_management_allow_edit'],
};

// ─── Human-readable Labels for Permission Keys ──────────────────────────
export const PERMISSION_KEY_LABELS = {
  profile_allow_view: 'View Profiles',
  profile_allow_edit: 'Edit Profiles',
  profile_allow_approval: 'Approve Profile Changes',
  emr_allow_view: 'View Medical Records',
  emr_allow_edit: 'Edit Medical Records',
  emr_allow_approval: 'Approve Record Changes',
  emr_allow_edit_catalogs: 'Edit Catalogs',
  emr_allow_set_dental_record: 'Set Dental Record',
  consultation_allow_view: 'View Consultations',
  consultation_allow_edit: 'Edit Consultations',
  appointment_allow_approval: 'Approve Appointments',
  appointment_allow_view_records: 'View Appointment Records',
  appointment_allow_view_configuration: 'View Appointment Config',
  appointment_allow_edit_configuration: 'Edit Appointment Config',
  inventory_allow_view: 'View Inventory',
  inventory_allow_edit: 'Edit Inventory',
  inventory_allow_dispense: 'Dispense Medicine',
  inventory_allow_manage_requests: 'Manage Medicine Requests',
  inventory_allow_prescribe: 'Prescribe Medicine',
  medicine_request_allow_approve: 'Approve Medicine Requests',
  health_chat_allow_access: 'Access Health Chat',
  health_chat_allow_manage: 'Manage Health Chat',
  analytics_allow_view: 'View Analytics',
  analytics_allow_export: 'Export Analytics',
  role_management_allow_access: 'Access Role Management',
  role_management_allow_edit: 'Edit Roles & Templates',
};

// ─── Module Definitions (for UI layout) ──────────────────────────────────
export const PERMISSION_MODULES = [
  { id: 'patientSearch', label: 'Search Patient', description: 'Search and view patient profiles', icon: 'search' },
  { id: 'pendingRequests', label: 'Pending Requests', description: 'Approve or reject appointment, medicine, and record update requests', icon: 'pending' },
  { id: 'medicalRecords', label: 'Medical Records', description: 'View, edit, and add consultation notes to medical records', icon: 'medical' },
  { id: 'dentalRecords', label: 'Dental Records', description: 'View, edit, and add notes to dental records', icon: 'dental' },
  { id: 'appointments', label: 'Appointments', description: 'Queue, confirm, cancel, no-show, and complete appointments', icon: 'calendar' },
  { id: 'inventory', label: 'Inventory', description: 'View stock, add/restock items, and dispense medicine', icon: 'inventory' },
  { id: 'healthChat', label: 'Health Chat', description: 'Access health chat consultation and messaging features', icon: 'chat' },
  { id: 'analytics', label: 'Analytics', description: 'View reports, dashboards, and system analytics', icon: 'chart' },
  { id: 'roleManagement', label: 'Role Management', description: 'Access role templates and staff permission management', icon: 'settings' },
];

// ─── Collect all unique mapped keys ──────────────────────────────────────
function getAllMappedKeys() {
  const keys = new Set();
  for (const moduleKeys of Object.values(MODULE_PERMISSION_MAP)) {
    for (const key of moduleKeys) keys.add(key);
  }
  return [...keys];
}

// ─── Build a granular permission map with all mapped keys set to val ─────
export const allKeys = (val) => {
  const map = {};
  for (const key of getAllMappedKeys()) map[key] = val;
  return map;
};

/** @deprecated Use allKeys instead */
export const allModules = allKeys;

// ─── Expand module toggles { moduleId: boolean } → { key: boolean } ─────
export const expandModulePermissions = (moduleMap) => {
  const keyStates = {};
  for (const [moduleId, keys] of Object.entries(MODULE_PERMISSION_MAP)) {
    const enabled = !!moduleMap[moduleId];
    for (const key of keys) {
      if (enabled) {
        keyStates[key] = true;
      } else if (!(key in keyStates)) {
        keyStates[key] = false;
      }
    }
  }
  return keyStates;
};

// ─── Derive module state from granular keys ──────────────────────────────
// Returns 'on' | 'partial' | 'off'
export const getModuleState = (perms, moduleId) => {
  const keys = MODULE_PERMISSION_MAP[moduleId] || [];
  if (keys.length === 0) return 'off';
  const count = keys.filter((k) => !!perms[k]).length;
  if (count === keys.length) return 'on';
  if (count > 0) return 'partial';
  return 'off';
};

// ─── Set all keys for a module to a boolean value ────────────────────────
export const setModuleKeys = (perms, moduleId, val) => {
  const updated = { ...perms };
  for (const key of MODULE_PERMISSION_MAP[moduleId] || []) updated[key] = val;
  return updated;
};

// ─── Default Role Templates ─────────────────────────────────────────────
export const DEFAULT_ROLE_TEMPLATES = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Full access to all system features',
    color: 'error',
    locked: true,
    permissions: allKeys(true),
  },
  {
    id: 'doctor',
    name: 'Doctor',
    description: 'Medical appointments, records & pending requests',
    color: 'accent',
    locked: false,
    permissions: expandModulePermissions({
      patientSearch: true, pendingRequests: true, medicalRecords: true,
      dentalRecords: false, appointments: true, inventory: false,
      healthChat: false, analytics: false,
    }),
  },
  {
    id: 'dentist',
    name: 'Dentist',
    description: 'Dental appointments, records & pending requests',
    color: 'primary',
    locked: false,
    permissions: expandModulePermissions({
      patientSearch: true, pendingRequests: true, medicalRecords: false,
      dentalRecords: true, appointments: true, inventory: false,
      healthChat: false, analytics: false,
    }),
  },
  {
    id: 'nurse',
    name: 'Nurse',
    description: 'View records & appointments, limited actions',
    color: 'success',
    locked: false,
    permissions: expandModulePermissions({
      patientSearch: true, pendingRequests: true, medicalRecords: true,
      dentalRecords: false, appointments: true, inventory: true,
      healthChat: false, analytics: false,
    }),
  },
];

// ─── Deep-clone permissions ──────────────────────────────────────────────
export const clonePermissions = (perms) => JSON.parse(JSON.stringify(perms));

// ─── Check if granular permissions differ from role default ──────────────
export const hasCustomPermissions = (staffPerms, roleId, roles = DEFAULT_ROLE_TEMPLATES) => {
  const role = roles.find((r) => r.id === roleId);
  if (!role) return true;
  const mapped = getAllMappedKeys();
  for (const key of mapped) {
    if (!!staffPerms[key] !== !!role.permissions[key]) return true;
  }
  return false;
};

// ─── Detect which template a granular permissions object matches ─────────
export const detectRole = (staffPerms) => {
  const mapped = getAllMappedKeys();
  for (const template of DEFAULT_ROLE_TEMPLATES) {
    const match = mapped.every((k) => !!staffPerms[k] === !!template.permissions[k]);
    if (match) return template.id;
  }
  return 'custom';
};

// ─── Available role colors ───────────────────────────────────────────────
export const ROLE_COLORS = ['error', 'accent', 'primary', 'success', 'purple', 'warning'];
