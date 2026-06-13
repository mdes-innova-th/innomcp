<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: COMP-2 role=dev model=zai-org/GLM-5.1
 finish_reason: stop | tokens: {"prompt_tokens":64,"completion_tokens":1481,"total_tokens":1545,"prompt_tokens_details":{"cached_tokens":4,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1298,"reasoning_tokens_estimated":true,"image_tokens":0},"cache_creation_input_tokens":0} | 27s
 generated: 2026-06-13T05:28:34.767Z -->
import React from 'react';

interface RadioGroupProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}

export default function RadioGroup({ options, value, onChange, name }: RadioGroupProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((option) => (
        <label 
          key={option.value} 
          className={`inline-flex items-center gap-3 cursor-pointer rounded-lg border p-3 transition-colors ${
            value === option.value 
              ? 'border-blue-500 bg-blue-50 text-blue-700' 
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 border-gray-300 text-blue-600 accent-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
