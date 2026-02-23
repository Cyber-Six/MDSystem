import { Monitor, Smartphone, MapPin, Calendar } from 'lucide-react';
import Modal from '@core/components/modals/modal';

const LoginActivityModal = ({ isOpen, onClose }) => {
  // Mock login activity data
  const loginActivities = [
    {
      id: 1,
      device: 'Windows PC - Chrome',
      location: 'Manila, Philippines',
      date: '2025-12-21',
      time: '10:30 AM',
      current: true,
      deviceType: 'desktop'
    },
    {
      id: 2,
      device: 'iPhone 14 - Safari',
      location: 'Quezon City, Philippines',
      date: '2025-12-20',
      time: '08:15 PM',
      current: false,
      deviceType: 'mobile'
    },
    {
      id: 3,
      device: 'Windows PC - Edge',
      location: 'Manila, Philippines',
      date: '2025-12-19',
      time: '02:45 PM',
      current: false,
      deviceType: 'desktop'
    },
    {
      id: 4,
      device: 'Android Phone - Chrome',
      location: 'Makati, Philippines',
      date: '2025-12-18',
      time: '11:20 AM',
      current: false,
      deviceType: 'mobile'
    }
  ];

  const ActivityItem = ({ activity }) => (
    <div className={`
      p-4 rounded-lg border
      ${activity.current 
        ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800' 
        : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
      }
    `}>
      <div className="flex items-start gap-3">
        {/* Device Icon */}
        <div className={`
          p-2 rounded-lg
          ${activity.current 
            ? 'bg-primary-100 dark:bg-primary-900/20' 
            : 'bg-neutral-100 dark:bg-neutral-700'
          }
        `}>
          {activity.deviceType === 'desktop' ? (
            <Monitor className={`
              w-5 h-5
              ${activity.current 
                ? 'text-primary-600 dark:text-primary-400' 
                : 'text-neutral-600 dark:text-neutral-400'
              }
            `} />
          ) : (
            <Smartphone className={`
              w-5 h-5
              ${activity.current 
                ? 'text-primary-600 dark:text-primary-400' 
                : 'text-neutral-600 dark:text-neutral-400'
              }
            `} />
          )}
        </div>

        {/* Activity Details */}
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">
                {activity.device}
              </p>
              {activity.current && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-success-100 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-full">
                  Current Session
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <MapPin className="w-4 h-4" />
              <span>{activity.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Calendar className="w-4 h-4" />
              <span>{activity.date} at {activity.time}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Login Activity" size="lg">
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Review recent login activity on your account. If you see any unfamiliar activity, change your password immediately.
          </p>
        </div>

        {/* Activity List */}
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {loginActivities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>

        {/* Close Button */}
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
