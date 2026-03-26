/**
 * Role Permission Constants & Defaults
 * Defines all modules and default role templates
 * Simplified: each module is a single ON/OFF toggle (no per-action granularity)
 */

// ─── Module definitions ──────────────────────────────────────────────────
export const PERMISSION_MODULES = [
  {
    id: 'patientSearch',
    label: 'Search Patient',
    description: 'Search and view patient profiles',
    icon: 'search',
  },
  {
    id: 'pendingRequests',
    label: 'Pending Requests',
    description: 'Approve or reject appointment, medicine, and record update requests',
    icon: 'pending',
  },
  {
    id: 'medicalRecords',
    label: 'Medical Records',
    description: 'View, edit, and add consultation notes to medical records',
    icon: 'medical',
  },
  {
    id: 'dentalRecords',
    label: 'Dental Records',
    description: 'View, edit, and add notes to dental records',
    icon: 'dental',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    description: 'Queue, confirm, cancel, no-show, and complete appointments',
    icon: 'calendar',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    description: 'View stock, add/restock items, and dispense medicine',
    icon: 'inventory',
  },
  {
    id: 'healthChat',
    label: 'Health Chat',
    description: 'Access health chat consultation and messaging features',
    icon: 'chat',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'View reports, dashboards, and system analytics',
    icon: 'chart',
  },
  {
    id: 'roleManagement',
    label: 'Role Management',
    description: 'View and edit roles, staff permissions, and system settings',
    icon: 'settings',
  },
];

// ─── Helper: build a permission map with all modules set to a value ─────
export const allModules = (val) => {
  const map = {};
  PERMISSION_MODULES.forEach((mod) => {
    map[mod.id] = val;
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
    permissions: allModules(true),
  },
  {
    id: 'doctor',
    name: 'Doctor',
    description: 'Medical appointments, records & pending requests',
    color: 'accent',
    locked: false,
    permissions: {
      patientSearch: true,
      pendingRequests: true,
      medicalRecords: true,
      dentalRecords: false,
      appointments: true,
      inventory: false,
      healthChat: false,
      analytics: false,
      roleManagement: false,
    },
  },
  {
    id: 'dentist',
    name: 'Dentist',
    description: 'Dental appointments, records & pending requests',
    color: 'primary',
    locked: false,
    permissions: {
      patientSearch: true,
      pendingRequests: true,
      medicalRecords: false,
      dentalRecords: true,
      appointments: true,
      inventory: false,
      healthChat: false,
      analytics: false,
      roleManagement: false,
    },
  },
  {
    id: 'nurse',
    name: 'Nurse',
    description: 'View records & appointments, limited actions',
    color: 'success',
    locked: false,
    permissions: {
      patientSearch: true,
      pendingRequests: true,
      medicalRecords: true,
      dentalRecords: false,
      appointments: true,
      inventory: true,
      healthChat: false,
      analytics: false,
      roleManagement: false,
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
