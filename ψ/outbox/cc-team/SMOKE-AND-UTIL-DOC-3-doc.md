<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: DOC-3 role=doc model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":47,"completion_tokens":1679,"total_tokens":1726,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1215,"image_tokens":0},"cache_creation_input_tokens":0} | 22s
 generated: 2026-06-13T05:34:04.705Z -->
```markdown
# Contributing Frontend

This guide outlines conventions for adding new React components to innomcp-next.

## File Naming
- Use **PascalCase** for component files and their folders: `components/Button/Button.tsx`.
- Co-locate related files (tests, sub‑components, utility hooks) inside the component directory.
- Always use the `.tsx` extension for files that contain JSX.

## Export Patterns
- Prefer **named exports** for all components to keep imports consistent and aid tree‑shaking.
- Export the component function directly: `export function Button() { … }`.
- For compound components, attach sub‑components to the main component:
  ```ts
  Button.Icon = Icon;
  export { Button };
  ```
- Avoid default exports—they can cause unintentional renaming during imports.

## Tailwind Usage
- Style components exclusively with Tailwind utility classes via `className`.
- Use the `cn()` helper from `@/lib/utils` to merge conditional classes cleanly.
  ```tsx
  import { cn } from "@/lib/utils";
  <button className={cn("base", variant === "primary" && "bg-blue-500")}>…
  ```
- Stick to design tokens from `tailwind.config.ts` (colors, spacing, fonts) and avoid hard‑coded values.
- Build with a **mobile‑first** mindset; add responsive modifiers (`sm:`, `md:`, etc.) when scaling up.
- Do not introduce inline styles or separate CSS files unless absolutely necessary.

## Testing
- Write tests with **Vitest** and **React Testing Library**.
- Place test files next to the component with a `.test.tsx` extension: `Button.test.tsx`.
- Verify correct rendering, prop variations, and user interactions.
- Use `render` and `screen`; query elements by accessible roles (e.g., `getByRole`) whenever possible.
- Simulate real user events with `@testing-library/user-event`.
- Mock external dependencies using `vi.mock` from Vitest.
- Focus tests on observable behavior, not internal implementation.
- Ensure all tests pass by running `pnpm test` before submitting a pull request.
```
