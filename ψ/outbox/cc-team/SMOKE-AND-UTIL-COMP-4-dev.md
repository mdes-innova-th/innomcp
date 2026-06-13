<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: COMP-4 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":72,"completion_tokens":1620,"total_tokens":1692,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1099,"image_tokens":0},"cache_creation_input_tokens":0} | 20s
 generated: 2026-06-13T05:28:31.761Z -->
import React, { useRef, useEffect, useState } from 'react';

interface TextAreaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxRows?: number;
  disabled?: boolean;
}

const TextArea: React.FC<TextAreaProps> = ({
  value,
  onChange,
  placeholder = '',
  rows = 1,
  maxRows,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [lineHeight, setLineHeight] = useState<number>(24); // fallback default

  useEffect(() => {
    if (textareaRef.current && maxRows && maxRows > 0) {
      const computedStyle = getComputedStyle(textareaRef.current);
      const lh = parseFloat(computedStyle.lineHeight);
      if (!isNaN(lh) && lh > 0) {
        setLineHeight(lh);
      }
    }
  }, [maxRows]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;

    if (maxRows && maxRows > 0) {
      const maxHeight = lineHeight * maxRows;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    } else {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = 'hidden';
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value, lineHeight, maxRows]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full resize-none rounded-md border border-gray-300 p-2 leading-normal placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        overflowY: 'hidden',
      }}
    />
  );
};

export default TextArea;
