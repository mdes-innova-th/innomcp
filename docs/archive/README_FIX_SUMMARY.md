
# God-Tier Fixes Applied

## 1. System Prompt Optimization (in `mcpclient.ts`)
- **Allowed JSON Syntax**: Relaxed the "Thai-only" rule to explicitly allow necessary JSON characters (`{`, `}`, `"`, `:`, `a-z` keys).
- **Removed "JSON" Ban**: Removed "JSON" and "API" from the forbidden list.
- **Explicit Thai Enforcement**: Kept the core rule to *answer* in Thai markdown, but interact structurally in valid JSON.

## 2. Robust JSON Parsing
- **Integrated `jsonrepair`**: Modified `extractJsonFromText` to usage the `jsonrepair` library. This automatically fixes common model errors (missing quotes, unclosed braces, trailing commas).

## 3. HTML/JSON Conflict Resolved
- **Fixed `generateHtmlResponse`**: Now uses a **fresh System Role** that explicitly overrides the default JSON-only prompt. It instructs the model to output pure HTML/Tailwind.

## 4. Consolidated Logic & Location Mapping
- **Centralized Location Map**: The map (Province/Lat/Lon/Region) is now in `executeTools` as a single source of truth.
- **Fixed "แม่กลอง"**: Added mapping "แม่กลอง" -> "สมุทรสงคราม".
- **Enhanced NWP Tools**: Forced `extractThaiLocationHints` to run for **ALL** NWP place tools (`daily` & `hourly`).

## 5. Verification
- `innomcp-node` compiled successfully (`tsc --noEmit` passed).
- `jsonrepair` is installed and verified.

## Next Steps
1. **Restart your backend server** (`innomcp-node`) to load the changes.
2. Try the query: **"แม่กลอง กับ หนองบัวลำพูน ฝนตกไหมในสัปดาห์ข้างหน้า"**.
   - It should validly identify "สมุทรสงคราม" and "หนองบัวลำภู" and use `nwp_daily_by_place`.
