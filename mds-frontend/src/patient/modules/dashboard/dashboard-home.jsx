import React from 'react';
import { Link } from 'react-router-dom';

const DashboardHome = () => {
  const pendingRequests = [
    { id: 1, type: 'Appointment', title: 'Medical Consultation', date: 'Dec 25, 2025', status: 'Pending', color: 'blue' },
    { id: 2, type: 'Medicine Request', title: 'Biogesic Request', date: 'Dec 20, 2025', status: 'Approved', color: 'green' },
    { id: 3, type: 'Record Update', title: 'Medical Record Update', date: 'Dec 18, 2025', status: 'Pending Verification', color: 'yellow' },
  ];

  const upcomingAppointments = [
    { id: 1, service: 'Medical Consultation', date: 'Dec 25, 2025', time: '10:00 AM', doctor: 'Dr. Smith' },
    { id: 2, service: 'Dental Checkup', date: 'Jan 5, 2026', time: '2:00 PM', doctor: 'Dr. Johnson' },
  ];

  const stats = [
    { title: 'Pending Requests', value: '3', icon: 'clock' },
    { title: 'Upcoming Appointments', value: '2', icon: 'calendar' },
    { title: 'Medicine Requests', value: '5', icon: 'medication' },
    { title: 'Consultations', value: '8', icon: 'chat' },
  ];

  const icons = {
    clock: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    calendar: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    medication: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    chat: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  };

  const statusBadgeColors = {
    blue: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    yellow: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200',
    purple: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-200',
  };

  return (
    <div className="space-y-6 py-6">
      {/* Welcome Section */}
      <div className="rounded-xl p-6" style={{ backgroundColor: '#F1C526' }}>
        <h1 className="text-3xl font-bold mb-1 text-white" style={{ margin: 0 }}>Welcome back, Student!</h1>
        <p className="text-white/80" style={{ margin: 0 }}>Here's what's happening with your health records today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-stone-200 dark:border-neutral-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-secondary-500 dark:text-gray-400">{stat.title}</p>
                <p className="text-3xl font-bold text-secondary-900 dark:text-white mt-1">{stat.value}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                {icons[stat.icon]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Requests Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-stone-200 dark:border-neutral-700 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-neutral-700 flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-primary-500"></div>
          <h2 className="text-xl font-semibold text-secondary-900 dark:text-white" style={{ margin: 0 }}>Pending Requests</h2>
        </div>
        <div className="p-6">
          {pendingRequests.length > 0 ? (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-50 dark:bg-neutral-800 rounded-xl border border-stone-200 dark:border-neutral-700 gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusBadgeColors[request.color]}`}>
                        {request.type}
                      </span>
                      <h3 className="font-medium text-secondary-900 dark:text-white">{request.title}</h3>
                    </div>
                    <div className="flex items-center flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {request.date}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        request.status === 'Approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-colors">
                      View
                    </button>
                    {request.status === 'Pending' && (
                      <button className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No pending requests</p>
          )}
        </div>
      </div>

      {/* Upcoming Appointments */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-stone-200 dark:border-neutral-700 shadow-sm">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-primary-500"></div>
            <h2 className="text-xl font-semibold text-secondary-900 dark:text-white" style={{ margin: 0 }}>Upcoming Appointments</h2>
          </div>
          <Link
            to="/appointments"
            className="text-sm font-medium text-primary-600 dark:text-primary-500 hover:text-primary-700 dark:hover:text-primary-400"
          >
            View All
          </Link>
        </div>
        <div className="p-6">
          {upcomingAppointments.length > 0 ? (
            <div className="space-y-4">
              {upcomingAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-primary-50 dark:bg-primary-500/10 rounded-xl border border-primary-200 dark:border-primary-500/30 gap-4"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-secondary-900 dark:text-white">{appointment.service}</h3>
                      <p className="text-sm text-secondary-600 dark:text-gray-400">{appointment.doctor}</p>
                      <p className="text-sm text-secondary-500 dark:text-gray-500 mt-1">
                        {appointment.date} at {appointment.time}
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-500/10 rounded-lg transition-colors">
                    Reschedule
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No upcoming appointments</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/record-update"
          className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-stone-200 dark:border-neutral-700 shadow-sm hover:border-primary-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-500/20 rounded-xl flex items-center justify-center group-hover:bg-primary-500 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-primary-700 dark:text-primary-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-secondary-900 dark:text-white">Update Records</h3>
              <p className="text-sm text-secondary-500 dark:text-gray-400">Update medical & dental info</p>
            </div>
          </div>
        </Link>

        <Link
          to="/appointments"
          className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-stone-200 dark:border-neutral-700 shadow-sm hover:border-primary-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-500/20 rounded-xl flex items-center justify-center group-hover:bg-primary-500 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-primary-700 dark:text-primary-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-secondary-900 dark:text-white">Book Appointment</h3>
              <p className="text-sm text-secondary-500 dark:text-gray-400">Schedule a consultation</p>
            </div>
          </div>
        </Link>

        <Link
          to="/medicine-request"
          className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-stone-200 dark:border-neutral-700 shadow-sm hover:border-primary-400 hover:shadow-md transition-all group"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-500/20 rounded-xl flex items-center justify-center group-hover:bg-primary-500 transition-colors flex-shrink-0">
              <svg className="w-6 h-6 text-primary-700 dark:text-primary-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-secondary-900 dark:text-white">Request Medicine</h3>
              <p className="text-sm text-secondary-500 dark:text-gray-400">Submit medicine request</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default DashboardHome;
