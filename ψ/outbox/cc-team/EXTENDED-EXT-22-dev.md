<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-22 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":57,"completion_tokens":460,"total_tokens":517,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":306,"image_tokens":0},"cache_creation_input_tokens":0} | 5s
 generated: 2026-06-13T05:26:08.978Z -->
import React from 'react';

interface SpinnerProps {
  show: boolean;
  message?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ show, message }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="flex flex-col items-center space-y-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent border-white" />
        {message && <p className="text-white text-lg">{message}</p>}
      </div>
    </div>
  );
};

export default Spinner;
