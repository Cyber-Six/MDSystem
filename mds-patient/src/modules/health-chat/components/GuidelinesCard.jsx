import React from 'react';

const guidelines = [
  'This chat is for general health questions, not emergencies.',
  'Not a substitute for professional medical advice or diagnosis.',
  'For emergencies, visit the clinic or call emergency services.',
  'Your conversation is private and secure.',
];

const GuidelinesCard = () => {
  return (
    <div className="rounded-2xl p-5 bg-primary-500/5 dark:bg-primary-500/10 border-[1.5px] border-primary-500/20 dark:border-primary-500/25">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-primary-700 dark:text-primary-400">
        Good to know
      </p>
      <ul className="space-y-2.5">
        {guidelines.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-primary-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
            </span>
            <span className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GuidelinesCard;
