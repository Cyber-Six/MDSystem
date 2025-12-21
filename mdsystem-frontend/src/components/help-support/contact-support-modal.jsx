import { useState } from 'react';
import { Mail, Phone, Paperclip, X } from 'lucide-react';
import Modal from '../modals/Modal';

const ContactSupportModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    description: ''
  });
  const [attachedFile, setAttachedFile] = useState(null);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, file: 'File size must be less than 5MB' }));
        return;
      }
      setAttachedFile(file);
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!formData.description.trim()) newErrors.description = 'Description is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle form submission
    console.log('Support request submitted:', { ...formData, file: attachedFile });
    
    // Reset form and close
    setFormData({ name: '', email: '', subject: '', description: '' });
    setAttachedFile(null);
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Contact Support" size="lg">
      <div className="space-y-4">
        {/* Contact Info */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
          <p className="text-sm font-medium text-gray-800 dark:text-white mb-2">
            Need immediate assistance?
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Mail className="w-4 h-4 text-primary-500" />
              <a href="mailto:support@tip.edu.ph" className="hover:text-primary-500 transition-colors">
                support@tip.edu.ph
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Phone className="w-4 h-4 text-primary-500" />
              <a href="tel:+6329111611" className="hover:text-primary-500 transition-colors">
                +63 2 9111 6111
              </a>
            </div>
          </div>
        </div>

        {/* Support Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name <span className="text-error-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`
                  w-full px-4 py-2.5
                  bg-white dark:bg-neutral-800
                  border ${errors.name ? 'border-error-500' : 'border-gray-300 dark:border-neutral-700'}
                  rounded-lg
                  text-gray-800 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  transition-colors duration-200
                `}
                placeholder="Your name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-error-500">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email <span className="text-error-500">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`
                  w-full px-4 py-2.5
                  bg-white dark:bg-neutral-800
                  border ${errors.email ? 'border-error-500' : 'border-gray-300 dark:border-neutral-700'}
                  rounded-lg
                  text-gray-800 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  transition-colors duration-200
                `}
                placeholder="your.email@tip.edu.ph"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-error-500">{errors.email}</p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject <span className="text-error-500">*</span>
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              className={`
                w-full px-4 py-2.5
                bg-white dark:bg-neutral-800
                border ${errors.subject ? 'border-error-500' : 'border-gray-300 dark:border-neutral-700'}
                rounded-lg
                text-gray-800 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                transition-colors duration-200
              `}
              placeholder="Brief description of your issue"
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-error-500">{errors.subject}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Issue Description <span className="text-error-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              className={`
                w-full px-4 py-2.5
                bg-white dark:bg-neutral-800
                border ${errors.description ? 'border-error-500' : 'border-gray-300 dark:border-neutral-700'}
                rounded-lg
                text-gray-800 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                transition-colors duration-200
                resize-none
              `}
              placeholder="Please describe your issue in detail..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-error-500">{errors.description}</p>
            )}
          </div>

          {/* File Attachment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attachment (Optional)
            </label>
            {!attachedFile ? (
              <label className="
                flex items-center justify-center gap-2
                w-full px-4 py-3
                border-2 border-dashed border-gray-300 dark:border-neutral-700
                rounded-lg cursor-pointer
                hover:border-primary-400 dark:hover:border-primary-600
                hover:bg-gray-50 dark:hover:bg-neutral-800
                transition-colors duration-200
              ">
                <Paperclip className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Click to attach a file (max 5MB)
                </span>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                />
              </label>
            ) : (
              <div className="
                flex items-center justify-between
                px-4 py-3
                bg-gray-50 dark:bg-neutral-800
                border border-gray-300 dark:border-neutral-700
                rounded-lg
              ">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-primary-500" />
                  <span className="text-sm text-gray-800 dark:text-white">
                    {attachedFile.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ({(attachedFile.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="p-1 text-neutral-500 hover:text-error-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            {errors.file && (
              <p className="mt-1 text-sm text-error-500">{errors.file}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="
                flex-1 px-4 py-2.5 
                border border-gray-300 dark:border-neutral-700
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
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
              "
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ContactSupportModal;
