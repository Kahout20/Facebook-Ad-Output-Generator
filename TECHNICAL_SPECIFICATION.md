# Technical Specification — AI Facebook Ad Copy Generator

## 1. Overview

A Next.js 14 (App Router) MVP that lets a user upload a product image and marketing preferences, and returns AI-generated, structured Facebook ad copy. Single-user, no accounts, no database — the current session's state lives in React state, and generation history persists locally via `localStorage`.

## 2. Frontend architecture

`app/page.tsx` is the single client component orchestrating the flow. It owns:
- the uploaded `File` and its object-URL preview
- the `MarketingSettings` form state
- generation state machine (`idle` → `loading` → `success` | `error`)
- which past generation (if any) is currently being viewed in the history modal

It composes five presentational components (`ImageUpload`, `MarketingSettingsForm`, `AdResults`, `RecentGenerations`, `HistoryEntryModal`), each responsible for one piece of UI and taking plain props/callbacks. `SiteNav` (site-wide top bar) is rendered from `app/layout.tsx`, not `page.tsx`, since it's chrome shared across the whole app rather than part of the generator flow. No presentational component talks to the network or to `localStorage` directly except `useGenerationHistory` (a small hook, see §9) and `page.tsx` itself (the `fetch` call).

Why a single page component instead of a multi-step wizard/router: the flow is linear and short (upload → settings → generate → result), and the brief explicitly asked to avoid over-engineering. Conditional rendering based on state is simpler and easier to review than routed steps for this size of app.

## 3. Backend / API route

`app/api/generate/route.ts` is the only server-side entry point. It:
1. Parses and validates the request body (image present, accepted mime type, size under 8MB, settings shape valid, custom audience non-empty if selected)
2. Calls `generateAdCopy()` from `lib/gemini.ts`
3. Maps any thrown error to a specific HTTP status and a generic, user-safe message
4. Logs the real error server-side via `console.error` for debugging, but never returns stack traces, provider error text, or configuration details to the client

`runtime = "nodejs"` is set explicitly since the Gemini SDK needs the Node runtime, not the Edge runtime.

## 4. Gemini integration

`lib/gemini.ts` wraps `@google/genai` (Google's current unified SDK — the project originally used the older `@google/generative-ai` package, which reached end-of-life in November 2025 and is incompatible with Google's newer `AQ.`-prefixed "Auth key" API key format; it was migrated early on):
- `getClient()` reads `GEMINI_API_KEY` from `process.env` (server-only) and throws a typed `GeminiConfigError` if missing
- `generateAdCopy()` sends the prompt text plus the image as `inlineData` (base64 + mime type) to `gemini-3.6-flash`, a current multimodal model capable of reading the product photo
- The raw text response is parsed by `parseAdCopyResponse()`, which:
  - Strips markdown code fences if the model adds them despite instructions
  - Extracts the first `{...}` block as a fallback
  - Validates `primaryText`, `headline`, `description`, and `cta` are present and non-empty (throws `GeminiParseError` otherwise)
  - Falls back `productName` to `"Uploaded Product"` if Gemini omits it, rather than failing the whole generation over a non-essential field
- After parsing, `generateAdCopy()` **overwrites** the returned `cta` with `settings.cta` unconditionally, and overwrites `productName` with the user-supplied value if one was given. This is a deliberate design choice: the prompt instructs Gemini to echo back the exact selected CTA and prioritize a user-supplied product name, but the code never *trusts* that instruction was followed — it enforces both outcomes structurally after the fact, so it's not possible for the AI to override either value even by mistake.

Three typed error classes (`GeminiConfigError`, `GeminiRequestError`, `GeminiParseError`) let the API route return the right HTTP status and message without string-matching error text.

## 5. Prompt design

`lib/prompt.ts` builds one instruction prompt per request from the current `MarketingSettings`, aimed at producing copy that reads like it came from an experienced human performance copywriter rather than generic AI-generated marketing text. Key elements, in the order they appear in the prompt:

- **Product understanding**: asks Gemini to analyze the image for what the product is, what problem it solves, its practical benefits, likely audience, and distinctive features — using only what's visible or explicitly supplied, never invented.
- **Context block**: product name (user-supplied takes priority; otherwise inferred, never a fabricated brand/model), key selling point (built into the copy, not just mentioned once), target audience (hard constraint if custom), tone, output language (hard constraint), and the selected CTA (hard constraint, stated explicitly: "use exactly this CTA... do not substitute").
- **Priority framework**: customer problem → product benefit → differentiation via the selling point → emotional appeal matched to tone/audience → clear value proposition → natural lead into the CTA.
- **"Do not invent" list**: specs, materials, certifications, discounts, prices, guarantees, statistics, medical claims, performance percentages, "number one" claims, unsupported comparisons.
- **Anti-cliché rules**: explicitly bans generic filler phrases ("Elevate your lifestyle," "Experience the luxury of...," "Designed for modern lifestyles," etc.) and overused AI-copywriter words ("effortless," "seamlessly," "approachable," "luxury"), with a bad/better example pair to anchor the tone. This also required rewording the app's own internal tone guidance — the `friendly` tone description previously used the word "approachable" to describe the desired tone to Gemini, which risked the model echoing that exact banned word back into the generated copy; it was reworded to avoid modeling the cliché it's trying to prevent.
- **Length guidance**: Primary Text is guided toward roughly 40–80 words as a soft preference, not a requirement — the prompt explicitly says not to pad the copy to hit a word count, and that every sentence must earn its place (a real benefit, insight, or reason to act) rather than adding a generic closing sentence just for length.
- **Internal quality checklist**: before returning its answer, the prompt asks Gemini to check that the product, problem, and benefit are clear; the audience/tone/language/CTA are respected; the selling point is actually used; no sentence is padding or a restatement; and no banned clichés or unsupported claims remain.
- **Output contract**: a single JSON object with `productName`, `primaryText`, `headline`, `description`, `cta` — no markdown fences, no commentary.

Keeping this in one pure function (settings in, string out) makes the prompt easy to review, version, and adjust without touching the API route or the Gemini client code.

## 6. Image handling

- Client-side: `lib/utils.ts`'s `fileToBase64()` reads the `File` via `FileReader` and strips the `data:...;base64,` prefix before sending JSON to the API route (avoids multipart/form-data complexity for an MVP).
- Server-side: the base64 string and mime type are passed straight through to Gemini as `inlineData` — no server-side image processing/resizing in this MVP (see §12).
- Size is checked twice: client-side against the real `File.size`, and server-side by estimating decoded byte length from the base64 string length (`(len * 3) / 4`), so a request can't bypass the client check.

## 7. Validation

- **Client**: file type/size checked in `ImageUpload` before accepting a file; "Generate" is disabled unless an image is present and, if "Custom" audience is selected, the description isn't empty.
- **Server**: the API route re-validates everything independently (never trusts the client) — file presence, mime type against `ACCEPTED_IMAGE_TYPES`, size, settings shape via `isValidSettings()`, and the custom-audience-non-empty rule.

## 8. Error handling

Every failure mode maps to a specific, human-readable message shown inline near the action that failed, never a raw exception or stack trace:
- No image / unsupported type / file too large → caught client-side in `ImageUpload`, or server-side as a 400 with a plain message
- Gemini not configured → 500, generic "not configured yet" message (details logged server-side only)
- Gemini request failure (network/provider) → 502, "AI service is unavailable right now"
- Invalid/unparseable Gemini response → 502, "AI response could not be understood — try Regenerate"
- Network failure from the browser's `fetch` → caught in `page.tsx`, generic network error message

## 9. Recent Generations (history)

`lib/history.ts` is a plain utility module (no React) that reads/writes a JSON array under a single `localStorage` key (`fbAdGenerator.generationHistory`):
- `getGenerationHistory()` — safe to call on the server (returns `[]`) or with malformed/missing data (returns `[]` rather than throwing)
- `saveGeneration(result)` — builds a `GenerationHistoryEntry` (id, productName, headline, primaryText, description, cta, timestamp), prepends it, and trims to the 10 most recent (`HISTORY_LIMIT`)
- `clearGenerationHistory()` — removes the key entirely
- `formatRelativeTime()` — "Just now" / "N min ago" / "N hour(s) ago" / "N day(s) ago"

`lib/useGenerationHistory.ts` is a thin React hook wrapping that module: it starts with an empty array on both the server and the first client render, then loads the real `localStorage` contents inside a `useEffect` — this two-phase approach (rather than reading `localStorage` synchronously during render) is what avoids Next.js hydration mismatches, since server-rendered HTML can never know what's in the browser's storage.

**Deliberately not stored**: the original product image. Only the generated text fields are kept, which keeps entries small and avoids storing potentially large base64 image data in `localStorage` (which has a small per-origin size limit, typically ~5–10MB depending on browser). `HistoryEntryModal` shows a past entry's text fields only, with a note explaining the image isn't available.

Both a fresh "Generate" and a "Regenerate" call `saveGeneration()` on success, so regenerated variations appear as separate history entries rather than overwriting the original — this is a deliberate choice so the user can compare variations, not an oversight.

**For the assessment MVP, generation history is stored locally in the browser to provide useful persistence without introducing unnecessary infrastructure. A production implementation would associate history with authenticated users and store it server-side.** This is intentionally not secure or durable — clearing browser storage, using a different browser, or switching devices all produce an empty history. A production version would move this to a database keyed to an authenticated user.

## 10. "Generate another ad" vs. "Regenerate"

These two actions are deliberately different and map to different state resets in `app/page.tsx`:

- **Regenerate** (`handleRegenerate`) calls the same generation logic as the initial "Generate" click, reusing the current `file` and current `settings` completely unchanged — it produces a new AI variation of the same product with the same inputs.
- **Generate another ad** (`handleGenerateAnother`) is meant to start a fresh product. It clears the uploaded image (via the same `handleClearImage` used by the image upload's "Remove" button) and also resets the product-specific settings fields — `productName`, `customAudience` text, and `keySellingPoint` — via a single `setSettings` update. It deliberately does **not** touch `tone`, `language`, `cta`, or `targetAudienceMode` (auto/custom), so the user's general marketing preferences carry over to the next product without needing to re-select them. This distinction (product-specific vs. general-preference settings) is the basis for what gets cleared and what doesn't.

## 11. Security considerations

- `GEMINI_API_KEY` is read only in server-side code (`lib/gemini.ts`, executed inside the `app/api/generate` route handler) and is never referenced with a `NEXT_PUBLIC_` prefix, so Next.js never inlines it into client bundles.
- `.env.local` is gitignored.
- API error responses are deliberately generic — no stack traces, provider error bodies, or internal config state ever reach the client; real errors go to `console.error` server-side.
- Input is validated server-side independent of client checks (file type/size, settings shape) since the client can't be trusted.

## 12. Deployment

Standard Vercel deployment: push to GitHub, import into Vercel, set `GEMINI_API_KEY` in Project Settings → Environment Variables, deploy. No build-step configuration beyond the defaults `next build` provides — no database, no separate backend service.

## 13. Function reference

Every non-trivial function in the codebase, grouped by file, in the order it appears. UI components (`ImageUpload`, `MarketingSettingsForm`, `AdResults`, `RecentGenerations`, `HistoryEntryModal`, `SiteNav`) are covered at the component level in §2 rather than prop-by-prop here, since their logic is mostly presentational; this section focuses on the functions that hold actual business logic.

### `lib/prompt.ts`

- **`buildAdCopyPrompt(settings)`** — the only exported function in the file. Takes the user's `MarketingSettings` and returns the full instruction string sent to Gemini. It's a pure function (settings in, string out) so the prompt can be reviewed, tested, or tuned without touching the network call or the API route. Internally it builds four small conditional instruction fragments (audience, product name, selling point) using ternaries — each one gives Gemini a fallback instruction when the user left that field blank, so the model never has to guess what "not provided" means. The two `Record<...>` lookup tables (`TONE_GUIDANCE`, `LANGUAGE_NAME`) exist so the tone/language options in the UI can map to fuller instruction text without a `switch` statement.

### `lib/gemini.ts`

- **`getClient()`** — reads `GEMINI_API_KEY` from `process.env` and constructs a `GoogleGenAI` client. Throws a typed `GeminiConfigError` if the key is missing, rather than letting the SDK fail with a less specific error later — this makes "forgot to set the env var" a distinct, recognizable failure mode.
- **`extractJsonBlock(raw)`** — defensive parsing helper. Gemini is instructed to return raw JSON with no markdown, but models don't always comply, so this strips ` ```json ` fences if present, and falls back to slicing out the first `{...}` block from the response text if no fence is found. Exists because trusting the model to always format correctly would make generation fail unnecessarily often.
- **`parseAdCopyResponse(raw)`** — takes the raw text response and turns it into a validated `AdCopyResult`. Parses JSON (throwing `GeminiParseError` on failure), checks that `primaryText`, `headline`, `description`, and `cta` are all non-empty strings, and defaults `productName` to `"Uploaded Product"` if Gemini omits it rather than failing the whole generation over one non-essential field. This is where "trust but verify" happens — the function never assumes the model's output matches the requested shape.
- **`generateAdCopy(imageBase64, mimeType, settings)`** — the main exported entry point, called by the API route. Builds the client and prompt, sends the image + prompt to Gemini, and passes the response through `parseAdCopyResponse`. After parsing, it does two things deliberately *not* delegated to the AI: it overwrites `cta` with `settings.cta` unconditionally, and overwrites `productName` with the user's value if one was supplied. The prompt already asks Gemini to respect both, but this function doesn't rely on that — it enforces the outcome in code, so neither value can be wrong even if the model ignores an instruction.

### `lib/history.ts`

- **`isBrowser()`** — returns whether `window`/`localStorage` exist. Every other function in the file checks this first, since Next.js renders this code on the server too, where `window` doesn't exist.
- **`isValidEntry(value)`** — a type guard that checks an unknown value has all the fields a `GenerationHistoryEntry` needs, with the right types. Used to filter out corrupted or old-shape data read back from `localStorage`, since anything written to browser storage should be treated as untrusted input (a user could hand-edit it, or an older version of the app could have written a different shape).
- **`getGenerationHistory()`** — reads and parses the stored array, returning `[]` on the server, on missing data, or on any parse error, rather than throwing. Filters the parsed array through `isValidEntry` so malformed entries silently drop instead of crashing the page.
- **`saveGeneration(result)`** — builds a new `GenerationHistoryEntry` (generating an id from a timestamp + random suffix, since there's no server to issue one), prepends it to the existing list, and trims to `HISTORY_LIMIT` (10) before writing back. The write is wrapped in try/catch since `localStorage.setItem` can throw if storage is full — in that case the function just returns the new in-memory list without persisting, rather than crashing the generation flow over a storage quota issue.
- **`clearGenerationHistory()`** — removes the storage key entirely. Also wrapped in try/catch for the same reason as above.
- **`formatRelativeTime(timestamp)`** — pure function turning a millisecond timestamp into "Just now" / "N min ago" / "N hour(s) ago" / "N day(s) ago". Kept separate from the storage functions since it's a display concern, not a persistence concern, and it's reused by both `RecentGenerations` and `HistoryEntryModal`.

### `lib/useGenerationHistory.ts`

- **`useGenerationHistory()`** — the only function in the file, a React hook wrapping `lib/history.ts` for use in components. It starts with an empty array on the very first render (both server and client) and only loads the real `localStorage` contents inside a `useEffect`, which runs after hydration. This two-phase approach exists specifically to avoid a Next.js hydration mismatch: if the hook read `localStorage` synchronously during render, the server-rendered HTML (which has no access to the browser's storage) would differ from the client's first render, and React would throw a hydration error. `addEntry` and `clearAll` are thin wrappers that call the underlying storage functions and then sync React state so the UI re-renders immediately.

### `lib/utils.ts`

- **`fileToBase64(file)`** — wraps the browser's `FileReader` in a Promise (it's a callback-based API natively) and strips the `data:...;base64,` prefix, since the API route expects raw base64. Used before every `fetch("/api/generate")` call.
- **`urlToFile(url, filename)`** — fetches a same-origin URL and converts the response into a `File` object, using the fetched blob's real content type rather than a guessed one. This was written to support the original demo-product quick-select feature (turning a demo product's image URL into a `File` the same upload code could use). That feature has since been removed from the UI (see §14 below) — this function is no longer called anywhere and is a candidate for deletion.
- **`copyToClipboard(text)`** — thin wrapper around `navigator.clipboard.writeText` that returns `true`/`false` instead of letting a rejected promise propagate, so callers (the various "Copy" buttons) can show a simple success/fail state without a try/catch at every call site.

### `app/api/generate/route.ts`

- **`jsonError(message, status)`** — tiny helper that returns a `NextResponse` matching the `GenerateAdErrorResponse` shape. Exists so every error path in `POST` returns a consistently-shaped response with one line, instead of repeating `NextResponse.json({ ok: false, error: ... }, { status })` everywhere.
- **`isValidSettings(settings)`** — a runtime type guard that re-validates the `MarketingSettings` shape from the request body. This exists even though the frontend TypeScript types already constrain what's sent, because the API route can be called by anything (not just this app's frontend) and TypeScript types provide zero protection at runtime — an API endpoint has to validate its input regardless of what the client claims to have sent.
- **`estimateBase64Bytes(base64)`** — estimates decoded byte size from the base64 string length (`length * 3/4`) without actually decoding it, so the server-side size check is cheap. Exists as a second, independent size check — the client already validates file size, but a request could be crafted to skip that check, so the server can't rely on it.
- **`POST(req)`** — the route handler. Parses the JSON body, then runs through validation in a specific order (image presence → mime type → size → settings shape → custom-audience-non-empty), returning a 400 with a specific message at the first failure. If all validation passes, it calls `generateAdCopy` and maps any thrown error type (`GeminiConfigError` / `GeminiParseError` / `GeminiRequestError` / unknown) to a distinct HTTP status and a generic, safe message — logging the real error to the server console first. The validation order matters: cheaper, more obviously-wrong checks (is there an image at all) run before more expensive ones (parsing settings), so a malformed request fails fast.

### `app/page.tsx`

- **`canGenerate`** (a `useMemo`, not a function declaration, but the equivalent of one) — derives whether the Generate button should be enabled: an image must be selected, and if "Custom" audience is chosen, the description can't be empty. Recomputed only when `file` or `settings` change.
- **`handleFileSelected(selected)`** — called when a file is chosen (upload or drag-drop). Sets the file, creates an object URL for the preview (revoking any previous one first to avoid a memory leak), and resets any previous generation result/state/error so a newly-uploaded image doesn't show stale results.
- **`handleClearImage()`** — clears the file, preview URL (revoking it), and generation state. Shared by the image upload's "Remove" button and, indirectly, by `handleGenerateAnother`.
- **`runGeneration(isRegenerate)`** — the shared logic behind both "Generate" and "Regenerate". Guards on `file` being present, sets the appropriate loading flag (`state` for a fresh generate, `regenerating` for a regenerate, so the UI can show different loading affordances for each), calls the API route, and on success both saves the result to history (`history.addEntry`) and updates `result`/`state`. Written as one function taking a boolean rather than two separate implementations, since the two flows are identical except for which loading indicator to show.
- **`handleGenerate` / `handleRegenerate`** — one-line wrappers calling `runGeneration(false)` and `runGeneration(true)` respectively, so the JSX can reference clearly-named handlers instead of an inline boolean.
- **`handleGenerateAnother()`** — calls `handleClearImage()` and then resets the product-specific settings fields (`customAudience`, `productName`, `keySellingPoint`) via a single `setSettings` update, while deliberately leaving `tone`, `language`, `cta`, and `targetAudienceMode` untouched — so general preferences carry over to the next product but nothing product-specific does.

## 14. Potential improvements

Realistic next steps beyond this MVP, not implemented here since they're out of scope for the assessment:

- **Authentication** — accounts so history and preferences can be tied to a real user
- **Server-side history storage** — move generation history into a database keyed to an authenticated user, so it survives across browsers/devices and can't be cleared client-side
- **Usage limits / rate limiting** — the current build has no generation cap; a production deployment would want abuse protection on the API route regardless of any business-model usage limit
- **Subscription/payment integration** — if a paid tier is reintroduced
- **Brand voice configuration** — saved tone/style presets per account
- **Multiple ad variations per generation** — return 2–3 options to A/B test in one call
- **A/B testing tools** — track which variant performs better once posted
- **Performance analytics** — surface real Meta Ads metrics for generated copy
- **Product catalog integration** — pull from a real store's product feed instead of manual upload
- **Direct Meta Ads integration** — push generated copy straight into Ads Manager
- **Better moderation/claim validation** — an automated pass checking generated copy against ad-policy rules before showing it to the user
- **Image optimization** — resize/compress uploads before sending to Gemini to cut latency and cost
- **Logging/monitoring** — structured server-side logging and alerting for Gemini failures

Specific, smaller items found while writing the function reference above (§13):

- **`lib/utils.ts`'s `urlToFile()` is dead code.** It was written to support the original demo-product quick-select feature, which has since been removed from the UI. It's no longer called anywhere and should be deleted along with its unused import in any file that still references it.
- **A stale comment in `lib/gemini.ts`.** The comment above `MODEL_NAME` still says `// gemini-2.5-flash: current stable multimodal model...` even though the constant itself was updated to `"gemini-3.6-flash"` — the comment should be updated to match, or removed, so it doesn't mislead a future reader.
- **No automated tests.** Every verification in this project so far has been manual (`tsc --noEmit`, `next build`, and manual browser testing) — a small test suite around `lib/gemini.ts`'s `parseAdCopyResponse()` and `lib/prompt.ts`'s `buildAdCopyPrompt()` would catch regressions in the two most business-logic-heavy pure functions without needing a real API key or a browser.