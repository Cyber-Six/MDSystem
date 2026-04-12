import React, { useState } from 'react';
import RoleTemplates from './components/role-templates';
import StaffAccounts from './components/staff-accounts';
import AdminTransfer from './components/admin-transfer';
import PatientManagement from './components/patient-management';
import { usePermissions } from '../../context/permissions-context';

/**
 * Role Management Page
 * Admin-only settings page with three sections:
 * - Staff Accounts: manage individual staff permissions
 * - Role Templates: manage reusable permission presets
 * - Admin Transfer: transfer admin privileges to another staff member
 */
const RoleManagementPage = () => {
  const [activeModule, setActiveModule] = useState('roles');
  const [activeSection, setActiveSection] = useState('staff');
  const { refetch: refetchPermissions } = usePermissions();

  const modules = [
    { id: 'roles', label: 'Role Management', icon: 'shield' },
    { id: 'patients', label: 'Patient Management', icon: 'patients' },
  ];

  const sections = [
    { id: 'staff', label: 'Staff Accounts', icon: 'users' },
    { id: 'roles', label: 'Role Templates', icon: 'shield' },
    { id: 'transfer', label: 'Admin Transfer', icon: 'transfer' },
  ];

  const sectionIcons = {
    users: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    shield: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    transfer: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    patients: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7a3 3 0 110 6 3 3 0 010-6zm6 2a2 2 0 110 4 2 2 0 010-4zM2 18a4 4 0 018 0m4 0a3 3 0 016 0" />
      </svg>
    ),
  };

  return (
    <div className="space-y-3">
      <div>
        <div>
          <h2 className="text-lg font-bold text-secondary-900 dark:text-white leading-none m-0">Administration</h2>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Manage staff access, permissions, and patient account analytics</p>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg w-fit">
        {modules.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => setActiveModule(module.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeModule === module.id
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
            }`}
          >
            {sectionIcons[module.icon]}
            {module.label}
          </button>
        ))}
      </div>

      {activeModule === 'roles' && (
        <>
          <div className="flex items-center justify-end">
            {/* Section Tabs */}
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-700/50 p-0.5 rounded-lg">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary-500 text-white shadow-sm'
                      : 'text-secondary-500 dark:text-neutral-400 hover:text-secondary-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {sectionIcons[section.icon]}
                  {section.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section Content */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-5">
            {activeSection === 'staff' && <StaffAccounts onRoleUpdate={refetchPermissions} />}
            {activeSection === 'roles' && <RoleTemplates onTemplateUpdate={refetchPermissions} />}
            {activeSection === 'transfer' && <AdminTransfer />}
          </div>
        </>
      )}

      {activeModule === 'patients' && (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-neutral-200 dark:border-neutral-700 p-5">
          <PatientManagement />
        </div>
      )}
    </div>
  );
};

export default RoleManagementPage;
