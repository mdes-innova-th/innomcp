<!-- cc-team deliverable
 group: G4 (Doc generation)
 member: D080 role=doc model=MiniMaxAI/MiniMax-M3
 finish_reason: stop | tokens: {"prompt_tokens":2056,"completion_tokens":511,"total_tokens":2567,"prompt_tokens_details":{"cached_tokens":114,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":0,"image_tokens":0},"cache_creation_input_tokens":0} | 15s
 generated: 2026-06-13T11:31:16.323Z -->
- **`default export` (Express Router)**
  - Express router exposing user-profile endpoints mounted at `/api/user`. Expects upstream auth middleware to populate `req.user.userId`; returns 401 otherwise. All handlers respond with a `{ success: boolean, ... }` envelope and translate thrown errors to 500 responses.

- **`GET /profile`**
  - Returns the authenticated user's profile row from the `user` table, aliased to camelCase fields (`userId`, `email`, `displayName`, `nickname`, `phone`, `profileImage`, `roleId`, `createdAt`).
  - @returns 200 `{ success: true, data: <row> }`; 404 if no user found.

- **`PUT /update-profile`**
  - Updates `displayName`, `nickname`, `phone`, and/or `profileImage` for the current user via a single dynamic `UPDATE`, and writes a `user_activity_log` row (`action_type='profile_update'`, status `success`).
  - Accepts `multipart/form-data` with field name **`profileImage`** (single file); image uploads use a 5 MB limit and are restricted to `jpeg|jpg|png|gif` by extension and MIME type, stored as `uploads/profiles/profile-<timestamp>-<rand>.<ext>`.
  - When a new image is uploaded, the previously stored image file (if any) is unlinked from disk before the DB update. Replaces 400 with "No fields to update" when the request body and file yield no changes.
  - **Caveat:** `updated_at = NOW()` is pushed into the parameter list *after* `userId` in code, but the `WHERE` clause expects `?` bound to `userId` last — the current binding order is correct only because `updateValues.push(userId)` is the final value, matching the trailing `?`; this ordering is fragile.

- **`DELETE /delete-account`**
  - Soft-deletes the authenticated user's account by setting `user_active = '0'` and stamping `updated_at = NOW()`, and logs the action to `user_activity_log`.
  - Requires `password` in the request body (400 otherwise) and a matching authenticated user (401/404 otherwise).
  - **Caveat:** Password verification is not actually implemented — the `comparePassword` call is commented out as a TODO, so any non-empty password currently passes the check.
