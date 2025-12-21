import { useState } from 'react';
import { Lock, ShieldCheck, Activity } from 'lucide-react';
import Modal from '../modals/modal';
import ChangePasswordModal from './change-password-modal';
import TwoFactorAuthModal from './two-factor-auth-modal';
import LoginActivityModal from './login-activity-modal';

const SettingsModal = ({ isOpen, onClose }) => {
  const [activeModal, setActiveModal] = useState(null);

  const settingsOptions = [
    {
      id: 'change-password',
      icon: Lock,
      title: 'Change Password',
      description: 'Update your password'
    },
    {
      id: '2fa',
      icon: ShieldCheck,
      title: 'Two-Factor Authentication',
      description: 'Add extra security'
    },
    {
      id: 'login-activity',
      icon: Activity,
      title: 'Login Activity',
      description: 'Review recent sessions'
    }
  ];

  const handleOptionClick = (optionId) => {
    setActiveModal(optionId);
  };

  const handleCloseSubModal = () => {
    setActiveModal(null);
  };

  const SettingOption = ({ option }) => (
    <button
      onClick={() => handleOptionClick(option.id)}
      className="
        w-full p-3 rounded-lg
        bg-gray-50 dark:bg-neutral-800
        border border-gray-200 dark:border-neutral-700
        hover:border-primary-400 dark:hover:border-primary-500
        transition-colors duration-200
        text-left
      "
    >
      <div className="flex items-center gap-3">
        <option.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {option.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {option.description}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="md">
        <div className="space-y-2">
          {settingsOptions.map((option) => (
            <SettingOption key={option.id} option={option} />
          ))}
        </div>
      </Modal>

      {/* Sub Modals */}
      <ChangePasswordModal 
        isOpen={activeModal === 'change-password'} 
        onClose={handleCloseSubModal} 
      />
      <TwoFactorAuthModal 
        isOpen={activeModal === '2fa'} 
        onClose={handleCloseSubModal} 
      />
      <LoginActivityModal 
        isOpen={activeModal === 'login-activity'} 
        onClose={handleCloseSubModal} 
      />
    </>
  );
};

export default SettingsModal;
