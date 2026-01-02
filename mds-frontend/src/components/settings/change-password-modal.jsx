import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Modal from '../modals/modal';
import { validatePassword, passwordsMatch, getPasswordError } from '@mdsystem/core/validation/password-validation';

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else {
      const passwordError = getPasswordError(formData.newPassword);
      if (passwordError) {
        newErrors.newPassword = passwordError;
      }
    }
    if (!passwordsMatch(formData.newPassword, formData.confirmPassword)) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle password change
    console.log('Password change submitted:', formData);
    // Reset form and close
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setErrors({});
    onClose();
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const PasswordInput = ({ label, name, value, show, field }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={(e) => setFormData(prev => ({ ...prev, [name]: e.target.value }))}
          className={`
            w-full px-4 py-2.5 pr-10
            bg-white dark:bg-neutral-800
            border ${errors[name] ? 'border-red-500' : 'border-gray-300 dark:border-neutral-600'}
            rounded-lg
            text-gray-900 dark:text-white
            placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
            transition-colors duration-200
          `}
          placeholder={`Enter ${label.toLowerCase()}`}
        />
        <button
          type="button"
          onClick={() => togglePasswordVisibility(field)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
      {errors[name] && (
        <p className="mt-1 text-sm text-red-500">{errors[name]}</p>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Password" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          label="Current Password"
          name="currentPassword"
          value={formData.currentPassword}
          show={showPasswords.current}
          field="current"
        />
        <PasswordInput
          label="New Password"
          name="newPassword"
          value={formData.newPassword}
          show={showPasswords.new}
          field="new"
        />
        <PasswordInput
          label="Confirm New Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          show={showPasswords.confirm}
          field="confirm"
        />

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="
              flex-1 px-4 py-2.5 
              border border-gray-300 dark:border-neutral-600
              text-gray-700 dark:text-gray-300
              rounded-lg font-medium
              hover:bg-gray-50 dark:hover:bg-neutral-800
              transition-colors duration-200
            "
          >
            Cancel
          </button>
          <button
            type="submit"
            className="
              flex-1 px-4 py-2.5 
              bg-primary-500 hover:bg-primary-600 
              text-white rounded-lg font-medium
              transition-colors duration-200
            "
          >
            Change Password
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
