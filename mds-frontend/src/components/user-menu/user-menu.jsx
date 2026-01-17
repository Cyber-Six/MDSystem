import { useState, useRef, useEffect } from 'react';
import { User, Settings, Moon, Sun, Monitor, HelpCircle, LogOut, ChevronRight, ChevronLeft, Lock, ShieldCheck, Activity, MessageSquare, Send } from 'lucide-react';
import ProfileModal from '../profile/profile-modal';
import ChangePasswordModal from '../settings/change-password-modal';
import TwoFactorAuthModal from '../settings/two-factor-auth-modal';
import LoginActivityModal from '../settings/login-activity-modal';
import FAQsModal from '../help-support/faqs-modal';
import ContactSupportModal from '../help-support/contact-support-modal';
import FeedbackModal from '../help-support/feedback-modal';

const UserMenu = ({ themeMode, toggleTheme, onLogout }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPanel, setCurrentPanel] = useState('main'); // 'main', 'settings', 'help'
  const [activeModal, setActiveModal] = useState(null);
  const menuRef = useRef(null);

  // Mock user data - replace with actual user data from context/props
  const userData = {
    name: 'Student Name',
    email: 'student@tip.edu.ph'
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on ESC key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleOpenModal = (modalName) => {
    setActiveModal(modalName);
    setIsOpen(false);
    setCurrentPanel('main');
  };

  const handleCloseModal = () => {
    setActiveModal(null);
  };

  const handleLogoutClick = () => {
    setIsOpen(false);
    setCurrentPanel('main');
    if (onLogout) {
      onLogout();
    }
  };

  const handleNavigateToPanel = (panel) => {
    setCurrentPanel(panel);
  };

  const handleBackToMain = () => {
    setCurrentPanel('main');
  };

  const mainMenuItems = [
    {
      id: 'profile',
      icon: User,
      label: 'Profile',
      onClick: () => handleOpenModal('profile')
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Settings',
      onClick: () => handleNavigateToPanel('settings'),
      hasSubmenu: true
    },
    {
      id: 'appearance',
      icon: themeMode === 'light' ? Moon : (themeMode === 'dark' ? Sun : Monitor),
      label: 'Appearance',
      subLabel: themeMode === 'system' ? 'System' : (themeMode === 'dark' ? 'Dark' : 'Light'),
      onClick: toggleTheme
    },
    {
      id: 'help',
      icon: HelpCircle,
      label: 'Help & Support',
      onClick: () => handleNavigateToPanel('help'),
      hasSubmenu: true
    }
  ];

  const settingsMenuItems = [
    {
      id: 'change-password',
      icon: Lock,
      label: 'Change Password',
      onClick: () => handleOpenModal('change-password')
    },
    {
      id: '2fa',
      icon: ShieldCheck,
      label: 'Two-Factor Auth',
      onClick: () => handleOpenModal('2fa')
    },
    {
      id: 'login-activity',
      icon: Activity,
      label: 'Login Activity',
      onClick: () => handleOpenModal('login-activity')
    }
  ];

  const helpMenuItems = [
    {
      id: 'faqs',
      icon: HelpCircle,
      label: 'FAQs / Knowledge Base',
      onClick: () => handleOpenModal('faqs')
    },
    {
      id: 'contact',
      icon: MessageSquare,
      label: 'Contact Support',
      onClick: () => handleOpenModal('contact')
    },
    {
      id: 'feedback',
      icon: Send,
      label: 'Feedback',
      onClick: () => handleOpenModal('feedback')
    }
  ];

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* User Avatar Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="
            flex items-center gap-2 p-0.5 rounded-full
            hover:bg-gray-100 dark:hover:bg-neutral-800
            transition-all duration-200
          "
          aria-label="User menu"
          aria-expanded={isOpen}
        >
          <img
            src="https://ui-avatars.com/api/?name=Student&background=F1C526&color=fff"
            alt="User Avatar"
            className="w-8 h-8 rounded-full"
          />
        </button>

        {/* Dropdown Menu with Sliding Panels */}
        {isOpen && (
          <div className="
            absolute right-0 mt-1 w-64
            bg-white dark:bg-neutral-900
            rounded-lg shadow-xl
            border border-gray-200 dark:border-neutral-700
            overflow-hidden
            z-[60]
          ">
            {/* Main Panel */}
            <div className={`
              transition-transform duration-300 ease-in-out
              ${currentPanel === 'main' ? 'translate-x-0 relative' : '-translate-x-full absolute top-0 left-0 w-full opacity-0 pointer-events-none'}
            `}>
              {/* User Info Header */}
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {userData.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {userData.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {userData.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1.5 px-2">
                {mainMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="
                      w-full text-left px-2 py-2
                      text-sm text-gray-700 dark:text-gray-300
                      hover:bg-gray-100 dark:hover:bg-neutral-800
                      rounded-md
                      flex items-center gap-2
                      transition-colors duration-150
                    "
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.subLabel && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        {item.subLabel}
                      </span>
                    )}
                    {item.hasSubmenu && (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>

              {/* Logout */}
              <div className="border-t border-gray-200 dark:border-neutral-700 py-1.5 px-2">
                <button
                  onClick={handleLogoutClick}
                  className="
                    w-full text-left px-2 py-2
                    text-sm text-red-600 dark:text-red-400
                    hover:bg-red-50 dark:hover:bg-red-900/20
                    rounded-md
                    flex items-center gap-2
                    transition-colors duration-150
                  "
                >
                  <LogOut className="w-[18px] h-[18px]" />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            <div className={`
              transition-transform duration-300 ease-in-out bg-white dark:bg-neutral-900
              ${currentPanel === 'settings' ? 'translate-x-0 relative' : 'translate-x-full absolute top-0 left-0 w-full opacity-0 pointer-events-none'}
            `}>
              {/* Back Button Header */}
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-700">
                <button
                  onClick={handleBackToMain}
                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Settings</span>
                </button>
              </div>

              {/* Settings Items */}
              <div className="py-1.5 px-2">
                {settingsMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="
                      w-full text-left px-2 py-2
                      text-sm text-gray-700 dark:text-gray-300
                      hover:bg-gray-100 dark:hover:bg-neutral-800
                      rounded-md
                      flex items-center gap-2
                      transition-colors duration-150
                    "
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Help & Support Panel */}
            <div className={`
              transition-transform duration-300 ease-in-out bg-white dark:bg-neutral-900
              ${currentPanel === 'help' ? 'translate-x-0 relative' : 'translate-x-full absolute top-0 left-0 w-full opacity-0 pointer-events-none'}
            `}>
              {/* Back Button Header */}
              <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-700">
                <button
                  onClick={handleBackToMain}
                  className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Help & Support</span>
                </button>
              </div>

              {/* Help Items */}
              <div className="py-1.5 px-2">
                {helpMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick}
                    className="
                      w-full text-left px-2 py-2
                      text-sm text-gray-700 dark:text-gray-300
                      hover:bg-gray-100 dark:hover:bg-neutral-800
                      rounded-md
                      flex items-center gap-2
                      transition-colors duration-150
                    "
                  >
                    <item.icon className="w-[18px] h-[18px]" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProfileModal 
        isOpen={activeModal === 'profile'} 
        onClose={handleCloseModal} 
      />
      <ChangePasswordModal 
        isOpen={activeModal === 'change-password'} 
        onClose={handleCloseModal} 
      />
      <TwoFactorAuthModal 
        isOpen={activeModal === '2fa'} 
        onClose={handleCloseModal} 
      />
      <LoginActivityModal 
        isOpen={activeModal === 'login-activity'} 
        onClose={handleCloseModal} 
      />
      <FAQsModal 
        isOpen={activeModal === 'faqs'} 
        onClose={handleCloseModal} 
      />
      <ContactSupportModal 
        isOpen={activeModal === 'contact'} 
        onClose={handleCloseModal} 
      />
      <FeedbackModal 
        isOpen={activeModal === 'feedback'} 
        onClose={handleCloseModal} 
      />
    </>
  );
};

export default UserMenu;
