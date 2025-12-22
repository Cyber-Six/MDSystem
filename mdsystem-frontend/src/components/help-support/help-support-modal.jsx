import { useState } from 'react';
import { HelpCircle, MessageSquare, Send } from 'lucide-react';
import Modal from '../modals/modal';
import FAQsModal from './faqs-modal';
import ContactSupportModal from './contact-support-modal';
import FeedbackModal from './feedback-modal';

const HelpSupportModal = ({ isOpen, onClose }) => {
  const [activeModal, setActiveModal] = useState(null);

  const supportOptions = [
    {
      id: 'faqs',
      icon: HelpCircle,
      title: 'FAQs / Knowledge Base',
      description: 'Find answers to common questions'
    },
    {
      id: 'contact',
      icon: MessageSquare,
      title: 'Contact Support',
      description: 'Submit a support request'
    },
    {
      id: 'feedback',
      icon: Send,
      title: 'Feedback',
      description: 'Share your suggestions'
    }
  ];

  const handleOptionClick = (optionId) => {
    setActiveModal(optionId);
  };

  const handleCloseSubModal = () => {
    setActiveModal(null);
  };

  const SupportOption = ({ option }) => (
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
      <Modal isOpen={isOpen} onClose={onClose} title="Help & Support" size="md">
        <div className="space-y-2">
          {supportOptions.map((option) => (
            <SupportOption key={option.id} option={option} />
          ))}
        </div>
      </Modal>

      {/* Sub Modals */}
      <FAQsModal 
        isOpen={activeModal === 'faqs'} 
        onClose={handleCloseSubModal} 
      />
      <ContactSupportModal 
        isOpen={activeModal === 'contact'} 
        onClose={handleCloseSubModal} 
      />
      <FeedbackModal 
        isOpen={activeModal === 'feedback'} 
        onClose={handleCloseSubModal} 
      />
    </>
  );
};

export default HelpSupportModal;
