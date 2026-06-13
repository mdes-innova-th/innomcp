<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-54 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":78,"completion_tokens":3000,"total_tokens":3078,"prompt_tokens_details":{"cached_tokens":18,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-13T05:27:44.818Z -->
The user wants a TypeScript React component for a Timer. Requirements:
- File path context: innomcp-next/src/app/components/common/Timer.tsx (but output should be just the code, no fences)
- Mode: 'countdown' | 'stopwatch'
- Props: {mode, initialMs?, onComplete?}
- Display: MM:SS (though if we have milliseconds or hours, but user specifically asked MM:SS. Wait, what about hours? If initialMs is large, MM:SS might not be enough. But user said Shows MM:SS. I should probably handle hours by just showing MM:SS with minutes potentially > 59, or maybe format as MM:SS where minutes can exceed 59. Or maybe HH:MM:SS? No, user explicitly said MM:SS. So I'll format minutes and seconds, allowing minutes to be > 59 if needed. Or maybe I should cap it? No, just MM:SS is fine, minutes can be large.
- Controls: start/pause/reset
- Export default
- Output ONLY .tsx, no fences (no markdown code blocks)

I need to write clean TypeScript React code. Likely using hooks: useState, useEffect, useRef.

Let's think about the logic:

State:
- timeMs: number (current time in ms)
- isRunning: boolean
- For countdown: starts at initialMs, goes down to 0.
- For stopwatch: starts at 0, goes up.

Wait, for countdown, initialMs is the starting time. If not provided, maybe default to 0? But countdown from 0 makes no sense. Maybe default to 60000 (1 minute) or require it? The prop is optional. If mode is countdown and initialMs is undefined, maybe default to 0 or handle gracefully. I'll default to 0 and if it's 0, maybe just show 00:00. Or better, if initialMs is undefined, use 0. But user might expect it to be required for countdown. I'll just handle it: `const startTime = initialMs ?? 0;` For countdown, if startTime is 0, it's already complete.

Actually, for countdown, the timer should start at initialMs and decrement. For stopwatch, start at 0 and increment.

Display formatting: MM:SS. We need to format milliseconds to minutes and seconds.
`const totalSeconds = Math.floor(timeMs / 1000);`
`const minutes = Math.floor(totalSeconds / 60);`
`const seconds = totalSeconds % 60;`
Then pad: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

But wait, if minutes > 99, padStart(2, '0') won't be enough. Maybe just don't pad minutes or use a dynamic pad? The user said MM:SS, implying two digits for minutes. But to be safe, I'll pad to at least 2 digits. `String(minutes).padStart(2, '0')` is fine.

Timer logic:
Use `useEffect` with `setInterval`. Interval every 100ms or 10ms? Since display is only seconds, 100ms is fine, but for smoother UI maybe 100ms. Actually, for countdown accuracy, we should probably use a smaller interval or track start time.

Better approach: use a `startTimeRef` and `pausedTimeRef` to track elapsed time precisely, rather than decrementing state which can drift.

Let's design:

For stopwatch:
- When start is clicked, record `Date.now() - elapsedMs` as `startTimeRef`.
- On interval (e.g., 100ms), set `timeMs` to `Date.now() - startTimeRef.current`.
- When pause, record current `timeMs` into `pausedTimeRef` or just keep it in state. When resume, update `startTimeRef` to `Date.now() - timeMs`.

For countdown:
- Total duration is `initialMs`.
- When start, `startTimeRef` = `Date.now()`. Target end = `Date.now() + remainingMs`.
- On interval, `remainingMs = endTimeRef - Date.now()`. Set `timeMs` to `remainingMs`.
- When pause, `timeMs` is the remaining time. When resume, `endTimeRef = Date.now() + timeMs`.

Actually, a unified approach:
- Keep `timeMs` in state (current display value).
- Keep `isRunning`.
- Keep `lastTickRef` for requestAnimationFrame or setInterval.

Simpler unified approach with `useEffect` and `setInterval` every 100ms:

```typescript
useEffect(() => {
  if (!isRunning) return;
  const interval = setInterval(() => {
    setTimeMs(prev => {
      if (mode === 'countdown') {
        const next = prev - 100;
        if (next <= 0) {
          clearInterval(interval); // can't do this inside easily, but we can stop via effect cleanup or check in effect
          return 0;
        }
        return next;
      } else {
        return prev + 100;
      }
    });
  }, 100);
  return () => clearInterval(interval);
}, [isRunning, mode]);
```

But the problem is clearing interval when countdown reaches 0. Since `setInterval` callback captures the interval id in a closure if we assign it to a variable declared outside. Actually:

```typescript
let interval: NodeJS.Timeout;
if (isRunning) {
  interval = setInterval(() => {
    setTimeMs(prev => {
      if (mode === 'countdown') {
        const next = prev - 100;
        if (next <= 0) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return next;
      }
      return prev + 100;
    });
  }, 100);
}
return () => clearInterval(interval);
```

This works. However, `onComplete` inside the interval callback might be stale if not using refs. But since we call it when reaching 0, it's probably okay, but to be safe with exhaustive-deps, we should use a ref for `onComplete`.

Also, `initialMs` prop: when mode is countdown, initial time should be `initialMs ?? 0`. When stopwatch, initial time is 0. But what if `initialMs` changes while running? Probably should reset if it changes? Or just use it on mount. The user didn't specify, but typically for a timer component, if `initialMs` changes, it should probably reset. I'll add a `useEffect` that resets when `initialMs` or `mode` changes.

Wait, if `mode` changes from countdown to stopwatch, it should reset. Yes.

Let's structure:

```typescript
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface TimerProps {
  mode: 'countdown' | 'stopwatch';
  initialMs?: number;
  onComplete?: () => void;
}

export default function Timer({ mode, initialMs = 0, onComplete }: TimerProps) {
  const [timeMs, setTimeMs] = useState(mode === 'countdown' ? initialMs : 0);
  const [isRunning, setIsRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Reset when mode or initialMs changes
  useEffect(() => {
    setIsRunning(false);
    setTimeMs(mode === 'countdown' ? initialMs : 0);
  }, [mode, initialMs]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTimeMs(prev => {
        if (mode === 'countdown') {
          const next = prev - 100;
          if (next <= 0) {
            clearInterval(interval);
            setIsRunning(false); // This might be problematic inside setState updater? Actually calling setIsRunning inside setTimeMs updater is not ideal because it's during render phase if it's a functional update? Wait, setTimeMs updater runs during render if it's a functional update? No, setState functional updater runs during the state update, not exactly render, but it's safe to call other setters? React docs say it's safe to call multiple setters, but inside an updater function, it's not recommended because it might be during render. Better to handle this in the effect body or use a ref.
            // Actually, better approach: don't use functional update for complex side effects.
            return 0;
          }
          return next;
        }
        return prev + 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, mode]);
}
```

The issue with calling `setIsRunning(false)` inside `setTimeMs` updater is that it could trigger a re-render while already rendering (if batching doesn't handle it). To avoid this, better to use a ref for running state or handle the completion in a separate effect.

Alternative: Use a `tick` approach.

```typescript
useEffect(() => {
  if (!isRunning) return;
  const interval = setInterval(() => {
    setTimeMs(prev => {
      if (mode === 'countdown') {
        return Math.max(0, prev - 100);
      }
      return prev + 100;
    });
  }, 100);
  return () => clearInterval(interval);
}, [isRunning, mode]);

useEffect(() => {
  if (mode === 'countdown' && timeMs === 0 && isRunning) {
    setIsRunning(false);
    onCompleteRef.current?.();
  }
}, [timeMs, mode, isRunning]);
```

This is cleaner. The interval just updates time. A separate effect watches for completion. But wait, if `timeMs` becomes 0, it triggers the effect. However, due to interval step of 100ms, it might overshoot slightly if we don't clamp. We are clamping with `Math.max(0, prev - 100)`. Good.

But what if `initialMs` is not a multiple of 100? Then the last step might leave a few ms. E.g., 1500ms -> 1400 -> ... -> 100 -> 0. That's fine. Or 1550 -> 1450 -> ... -> 50 -> -50 -> 0. Wait, `Math.max(0, prev - 100)` handles it. But it might skip the exact 0? No, if prev is 50, next is -50, Math.max(0, -50) = 0. So it will hit 0. Good.

However, if `initialMs` is 0 and mode is countdown, `timeMs` starts at 0. The completion effect would immediately fire if `isRunning` is true? But `isRunning` starts false. If user clicks start, `timeMs` is 0, interval runs, `Math.max(0, 0-100)` = 0. So it stays 0. The completion effect fires because `timeMs === 0 && isRunning`. That would immediately call onComplete and set isRunning false. That seems acceptable: starting a countdown from 0 immediately completes.

But maybe we should prevent starting if time is 0? Not necessary.

What about stopwatch? It increments forever.

Formatting:
```typescript
const totalSeconds = Math.floor(timeMs / 1000);
const minutes = Math.floor(totalSeconds / 60);
const seconds = totalSeconds % 60;
const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
```

Controls: Start/Pause/Reset buttons.
- Start/Pause toggle: if running, show Pause, else Show Start.
- Reset: resets to initial state.

Styling: The user didn't specify styling library. Since it's Next.js app directory, likely Tailwind is available but not guaranteed. I should keep it minimal or use inline styles or basic classes. The user said "Output ONLY .tsx, no fences". They didn't specify styling, so I can use basic JSX with inline styles or Tailwind classes. Given the path `innomcp-next`, Tailwind is very common in Next.js. But to be safe and self-contained, maybe use inline styles or minimal class names. However, using Tailwind is standard. But if they don't have Tailwind, classes won't work. Inline styles are safest for a standalone component, but ugly. Alternatively, just use semantic HTML with no styling? No, they asked for a component with controls. I'll use basic inline styles for layout to avoid external dependencies, or use Tailwind but mention it's assumed? The prompt doesn't mention styling. I'll use a clean layout with inline styles or minimal CSS-in-JS. Actually, standard React components often just use classes. I'll use Tailwind classes because it's Next.js and extremely common. But if I want to be 100% safe, I'll use inline styles for the container and buttons.

Wait, the user might just want the logic and structure. I'll provide a clean component with inline styles for minimal dependency, or perhaps just use `<button>` elements without classes. But "Shows MM:SS. Controls: start/pause/reset." implies some layout. I'll use a simple flex layout with inline styles.

Let's refine the code:

```typescript
'use client';

import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  mode: 'countdown' | 'stopwatch';
  initialMs?: number;
  onComplete?: () => void;
}

export default function Timer({ mode, initialMs = 0, onComplete }: TimerProps) {
  const [timeMs, setTimeMs] = useState(() => (mode === 'countdown' ? initialMs : 0));
  const [isRunning, setIsRunning] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Reset when mode or initialMs changes
  useEffect(() => {
    setIsRunning(false);
    setTimeMs(mode === 'countdown' ? initialMs : 0);
  }, [mode, initialMs]);

  // Timer interval
