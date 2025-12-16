import { useState, useEffect } from 'react';
import axiosRequest from '../services/axiosRequestHandler';
import { logout } from '../services/refreshTokenService';
import mdSystemLogo from '../assets/MDSystem.png';

const Dashboard = ({ isHome, isAuthenticated, setIsAuthenticated }) => {
  const [appointments, setAppointments] = useState([]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background - matching Auth.jsx style */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
        }}
      >
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 80% 20%, rgba(245, 158, 11, 0.1) 0%, transparent 50%)'
          }}
        />
      </div>

      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/5 backdrop-blur-md border-b border-white/10 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <img src={mdSystemLogo} className="h-10 w-10" alt="MDSystem logo" />
              <div>
                <h1 className="text-lg font-semibold text-white font-heading">
                  MDSystem
                </h1>
                <p className="text-xs text-neutral-400">Dashboard</p>
              </div>
            </div>

            {/* Nav Links */}
            <div className="hidden md:flex items-center space-x-6">
              <a href="#" className="text-sm text-white/80 hover:text-primary-400 transition-colors">Home</a>
              <a href="#" className="text-sm text-white/80 hover:text-primary-400 transition-colors">Appointments</a>
              <a href="#" className="text-sm text-white/80 hover:text-primary-400 transition-colors">Records</a>
              <a href="#" className="text-sm text-white/80 hover:text-primary-400 transition-colors">Settings</a>
            </div>
            
            {/* Logout Button */}
            <button
              onClick={() => logout(true)}
              className="px-4 py-2 bg-gradient-to-r from-error-500 to-error-600 hover:from-error-600 hover:to-error-700 
                       text-white font-medium rounded-lg transition-all duration-200 flex items-center space-x-2 
                       shadow-lg hover:shadow-xl hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-8">
            <div className="inline-block px-4 py-2 bg-primary-500/10 border border-primary-500/30 rounded-full text-primary-300 text-sm font-semibold mb-4">
              👋 Welcome back!
            </div>
            <h2 className="text-3xl font-bold text-white font-heading mb-2">
              Your Dashboard
            </h2>
            <p className="text-neutral-400">
              Here's an overview of your healthcare information.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">📅</span>
                <span className="text-xs text-primary-400 bg-primary-500/10 px-2 py-1 rounded-full">Today</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">0</h3>
              <p className="text-sm text-neutral-400">Upcoming Appointments</p>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">📋</span>
                <span className="text-xs text-success-400 bg-success-500/10 px-2 py-1 rounded-full">Updated</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">-</h3>
              <p className="text-sm text-neutral-400">Medical Records</p>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">💊</span>
                <span className="text-xs text-accent-400 bg-accent-500/10 px-2 py-1 rounded-full">Active</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">-</h3>
              <p className="text-sm text-neutral-400">Prescriptions</p>
            </div>

            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all duration-300 hover:bg-white/8 hover:border-primary-500/30 hover:-translate-y-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">💬</span>
                <span className="text-xs text-warning-400 bg-warning-500/10 px-2 py-1 rounded-full">New</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">0</h3>
              <p className="text-sm text-neutral-400">Messages</p>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Appointments Section */}
            <div className="lg:col-span-2 p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Upcoming Appointments</h3>
                <button className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
                  View all →
                </button>
              </div>
              
              {appointments.length > 0 ? (
                <ul className="space-y-3">
                  {appointments.slice(0, 5).map((appt) => (
                    <li key={appt.id} className="p-4 bg-white/5 rounded-lg border border-white/5 hover:border-primary-500/30 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{appt.type}</p>
                          <p className="text-sm text-neutral-400">{appt.date}</p>
                        </div>
                        <span className="px-3 py-1 bg-primary-500/10 text-primary-400 text-xs rounded-full">
                          Scheduled
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-12">
                  <span className="text-4xl block mb-4">📅</span>
                  <p className="text-neutral-400 mb-4">No upcoming appointments</p>
                  <button className="px-4 py-2 bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 text-white font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl">
                    Schedule Appointment
                  </button>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="p-6 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white mb-6">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full p-4 bg-white/5 border border-white/10 rounded-lg text-left hover:bg-white/8 hover:border-primary-500/30 transition-all duration-300 group">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl group-hover:scale-110 transition-transform">📅</span>
                    <div>
                      <p className="text-white font-medium">Book Appointment</p>
                      <p className="text-xs text-neutral-400">Schedule a new visit</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full p-4 bg-white/5 border border-white/10 rounded-lg text-left hover:bg-white/8 hover:border-primary-500/30 transition-all duration-300 group">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl group-hover:scale-110 transition-transform">📋</span>
                    <div>
                      <p className="text-white font-medium">View Records</p>
                      <p className="text-xs text-neutral-400">Access medical history</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full p-4 bg-white/5 border border-white/10 rounded-lg text-left hover:bg-white/8 hover:border-primary-500/30 transition-all duration-300 group">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl group-hover:scale-110 transition-transform">💬</span>
                    <div>
                      <p className="text-white font-medium">Contact Support</p>
                      <p className="text-xs text-neutral-400">Get help from our team</p>
                    </div>
                  </div>
                </button>
                
                <button className="w-full p-4 bg-white/5 border border-white/10 rounded-lg text-left hover:bg-white/8 hover:border-primary-500/30 transition-all duration-300 group">
                  <div className="flex items-center space-x-3">
                    <span className="text-xl group-hover:scale-110 transition-transform">⚙️</span>
                    <div>
                      <p className="text-white font-medium">Settings</p>
                      <p className="text-xs text-neutral-400">Manage your account</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;