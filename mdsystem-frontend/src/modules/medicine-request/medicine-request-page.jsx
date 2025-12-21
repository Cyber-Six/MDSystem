import React, { useState } from 'react';

const MedicineRequestPage = () => {
  const [formData, setFormData] = useState({
    chiefComplaint: '',
    branchConsulted: '',
    medicines: [],
    quantity: {}
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState([
    {
      id: 1,
      date: '2024-01-10',
      medicines: ['BIOGESIC', 'NEOZEP'],
      status: 'Approved',
      branch: 'Arlegui'
    },
    {
      id: 2,
      date: '2024-01-08',
      medicines: ['BAND-AID'],
      status: 'Pending',
      branch: 'Casal'
    }
  ]);

  const medicines = [
    'ALAXAN',
    'BAND-AID',
    'BIOGESIC',
    'BONAMINE',
    'BUSCOPAN',
    'CAPOMED',
    'CETIRIZINE',
    'CATAPRES',
    'DIATABS',
    'EYE DROPS',
    'LORATADINE',
    'MEDICOL',
    'MOTILIUM',
    'MEFENAMIC ACID',
    'NEOZEP',
    'HYDRITE',
    'PLASIL',
    'PRED 10',
    'SERC',
    'SIMECO',
    'TUSERAN',
    'VENTOLIN Tablet',
    'VENTOLIN Nebules',
    'DISPOSABLE GLOVES',
    'DISPOSABLE MASK',
    'OTHERS'
  ];

  const handleMedicineToggle = (medicine) => {
    const newMedicines = formData.medicines.includes(medicine)
      ? formData.medicines.filter(m => m !== medicine)
      : [...formData.medicines, medicine];
    
    setFormData({ ...formData, medicines: newMedicines });
  };

  const handleQuantityChange = (medicine, quantity) => {
    setFormData({
      ...formData,
      quantity: { ...formData.quantity, [medicine]: quantity }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newRequest = {
        id: requests.length + 1,
        date: new Date().toISOString().split('T')[0],
        medicines: formData.medicines,
        status: 'Pending',
        branch: formData.branchConsulted
      };
      
      setRequests([newRequest, ...requests]);
      setFormData({ chiefComplaint: '', branchConsulted: '', medicines: [], quantity: {} });
      alert('Medicine request submitted successfully!');
    } catch (error) {
      console.error('Error submitting request:', error);
      alert('Error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'approved':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'ready':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'claimed':
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
          Medicine Request
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Request medicines from the clinic
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Request Form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">
              New Medicine Request
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Chief Complaint *
                </label>
                <textarea
                  required
                  value={formData.chiefComplaint}
                  onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
                  rows="4"
                  placeholder="Describe your symptoms or condition"
                  className="w-full px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg 
                           bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Branch Consulted */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Branch Consulted *
                </label>
                <div className="flex items-center space-x-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      required
                      type="radio"
                      name="branch"
                      value="Arlegui"
                      checked={formData.branchConsulted === 'Arlegui'}
                      onChange={(e) => setFormData({ ...formData, branchConsulted: e.target.value })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">Arlegui</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      required
                      type="radio"
                      name="branch"
                      value="Casal"
                      checked={formData.branchConsulted === 'Casal'}
                      onChange={(e) => setFormData({ ...formData, branchConsulted: e.target.value })}
                      className="w-4 h-4 text-primary-600"
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">Casal</span>
                  </label>
                </div>
              </div>

              {/* Medicine Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                  Select Medicines * (Check all that apply)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  {medicines.map((medicine) => (
                    <div key={medicine} className="space-y-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.medicines.includes(medicine)}
                          onChange={() => handleMedicineToggle(medicine)}
                          className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">{medicine}</span>
                      </label>
                      
                      {formData.medicines.includes(medicine) && (
                        <div className="ml-6">
                          <select
                            value={formData.quantity[medicine] || ''}
                            onChange={(e) => handleQuantityChange(medicine, e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 rounded 
                                     bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white
                                     focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          >
                            <option value="">Select Quantity</option>
                            <option value="1PC">1PC</option>
                            <option value="2PCS">2PCS</option>
                            <option value="3PCS">3PCS</option>
                            <option value="4PCS">4PCS</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || formData.medicines.length === 0}
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
                  <span>Submit Medicine Request</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Info Card */}
        <div>
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary-900 dark:text-primary-100 mb-4">
              Request Guidelines
            </h3>
            <ul className="space-y-3 text-sm text-primary-700 dark:text-primary-300">
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Medicine requests are subject to approval by medical staff</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Only request medicines that are necessary for your condition</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Bring your student ID when claiming approved medicines</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Processing time is typically 1-2 business days</span>
              </li>
              <li className="flex items-start space-x-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Follow dosage instructions carefully</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Request History */}
      <div className="mt-8 bg-white dark:bg-neutral-900 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-6">
          Request History
        </h2>

        {requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Medicines</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Branch</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{request.date}</td>
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">
                      {request.medicines.join(', ')}
                    </td>
                    <td className="py-3 px-4 text-sm text-neutral-900 dark:text-white">{request.branch}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button className="text-primary-600 dark:text-primary-400 hover:text-primary-700 text-sm font-medium">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="mt-4 text-neutral-600 dark:text-neutral-400">No medicine requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicineRequestPage;
