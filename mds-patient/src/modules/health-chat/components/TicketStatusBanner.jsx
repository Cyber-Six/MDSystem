import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

const TicketStatusBanner = ({ status, onCancel, isLoading }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'Open':
        return {
          icon: Clock,
          text: 'Waiting for Staff Approval',
          description: 'Your request has been submitted and is pending review. A medical staff member will review and approve it shortly. You will be notified when the chat is ready.',
          bgColor: 'bg-amber-50 dark:bg-amber-900/20',
          borderColor: 'border-amber-200 dark:border-amber-800',
          iconColor: 'text-amber-500',
          textColor: 'text-amber-700 dark:text-amber-300',
          showCancel: true
        };
      case 'Ongoing':
        return {
          icon: CheckCircle,
          text: 'Chat Active',
          description: 'You are now connected with medical staff.',
          bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
          borderColor: 'border-emerald-200 dark:border-emerald-800',
          iconColor: 'text-emerald-500',
          textColor: 'text-emerald-700 dark:text-emerald-300',
          showCancel: false
        };
      case 'Closed':
        return {
          icon: XCircle,
          text: 'Chat Closed',
          description: 'This conversation has been closed.',
          bgColor: 'bg-neutral-50 dark:bg-neutral-800',
          borderColor: 'border-neutral-200 dark:border-neutral-700',
          iconColor: 'text-neutral-500',
          textColor: 'text-neutral-700 dark:text-neutral-300',
          showCancel: false
        };
      case 'Expired':
        return {
          icon: AlertCircle,
          text: 'Chat Expired',
          description: 'This conversation has expired after 3 days.',
          bgColor: 'bg-neutral-50 dark:bg-neutral-800',
          borderColor: 'border-neutral-200 dark:border-neutral-700',
          iconColor: 'text-neutral-500',
          textColor: 'text-neutral-700 dark:text-neutral-300',
          showCancel: false
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this request? This action cannot be undone.')) {
      onCancel();
    }
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${config.bgColor} ${config.borderColor} mb-4`}>
      <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className={`text-sm font-semibold ${config.textColor}`}>
            {config.text}
          </h4>
          {config.showCancel && (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400
                       hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30
                       rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cancel this request"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}
        </div>
        <p className={`text-xs ${config.textColor} opacity-90`}>
          {config.description}
        </p>
      </div>
    </div>
  );
};

export default TicketStatusBanner;
