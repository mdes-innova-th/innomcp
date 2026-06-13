<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-30 role=dev model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":52,"completion_tokens":1611,"total_tokens":1663,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1390,"image_tokens":0},"cache_creation_input_tokens":0} | 31s
 generated: 2026-06-13T05:26:57.034Z -->
import { useState, useEffect } from 'react';

export function useKeyPress(key: string): boolean {
  const [isPressed, setIsPressed] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) {
        setIsPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === key) {
        setIsPressed(false);
      }
    };

    const handleBlur = () => {
      setIsPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [key]);

  return isPressed;
}
