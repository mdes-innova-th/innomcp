<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: DOC-1 role=doc model=Qwen/Qwen3.7-Max
 finish_reason: stop | tokens: {"prompt_tokens":53,"completion_tokens":2978,"total_tokens":3031,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":2467,"image_tokens":0},"cache_creation_input_tokens":0} | 58s
 generated: 2026-06-13T05:29:32.681Z -->
# COMPONENT-DESIGN-SYSTEM

## Core Philosophy
Components in `innomcp-next` must be composable, accessible, and strictly typed. We prioritize standard HTML semantics and extensibility over rigid, monolithic abstractions.

## Tailwind Conventions
* **Utility-First:** Use Tailwind utility classes exclusively. Avoid custom CSS files and `@apply`.
* **Class Merging:** Always use `tailwind-merge` (via a `cn` utility) to handle class conflicts when consumers override styles.
* **Variants:** Use `class-variance-authority` (CVA) to define component variants (e.g., `size`, `variant`) and manage default styles.
* **Theming:** Rely on CSS variables defined in `globals.css` for colors, ensuring seamless dark mode support.

## Prop Naming & API
* **HTML Parity:** Extend native HTML attributes (e.g., `React.ComponentPropsWithoutRef<'button'>`). Use standard names like `disabled`, `className`, and `onClick`.
* **Custom Props:** Prefer `variant` and `size` over boolean flags. If booleans are necessary, use descriptive prefixes like `isLoading`.
* **Refs:** All interactive base components must use `React.forwardRef` to expose the underlying DOM node.

## Accessibility (a11y) Requirements
* **Semantic HTML:** Always use correct native elements (e.g., `<button>` for actions). Never use `<div onClick>`.
* **Keyboard Navigation:** Ensure full keyboard operability. Manage focus traps for modals and support `Escape` to close overlays.
* **ARIA:** Apply appropriate `aria-*` attributes and `role`s for custom widgets.
* **Focus States:** Never remove default outlines without replacing them. Use `focus-visible:ring-2 ring-offset-2` for clear focus indicators.

## When to Create vs. Reuse
* **Reuse First:** Always check existing base components (e.g., shadcn/ui, Radix UI primitives) before building from scratch. Extend them using the `className` prop.
* **Create New:** Only create a new base component if existing ones cannot be extended without breaking their core abstraction or violating single-responsibility.
* **Feature vs. Base:** If a component contains domain-specific business logic or API calls, it is a *Feature Component*. Keep `/components/ui` strictly for pure, reusable UI primitives.
