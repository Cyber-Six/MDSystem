import React from 'react';

const TypingIndicator = ({ isTyping, label = 'Patient is typing' }) => {
  if (!isTyping) return null;

  return (
    <div className="flex items-end gap-2 mb-1.5">
      {/* Patient avatar placeholder */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold"
        style={{ background: '#f4c430', color: '#1c1a17' }}
      >
        P
      </div>

      {/* Dots bubble */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl"
        style={{
          background: '#fdfcfa',
          border: '1px solid #e8e5e0',
          borderBottomLeftRadius: '4px',
          boxShadow: '0 1px 3px rgba(28,25,23,0.05)'
        }}
      >
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="block rounded-full animate-bounce"
            style={{
              width: '5px',
              height: '5px',
              background: '#d5d1cb',
              animationDelay: `${delay}ms`,
              animationDuration: '700ms'
            }}
          />
        ))}
      </div>

      <span
        className="text-[10px]"
        style={{ color: '#a19b93', fontFamily: 'Fira Code, monospace' }}
      >
        {label}
      </span>
    </div>
  );
};

export default TypingIndicator;