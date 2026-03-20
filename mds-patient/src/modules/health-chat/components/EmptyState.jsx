import React from 'react';
import { WifiOff, AlertCircle } from 'lucide-react';

const EmptyState = ({ type, error, onRetry }) => {
  if (type === 'initializing') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mx-auto mb-4"
          />
          <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            Getting things ready…
          </p>
        </div>
      </div>
    );
  }

  if (type === 'offline') {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-neutral-100 dark:bg-neutral-800 border-[1.5px] border-neutral-200 dark:border-neutral-700">
            <WifiOff className="w-7 h-7 text-neutral-400 dark:text-neutral-500" />
          </div>
          <h2 className="font-heading font-semibold text-lg text-secondary-800 dark:text-white mb-2">
            Can't connect right now
          </h2>
          <p className="text-sm mb-5 text-neutral-500 dark:text-neutral-400">
            Check your network connection, then try again.
          </p>
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-secondary-900 transition-all
                       hover:brightness-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
              boxShadow: '0 3px 10px rgba(244,196,48,0.3)'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-4">
        <div className="text-center max-w-xs">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50 dark:bg-red-900/20 border-[1.5px] border-red-200 dark:border-red-800">
            <AlertCircle className="w-7 h-7 text-error-500" />
          </div>
          <h2 className="font-heading font-semibold text-lg text-secondary-800 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm mb-5 text-neutral-500 dark:text-neutral-400">
            {error || 'An error occurred while connecting.'}
          </p>
          <button
            onClick={onRetry}
            className="px-6 py-2.5 rounded-full text-sm font-semibold text-secondary-900 transition-all
                       hover:brightness-105 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #f4c430 0%, #DDB322 100%)',
              boxShadow: '0 3px 10px rgba(244,196,48,0.3)'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default EmptyState;
