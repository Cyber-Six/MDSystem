import { User, Mail, Phone, UserCircle, IdCard } from 'lucide-react';
import Modal from '@core/components/modals/modal';

const ProfileModal = ({ isOpen, onClose }) => {
  // Mock data
  const userProfile = {
    name: 'Rey Mark Endaya Samarita',
    email: 'student@tip.edu.ph',
    contactNumber: '+63 912 345 6789',
    emergencyContact: '+63 998 765 4321',
    studentId: '2021-12345'
  };

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile" size="md">
      <div className="space-y-4">
        {/* Avatar and Name */}
        <div className="flex flex-col items-center pb-4 border-b border-gray-200 dark:border-neutral-700">
          <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {userProfile.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Student
          </p>
        </div>

        {/* Profile Information */}
        <div className="space-y-2">
          <ProfileField 
            icon={Mail} 
            label="Email Address" 
            value={userProfile.email} 
          />
          <ProfileField 
            icon={Phone} 
            label="Contact Number" 
            value={userProfile.contactNumber} 
          />
          <ProfileField 
            icon={UserCircle} 
            label="Emergency Contact" 
            value={userProfile.emergencyContact} 
          />
          <ProfileField 
            icon={IdCard} 
            label="Student ID" 
            value={userProfile.studentId} 
          />
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
