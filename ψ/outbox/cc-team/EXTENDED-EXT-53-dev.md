<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-53 role=dev model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":73,"completion_tokens":904,"total_tokens":977,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":534,"image_tokens":0},"cache_creation_input_tokens":0} | 10s
 generated: 2026-06-13T05:27:27.300Z -->
import React, { useState, useEffect, useRef } from 'react';

interface CountProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
}

const Count: React.FC<CountProps> = ({
  value,
  duration = 500,
  prefix = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Cancel any previous animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Reset to 0
    setDisplayValue(0);
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const current = progress * value;

      setDisplayValue(Math.round(current));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(Math.round(value));
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup on unmount or dependency change
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span>
      {prefix}{displayValue}{suffix}
    </span>
  );
};

export default Count;
