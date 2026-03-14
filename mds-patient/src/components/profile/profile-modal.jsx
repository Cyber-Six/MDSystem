import { useState, useEffect } from 'react';
import { User, Mail, Phone, UserCircle, IdCard } from 'lucide-react';
import Modal from '@core/components/modals/modal';
import { getPatientProfile } from '@core/services/emr-service';

const ProfileModal = ({ isOpen, onClose }) => {
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    getPatientProfile()
      .then(setUserProfile)
      .catch(() => setUserProfile(null))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const ProfileField = ({ icon: Icon, label, value }) => (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-primary-500 dark:text-primary-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {label}
          </p>
          <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
            {value}
          </p>
        </div>
      </div>
    </div>
  );

  const SkeletonField = () => (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile" size="md">
      <div className="space-y-4">
        {/* Avatar and Name */}
        <div className="flex flex-col items-center pb-4 border-b border-gray-200 dark:border-neutral-700">
          <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-white" />
          </div>
          {isLoading ? (
            <div className="space-y-2 flex flex-col items-center">
              <div className="h-5 w-48 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
              <div className="h-4 w-20 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
            </div>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
                {userProfile?.name || '—'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Student
              </p>
            </>
          )}
        </div>

        {/* Profile Information */}
        <div className="space-y-2">
          {isLoading ? (
            <>
              <SkeletonField />
              <SkeletonField />
              <SkeletonField />
              <SkeletonField />
            </>
          ) : (
            <>
              {(() => {
                const emergencyFields = [];
                if (userProfile?.firstEmergencyContactNumber) {
                  emergencyFields.push({
                    key: 'first-emergency-contact',
                    label: 'First Emergency Contact Number',
                    value: userProfile.firstEmergencyContactNumber,
                  });
                }
                if (userProfile?.secondEmergencyContactNumber) {
                  emergencyFields.push({
                    key: 'second-emergency-contact',
                    label: 'Second Emergency Contact Number',
                    value: userProfile.secondEmergencyContactNumber,
                  });
                }
                if (emergencyFields.length === 0) {
                  emergencyFields.push({
                    key: 'no-emergency-contact',
                    label: 'Emergency Contact',
                    value: '—',
                  });
                }

                return (
                  <>
                    <ProfileField
                      icon={Mail}
                      label="Email Address"
                      value={userProfile?.email || '—'}
                    />
                    <ProfileField
                      icon={Phone}
                      label="Contact Number"
                      value={userProfile?.contactNumber || '—'}
                    />
                    {emergencyFields.map((field) => (
                      <ProfileField
                        key={field.key}
                        icon={UserCircle}
                        label={field.label}
                        value={field.value}
                      />
                    ))}
                    <ProfileField
                      icon={IdCard}
                      label="Student ID"
                      value={userProfile?.identifier || '—'}
                    />
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
