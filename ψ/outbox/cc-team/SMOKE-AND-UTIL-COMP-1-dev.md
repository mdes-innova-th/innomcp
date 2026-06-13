<!-- cc-team deliverable
 group: SMOKE-AND-UTIL (Smoke tests, utilities, components, CI — 44 additional tasks)
 member: COMP-1 role=dev model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":64,"completion_tokens":3000,"total_tokens":3064,"prompt_tokens_details":{"cached_tokens":14,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 26s
 generated: 2026-06-13T05:28:33.916Z -->
The user wants a React component file for a controlled checkbox. Let me analyze the requirements:

1. File path context: `innomcp-next/src/app/components/common/Checkbox.tsx` (just for context, not needed in output)
2. Type: Controlled checkbox
3. Props:
   - `checked: boolean`
   - `onChange: (v: boolean) => void`
   - `label?: string`
   - `disabled?: boolean`
4. Styling: Tailwind CSS
5. Export: Default export
6. Output format: ONLY the .tsx content, no markdown fences (no ```tsx or ```)

I need to write a clean, accessible checkbox component using Tailwind CSS.

Key considerations:
- Use a native `<input type="checkbox">` for accessibility, but style it with Tailwind
- Or use a div-based approach with proper aria roles. Actually, native input is better for accessibility and form integration.
- Common pattern: hide the native checkbox visually but keep it accessible, style a custom "check" element.
- Or use native checkbox with Tailwind styling directly (appearance-none).

Let me design it:
- Container label (if label exists) or just the checkbox wrapper
- Hidden/appearance-none native input for functionality
- Custom styled div/span for the visual checkbox
- Support disabled state with opacity/cursor-not-allowed
- Handle onChange event to call props.onChange with the new checked value

Structure:
```tsx
import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Checkbox({ checked, onChange, label, disabled }: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <div className="relative flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className="peer h-4 w-4 appearance-none rounded border border-gray-300 checked:border-blue-600 checked:bg-blue-600 disabled:cursor-not-allowed"
        />
        {/* Checkmark icon */}
        <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100" ...>
          <path d="M1 5l3 3L9 1" />
        </svg>
      </div>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  );
}
```

Wait, the checkmark SVG needs proper sizing. Let me think about the exact Tailwind classes.

Actually, a simpler robust approach:
- Use `peer` on the input
- Use a sibling div or svg that shows when checked
- Or use `accent-color` but that's less customizable.

Better approach with Tailwind:
- `appearance-none` to remove default styling
- `border`, `rounded` (maybe `rounded-sm` or `rounded`)
- `checked:bg-blue-600`, `checked:border-transparent`
- For the checkmark, an SVG absolutely positioned over the checkbox, using `peer-checked:opacity-100` and `opacity-0` by default.

Sizing: `h-4 w-4` or `h-5 w-5`. Let's use `h-4 w-4` with `rounded`.

Wait, if using `appearance-none`, the input itself can be styled directly. But drawing a checkmark inside requires an SVG overlay or using `background-image` with Tailwind arbitrary values. SVG overlay is cleaner.

Let me refine:

```tsx
<label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
  <div className="relative flex h-4 w-4 items-center justify-center">
    <input
      type="checkbox"
      className="peer h-4 w-4 appearance-none rounded border border-gray-300 transition-colors checked:border-blue-600 checked:bg-blue-600 disabled:cursor-not-allowed"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
    <svg
      className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
    >
      <path
        d="M1.5 5.5L3.5 7.5L8.5 2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
  {label && <span className="text-sm text-gray-900 select-none">{label}</span>}
</label>
```

Wait, the SVG dimensions might not align perfectly with h-4 w-4 (16px). If checkbox is 16x16, an SVG of 10x10 centered should work. Or use `w-3 h-3` classes on the svg.

Actually, using `w-3 h-3` (12px) on SVG and absolute centering with `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2` is safer.

Also, need to consider that the label should not have `cursor-pointer` when disabled. The input itself gets `disabled:cursor-not-allowed`.

One more thing: the `onChange` prop expects `(v: boolean) => void`. So `onChange={(e) => onChange(e.target.checked)}` is correct.

Should I use `React.FC` or just a function? The user didn't specify, but modern React prefers plain functions. I'll use a plain function with typed props.

Let's make sure the Tailwind classes are standard and don't require custom config:
- `inline-flex`
- `items-center`
- `gap-2`
- `cursor-pointer` / `cursor-not-allowed`
- `opacity-60` (for disabled)
- `relative`
- `flex`
- `h-4 w-4`
- `appearance-none`
- `rounded` (or `rounded-sm`)
- `border`
- `border-gray-300`
- `transition-colors`
- `checked:border-blue-600`
- `checked:bg-blue-600`
- `disabled:cursor-not-allowed`
- `pointer-events-none`
- `absolute`
- `text-white`
- `opacity-0`
- `peer-checked:opacity-100`
- `text-sm`
- `text-gray-900` (or `text-gray-700`)
- `select-none`

I should also consider focus styles for accessibility:
- `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` or `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`

Actually, since it's a hidden/natively styled checkbox with appearance-none, adding `focus:ring-2 focus:ring-blue-500 focus:ring-offset-1` is good.

Wait, `appearance-none` inputs can have focus rings. Let me add:
`focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`

But `focus:ring-offset-1` might not exist by default in Tailwind (it has 0, 1, 2, 4... actually yes, `ring-offset-1` exists? Let me recall: Tailwind has `ring-offset-0`, `ring-offset-1`, `ring-offset-2`, `ring-offset-4`, `ring-offset-8`. Yes, `ring-offset-1` exists. But to be safe, maybe just `focus:ring-2 focus:ring-blue-500`.

Actually, `focus-visible` is better for mouse users. But standard `focus:ring` is fine.

Let me also consider if the component should be wrapped in a `forwardRef`. The user didn't ask for it, but it's often useful for form libraries. However, the prompt is specific about the props: `{checked:boolean, onChange:(v:boolean)=>void, label?:string, disabled?:boolean}`. No mention of ref. I'll keep it simple without forwardRef.

One detail: if `label` is provided, clicking the label should toggle the checkbox. That's why wrapping in `<label>` is correct.

Let me write the final code:

```tsx
import React from "react";

interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: CheckboxProps) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <div className="relative flex h-4 w-4 items-center justify-center">
        <input
          type="checkbox"
          className="peer h-4 w-4 appearance-none rounded border border-gray-300 transition-colors checked:border-blue-600 checked:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M2 7L5.5 10.5L12 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {label && (
        <span className="select-none text-sm text-gray-900">{label}</span>
      )}
    </label>
  );
}
```

Wait, I should check if `h-3 w-3` with viewBox 0 0 14 14 works. The path coordinates are for 14x14. If I set h-3 w-3 (12x12), the viewBox scales down. That should be fine. Alternatively, use viewBox 0 0 12 12 and path "M2 6L5 9L10 3". But the current one is okay.

Actually, `h-3 w-3` is 0.75rem = 12px. The checkbox is `h-4 w-4` = 1rem = 16px. A 12px icon centered in 16px box looks good.

One issue: `focus:ring-offset-1` - does this exist? In Tailwind CSS v3, the default ringOffset scale is 0, 1, 2, 4, 8. Yes, it exists. But to be absolutely safe and avoid any custom config assumptions, I could omit `focus:ring-offset-1` or use `focus:ring-offset-2`. Actually, `ring-offset-1` is indeed in the default scale. Let me keep it or remove it. I'll keep `focus:ring-offset-2` which is definitely standard. But `focus:ring-offset-1` is also standard. I'll use `focus:ring-offset-2` to be safer? No, `1` is fine.

Wait, I should also make sure the label text color changes when disabled? The prompt doesn't specify, but `opacity-60` on the label container handles that for the whole row.

Actually, putting `opacity-60` on the label makes the checkmark also 60% opacity when disabled, which might look odd if the checkbox is unchecked (white checkmark on transparent background). But when disabled and checked, the blue background is at 60% opacity too. That's acceptable.

Alternatively, apply disabled styles only to the input and text separately. But the prompt is simple, so keeping it simple is better.

Let me reconsider the `disabled` styling. If disabled, the cursor should be not-allowed. The input has `disabled:cursor-not-allowed`. The label has `cursor-pointer` or `cursor-not-allowed`. But if the label has `cursor-not-allowed`, clicking it still toggles the checkbox unless `pointer-events-none` is used. However, since the input is disabled, clicking the label won't toggle a disabled checkbox natively. So that's fine.

Actually, in HTML, clicking a label associated with a disabled checkbox does NOT toggle it. But here the input is nested inside the label, so it should be fine.

Wait, I didn't use `htmlFor` because the input is nested inside the label. That's valid HTML and no id is needed.

Let me double check the SVG path for a checkmark at viewBox 0 0 14 14:
"M2 7L5.5 10.5L12 3.5" - this looks good. strokeWidth="2" is fine.

I think this is solid. I'll output exactly the TSX code with no markdown fences.

One final check: The user said "Output ONLY .tsx, no fences." This means I should not wrap the code in ```tsx ... ```. Just raw text.

Also, the user mentioned the path `innomcp-next/src/app/components/common/Checkbox.tsx`. I don't need to output the path, just the file content.

Let me make sure there are no extra blank lines at the end or beginning, though one newline at end is standard.

I'll write it cleanly
