import React from 'react';

interface ErrorMessageProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ title, message, onRetry }) => {
  return (
    <div className="border border-red-500 rounded-md p-4 bg-red-50">
      <h3 className="font-bold text-red-700 text-lg">{title}</h3>
      <p className="text-red-600 mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;