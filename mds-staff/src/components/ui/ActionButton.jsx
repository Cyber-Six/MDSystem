import React from 'react';

const ActionButton = ({ children, onClick, className = '', type = 'button', disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors ${className}`}
    >
      {children}
    </button>
  );
};

export default ActionButton;
