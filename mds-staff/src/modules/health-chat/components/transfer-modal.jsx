import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Loader2, Search } from 'lucide-react';
import { getHealthChatStaff } from '../health-chat-service';

const TransferModal = ({ isOpen, onClose, onTransfer, currentMedicalEmail, chatId }) => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedStaffId(null);
    setSearch('');
    setError(null);

    const fetchStaff = async () => {
      if (!chatId) {
        setStaff([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await getHealthChatStaff(chatId);
        // Filter out current staff member
        const filtered = result.filter(s => s.email !== currentMedicalEmail);
        setStaff(filtered);
      } catch (err) {
        setError(err.message || 'Failed to load staff');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, [isOpen, currentMedicalEmail, chatId]);

  if (!isOpen) return null;

  const filteredStaff = staff.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.role?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q);
  });

  const handleTransfer = async () => {
    if (!selectedStaffId) return;
    try {
      setTransferring(true);
      setError(null);
      await onTransfer(selectedStaffId);
      onClose();
    } catch (err) {
      setError(err.message || 'Transfer failed');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary-100 dark:bg-primary-900/30">
              <ArrowRightLeft className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">
                Transfer Ticket
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Select a staff member to transfer this ticket to
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role, or email…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm
                         bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700
                         text-secondary-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500
                         focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
        </div>

        {/* Staff list */}
        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
            </div>
          )}
          {!loading && filteredStaff.length === 0 && (
            <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">
              {search ? 'No matching staff found' : 'No available staff'}
            </p>
          )}
          {!loading && filteredStaff.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStaffId(s.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-left transition-all duration-150
                ${selectedStaffId === s.id
                  ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent'
                }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${selectedStaffId === s.id
                  ? 'bg-primary-500 text-secondary-900'
                  : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                }`}>
                {s.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium truncate ${
                  selectedStaffId === s.id
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-secondary-900 dark:text-white'
                }`}>{s.name}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                  {[s.role, s.branch].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 pb-2 flex-shrink-0">
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                       text-neutral-700 dark:text-neutral-300
                       border border-neutral-300 dark:border-neutral-600
                       hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedStaffId || transferring}
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50
                       bg-primary-500 hover:bg-primary-600 text-secondary-900"
          >
            {transferring ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Transferring…
              </span>
            ) : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
