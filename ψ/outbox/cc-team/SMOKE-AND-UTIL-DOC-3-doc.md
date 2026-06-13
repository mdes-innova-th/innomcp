<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: DOC-3 role=doc model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":47,"completion_tokens":991,"total_tokens":1038,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":378,"image_tokens":0},"cache_creation_input_tokens":0} | 14s
 generated: 2026-06-13T05:28:19.337Z -->
```markdown
# Contributing Frontend — Adding React Components

This guide covers how to add new React components to `innomcp-next`. Follow these conventions to keep the codebase consistent.

## File Naming
- Use **PascalCase** for component files and their directories (e.g., `Button/Button.tsx`).
- Always use the `.tsx` extension.
- Keep each component in its own folder, co-locating related files:
  ```
  Button/
    Button.tsx
    Button.test.tsx
    index.ts
  ```
- The `index.ts` file should re-export the component (see export patterns).

## Export Patterns
- **Prefer named exports** for all components. This avoids accidental renaming during imports and makes refactoring safer.
- Export the component interface/types separately (e.g., `export interface ButtonProps { … }`).
- Use a barrel `index.ts` in each folder:
  ```ts
  export { Button, type ButtonProps } from './Button';
  ```
- Do not use default exports for components.

## Tailwind Usage
- Style components exclusively with Tailwind utility classes via the `className` prop.
- Use the `cn()` utility (from `@/lib/utils`) to conditionally merge classes:
  ```tsx
  <button className={cn('px-4 py-2 rounded', variant === 'primary' && 'bg-blue-600')} />
  ```
- Avoid inline styles and CSS modules unless absolutely necessary. If you need reusable patterns, extract them with `@apply` in a shared layer.
- Follow the design system tokens (spacing, colors, typography) already defined in the Tailwind config.
- Use responsive prefixes (`sm:`, `md:`, etc.) and dark mode classes (`dark:`) as needed.

## Testing
- Use **Vitest** and **React Testing Library**.
- Place the test file next to the component with the suffix `.test.tsx` (e.g., `Button.test.tsx`).
- Write tests that focus on **user-visible behavior**: rendering, interactions, accessibility.
- Example minimal test:
  ```tsx
  import { render, screen } from '@testing-library/react';
  import userEvent from '@testing-library/user-event';
  import { Button } from './Button';

  test('renders children and responds to click', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    await userEvent.click(screen.getByRole('button', { name: /click me/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  ```
- Mock external dependencies (APIs, hooks) with `vi.mock` when needed, but keep mocks minimal to avoid testing implementation details.

---

Follow these patterns to ensure every component is predictable, maintainable, and easy to review.
```
