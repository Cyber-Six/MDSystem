import React from 'react';
import { Stethoscope } from 'lucide-react';

/**
 * TypingIndicator — patient side
 * Shows a friendly warm-toned animation when staff is typing
 */
const TypingIndicator = ({ isTyping, label = 'Medical Staff' }) => {
  if (!isTyping) return null;

  return (
    <div className="flex gap-2.5 items-end mb-1">
      {/* Staff avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-primary-500/15 border-[1.5px] border-primary-500/30">
        <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
      </div>

      {/* Bubble */}
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white dark:bg-neutral-800 border-[1.5px] border-neutral-200 dark:border-neutral-700 shadow-sm"
        style={{ borderBottomLeftRadius: '4px' }}
      >
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="block rounded-full animate-bounce bg-primary-500"
            style={{
              width: '6px',
              height: '6px',
              animationDelay: `${delay}ms`,
              animationDuration: '700ms'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(TypingIndicator);
