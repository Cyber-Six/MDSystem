import React from 'react';

const guidelines = [
  'This chat is for general health questions, not emergencies.',
  'Not a substitute for professional medical advice or diagnosis.',
  'For emergencies, visit the clinic or call emergency services.',
  'Your conversation is private and secure.',
];

const GuidelinesCard = () => {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'rgba(244,196,48,0.06)',
        border: '1.5px solid rgba(244,196,48,0.2)'
      }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#C9A01E' }}>
        Good to know
      </p>
      <ul className="space-y-2.5">
        {guidelines.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(244,196,48,0.2)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#f4c430' }}
              />
            </span>
            <span className="text-sm leading-relaxed" style={{ color: '#57534e' }}>
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GuidelinesCard;