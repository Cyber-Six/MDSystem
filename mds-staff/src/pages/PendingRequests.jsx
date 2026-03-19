import React, { useState } from 'react';
import AppointmentDetailsModal from '../components/modals/AppointmentDetailsModal';
import RecordUpdateDetailsModal from '../components/modals/RecordUpdateDetailsModal';
import MedicineRequestDetailsModal from '../components/modals/MedicineRequestDetailsModal';
import InitialRecordList from '../modules/pending-requests/components/initial-record-list';
import RecordUpdateList from '../modules/pending-requests/components/review-sections/record-update/record-update-list';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'RevisionSubmitted', label: 'Request Submitted' },
  { value: 'Revision', label: 'Revision Requested' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Cancelled', label: 'Cancelled' },
];

/**
 * Pending Requests Page
 * Staff can view and manage pending requests with filters
 */
const PendingRequests = () => {
  const [filterType, setFilterType] = useState('Initial Record');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRequests, setSelectedRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalType, setModalType] = useState(null);

  // TODO: Load from API — patientSlot (Pending), patientUpdateLog, MedicineTransactionLog
  const allRequests = [ // eslint-disable-line no-unused-vars
  // Remove this comment block when API is wired
  /*
    { 
      id: 1, 
      patientId: '2021-00001', 
      name: 'Juan Dela Cruz', 
      type: 'Record Update', 
      category: 'Medical', 
      submitted: '2026-02-04', 
      expires: '2026-02-11', 
      status: 'Pending',
      // Record Update specific fields
      updateFields: [
        {
          fieldName: 'Blood Type',
          currentValue: 'A+',
          requestedValue: 'O+',
          reason: 'Previous record was incorrect based on recent laboratory test'
        },
        {
          fieldName: 'Allergies - Food',
          currentValue: 'None',
          requestedValue: 'Shellfish, Peanuts',
          reason: 'Recently discovered allergies during consultation'
        }
      ],
      documents: [
        { name: 'Laboratory_Result_BloodType.pdf', uploadDate: '2026-02-04' },
        { name: 'Medical_Certificate.pdf', uploadDate: '2026-02-04' }
      ],
      notes: 'Please update medical records based on recent laboratory findings.'
    },
    { 
      id: 2, 
      patientId: '2021-00002', 
      studentNumber: '2021-00002',
      name: 'Maria Santos',
      studentName: 'Maria Santos',
      type: 'Appointment', 
      category: 'Dental', 
      submitted: '2026-02-04', 
      expires: '2026-02-11', 
      status: 'Pending',
      // Appointment-specific details
      program: 'BS Information Technology',
      yearLevel: 'Senior',
      contactNumber: '09123456789',
      email: 'maria.santos@tip.edu.ph',
      scheduledDate: '2026-02-10',
      scheduledTime: '10:00 AM',
      reason: 'Routine dental checkup and cleaning',
      notes: 'Preferred morning schedule',
      submittedDate: '2026-02-04 09:30 AM'
    },
    { 
      id: 3, 
      patientId: '2021-00003', 
      name: 'Pedro Reyes', 
      type: 'Medicine Request', 
      category: 'Medical', 
      submitted: '2026-02-03', 
      expires: '2026-02-10', 
      status: 'Pending',
      // Medicine Request specific fields
      medicineName: 'Paracetamol 500mg',
      medicineType: 'Tablet',
      requestedQuantity: 10,
      unit: 'tablets',
      stockAvailable: 50,
      reason: 'For headache and fever relief',
      prescribedBy: 'Dr. Elena Smith',
      prescriptionDate: '2026-02-03',
      priority: 'Normal',
      contactNumber: '09187654321'
    },
    { 
      id: 4, 
      patientId: '2021-00004', 
      name: 'Ana Garcia', 
      type: 'Record Update', 
      category: 'Both', 
      submitted: '2026-02-03', 
      expires: '2026-02-10', 
      status: 'Pending',
      // Record Update specific fields
      updateFields: [
        {
          fieldName: 'Contact Number',
          currentValue: '09123456789',
          requestedValue: '09987654321',
          reason: 'Changed mobile number'
        },
        {
          fieldName: 'Emergency Contact - Mother',
          currentValue: '09111111111',
          requestedValue: '09222222222',
          reason: 'Mother changed contact number'
        }
      ],
      notes: 'Updated contact information for emergency purposes.'
    },
    { 
      id: 5, 
      patientId: '2021-00005',
      studentNumber: '2021-00005', 
      name: 'Carlos Tan',
      studentName: 'Carlos Tan',
      type: 'Appointment', 
      category: 'Medical', 
      submitted: '2026-02-02', 
      expires: '2026-02-09', 
      status: 'Pending',
      // Appointment-specific details
      program: 'BS Computer Science',
      yearLevel: 'Junior',
      contactNumber: '09187654321',
      email: 'carlos.tan@tip.edu.ph',
      scheduledDate: '2026-02-08',
      scheduledTime: '2:00 PM',
      reason: 'Required for OJT clearance documentation',
      notes: 'Needs medical certificate',
      submittedDate: '2026-02-02 11:15 AM'
    },
    { 
      id: 6, 
      patientId: '2021-00006', 
      name: 'Lisa Wong', 
      type: 'Record Update', 
      category: 'Medical', 
      submitted: '2026-01-30', 
      expires: '2026-02-06', 
      status: 'Expired',
      updateFields: [
        {
          fieldName: 'Address',
          currentValue: '123 Old St., Manila',
          requestedValue: '456 New Ave., Quezon City',
          reason: 'Moved to new residence'
        }
      ]
    },
    { 
      id: 7, 
      patientId: '2021-00007', 
      name: 'Mark Lim', 
      type: 'Record Update', 
      category: 'Dental', 
      submitted: '2026-02-01', 
      expires: '2026-02-08', 
      status: 'Revision',
      updateFields: [
        {
          fieldName: 'Dental History',
          currentValue: 'No previous dental work',
          requestedValue: 'Had braces from 2020-2022',
          reason: 'Forgot to mention during initial consultation'
        }
      ],
      notes: 'Please provide proof of dental treatment records.'
    },
  */ ].filter(Boolean);

  // Handler functions for modals
  const handleViewRequest = (request) => {
    setSelectedRequest(request);
    setModalType(request.type);
  };

  const handleCloseModal = () => {
    setSelectedRequest(null);
    setModalType(null);
  };

  // Appointment handlers
  const handleAcceptAppointment = (appointmentId) => {
    console.log('Accepting appointment:', appointmentId);
    // TODO: Implement API call to accept appointment
    alert('Appointment accepted successfully!');
  };

  const handleRejectAppointment = (appointmentId, reason) => {
    console.log('Rejecting appointment:', appointmentId, 'Reason:', reason);
    // TODO: Implement API call to reject appointment
    alert(`Appointment rejected. Reason: ${reason}`);
  };

  const handleUpdateAppointment = (appointmentId, updatedData) => {
    console.log('Updating appointment:', appointmentId, updatedData);
    // TODO: Implement API call to update appointment
    alert('Appointment updated successfully!');
  };

  // Record Update handlers
  const handleApproveRecordUpdate = (requestId) => {
    console.log('Approving record update:', requestId);
    // TODO: Implement API call to approve record update
    alert('Record update approved successfully!');
  };

  const handleRejectRecordUpdate = (requestId, reason) => {
    console.log('Rejecting record update:', requestId, 'Reason:', reason);
    // TODO: Implement API call to reject record update
    alert(`Record update rejected. Reason: ${reason}`);
  };

  // Medicine Request handlers
  const handleDispenseMedicine = (requestId, quantity) => {
    console.log('Dispensing medicine:', requestId, 'Quantity:', quantity);
    // TODO: Implement API call to dispense medicine
    alert(`Medicine dispensed successfully! Quantity: ${quantity}`);
  };

  const handleRejectMedicineRequest = (requestId, reason) => {
    console.log('Rejecting medicine request:', requestId, 'Reason:', reason);
    // TODO: Implement API call to reject medicine request
    alert(`Medicine request rejected. Reason: ${reason}`);
  };

  // Filter requests (legacy local table only)
  const filteredRequests = allRequests.filter(request => {
    const matchesType = filterType === 'all' || request.type === filterType;
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    return matchesType && matchesStatus;
  });

  // Handle selection
  const toggleSelectAll = () => {
    if (selectedRequests.length === filteredRequests.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(filteredRequests.map(r => r.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedRequests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-400';
      case 'Expired':
        return 'bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400';
      case 'Revision':
        return 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400';
      case 'Approved':
        return 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400';
      default:
        return 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Medical':
        return 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400';
      case 'Dental':
        return 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400';
      case 'Both':
        return 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400';
      default:
        return 'bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400';
    }
  };

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-2.5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="all">All Types</option>
              <option value="Initial Record">Initial Record</option>
              <option value="Record Update">Record Update</option>
              <option value="Appointment">Appointment</option>
              <option value="Medicine Request">Medicine Request</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-700 text-secondary-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedRequests.length > 0 && (
            <div className="flex gap-2">
              <span className="text-sm text-secondary-600 dark:text-neutral-400">
                {selectedRequests.length} selected
              </span>
              <button className="px-3 py-1 text-xs font-medium text-white bg-success-500 hover:bg-success-600 rounded transition-colors">
                Approve All
              </button>
              <button className="px-3 py-1 text-xs font-medium text-white bg-error-500 hover:bg-error-600 rounded transition-colors">
                Reject All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Initial Record Submissions — powered by the real backend */}
      {filterType === 'Initial Record' && (
        <InitialRecordList
          externalStatusFilter={filterStatus}
          showStatusFilter={false}
        />
      )}

      {/* Record Update Requests — powered by the real backend */}
      {filterType === 'Record Update' && (
        <RecordUpdateList
          externalStatusFilter={filterStatus}
          showStatusFilter={false}
        />
      )}

      {/* All Types: render both backend-backed patient-record request lists */}
      {filterType === 'all' && (
        <>
          <InitialRecordList
            externalStatusFilter={filterStatus}
            showStatusFilter={false}
          />
          <RecordUpdateList
            externalStatusFilter={filterStatus}
            showStatusFilter={false}
          />
        </>
      )}

      {/* Requests Table (Appointment / Medicine Request) */}
      {filterType !== 'Initial Record' && filterType !== 'Record Update' && filterType !== 'all' && (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-secondary-800 dark:text-white">
            Pending Requests ({filteredRequests.length})
          </h3>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-secondary-300 dark:text-neutral-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm text-secondary-500 dark:text-neutral-400">No pending requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-700/50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRequests.length === filteredRequests.length && filteredRequests.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Student ID</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden sm:table-cell">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Submitted</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider hidden lg:table-cell">Expires</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-secondary-500 dark:text-neutral-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {/* Row height: adjust py-2.5 on each <td> inside the map below to increase/decrease row height */}
                {filteredRequests.map((request) => (
                  <tr key={request.id} onClick={() => handleViewRequest(request)} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 cursor-pointer">
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request.id)}
                        onChange={() => toggleSelect(request.id)}
                        className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-neutral-200 dark:bg-neutral-600 rounded-full flex items-center justify-center text-[10px] font-medium text-secondary-600 dark:text-neutral-300 flex-shrink-0">
                          {request.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-xs font-medium text-secondary-800 dark:text-white truncate">{request.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-secondary-500 dark:text-neutral-400">{request.patientId}</td>
                    <td className="px-3 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 hidden sm:table-cell">{request.type}</td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(request.category)}`}>
                        {request.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 hidden lg:table-cell">{request.submitted}</td>
                    <td className="px-3 py-2.5 text-xs text-secondary-600 dark:text-neutral-300 hidden lg:table-cell">{request.expires}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Modals - Conditionally render based on request type */}
      {modalType === 'Appointment' && selectedRequest && (
        <AppointmentDetailsModal
          appointment={selectedRequest}
          onClose={handleCloseModal}
          onAccept={handleAcceptAppointment}
          onReject={handleRejectAppointment}
          onUpdate={handleUpdateAppointment}
        />
      )}

      {modalType === 'Record Update' && selectedRequest && (
        <RecordUpdateDetailsModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onApprove={handleApproveRecordUpdate}
          onReject={handleRejectRecordUpdate}
        />
      )}

      {modalType === 'Medicine Request' && selectedRequest && (
        <MedicineRequestDetailsModal
          request={selectedRequest}
          onClose={handleCloseModal}
          onDispense={handleDispenseMedicine}
          onReject={handleRejectMedicineRequest}
        />
      )}
    </div>
  );
};

export default PendingRequests;
