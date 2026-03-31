import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AnnouncementCarousel } from '../anouncement';
import { fetchDashboardStats } from './dashboard-service';

/**
 * Staff Dashboard Home Page
 * Dynamically fetches and displays key metrics, recent patients, and pending requests.
 */
const StaffDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    pendingRequests: 0,
    pendingBreakdown: { emr: 0, appointments: 0, medicine: 0 },
    todayAppointments: 0,
    todayRemaining: 0,
    activeConsultations: 0,
    lowStockItems: 0,
  });
  const [tomorrowAvailability, setTomorrowAvailability] = useState({});
  const [recentPatients, setRecentPatients] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchDashboardStats();
      setStats(data.stats);
      setTomorrowAvailability(data.tomorrowAvailability || {});
      setRecentPatients(data.recentPatients || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    // Refresh dashboard stats every 60 seconds
    const interval = setInterval(loadDashboard, 60_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const statCards = [
    { label: 'Pending Requests', value: stats.pendingRequests, change: stats.pendingRequests > 0 ? `${stats.pendingBreakdown.emr} EMR · ${stats.pendingBreakdown.appointments} Appt · ${stats.pendingBreakdown.medicine} Rx` : '—', color: 'warning', icon: 'pending', link: '/pending' },
    { label: "Today's Appointments", value: stats.todayAppointments, change: `${stats.todayRemaining} remaining`, color: 'accent', icon: 'calendar', link: '/appointments' },
    { label: 'Active Consultations', value: stats.activeConsultations, change: stats.activeConsultations > 0 ? 'In progress' : '—', color: 'success', icon: 'chat' },
    { label: 'Low Stock Items', value: stats.lowStockItems, change: stats.lowStockItems > 0 ? 'Needs attention' : '—', color: 'error', icon: 'alert', link: '/inventory' },
  ];

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
      {/* Error Banner */}
      {error && (
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-error-700 dark:text-error-400">{error}</span>
          <button onClick={loadDashboard} className="text-xs text-error-600 hover:text-error-800 dark:text-error-400 dark:hover:text-error-300 underline">
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, idx) => {
          const Card = stat.link ? Link : 'div';
          const cardProps = stat.link ? { to: stat.link } : {};
          return (
            <Card key={idx} {...cardProps} className={`bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 ${stat.link ? 'hover:border-primary-300 dark:hover:border-primary-600 transition-colors' : ''} ${loading ? 'animate-pulse' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`p-1.5 rounded-md ${colorClasses[stat.color]}`}>
                  {icons[stat.icon]}
                </span>
                <span className="text-xs text-secondary-500 dark:text-neutral-400">{stat.change}</span>
              </div>
              <p className="text-2xl font-bold text-secondary-800 dark:text-white">{loading ? '—' : stat.value}</p>
              <p className="text-xs text-secondary-500 dark:text-neutral-400">{stat.label}</p>
            </Card>
          );
        })}
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
            <span className="text-2xl font-bold text-secondary-800 dark:text-white">{loading ? '—' : stats.todayAppointments}</span>
            <span className="text-xs text-secondary-500 dark:text-neutral-400">total</span>
            <span className="text-xs text-accent-600 dark:text-accent-400 ml-2">{loading ? '—' : stats.todayRemaining} remaining</span>
          </div>
        </div>

        {/* Tomorrow's Availability Widget */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">Tomorrow's Availability</h3>
            <Link to="/appointments" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Manage Slots</Link>
          </div>
          <div className="space-y-2">
            {Object.keys(tomorrowAvailability).length === 0 && !loading ? (
              <p className="text-xs text-secondary-400 dark:text-neutral-500">No schedulers configured</p>
            ) : (
              Object.entries(tomorrowAvailability).map(([label, data], idx) => {
                const booked = data.total - data.open;
                const pct = data.total > 0 ? (booked / data.total) * 100 : 0;
                return (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-secondary-500 dark:text-neutral-400 truncate max-w-[100px]">{label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-neutral-200 dark:bg-neutral-600 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${idx % 2 === 0 ? 'bg-accent-500' : 'bg-purple-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-secondary-700 dark:text-neutral-300">
                        {loading ? '—' : `${data.open}/${data.total}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
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
            {loading ? (
              <div className="p-6 text-center text-xs text-secondary-400 dark:text-neutral-500">Loading...</div>
            ) : recentPatients.length === 0 ? (
              <div className="p-6 text-center text-xs text-secondary-400 dark:text-neutral-500">No recent patients</div>
            ) : (
              recentPatients.map((patient) => (
                <Link
                  key={patient.id}
                  to={`/patient/${patient.id}`}
                  className="flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-600 rounded-full flex items-center justify-center text-xs font-medium text-secondary-600 dark:text-neutral-300">
                      {patient.name?.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-800 dark:text-white">{patient.name}</p>
                      <p className="text-xs text-secondary-500 dark:text-neutral-400">{patient.identifier || '—'} • {patient.program}</p>
                    </div>
                  </div>
                  <span className="text-xs text-secondary-400 dark:text-neutral-500">
                    {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : '—'}
                  </span>
                </Link>
              ))
            )}
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
            {loading ? (
              <div className="p-6 text-center text-xs text-secondary-400 dark:text-neutral-500">Loading...</div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-6 text-center text-xs text-secondary-400 dark:text-neutral-500">No pending requests</div>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3">
                  <div>
                    <p className="text-sm font-medium text-secondary-800 dark:text-white">{request.name}</p>
                    <p className="text-xs text-secondary-500 dark:text-neutral-400">
                      {request.type} • {request.submitted ? new Date(request.submitted).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400 text-xs font-medium rounded">
                      {request.status}
                    </span>
                    <Link
                      to={request.type === 'Appointment' ? '/appointments' : '/pending'}
                      className="p-1 text-secondary-400 hover:text-secondary-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
