import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import Modal from '@shared/components/modals/modal';

const FAQsModal = ({ isOpen, onClose }) => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      question: 'How do I reset my password?',
      answer: 'To reset your password, click on "Settings" in the user menu, then select "Change Password". You will need to enter your current password and then your new password twice to confirm.'
    },
    {
      question: 'How do I enable two-factor authentication?',
      answer: 'Go to Settings > Two-Factor Authentication. Toggle the switch to enable 2FA, then follow the on-screen instructions to scan the QR code with your authenticator app and verify the setup.'
    },
    {
      question: 'Why can\'t I access certain features?',
      answer: 'Some features may be restricted based on your user role and permissions. If you believe you should have access to a feature, please contact your system administrator or support team.'
    },
    {
      question: 'How do I update my profile information?',
      answer: 'Currently, profile information is managed by the administration. If you need to update your contact details, email, or other information, please contact support with the updated information.'
    },
    {
      question: 'What should I do if I see unfamiliar login activity?',
      answer: 'If you notice any suspicious login activity in Settings > Login Activity, immediately change your password and enable two-factor authentication. Then contact support to report the incident.'
    },
    {
      question: 'How do I switch between light and dark mode?',
      answer: 'Click on "Appearance" in the user menu to toggle between light and dark mode. Your preference will be saved automatically.'
    },
    {
      question: 'What browsers are supported?',
      answer: 'The system works best on the latest versions of Chrome, Firefox, Safari, and Edge. For optimal performance, please keep your browser up to date.'
    },
    {
      question: 'How do I log out of all devices?',
      answer: 'Currently, you can only log out of your current session. To log out of all devices, change your password, which will invalidate all existing sessions.'
    }
  ];

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const FAQItem = ({ faq, index }) => {
    const isOpen = openIndex === index;

    return (
      <div className="border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleFAQ(index)}
          className="
            w-full px-4 py-3 flex items-center justify-between
            bg-white dark:bg-neutral-800
            hover:bg-gray-50 dark:hover:bg-neutral-700
            transition-colors duration-200
            text-left
          "
        >
          <span className="font-medium text-gray-800 dark:text-white pr-4">
            {faq.question}
          </span>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-primary-500 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-400 flex-shrink-0" />
          )}
        </button>
        {isOpen && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-700 border-t border-gray-200 dark:border-neutral-700 animate-slide-down">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {faq.answer}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Frequently Asked Questions" size="lg">
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Find answers to common questions about using the system. If you can't find what you're looking for, please contact support.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {faqs.map((faq, index) => (
            <FAQItem key={index} faq={faq} index={index} />
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

export default FAQsModal;
