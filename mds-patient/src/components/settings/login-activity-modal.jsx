import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  MapPin,
  Monitor,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import Modal from '@core/components/modals/modal';
import { axiosRequest } from '../../packages-core-adapter';

const isMobileUserAgent = (userAgent = '') => /mobile|android|iphone|ipad|ipod/i.test(userAgent);

const formatTimestamp = (value) => {
  if (!value) return 'Unknown time';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
};

const formatDeviceLabel = (userAgent = '') => {
  if (!userAgent || typeof userAgent !== 'string') return 'Unknown device';
  const compact = userAgent.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Unknown device';
  return compact.length > 80 ? `${compact.slice(0, 80)}...` : compact;
};

const ActivityItem = ({ activity }) => {
  const DeviceIcon = activity.deviceType === 'mobile' ? Smartphone : Monitor;

  return (
    <div
      className={`
        p-4 rounded-lg border
        ${activity.wasSuccessful
          ? 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
          : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40'}
      `}
    >
      <div className="flex items-start gap-3">
        <div
          className={`
            p-2 rounded-lg
            ${activity.wasSuccessful
              ? 'bg-success-100 dark:bg-success-900/20'
              : 'bg-red-100 dark:bg-red-900/20'}
          `}
        >
          {activity.wasSuccessful ? (
            <ShieldCheck className="w-5 h-5 text-success-700 dark:text-success-400" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-red-700 dark:text-red-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 dark:text-white">
            {activity.wasSuccessful ? 'Successful Login' : 'Failed Login Attempt'}
          </p>

          <div className="space-y-1.5 mt-2">
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <DeviceIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="break-all">{activity.deviceLabel}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span>{activity.ipAddress ? `IP: ${activity.ipAddress}` : 'IP: Unavailable'}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>{activity.displayTime}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoginActivityModal = ({ isOpen, onClose }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchLoginActivity = useCallback(async ({ manualRefresh = false } = {}) => {
    if (manualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await axiosRequest.get('/auth/user/login-activity');
      const rawSessions = Array.isArray(response?.data?.sessions) ? response.data.sessions : [];

      const normalized = rawSessions.map((item, index) => {
        const userAgent = typeof item?.userAgent === 'string' ? item.userAgent : '';
        return {
          id: item?.id ? String(item.id) : `session-${index}`,
          wasSuccessful: Boolean(item?.wasSuccessful),
          ipAddress: typeof item?.ipAddress === 'string' ? item.ipAddress : '',
          deviceType: isMobileUserAgent(userAgent) ? 'mobile' : 'desktop',
          deviceLabel: formatDeviceLabel(userAgent),
          displayTime: formatTimestamp(item?.timestamp),
        };
      });

      setRecords(normalized);
    } catch (err) {
      const message = err?.response?.data?.message || 'Unable to load login activity at the moment.';
      setError(message);
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchLoginActivity();
  }, [isOpen, fetchLoginActivity]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Login Activity" size="lg">
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Review recent login activity on your account. If you see any unfamiliar activity, change your password immediately.
          </p>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => fetchLoginActivity({ manualRefresh: true })}
            disabled={loading || refreshing}
            className="
              inline-flex items-center gap-2 px-3 py-2 rounded-lg
              text-sm font-medium text-gray-700 dark:text-gray-300
              bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700
              hover:bg-gray-200 dark:hover:bg-neutral-700
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-colors duration-200
            "
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="p-4 rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : null}

        {!loading && !error && records.length === 0 ? (
          <div className="p-6 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
            <p className="text-sm text-gray-600 dark:text-gray-300">No login activity found.</p>
          </div>
        ) : null}

        {!loading && records.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {records.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        ) : null}

        <button
          onClick={onClose}
          className="
            w-full px-4 py-2.5
            bg-gray-100 dark:bg-neutral-800
            text-gray-700 dark:text-gray-300
            rounded-lg font-medium
            hover:bg-neutral-200 dark:hover:bg-neutral-700
            transition-colors duration-200
          "
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default LoginActivityModal;
