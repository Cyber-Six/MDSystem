import { useState } from 'react';
import Modal from '@core/components/modals/modal';

const FeedbackModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    category: 'general',
    rating: 0,
    feedback: ''
  });
  const [errors, setErrors] = useState({});
  const [hoveredRating, setHoveredRating] = useState(0);

  const categories = [
    { value: 'general', label: 'General Feedback' },
    { value: 'bug', label: 'Bug Report' },
    { value: 'feature', label: 'Feature Request' },
    { value: 'ui', label: 'User Interface' },
    { value: 'performance', label: 'Performance' },
    { value: 'other', label: 'Other' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleRatingClick = (rating) => {
    setFormData(prev => ({ ...prev, rating }));
    if (errors.rating) {
      setErrors(prev => ({ ...prev, rating: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.rating) {
      newErrors.rating = 'Please select a rating';
    }
    if (!formData.feedback.trim()) {
      newErrors.feedback = 'Feedback is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle feedback submission
    console.log('Feedback submitted:', formData);

    // Reset form and close
    setFormData({ category: 'general', rating: 0, feedback: '' });
    setErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Feedback" size="md">
      <div className="space-y-4">
        {/* Info Banner */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Your feedback helps us improve. Please share your thoughts, suggestions, or report any issues you've encountered.
          </p>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="
                w-full px-4 py-2.5
                bg-white dark:bg-neutral-800
                border border-gray-300 dark:border-neutral-700
                rounded-lg
                text-gray-800 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                transition-colors duration-200
              "
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rating <span className="text-error-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingClick(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredRating || formData.rating)
                        ? 'fill-primary-500 text-primary-500'
                        : 'fill-neutral-200 dark:fill-neutral-700 text-neutral-200 dark:text-neutral-700'
                    }`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </button>
              ))}
              {formData.rating > 0 && (
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                  {formData.rating} star{formData.rating !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {errors.rating && (
              <p className="mt-1 text-sm text-error-500">{errors.rating}</p>
            )}
          </div>

          {/* Feedback Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Feedback <span className="text-error-500">*</span>
            </label>
            <textarea
              name="feedback"
              value={formData.feedback}
              onChange={handleChange}
              rows="5"
              className={`
                w-full px-4 py-2.5
                bg-white dark:bg-neutral-800
                border ${errors.feedback ? 'border-error-500' : 'border-gray-300 dark:border-neutral-700'}
                rounded-lg
                text-gray-800 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                transition-colors duration-200
                resize-none
              `}
              placeholder="Tell us what you think..."
            />
            {errors.feedback && (
              <p className="mt-1 text-sm text-error-500">{errors.feedback}</p>
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
              Submit Feedback
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default FeedbackModal;
