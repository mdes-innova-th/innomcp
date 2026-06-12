<!-- cc-team deliverable
 group: VQA (Visual QA + frontend completion tasks)
 member: VQA-6 role=test model=deepseek/deepseek-v4-flash
 finish_reason: stop | tokens: {"prompt_tokens":154,"completion_tokens":1718,"total_tokens":1872,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":78,"image_tokens":0},"cache_creation_input_tokens":0} | 25s
 generated: 2026-06-12T04:20:58.630Z -->
# Visual Regression Checklist — innomcp-next Manus.im-style UI

## 1. Header Checks

| # | Check | What to Look For | How to Test | Pass Criteria |
|---|-------|------------------|-------------|---------------|
| 1.1 | MDES brand label visible | The text "MDES" (or the defined brand name) appears in the header. | Open the app at any viewport width ≥ 769px. Look at the top-left corner of the header. | The brand string is rendered, readable, and matches the design spec (e.g., colour, font weight). |
| 1.2 | Header is sticky | The header remains fixed at the top when scrolling the page content. | Scroll the main content area (e.g., the chat or workspace) until content scrolls under the header. | The header does not move with the scroll; it stays pinned to the viewport top. |
| 1.3 | Header text and styles correct | All header elements (brand, nav items, icons) use the correct font, size, colour, and spacing per the design. | Compare rendered header against the Manus.im-style design mockup. Inspect CSS for font-family, font-size, colour hex, and margins. | All text properties match the spec (e.g., brand weight 700, nav items weight 500, colour `#1a1a1a` or dark theme equivalent). |
| 1.4 | No unexpected text or artefacts | Header does not show placeholder, debug, or incorrect text. | Check the header after full page load. | Only intended content appears; no empty brackets, "undefined", or stray characters. |

---

## 2. Three-Column Layout

| # | Check | What to Look For | How to Test | Pass Criteria |
|---|-------|------------------|-------------|---------------|
| 2.1 | Left sidebar width 250–300px | The left sidebar has a fixed or min-width between 250px and 300px. | Open browser DevTools, inspect the sidebar element. Check its computed width. | Width is in range [250, 300] pixels. No smaller or larger unless responsive breakpoints override. |
| 2.2 | Center column uses flex-1 | The center column (chat area) fills remaining horizontal space after left and right panels. | Resize browser horizontally; observe that the centre column expands/contracts. Inspect `flex-grow: 1` or equivalent. | The centre column is flexible and does not have a fixed width. Its width changes when side panels are resized. |
| 2.3 | Right panel width 320–400px | The right panel (workspace) has a fixed or min-width between 320px and 400px. | Inspect the right panel in DevTools. | Computed width is between 320px and 400px (or uses `max-width`/`min-width` in that range). |
| 2.4 | All three columns visible at ≥ 1024px | The layout shows three distinct columns (sidebar, chat, workspace) at desktop sizes. | Set viewport to 1280px. Observe the three columns. | Each column renders content; no column is collapsed or missing. |

---

## 3. Chat Area

| # | Check | What to Look For | How to Test | Pass Criteria |
|---|-------|------------------|-------------|---------------|
| 3.1 | Input field visible | A text input for composing messages is present. | Look at the bottom of the centre column. | An `<input>` or `<textarea>` is rendered, with a placeholder like "Type a message…" (or similar). |
| 3.2 | Send button visible | A button (icon or text) to send the message is shown. | Check next to the input field. | A clickable button (e.g., arrow or "Send" label) is rendered and is not disabled unless logic requires it. |
| 3.3 | Messages area is scrollable | The history of messages can be scrolled up to see older messages. | Add enough messages to exceed the visible height. Try to scroll the message list. | The message container has `overflow-y: auto` (or `scroll`) and can be scrolled with mouse wheel or trackpad. |
| 3.4 | No broken avatars or text overflow | Each message bubble shows user avatar and text without overflow or clipping. | Send a long message, also check short messages. | Message text wraps correctly inside the bubble; avatar is not cut off; no horizontal scrollbar appears in the message area. |

---

## 4. Workspace Panel

| # | Check | What to Look For | How to Test | Pass Criteria |
|---|-------|------------------|-------------|---------------|
| 4.1 | ManusWorkspacePanel component renders | The right panel contains the `ManusWorkspacePanel` instead of a blank or default placeholder. | Inspect the right panel in React DevTools (or see the DOM for a specific class/id). | A component with name `ManusWorkspacePanel` exists in the component hierarchy. |
| 4.2 | Not blank / empty | The workspace panel shows meaningful content (e.g., tools, file list, or instructions). | Look at the right panel; it should not be a solid colour with nothing. | At least one element (text, list, button) is rendered inside the panel. |
| 4.3 | Correct initial state | The workspace shows the expected initial content (e.g., "Welcome" or empty state). | Compare against design spec for the initial state. | The initial content matches the design (e.g., a placeholder with an icon and text "Select a tool"). |
| 4.4 | No console errors | No React errors or warnings related to the workspace panel appear. | Open browser console while interacting with the panel. | Console is clear of errors/warnings from the workspace component. |

---

## 5. Responsive Behaviour

| # | Check | What to Look For | How to Test | Pass Criteria |
|---|-------|------------------|-------------|---------------|
| 5.1 | 768px: sidebar hidden | At viewport ≤ 768px, the left sidebar is not visible (collapsed/overlay). | Use DevTools to set viewport to 768px width. | The left sidebar element has `display: none` or is positioned off-screen (e.g., `transform: translateX(-100%)`) with no visible overflow. |
| 5.2 | 768px: main content occupies full width | The centre column and right panel stretch to fill the screen. | At 768px, observe the layout. | Centre column and right panel are both visible (if they fit) and take up the available width; no empty space on left. |
| 5.3 | 375px: single column | At viewport ≤ 375px, only one column is visible (likely the chat area). | Set viewport to 375px. | The left sidebar is hidden, the right workspace panel is hidden (or collapsed to overlay), leaving only the centre chat area full-width. |
| 5.4 | 375px: no horizontal overflow | No content forces a horizontal scrollbar. | Scroll horizontally. | No horizontal scrollbar appears; all content fits within the viewport width. |
| 5.5 | Breakpoint transitions are smooth | The layout changes at the expected breakpoints without lag or visual glitch. | Slowly resize the browser from 1200px down to 320px. | Layout shifts are instant and do not leave janky partial states. |

---

*Document version: 1.0*  
*Last updated: 2025-04-10*
