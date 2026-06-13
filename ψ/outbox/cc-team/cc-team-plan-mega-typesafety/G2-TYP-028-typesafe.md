<!-- cc-team deliverable
 group: G2 (typesafety division)
 member: TYP-028 role=typesafe model=moonshotai/Kimi-K2.6
 finish_reason: length | tokens: {"prompt_tokens":897,"completion_tokens":5000,"total_tokens":5897,"prompt_tokens_details":{"cached_tokens":63,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 54s
 generated: 2026-06-13T12:03:49.395Z -->
The user wants a type-safety audit of the provided TypeScript code. I need to find:
1. `as any` - none visible
2. unsafe casts - none visible
3. non-null assertions (!) - found: `notification.sessionId!` in the `notify` method
4. implicit any - need to check `err` in catch block, and possibly other variables
5. missing null/undefined guards - `notification.sessionId` is used with non-null assertion but the parameter type `Omit<Notification, 'id' | 'timestamp'>` still allows `sessionId` to be optional (`sessionId?: string`). So if someone calls `notify` without `sessionId`, it will be undefined, but the code assumes it exists to look up the listener. Also `getRecentNotifications` filters by `sessionId` but `sessionId` in Notification is optional, so `n.sessionId === sessionId` could be comparing `undefined === string` which is fine but maybe missing guard for undefined sessionId in history.
6. unsafe JSON.parse - none visible
7. untyped catch - `catch (err)` - `err` is implicitly `any` in older TS or `unknown` in strict newer TS depending on tsconfig. Since they asked for untyped catch, this qualifies.

Let me analyze each issue carefully:

1. **Non-null assertion**: Line `const callback = this.listeners.get(notification.sessionId!);`
   - Severity: high/medium
   - Location: `notify` method
   - Pattern: `notification.sessionId!`
   - Fix: Guard against undefined sessionId or change type to require sessionId.

2. **Untyped catch**: Line `catch (err)`
   - Severity: medium/low
   - Location: `broadcast` method
   - Pattern: `catch (err)` with implicit any/unknown
   - Fix: `catch (err: unknown)` and type-narrow before logging.

3. **Missing null/undefined guard**: In `notify`, the parameter is `Omit<Notification, 'id' | 'timestamp'>`. Since `Notification` has `sessionId?: string`, the omit still leaves it optional. Calling `this.listeners.get(notification.sessionId!)` will pass `undefined` to `.get()` if sessionId is missing, which is valid for Map.get but the intent is wrong. Also the callback check `if (callback)` handles missing callback, but the real issue is that `notify` should probably require `sessionId` since it's notifying a specific session. The type signature allows omitting it.
   - Actually, looking at the convenience methods like `notifyTaskComplete`, they pass `sessionId`. But a direct call to `notify({type: 'error', title: 'x'})` would be type-valid but crash or silently fail because `sessionId` is undefined and `notification.sessionId!` hides this.
   - Fix: Change parameter type to require `sessionId`: `Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }` or guard inside.

4. **Missing null/undefined guard in `getRecentNotifications`**: `n.sessionId === sessionId` where `n.sessionId` can be undefined. If `sessionId` parameter is passed as empty string or undefined? The parameter is `sessionId: string` so it's required. But history contains broadcast notifications where `sessionId` might be undefined. The filter will correctly exclude them (undefined === string is false). However, if the intent is to also get broadcast notifications, this is a bug. But based on the method name "for a session", excluding broadcasts is correct. Still, comparing optional to required without explicit handling could be noted, but it's not necessarily unsafe in TS terms. Actually, `Notification` interface has `sessionId?: string`, so `n.sessionId` can be undefined. The comparison is safe TS-wise. I'll skip this unless it's a clear issue.

5. **Implicit any**: The `err` in catch is the main one. Are there others? `crypto.randomUUID()` - assuming crypto is available. In Node.js, `crypto` might need import. Wait, the code doesn't show imports. If this is running in a modern Node environment with global crypto, it's fine. But if not imported, it might be an implicit any if there's a global declaration. However, the user is asking about type-safety specifically in the code shown. The `crypto` usage assumes a global or imported `crypto`. If not imported, TS might complain depending on lib settings. But I should probably not flag this unless it's clearly an implicit any. Actually, `crypto.randomUUID()` is valid in modern Node if `import * as crypto from 'crypto'` or global web crypto. The code snippet doesn't show the import, but I can't assume it's missing.

Let me focus on what is definitely in the code.

Issues to report:
- `notification.sessionId!` non-null assertion in `notify`
- `catch (err)` untyped / implicit any
- `notify` parameter type allows missing `sessionId` but logic assumes it exists (missing null/undefined guard / type safety issue). This is closely related to the non-null assertion but is about the type signature itself.

Wait, the user wants a table with columns: severity | location | unsafe pattern | safer fix

Let me formulate rows:

1. Severity: high, Location: `notify` method, line with `notification.sessionId!`, Pattern: non-null assertion on optional property, Fix: change parameter to `Omit<Notification, 'id' | 'timestamp' | 'sessionId'> & { sessionId: string }` or guard with `if (!notification.sessionId) throw ...`

2. Severity: medium, Location: `broadcast` method catch block, Pattern: untyped catch clause `catch (err)`, Fix: `catch (err: unknown) { ... }` and optionally `if (err instanceof Error) ...`

3. Severity: medium, Location: `notify` method signature, Pattern: missing null guard for optional `sessionId`, Fix: require `sessionId` in the input type or validate before use.

Actually, the non-null assertion and the missing guard are at the same location. I can combine them or list separately. The non-null assertion is the specific unsafe pattern. The missing guard is the underlying cause. I'll list the non-null assertion as the pattern and the fix as both typing and guarding.

Are there any other issues?
- `this.listeners.get(sessionId)` in `subscribe` returns `(n: Notification) => void | undefined`. The `unsubscribe` compares `=== callback`. This is fine.
- `broadcast` sets `broadcast: true` but the type `Omit<Notification, 'id' | 'timestamp' | 'sessionId'>` means `broadcast` can be passed in by caller? Actually, `Omit<...>` removes those keys, but `broadcast` is still optional in the remaining keys. The method then sets `broadcast: true`. If caller passes `broadcast: false`, it gets overwritten. That's fine, probably intended.
- `getRecentNotifications` sorts the entire filtered array. Since history is chronological, filtering then sorting is fine but inefficient. Not a type-safety issue.

Let me double-check: `Notification` interface has `data?: unknown;` - that's fine, unknown is safe.

So the main issues are:
1. Non-null assertion `!`
2. Untyped catch `err` (implicit any depending on TS version/config, but flagged as untyped catch)

Is there implicit any elsewhere? No variable declarations without types that infer any. The `notification` parameter is typed. `callback` is typed via inference from Map or parameters.

What about `crypto`? If it's the Node.js `crypto` module without import, in TypeScript with Node types it might be available as global if using `node:crypto`? Actually, `crypto` is not global in Node by default unless you import it. However, in some environments or with certain tsconfig/lib settings, it might be available. But since the code snippet doesn't show imports, I should probably not flag it as a type-safety issue in the audit because I don't have the full file context.

Wait, the user said "implicit any". The `err` in catch is the classic one. In TypeScript before 4.0, catch variables are implicitly `any`. In TS 4.0+ with `useUnknownInCatchVariables` (part of strict), they are `unknown`. But many codebases still have them as `any` by default or it's considered untyped. The prompt explicitly asks for "untyped catch". So I will include it.

Let me structure the table exactly as requested.

| severity | location | unsafe pattern | safer fix |

Rows:
- high | `notify` (line `this.listeners.get(notification.sessionId!)`) | non-null assertion (`!`) on optional `sessionId` | change parameter type to require `sessionId`: `Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }`
- medium | `broadcast` catch clause | untyped catch variable `err` | `catch (err: unknown) { if (err instanceof Error) console.error(...) }`
- medium | `notify` method body | missing null/undefined guard before Map lookup | add guard `if (!notification.sessionId) return;` or throw, and remove `!`

Actually, I can merge the non-null assertion and missing guard into one row since the fix covers both. But the user might want distinct patterns. I'll list them separately to be thorough, or combine. Let's do separate to show both patterns.

Wait, is there an issue with `notification.sessionId!` being a missing null guard? Yes. But the non-null assertion is the unsafe pattern. The missing guard is the root cause. I'll list:
- high | `notify` | non-null assertion `notification.sessionId!` | require `sessionId` in type or validate before use

And maybe:
- medium | `notify` signature | accepts optional `sessionId` for session-targeted notification | `notify(notification: Omit<Notification, 'id' | 'timestamp' | 'sessionId'> & { sessionId: string })`

But that's essentially the same fix. I'll avoid duplication and just list the non-null assertion row with a comprehensive fix.

Another potential issue: `getRecentNotifications` takes `sessionId: string`, but `Notification.sessionId` is optional. The filter `n.sessionId === sessionId` is safe, but what if `sessionId` passed is empty? Not really a type issue.

What about `this.listeners.get(sessionId)` in `subscribe`? It returns a function or undefined. The comparison `this.listeners.get(sessionId) === callback` is safe.

What about `broadcast` setting `broadcast: true` on a notification that might already have it? The type is `Omit<Notification, 'id' | 'timestamp' | 'sessionId'>`, which means the input cannot have `id`, `timestamp`, or `sessionId`, but CAN have `broadcast`. So if caller passes `{ type: 'error', title: 'x', broadcast: false }`, the method overwrites it with `true`. That's logic, not type safety.

Alright, I think 2 or 3 rows are sufficient. Let me make sure the table is clean with no filler.

Actually, looking closely at the prompt: "missing null/undefined guards" is a category. The `notify` method uses `notification.sessionId!` which is both a non-null assertion and a missing guard. I should flag it under the missing guard category too, or instead. But the `!` is the explicit unsafe pattern. I'll include it.

Also, `getRecentNotifications` filters history where `n.sessionId` might be undefined. Not a huge issue.

Another thing: `notificationService` is exported as a singleton. No type issues there.

Let me check if there are any implicit `any` in array methods: `.filter(n => ...)` - `n` is inferred as `Notification`. `.sort((a, b) => ...)` - inferred. Good.

So final table:

| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| high | `notify` line `this.listeners.get(notification.sessionId!)` | non-null assertion (`!`) on optional `sessionId` | narrow parameter type to require `sessionId`: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }` |
| medium | `broadcast` catch block | untyped catch variable `err` (implicit `any`) | `catch (err: unknown)` and narrow before accessing |
| medium | `notify` method entry | missing null guard for optional `sessionId` | validate `if (!notification.sessionId) return;` before lookup |

Wait, the prompt says "No filler." So I should be concise. Maybe I can combine the non-null assertion and missing guard into one, since the fix handles both. But the prompt lists them as separate categories to find. I'll provide exactly the distinct unsafe patterns found.

Actually, I can present it as:

| severity | location | unsafe pattern | safer fix |
| high | `notify` | non-null assertion `notification.sessionId!` | require `sessionId` in type: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }` |
| medium | `broadcast` catch | untyped catch variable `err` | `catch (err: unknown)` with `instanceof Error` guard |

Is there anything else? Let me re-read the code carefully.

```typescript
notify(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    const fullNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    this.addToHistory(fullNotification);
    const callback = this.listeners.get(notification.sessionId!);
    if (callback) {
      callback(fullNotification);
    }
  }
```

Yes, `notification.sessionId!` is the only `!`.

```typescript
for (const [, callback] of this.listeners) {
      try {
        callback(fullNotification);
      } catch (err) {
        console.error('Notification listener error:', err);
      }
    }
```

Yes, untyped catch.

Are there any other implicit any? No.

Unsafe JSON.parse? No.

Unsafe casts? No.

`as any`? No.

So two rows. But the user listed "missing null/undefined guards" as a category to find. If I only report the `!`, I'm covering it. But maybe I should explicitly mention the missing guard aspect. However, the `!` is the syntactic pattern. The missing guard is the semantic issue. I'll stick to the syntactic patterns found: `!` and untyped catch.

Wait, what about `notification.sessionId!` being used after `fullNotification` is created? `fullNotification` includes `sessionId` from the spread, which could be undefined. Then it's added to history. Then the lookup uses `!`. If `sessionId` is undefined, `fullNotification` goes into history with undefined sessionId, and the lookup uses `undefined` which Map.get handles (returns undefined). So the only runtime risk is that the notification is added to history without a sessionId but was intended for a session. The type system allows this. The fix is to make `sessionId` required in the parameter.

I think two rows is fine, but to be thorough and match the prompt's request for "missing null/undefined guards", I'll add a row or adjust the description.

Actually, looking at `getRecentNotifications`:
```typescript
getRecentNotifications(sessionId: string, limit = 50): Notification[] {
    return this.history
      .filter(n => n.sessionId === sessionId)
```
Here `n.sessionId` is optional. If `sessionId` is passed, and `n.sessionId` is undefined, it's false. That's fine. But what if `sessionId` is not found? It returns empty array. That's fine.

What about `this.listeners.get(sessionId)` in `subscribe`? It could return undefined, but it's only used in the unsubscribe closure, which compares with `=== callback`. That's safe.

I think I'll provide exactly two rows. But to satisfy the "missing null/undefined guards" prompt, I'll phrase the first row's pattern as "non-null assertion (`!`) instead of null guard".

Let me reconsider if there are any other issues. The `crypto` global: if this is Node and they didn't import `crypto`, it might error at runtime, but TypeScript with `@types/node` might have `crypto` in the global namespace if `lib` includes it? Actually, in Node 19+, `crypto` is available as global `crypto` like Web Crypto API. So it's fine.

One more: `notification` parameter in `notify` is `Omit<Notification, 'id' | 'timestamp'>`. This means `data?: unknown` is included. That's fine.

Alright, I'll output the markdown table. I'll make sure to escape pipes in the fix column if needed.

Actually, for the fix column, using `|` inside code backticks in markdown tables can be tricky. I'll use `\|` to escape them inside the cell, or avoid pipes in the code. I'll write `& { sessionId: string }` without pipe.

Final check on severity:
- Non-null assertion on optional property that is used for a Map key lookup: High. Because it masks a potential bug where a session-specific notification is sent without a sessionId.
- Untyped catch: Medium/Low. I'll say medium because it can lead to unsafe property access if someone refactors the catch block.

Let's go with that.

Wait, the user might want me to find "implicit any". Is the `err` considered implicit any or untyped catch? Both. I'll label it as untyped catch.

What about `notification: Omit<Notification, 'id' | 'timestamp'>` - does this have implicit any? No.

Okay, I'm ready.

One last thought: The prompt says "Output table | severity | location | unsafe pattern | safer fix |. No filler." This means I should output ONLY the table, no introductory text, no concluding text. Just the table.

Let me format it cleanly.

| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| high | `notify` line `this.listeners.get(...)` | non-null assertion `notification.sessionId!` on optional property | change parameter to require `sessionId`: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }` |
| medium | `broadcast` catch block | untyped catch variable `err` | `catch (err: unknown)` and narrow (e.g. `err instanceof Error`) before use |

Wait, using `\|` inside backticks in a markdown table might still break rendering depending on the parser. To be safe, I can avoid the pipe character in the fix by writing it differently, or just not use backticks for the pipe. Actually, standard markdown tables use `|` as column delimiter. Backticks don't escape them. So `Omit<Notification, 'id' \| 'timestamp'>` might still be parsed as columns if the renderer is strict. Better to avoid the pipe character entirely or use HTML entity `&#124;` or just write "and" instead of `|`. Or I can write the fix without code backticks for the pipe part.

I'll write: `Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }` -> but the `|` will break the table. So I'll phrase it as: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }` — escaping the pipe with backslash usually works in markdown table cells if the cell isn't parsed as code. Actually, in GFM, backslash before pipe in a table cell escapes it. But inside backticks, it's literal. However, some parsers see the backtick-enclosed `|` as a cell delimiter anyway if the backticks don't span the whole cell? No, if the whole content is in backticks, it's a single code span. But the cell contains text + code span. Let's keep it simple: `require sessionId in the notify parameter type` without code snippet, or use `& { sessionId: string }` and mention "Omit... plus required sessionId".

Actually, I can just write the fix as plain text: `change notify param to require sessionId: Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }` and hope the markdown renderer handles the pipe inside the cell. Many do if it's not at the start/end or if there are spaces. But to be absolutely safe, I'll use `<code>` HTML tags for the code parts so I can avoid pipe issues, or just avoid pipes in code.

Simpler: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }` — I'll use backslash escape outside backticks? No, the whole thing is meant to be code. I'll just write: `Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }` and rely on the fact that standard markdown parsers handle pipes inside table cells if they are not the outermost delimiter. Actually, no, they don't. A pipe inside a table cell usually starts a new column unless escaped.

So I'll escape it: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }`. In markdown, `\|` inside a table cell renders as `|`. But inside backticks, the backslash is literal. So I should not put it inside backticks.

I'll write the cell as: change parameter type to require `sessionId` (e.g. `Omit<...> & { sessionId: string }`) and omit the pipe in the example, or use a comma: `Omit<Notification, 'id', 'timestamp'>` — no, that's invalid TS.

Better: `Omit<Notification, 'id' \| 'timestamp'> & { sessionId: string }` without backticks around the whole thing, but with backticks around smaller parts? No, the pipe is the problem.

I'll use: `Omit<Notification, 'id' &#124; 'timestamp'> & { sessionId: string }` using HTML entity. That renders correctly.

Or even simpler: `Omit<Notification, 'id' | 'timestamp'> & { sessionId: string }` — I'll just write it and if the table breaks, so be it. But I can avoid the issue by not using a code block that contains the pipe. I'll write: `narrow parameter type to require sessionId` as text.

Let's do this:

| severity | location | unsafe pattern | safer fix |
|---|---|---|---|
| high | `notify` method | non-null assertion `notification.sessionId!` | require `sessionId` in parameter type and remove `!` |
| medium | `broadcast` catch | untyped catch variable `err` | `catch (err: unknown)` with `instanceof Error` guard |

This is concise, no filler, no pipe issues.

But wait, the prompt says "safer fix" should ideally show the fix. "require `sessionId` in parameter type and remove `!`" is clear enough.

I'll add one more row for the missing guard aspect? The non-null assertion row covers it. But to be explicit about the missing null/undefined guard category requested:

| high | `notify` method | non-null assertion (`!`) instead of null guard | validate `notification.sessionId` or require it in the input type |

And:

| medium | `broadcast` catch block | untyped / implicit-any catch variable `err` | `catch (err: unknown)` and narrow before accessing |

I think that's sufficient
