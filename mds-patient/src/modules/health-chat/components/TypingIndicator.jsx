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
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(244,196,48,0.15)',
          border: '1.5px solid rgba(244,196,48,0.3)'
        }}
      >
        <Stethoscope className="w-3.5 h-3.5 text-primary-500" />
      </div>

      {/* Bubble */}
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
        style={{
          background: '#fdfcfa',
          border: '1.5px solid #e8e5e0',
          borderBottomLeftRadius: '4px',
          boxShadow: '0 1px 4px rgba(28,25,23,0.06)'
        }}
      >
        {[0, 150, 300].map((delay, i) => (
          <span
            key={i}
            className="block rounded-full animate-bounce"
            style={{
              width: '6px',
              height: '6px',
              background: '#f4c430',
              animationDelay: `${delay}ms`,
              animationDuration: '700ms'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default TypingIndicator;