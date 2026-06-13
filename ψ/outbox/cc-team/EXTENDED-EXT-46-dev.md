<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-46 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":66,"completion_tokens":374,"total_tokens":440,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":210,"image_tokens":0},"cache_creation_input_tokens":0} | 5s
 generated: 2026-06-13T05:27:08.085Z -->
import React from 'react';

interface KbdProps {
  keys: string[];
}

const Kbd: React.FC<KbdProps> = ({ keys }) => {
  return (
    <div className="inline-flex items-center gap-1">
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-gray-400 mx-0.5">+</span>}
          <kbd className="px-2 py-1 text-xs font-mono font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded-md shadow-sm">
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
};

export default Kbd;
