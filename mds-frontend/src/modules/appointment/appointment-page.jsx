import React, { useState } from 'react';

const AppointmentPage = () => {
  const [formData, setFormData] = useState({
    serviceType: '',
    preferredDate: '',
    preferredTime: '',
    reason: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointments, setAppointments] = useState([
    {
      id: 1,
      serviceType: 'Medical Consultation',
      date: '2024-01-15',
      time: 'Morning',
      status: 'Pending',
      reason: 'Regular checkup'
    },
    {
      id: 2,
      serviceType: 'Dental Checkup',
      date: '2024-01-10',
      time: 'Afternoon',
      status: 'Completed',
      reason: 'Tooth cleaning'
    }
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newAppointment = {
        id: appointments.length + 1,
        ...formData,
        status: 'Pending'
      };
      
      setAppointments([newAppointment, ...appointments]);
      setFormData({ serviceType: '', preferredDate: '', preferredTime: '', reason: '' });
      alert('Appointment request submitted successfully!');
    } catch (error) {
      console.error('Error submitting appointment:', error);
      alert('Error submitting appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'confirmed':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          Book an Appointment
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Schedule your medical or dental consultation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Appointment Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">
              New Appointment Request
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Service Type *
                </label>
                <select
                  required
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select Service</option>
                  <option value="Medical Consultation">Medical Consultation</option>
                  <option value="Dental Checkup">Dental Checkup</option>
                  <option value="Dental Cleaning">Dental Cleaning</option>
                  <option value="Follow-up Consultation">Follow-up Consultation</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>

              {/* Preferred Date */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Preferred Date *
                </label>
                <input
                  required
                  type="date"
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({ ...formData, preferredDate: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Preferred Time Slot */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Preferred Time Slot *
                </label>
                <select
                  required
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({ ...formData, preferredTime: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select Time Slot</option>
                  <option value="Morning">Morning (8:00 AM - 12:00 PM)</option>
                  <option value="Afternoon">Afternoon (1:00 PM - 5:00 PM)</option>
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Reason for Appointment *
                </label>
                <textarea
                  required
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows="4"
                  placeholder="Please describe your symptoms or reason for the appointment"
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg 
                         transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Appointment Request</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Info Card */}
        <div>
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4">
              Important Information
            </h3>
            <ul className="space-y-3 text-sm text-primary-700 dark:text-primary-300">
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Appointments are subject to availability and confirmation</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>You will receive a confirmation email once your appointment is confirmed</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Please arrive 10 minutes before your scheduled time</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Bring your student ID and any relevant medical documents</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Appointments History */}
      <div className="mt-8 bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">
          Your Appointments
        </h2>

        {appointments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Service</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Time</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{appointment.serviceType}</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{appointment.date}</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{appointment.time}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 text-sm font-medium">
                          View
                        </button>
                        {appointment.status === 'Pending' && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                            <button className="text-amber-600 dark:text-amber-400 hover:text-amber-700 text-sm font-medium">
                              Reschedule
                            </button>
                            <span className="text-neutral-300 dark:text-neutral-600">|</span>
                            <button className="text-red-600 dark:text-red-400 hover:text-red-700 text-sm font-medium">
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">No appointments yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppointmentPage;
