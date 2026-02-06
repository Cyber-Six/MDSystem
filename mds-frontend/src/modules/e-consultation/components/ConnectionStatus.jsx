import React from 'react';

const ConnectionStatus = ({ connectionStatus }) => {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
      <h4 className="text-sm font-medium text-neutral-900 dark:text-white mb-2">Connection Status</h4>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
        }`} />
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          {connectionStatus === 'connected' && 'Connected to backend'}
          {connectionStatus === 'offline' && 'Offline'}
          {connectionStatus === 'error' && 'Connection error'}
          {connectionStatus === 'checking' && 'Checking connection...'}
        </span>
      </div>
    </div>
  );
};

export default ConnectionStatus;
