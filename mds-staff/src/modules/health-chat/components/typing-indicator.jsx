import React from 'react';

const TypingIndicator = ({ isTyping, label = 'Patient is typing' }) => {
  if (!isTyping) return null;

  return (
    <div className="flex items-end gap-2 mb-1.5">
      {/* Patient avatar placeholder */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold bg-primary-500 text-secondary-900">
        P
      </div>

      {/* Dots bubble */}
      <div
        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm"
        style={{ borderBottomLeftRadius: '4px' }}
      >
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="block rounded-full animate-bounce bg-neutral-300 dark:bg-neutral-500"
            style={{
              width: '5px',
              height: '5px',
              animationDelay: `${delay}ms`,
              animationDuration: '700ms'
            }}
          />
        ))}
      </div>

      <span
        className="text-[10px] text-neutral-400 dark:text-neutral-500"
        style={{ fontFamily: 'Fira Code, monospace' }}
      >
        {label}
      </span>
    </div>
  );
};

export default React.memo(TypingIndicator);
