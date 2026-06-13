<!-- cc-team deliverable
 group: EXTENDED (120+ quality/utility/component tasks)
 member: EXT-19 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":56,"completion_tokens":3000,"total_tokens":3056,"prompt_tokens_details":{"cached_tokens":55,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 29s
 generated: 2026-06-13T05:26:25.822Z -->
The user wants a React hook written in TypeScript, located at `innomcp-next/src/app/hooks/useMediaQuery.ts`. The hook should:

1. Be named `useMediaQuery`
2. Take a `query: string` parameter
3. Return a `boolean`
4. Use `window.matchMedia`
5. Update on change (listen to changes)
6. Be SSR-safe (Server-Side Rendering safe - needs to handle case where `window` is undefined)
7. Be exported
8. Output ONLY `.ts` content, no markdown fences (no ```typescript blocks)

Let me write this hook.

For SSR safety:
- During server rendering, `window` is undefined. We should return `false` as a default, or perhaps match the initial state based on the query if possible, but without window we can't know. Returning `false` is safest, or we could return a default that makes sense. Actually, a common pattern is to default to `false` to avoid hydration mismatches, or we could default to `true` for mobile-first queries? But safest is `false` or we can try to default to `false` to prevent issues. Some implementations default to `false` but allow an optional default value. However the user specified the signature as `useMediaQuery(query:string): boolean`, so no optional default parameter in the signature. I'll default to `false` on server.

Implementation:
```typescript
import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia(query);
    
    // Set initial value
    setMatches(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern API
    media.addEventListener('change', listener);
    
    return () => {
      media.removeEventListener('change', listener);
    };
  }, [query]);

  return matches;
}
```

Wait, there's a subtle issue. If the effect runs and sets the initial value, there might be a flash of incorrect content during hydration if the server rendered `false` but client immediately sets `true` before hydration? Actually, `useEffect` runs after hydration, so it's fine. But to be extra safe and avoid a potential hydration mismatch if we were to use `useSyncExternalStore`... but the user asked for a hook using `window.matchMedia` and updating on change. `useSyncExternalStore` is actually the modern recommended way for this because it handles SSR and hydration correctly.

However, the user specifically said "Uses window.matchMedia, updates on change. SSR-safe." They didn't specify `useSyncExternalStore`, but that's the most SSR-safe way. But a `useState` + `useEffect` approach is also commonly used and considered SSR-safe enough if we default to `false`.

Actually, let me reconsider. With `useEffect`, the initial render on client will have `false` (or whatever we initialize to) until the effect runs. This could cause a layout shift or incorrect rendering for a frame. `useSyncExternalStore` would be better because it can snapshot the correct value immediately during hydration if available.

But `useSyncExternalStore` requires a getSnapshot function. During SSR, `window` is undefined, so getSnapshot would return `false`. On client, it reads `window.matchMedia(query).matches`. However, `matchMedia` returns a live object, so we need to be careful that the snapshot is immutable.

Let me write it with `useSyncExternalStore` for maximum SSR safety and correctness:

```typescript
import { useSyncExternalStore } from 'react';

function getServerSnapshot() {
  return false;
}

export function useMediaQuery(query: string): boolean {
  const getSnapshot = () => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  };

  const subscribe = (callback: () => void) => {
    if (typeof window === 'undefined') {
      return () => {};
    }
    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener('change', callback);
    return () => {
      mediaQueryList.removeEventListener('change', callback);
    };
  };

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
}
```

Wait, there's a problem with `getSnapshot`. The React docs say: "The same getSnapshot function should return the same data for a particular store state. If the underlying store changes and the returned data differs, React will re-render the component." 

But `window.matchMedia(query).matches` is not a store state per se. However, `useSyncExternalStore` is actually perfect for this because the MediaQueryList is an external store. The issue is that `getSnapshot` creates a new MediaQueryList every time. But that's okay because `matches` is a boolean, and if it hasn't changed, React won't re-render (it does shallow equality? Actually React uses `Object.is` to compare snapshot results). So if `matches` is the same boolean, it's fine.

However, there's a subtle issue: if the component re-renders for other reasons, `getSnapshot` runs again and creates a new MediaQueryList object, but reads its `matches`. This is fine.

But actually, the `subscribe` function also creates a new MediaQueryList. We should ideally use the same MediaQueryList instance for both subscribe and getSnapshot? Not necessarily required, but it's cleaner. However, since `getSnapshot` is called frequently, creating a new MediaQueryList every time might be slightly inefficient but acceptable.

Actually, a more optimized version caches the MediaQueryList per query. But since the hook could be called with different queries, we can use a WeakMap or just a Map. But query is a string, so we can use a Map. However, for simplicity and since matchMedia is cheap, we might not need it.

But wait: `useSyncExternalStore` expects the subscribe function to be stable or memoized? Actually, React will re-subscribe if the subscribe function changes identity. So we should wrap it in `useCallback` or define it inside the hook but React will handle it. Actually, the subscribe function is passed directly to `useSyncExternalStore`, and React internally uses it. If we define it inside the component, it will be a new function on every render, causing React to re-subscribe every render. That's bad.

So we should use `useCallback` for subscribe, or better yet, use a ref or memoize the media query list.

Actually, the standard pattern for `useSyncExternalStore` with matchMedia is:

```typescript
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', callback);
      return () => mediaQuery.removeEventListener('change', callback);
    },
    () => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia(query).matches;
    },
    () => false
  );
}
```

But as I noted, this creates new functions every render. React's `useSyncExternalStore` does accept a subscribe function and it will re-subscribe if the function identity changes. So we should memoize it.

We can use `useCallback`:

```typescript
import { useSyncExternalStore, useCallback } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((callback: () => void) => {
    if (typeof window === 'undefined') return () => {};
    const mediaQuery = window.matchMedia(query);
    mediaQuery.addEventListener('change', callback);
    return () => mediaQuery.removeEventListener('change', callback);
  }, [query]);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

This is much better. SSR-safe, no hydration mismatch (if server snapshot matches initial client snapshot before hydration), updates immediately.

However, some might argue that `useEffect` is simpler and sufficient. But `useSyncExternalStore` is truly SSR-safe and avoids the "flash of false content" issue. Given the user specifically asked for SSR-safe, I think `useSyncExternalStore` is the best choice.

But wait, the user said "Uses window.matchMedia, updates on change." Both approaches do this.

Let me check if there are any issues with `useSyncExternalStore` and `matchMedia`. The `change` event callback receives a `MediaQueryListEvent`, but `useSyncExternalStore`'s subscribe function expects a callback that takes no arguments. So we need to wrap it:

```typescript
const onChange = () => callback();
mediaQuery.addEventListener('change', onChange);
return () => mediaQuery.removeEventListener('change', onChange);
```

Actually, the callback passed by React to the subscribe function is `() => void`. The MediaQueryList event listener receives an event. So we need an adapter:

```typescript
const listener = () => callback();
mediaQuery.addEventListener('change', listener);
return () => mediaQuery.removeEventListener('change', listener);
```

This is correct.

Let me write the final code cleanly.

One more thing: should I include `'use client'`? Since this uses `window`, it must be a client component. In Next.js App Router, hooks that use browser APIs need to be used in client components, but the hook file itself doesn't necessarily need the directive unless it's imported into a server component. However, since the hook uses `window`, it can only run on the client. But the file is in `src/app/hooks/`. Usually, you don't put `'use client'` in a hook file; you put it in the component that uses the hook. But sometimes people put it in the hook file to be safe. The user didn't ask for it, and it's not strictly necessary for the hook to work if called from a client component. I'll omit it to keep it framework-agnostic, though it's clearly for Next.js given the path. Actually, the path `innomcp-next/src/app/hooks/useMediaQuery.ts` suggests Next.js App Router. But the hook itself is just React. I'll omit `'use client'` because hooks don't render anything; they just need to be called from client components.

Let me write the final output:

```typescript
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined') {
        return () => {};
      }

      const mediaQueryList = window.matchMedia(query);
      const listener = () => callback();

      mediaQueryList.addEventListener('change', listener);
      return () => mediaQueryList.removeEventListener('change', listener);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

Wait, I can simplify by not importing `useCallback` separately if I import everything from react. But separate imports are fine.

Actually, I can write it without `useCallback` by using refs or by relying on the fact that `useSyncExternalStore` is designed to handle this. But no, React will resubscribe if subscribe changes identity.

Let me double-check: does `useSyncExternalStore` resubscribe on every render if subscribe is not memoized? Yes, according to the docs: "React will re-subscribe to the store if you pass a different subscribe function between re-renders." So memoizing is important.

Alternatively, we can define the subscribe, getSnapshot, and getServerSnapshot outside the hook to avoid memoization, but they depend on `query`. We could use a global cache:

```typescript
const mediaQueryCache = new Map<string, MediaQueryList>();

function getMediaQueryList(query: string): MediaQueryList | undefined {
  if (typeof window === 'undefined') return undefined;
  if (!mediaQueryCache.has(query)) {
    mediaQueryCache.set(query, window.matchMedia(query));
  }
  return mediaQueryCache.get(query);
}
```

But this adds complexity and potential memory leaks if many unique queries are used. Not necessary.

The `useCallback` approach is clean and sufficient.

One more check: `useSyncExternalStore` is available in React 18+. Given the path `innomcp-next`, Next.js App Router requires React 18 anyway. So it's fine.

If I wanted to be compatible with older React, I could use `useState` + `useEffect`, but `useSyncExternalStore` is the correct modern approach.

Let me also consider if `matchMedia` is available in all browsers. Yes, widely supported.

Final check on the requirements:
- Output ONLY .ts, no fences: Yes, I will output raw text without markdown code blocks.
- Export: Yes, named export.
- SSR-safe: Yes, checks `typeof window`.
- Updates on change: Yes, event listener.
- Uses window.matchMedia: Yes.

I think the code is good. I'll write it concisely.

Actually, I can make it even more concise by inlining the callbacks but still using `useCallback`:

```typescript
import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const mql = window
