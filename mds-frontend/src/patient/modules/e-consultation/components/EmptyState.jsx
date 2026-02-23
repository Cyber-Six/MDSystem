import React from 'react';
import { Loader2, WifiOff, AlertCircle } from 'lucide-react';

const EmptyState = ({ type, error, onRetry }) => {
  if (type === 'initializing') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Connecting to AI assistant...</p>
        </div>
      </div>
    );
  }

  if (type === 'offline') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <WifiOff className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Unable to Connect</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            The AI service is currently unavailable. Please ensure:
          </p>
          <ul className="text-left text-neutral-600 dark:text-neutral-400 mb-6 max-w-md mx-auto">
            <li>• The backend server is running</li>
            <li>• Your network connection is stable</li>
          </ul>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">Connection Error</h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {error || 'An error occurred while connecting to the AI service.'}
          </p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
