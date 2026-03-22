import React from 'react';
import { Link } from 'react-router-dom';
import { AnnouncementCarousel } from '../anouncement';

/**
 * Staff Dashboard Home Page
 * Overview of key metrics and quick actions
 */
const StaffDashboard = () => {
  // TODO: Load all stats from API
  const stats = [
    { label: 'Pending Requests', value: 0, change: '—', color: 'warning', icon: 'pending' },
    { label: "Today's Appointments", value: 0, change: '0 remaining', color: 'accent', icon: 'calendar', link: '/appointments' },
    { label: 'Active Consultations', value: 0, change: '—', color: 'success', icon: 'chat' },
    { label: 'Low Stock Items', value: 0, change: '—', color: 'error', icon: 'alert' },
  ];

  // TODO: Load from patientSlot (today's date) + ScheduleDateEntity (tomorrow)
  const appointmentStats = {
    todayTotal: 0,
    todayRemaining: 0,
    ojtMissingDocs: 0,
    tomorrowMedical: { open: 0, total: 0 },
    tomorrowDental: { open: 0, total: 0 },
  };

  // TODO: Load recent patients from ClinicVisitation joined to UsersPersonal
  const recentPatients = [];

  // TODO: Load from patientUpdateLog + patientSlot (Pending status)
  const pendingRequests = [];

  const icons = {
    pending: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    calendar: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    chat: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    alert: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  const colorClasses = {
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
    accent: 'bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
    error: 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400',
  };

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className={`p-1.5 rounded-md ${colorClasses[stat.color]}`}>
                {icons[stat.icon]}
              </span>
              <span className="text-xs text-secondary-500 dark:text-neutral-400">{stat.change}</span>
            </div>
            <p className="text-2xl font-bold text-secondary-800 dark:text-white">{stat.value}</p>
            <p className="text-xs text-secondary-500 dark:text-neutral-400">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Announcements Section */}
      <AnnouncementCarousel />

      {/* Quick Actions */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
        <h3 className="text-sm font-semibold text-secondary-800 dark:text-white mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search Patient
          </Link>
          <Link
            to="/pending"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View Pending
          </Link>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium rounded-md transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Consultation
          </button>
        </div>
      </div>

      {/* Appointment & Availability Widgets */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Today's Appointments Widget */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Today's Appointments</h3>
            <Link to="/appointments" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">View Queue</Link>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-2xl font-bold text-secondary-800 dark:text-white">{appointmentStats.todayTotal}</span>
            <span className="text-xs text-secondary-500 dark:text-neutral-400">total</span>
            <span className="text-xs text-accent-600 dark:text-accent-400 ml-2">{appointmentStats.todayRemaining} remaining</span>
          </div>
          {appointmentStats.ojtMissingDocs > 0 && (
            <div className="flex items-center gap-1.5 mt-2 p-1.5 bg-warning-50 dark:bg-warning-900/20 rounded text-xs text-warning-700 dark:text-warning-400">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {appointmentStats.ojtMissingDocs} OJT appointment{appointmentStats.ojtMissingDocs > 1 ? 's' : ''} missing documents
            </div>
          )}
        </div>

        {/* Tomorrow's Availability Widget */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Tomorrow's Availability</h3>
            <Link to="/appointments" className="text-xs text-primary-600 dark:text-primary-400 hover:underline" onClick={() => {}}>Manage Slots</Link>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary-500 dark:text-neutral-400">Medical</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent-500 rounded-full" 
                    style={{ width: `${appointmentStats.tomorrowMedical.total > 0 ? ((appointmentStats.tomorrowMedical.total - appointmentStats.tomorrowMedical.open) / appointmentStats.tomorrowMedical.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-secondary-700 dark:text-neutral-300">{appointmentStats.tomorrowMedical.open}/{appointmentStats.tomorrowMedical.total}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary-500 dark:text-neutral-400">Dental</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{ width: `${appointmentStats.tomorrowDental.total > 0 ? ((appointmentStats.tomorrowDental.total - appointmentStats.tomorrowDental.open) / appointmentStats.tomorrowDental.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-secondary-700 dark:text-neutral-300">{appointmentStats.tomorrowDental.open}/{appointmentStats.tomorrowDental.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Patients */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Recent Patients</h3>
            <Link to="/search" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {recentPatients.map((patient) => (
              <Link
                key={patient.id}
                to={`/patient/${patient.id}`}
                className="flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-600 rounded-full flex items-center justify-center text-xs font-medium text-secondary-600 dark:text-neutral-300">
                    {patient.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.name}</p>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">{patient.id} • {patient.program}</p>
                  </div>
                </div>
                <span className="text-xs text-secondary-400 dark:text-neutral-500">{patient.lastVisit}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Pending Requests */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Pending Requests</h3>
            <Link to="/pending" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium text-secondary-800 dark:text-white">{request.name}</p>
                  <p className="text-xs text-secondary-500 dark:text-neutral-400">{request.type} • {request.submitted}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-xs font-medium rounded">
                    {request.status}
                  </span>
                  <button className="p-1 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
