<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-17 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":83,"completion_tokens":312,"total_tokens":395,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":127,"image_tokens":0},"cache_creation_input_tokens":0} | 5s
 generated: 2026-06-12T04:21:21.124Z -->
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
