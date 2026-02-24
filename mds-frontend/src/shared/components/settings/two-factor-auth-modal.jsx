import { useState } from 'react';
import { Shield, Smartphone, QrCode } from 'lucide-react';
import Modal from '@shared/components/modals/modal';

const TwoFactorAuthModal = ({ isOpen, onClose }) => {
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const handleToggle2FA = () => {
    if (!is2FAEnabled) {
      setShowSetup(true);
    } else {
      // Disable 2FA
      setIs2FAEnabled(false);
      setShowSetup(false);
    }
  };

  const handleComplete2FASetup = () => {
    setIs2FAEnabled(true);
    setShowSetup(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Two-Factor Authentication" size="md">
      <div className="space-y-6">
        {/* Status Section */}
        <div className={`
          p-4 rounded-lg border-2
          ${is2FAEnabled 
            ? 'bg-success-50 dark:bg-success-900/10 border-success-200 dark:border-success-800' 
            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700'
          }
        `}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`
                p-2 rounded-lg
                ${is2FAEnabled 
                  ? 'bg-success-100 dark:bg-success-900/20' 
                  : 'bg-neutral-200 dark:bg-neutral-700'
                }
              `}>
                <Shield className={`
                  w-6 h-6
                  ${is2FAEnabled 
                    ? 'text-success-600 dark:text-success-400' 
                    : 'text-neutral-600 dark:text-neutral-400'
                  }
                `} />
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">
                  Two-Factor Authentication
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {is2FAEnabled ? 'Currently enabled' : 'Currently disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggle2FA}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full
                transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                ${is2FAEnabled ? 'bg-success-600' : 'bg-neutral-300 dark:bg-neutral-600'}
              `}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                  ${is2FAEnabled ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
          </div>
        </div>

        {/* Setup Instructions */}
        {showSetup && !is2FAEnabled && (
          <div className="space-y-4 animate-slide-in">
            <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
              <h4 className="font-semibold text-gray-800 dark:text-white mb-2">
                Setup Instructions
              </h4>
              <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2">
                  <span className="font-semibold">1.</span>
                  <span>Download an authenticator app (Google Authenticator, Authy, etc.)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">2.</span>
                  <span>Scan the QR code below with your authenticator app</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold">3.</span>
                  <span>Enter the 6-digit code from your app to verify</span>
                </li>
              </ol>
            </div>

            {/* QR Code Placeholder */}
            <div className="flex flex-col items-center p-6 bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
              <div className="w-48 h-48 bg-neutral-100 dark:bg-neutral-700 rounded-lg flex items-center justify-center mb-4">
                <QrCode className="w-32 h-32 text-neutral-400 dark:text-neutral-500" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Scan this QR code with your authenticator app
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Or enter this key manually: <span className="font-mono font-semibold">ABCD-EFGH-IJKL-MNOP</span>
              </p>
            </div>

            {/* Verification Code Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Verification Code
              </label>
              <input
                type="text"
                maxLength="6"
                placeholder="Enter 6-digit code"
                className="
                  w-full px-4 py-2.5
                  bg-white dark:bg-neutral-800
                  border border-gray-300 dark:border-neutral-700
                  rounded-lg text-center text-lg font-mono
                  text-gray-800 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  transition-colors duration-200
                "
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSetup(false)}
                className="
                  flex-1 px-4 py-2.5 
                  border border-gray-300 dark:border-neutral-700
                  text-gray-700 dark:text-gray-300
                  rounded-lg font-medium
                  hover:bg-neutral-50 dark:hover:bg-neutral-800
                  transition-colors duration-200
                "
              >
                Cancel
              </button>
              <button
                onClick={handleComplete2FASetup}
                className="
                  flex-1 px-4 py-2.5 
                  bg-primary-500 hover:bg-primary-600 
                  text-white rounded-lg font-medium
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                "
              >
                Enable 2FA
              </button>
            </div>
          </div>
        )}

        {/* Info when enabled */}
        {is2FAEnabled && (
          <div className="p-4 bg-success-50 dark:bg-success-900/10 rounded-lg border border-success-200 dark:border-success-800 animate-slide-in">
            <div className="flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-success-600 dark:text-success-400 mt-0.5" />
              <div>
                <p className="font-medium text-success-900 dark:text-success-300 mb-1">
                  Two-Factor Authentication is Active
                </p>
                <p className="text-sm text-success-700 dark:text-success-400">
                  Your account is protected with an additional layer of security. You'll need to enter a code from your authenticator app each time you log in.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Close button when not setting up */}
        {!showSetup && (
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
        )}
      </div>
    </Modal>
  );
};

export default TwoFactorAuthModal;
