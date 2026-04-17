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
    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
      <div className="flex items-start gap-2.5">
        <Icon className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p style={{ margin: 0, lineHeight: 1.2 }} className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">
            {label}
          </p>
          <p style={{ margin: 0, lineHeight: 1.25 }} className="text-sm font-semibold text-gray-900 dark:text-white break-words">
            {value}
          </p>
        </div>
      </div>
    </div>
  );

  const SkeletonField = () => (
    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
      <div className="flex items-start gap-2.5">
        <div className="w-4 h-4 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-24 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
          <div className="h-4 w-36 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Profile"
      size="md"
      className="max-h-[88vh]"
      contentClassName="py-2"
      backdropBlur={4}
      backdropOpacity={0.72}
    >
      <div className="space-y-2.5">
        {/* Avatar and Name */}
        <div className="flex flex-col items-center pb-3 border-b border-gray-200 dark:border-neutral-700">
          <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center mb-2">
            <User className="w-8 h-8 text-white" />
          </div>
          {isLoading ? (
            <div className="space-y-1.5 flex flex-col items-center">
              <div className="h-5 w-44 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
              <div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-neutral-700 animate-pulse" />
            </div>
          ) : (
            <>
              <h3 style={{ margin: 0, lineHeight: 1.2 }} className="text-xl font-semibold text-gray-900 dark:text-white text-center">
                {userProfile?.name || '—'}
              </h3>
              <p style={{ margin: 0, lineHeight: 1.2 }} className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Student
              </p>
            </>
          )}
        </div>

        {/* Profile Information */}
        <div className="grid grid-cols-1 gap-2">
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
