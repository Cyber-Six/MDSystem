/**
 * Role Permission Constants & Helpers
 * Granular permission keys grouped by modules, with default templates.
 * Keep MODULE_PERMISSION_MAP in sync with Backend/services/permit.js
 */

// ─── Module → Granular Key Mapping ───────────────────────────────────────
export const MODULE_PERMISSION_MAP = {
  patientSearch: ['profile_allow_view', 'emr_allow_view', 'profile_allow_update_email_identifier'],
  pendingRequests: ['emr_allow_approval', 'profile_allow_approval', 'appointment_allow_approval', 'medicine_request_allow_approve'],
  medicalRecords: ['emr_allow_view', 'emr_allow_edit', 'emr_allow_edit_catalogs', 'emr_allow_set_vital_sign', 'consultation_allow_view', 'consultation_allow_edit', 'profile_allow_view', 'profile_allow_edit'],
  dentalRecords: ['emr_allow_view', 'emr_allow_edit', 'emr_allow_set_dental_record', 'consultation_allow_view', 'consultation_allow_edit'],
  appointments: ['appointment_allow_approval', 'appointment_allow_view_records', 'appointment_allow_view_configuration', 'appointment_allow_edit_configuration'],
  inventory: ['inventory_allow_view', 'inventory_allow_edit', 'inventory_allow_dispense', 'inventory_allow_manage_requests', 'inventory_allow_prescribe', 'inventory_allow_configure'],
  announcements: ['announcement_allow_crud'],
  healthChat: ['health_chat_allow_access'],
  sendNotification: ['notification_allow_send_to_patients'],
  analytics: ['analytics_allow_view', 'analytics_allow_export'],
  // Documents reuses the same parent toggle + child dropdown tiering behavior.
  documents: ['document_allow_view', 'document_allow_manage', 'document_allow_generate'],
  // superiorAccess tracked here so the key is included in template CRUD operations
  // Rendered as a Major Permission Switch in the UI (not a regular expandable module)
  superiorAccess: ['privileged_to_perform_on_superior'],
  // roleManagement excluded — admin-only via is_admin, not assignable via templates
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
  analytics_allow_view: 'View Analytics',
  analytics_allow_export: 'Export Analytics',
  document_allow_view: 'View Documents',
  document_allow_manage: 'Manage Documents',
  document_allow_generate: 'Generate Documents',
  // Keys now in their respective modules
  emr_allow_set_vital_sign: 'Set Vital Signs',
  notification_allow_send_to_patients: 'Send Notification to Patients',
  announcement_allow_crud: 'Manage Announcements',
  inventory_allow_configure: 'Configure Inventory',
  profile_allow_update_email_identifier: 'Update Email Identifier',
  privileged_to_perform_on_superior: 'Access Superior Accounts',
  // role_management keys excluded — admin-only
};

// ─── Module Definitions (for UI layout) ──────────────────────────────────
export const PERMISSION_MODULES = [
  { id: 'patientSearch', label: 'Search Patient', description: 'Search and view patient profiles and medical identifiers', icon: 'search' },
  { id: 'pendingRequests', label: 'Pending Requests', description: 'Approve or reject appointment, medicine, and record update requests', icon: 'pending' },
  { id: 'medicalRecords', label: 'Medical Records', description: 'View, edit, add consultation notes and set vital signs', icon: 'medical' },
  { id: 'dentalRecords', label: 'Dental Records', description: 'View, edit, and add notes to dental records', icon: 'dental' },
  { id: 'appointments', label: 'Appointments', description: 'Queue, confirm, cancel, no-show, and complete appointments', icon: 'calendar' },
  { id: 'inventory', label: 'Inventory', description: 'View stock, add/restock items, dispense and configure medicine', icon: 'inventory' },
  { id: 'announcements', label: 'Announcements', description: 'Create, edit, and delete announcements visible to all users', icon: 'bell' },
  { id: 'healthChat', label: 'Health Chat', description: 'Access health chat consultation and messaging features', icon: 'chat' },
  { id: 'sendNotification', label: 'Send Notification', description: 'Send push notifications and alerts directly to patients', icon: 'notification' },
  { id: 'analytics', label: 'Analytics', description: 'View reports, dashboards, and system analytics', icon: 'chart' },
  { id: 'documents', label: 'Documents', description: 'View, manage, and generate patient documents and templates', icon: 'document' },
  // superiorAccess excluded here — rendered as a Major Permission Switch instead
  // roleManagement excluded — admin-only access
];

// ─── Major Permission Switches ────────────────────────────────────────────
// Cross-cutting permissions rendered as prominent standalone toggles in the
// PermissionMatrix, separate from the regular module list.
export const MAJOR_PERMISSION_SWITCHES = [
  {
    id: 'superiorAccess',
    key: 'privileged_to_perform_on_superior',
    label: 'Superior Account Access',
    description: 'Allow performing medical actions on patients with Superior identity (e.g. administrators, executives). Grant with caution.',
    icon: 'shield',
  },
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
      announcements: false, healthChat: false, sendNotification: false, analytics: false, documents: false,
      superiorAccess: false,
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
      announcements: false, healthChat: false, sendNotification: false, analytics: false, documents: false,
      superiorAccess: false,
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
      announcements: false, healthChat: false, sendNotification: false, analytics: false, documents: false,
      superiorAccess: false,
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
