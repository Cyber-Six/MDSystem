import React, { useState } from 'react';
import RoleTemplates from './components/role-templates';
import StaffAccounts from './components/staff-accounts';

/**
 * Role Management Page
 * Admin-only settings page with two sections:
 * - Role Templates: manage reusable permission presets
 * - Staff Accounts: manage individual staff permissions
 */
const RoleManagementPage = () => {
  const [activeSection, setActiveSection] = useState('staff');

  const sections = [
    { id: 'staff', label: 'Staff Accounts', icon: 'users' },
    { id: 'roles', label: 'Role Templates', icon: 'shield' },
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
  };

  return (
    <div className="space-y-1">
      {/* Page Header + Tabs in same row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-secondary-900 dark:text-white leading-none m-0">Role Management</h2>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Manage staff access and permissions across the system</p>
        </div>
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
        {activeSection === 'staff' && <StaffAccounts />}
        {activeSection === 'roles' && <RoleTemplates />}
      </div>
    </div>
  );
};

export default RoleManagementPage;
