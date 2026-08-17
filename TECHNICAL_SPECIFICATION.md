# Technical Specification — AI Facebook Ad Copy Generator

## 1. Overview

A Next.js 14 (App Router) MVP that lets a user upload a product image and marketing preferences, and returns AI-generated, structured Facebook ad copy. Single-user, no accounts, no database — the current session's state lives in React state, and a "Recent Generations" history persists locally in the browser via `localStorage`. The AI is Google's Gemini (`gemini-3.6-flash`, multimodal — it can read the product photo directly), accessed only from the server, never from the browser.

This document is organized in four parts:
- **§2** — a quick-reference table of what every file is responsible for, folder by folder
- **§3** — a detailed walkthrough of every file, explaining what each function inside it does and why it's written that way
- **§4** — the end-to-end trace of what happens, file by file, when a user clicks "Generate"
- **§5** — what could be improved, including specific issues found while writing this document

## 2. File responsibility overview

### `app/` — pages and the server route

| File | Responsible for |
|---|---|
| `page.tsx` | The entire app's single screen. Holds all UI state (uploaded image, settings, generation result, history) and composes every component together. |
| `layout.tsx` | The wrapper around every page — loads fonts, sets page metadata, and renders the top nav (`SiteNav`) above whatever page is showing. |
| `globals.css` | Site-wide CSS — Tailwind's entrypoint plus a few global rules (dark color scheme, a shared focus-ring utility, reduced-motion support). |
| `api/generate/route.ts` | The **only** server code allowed to talk to Gemini. Receives an image + settings from the browser, validates everything, calls the AI, and returns clean JSON or a safe error message. This is what keeps the Gemini API key off the client. |

### `components/` — visual building blocks

| File | Responsible for |
|---|---|
| `SiteNav.tsx` | The top bar — "AdStudio AI" logo and "Powered by Gemini" badge. No state, no logic. |
| `ImageUpload.tsx` | The drag-and-drop / browse box, client-side file validation, and the image preview once one's uploaded. |
| `MarketingSettingsForm.tsx` | The settings panel: Target Audience, Tone, Language, Call to Action, Product Name, Key Selling Point. |
| `AdResults.tsx` | Displays a generated ad two ways: a realistic Facebook-post mockup, and individually copyable text fields. Also hosts the Regenerate / Generate another ad buttons. |
| `RecentGenerations.tsx` | The "Recent Generations" list — empty state, entry list, and "Clear history" with a confirmation step. |
| `HistoryEntryModal.tsx` | The read-only pop-up shown when a user clicks "View" on a past generation. |

### `lib/` — logic with no visual output

| File | Responsible for |
|---|---|
| `types.ts` | Shared TypeScript types and constants used across the whole app (what a "setting" looks like, what a "result" looks like, the CTA option list, size limits, etc.). Every other file imports from here — it has no logic of its own. |
| `prompt.ts` | Builds the text instructions sent to Gemini, based on the user's marketing settings. This is where the "sound like a real copywriter" rules live. |
| `gemini.ts` | Calls the Gemini API with that prompt and the image, validates the JSON it gets back, and enforces that the CTA and product name match exactly what the user chose. |
| `history.ts` | Plain (non-React) functions that read, write, and clear the "Recent Generations" list in the browser's `localStorage`. |
| `useGenerationHistory.ts` | A React hook wrapping `history.ts` so components can use it safely (handles a Next.js rendering timing issue — see §3). |
| `utils.ts` | Small reusable helpers: converting an uploaded file to the format the API needs, and copying text to the clipboard. |

## 3. File-by-file details

### `app/`

#### `app/layout.tsx`

Not a function-heavy file — it's the root layout every page renders inside of. It loads two Google Fonts (`Sora` for display/headings, `Inter` for body text) via Next.js's built-in font loader, sets the page `<title>` and meta description, and renders `<SiteNav />` followed by whatever page content is passed in as `children`. There's exactly one function here, `RootLayout(...)`, which is really just the JSX shell — no business logic.

#### `app/page.tsx`

The main screen. All of its "functions" are React state and event handlers living inside the `HomePage` component:

- **`canGenerate`** (a `useMemo`, not a named function, but does the same job) — derives whether the Generate button should be enabled: an image must be selected, and if "Custom" audience is chosen, the description field can't be empty. Recomputed only when `file` or `settings` change, so it doesn't recalculate on every keystroke elsewhere on the page.
- **`handleFileSelected(selected)`** — runs when a file is chosen (via upload or drag-drop). Sets the file, creates a browser object URL for the image preview (revoking any previous one first, to avoid leaking memory), and resets any previous generation result/state/error so a newly-uploaded image never shows stale results from a different product.
- **`handleClearImage()`** — clears the file, preview URL (revoking it), and generation state. Shared by the image upload's "Remove" button and, indirectly, by `handleGenerateAnother` below.
- **`runGeneration(isRegenerate)`** — the shared logic behind both "Generate" and "Regenerate." Guards on `file` being present, sets the correct loading flag (`state` for a fresh generate, `regenerating` for a regenerate — kept separate so the UI can show different loading behavior for each), calls `POST /api/generate`, and on success both saves the result to history and updates the displayed result. Written as one function taking a boolean rather than two near-identical functions, since the only real difference between "Generate" and "Regenerate" is which loading indicator lights up.
- **`handleGenerate` / `handleRegenerate`** — one-line wrappers calling `runGeneration(false)` and `runGeneration(true)` respectively, so the JSX can reference clearly-named handlers instead of an inline boolean.
- **`handleGenerateAnother()`** — calls `handleClearImage()`, then resets the product-specific settings fields (`customAudience`, `productName`, `keySellingPoint`) in one `setSettings` update, while deliberately leaving `tone`, `language`, `cta`, and `targetAudienceMode` untouched. This distinction (product-specific vs. general-preference settings) is the whole reason this function exists separately from `handleClearImage` — the two look similar but serve different intents.

#### `app/globals.css`

No functions — a CSS file. Three things worth noting: it sets `color-scheme: dark` and a dark background/text color on `<body>` (this is the whole app's "theme switch," since every component's colors come from Tailwind design tokens defined in `tailwind.config.ts`, not hardcoded here); it defines a `.focus-ring` utility class reused by every interactive element for consistent keyboard-focus styling; and it disables animations under `prefers-reduced-motion` for accessibility.

#### `app/api/generate/route.ts`

The server-side gatekeeper. Four functions:

- **`jsonError(message, status)`** — a tiny helper that returns a `NextResponse` matching the app's `GenerateAdErrorResponse` shape. Exists so every error path in `POST` can return a consistently-shaped response in one line instead of repeating the same object literal everywhere.
- **`isValidSettings(settings)`** — a runtime type guard that re-checks the `MarketingSettings` shape from the incoming request body. This exists even though the frontend's TypeScript types already constrain what *should* be sent, because TypeScript types provide zero protection at runtime — this API endpoint could in principle be called by anything, not just this app's own frontend, so it has to validate its input regardless of what the caller claims to have sent.
- **`estimateBase64Bytes(base64)`** — estimates decoded byte size from the base64 string's length (`length * 3/4`) without actually decoding it, so the server-side size check stays cheap. This is a second, independent size check — the browser already validates file size before sending, but a request could be crafted by hand to skip that check, so the server can't rely on the client having done it.
- **`POST(req)`** — the route handler itself. Parses the JSON body, then validates in a specific order: image presence → mime type → size → settings shape → custom-audience-non-empty — returning a 400 with a specific message at the first failure. Cheaper, more obviously-wrong checks run before more expensive ones, so a malformed request fails fast rather than doing unnecessary work first. If everything passes, it calls `generateAdCopy()` from `lib/gemini.ts` and maps whichever typed error comes back (`GeminiConfigError` / `GeminiParseError` / `GeminiRequestError` / anything else) to a distinct HTTP status and a generic, safe client-facing message — logging the real error to the server console first, so nothing about the Gemini provider, the API key, or an internal stack trace ever reaches the browser.

### `components/`

#### `components/SiteNav.tsx`

One function, `SiteNav()`, and it's pure JSX — no state, no props, no logic. It exists as its own file (rather than being inlined into `layout.tsx`) simply so the nav bar is a self-contained, easily-swappable unit.

#### `components/ImageUpload.tsx`

- **`formatMb(bytes)`** — a tiny pure function converting a byte count into a human string like `"8MB"`. Used so the max-size number shown to the user and the actual limit enforced in code can never drift apart — both read from the same `MAX_IMAGE_SIZE_BYTES` constant in `lib/types.ts`.
- **`validateAndUse(file)`** — runs whenever a file arrives, whether from clicking to browse or dragging-and-dropping. Checks the file's type against `ACCEPTED_IMAGE_TYPES` and its size against `MAX_IMAGE_SIZE_BYTES`, setting a specific error message and bailing out on either failure; otherwise clears any previous error and hands the file up to the parent via the `onFileSelected` prop. Centralizing this in one function means both the "browse" input's `onChange` and the drag-and-drop `onDrop` handler can call the exact same validation logic instead of duplicating it.
- The rest of the component is conditional JSX: if `previewUrl` is set, it renders the uploaded-image preview with a "Remove" button; otherwise it renders the empty dashed-border drop zone with the upload icon and instructions.

#### `components/MarketingSettingsForm.tsx`

- **`Field({ label, optional, children })`** — a small internal layout component (technically a function, just like any other) that renders a label row (with an "Optional · helps the AI be more accurate" hint when `optional` is true) above whatever form control is passed as `children`. Exists purely to keep the six settings fields visually consistent without repeating the same label markup six times.
- **`set(key, value)`** — a small generic helper defined inside `MarketingSettingsForm` itself. Rather than writing six separate `onChange` handlers (one per setting), every pill button and text input calls `set("someKey", newValue)`, which spreads the existing `settings` object and overwrites just that one key before calling the parent's `onChange`. This is the core reason the whole settings panel can stay one flat component instead of being split into six controlled sub-components each managing its own change handler.
- The rest of the file is JSX rendering pill buttons for Target Audience / Tone / Language / Call to Action (each just calling `set(...)` with a different key and value), and plain text inputs for the two optional fields, Product Name and Key Selling Point / Benefit.

#### `components/AdResults.tsx`

- **`CopyButton({ text, label })`** — a small self-contained component with its own `copied` state. Calls `copyToClipboard()` from `lib/utils.ts`, and if it succeeds, flips a local `copied` flag to true for 1.5 seconds (via `setTimeout`) so the button label changes to "Copied ✓" and then reverts — all without the parent component needing to know or care about that state.
- **`Row({ label, value })`** — a tiny presentational component pairing a field label with its value and a `CopyButton`. Used four times (Primary text, Headline, Description, Call to action) so the same layout doesn't get repeated by hand four times.
- The main `AdResults` component itself computes `allText` (a plain string concatenation of all four fields, used by the "Copy all" button) and manages one more local `copiedAll` boolean for that button's own "Copied ✓" flash. Everything else is JSX: the left column renders a mockup styled to look like an actual Facebook post (deliberately hardcoded to light/white colors regardless of the app's dark theme, since a real Facebook post is never dark-mode), and the right column renders the four `Row`s plus the Regenerate / Generate another ad buttons, which just call the `onRegenerate` / `onGenerateAnother` props passed down from `page.tsx`.

#### `components/RecentGenerations.tsx`

One function, `RecentGenerations(...)`, with one piece of local state: `confirmingClear` (a boolean controlling whether the "are you sure?" dialog is showing). There's no separate named function for the confirm/cancel logic — clicking "Clear history" sets `confirmingClear` to `true`; clicking "Cancel" sets it back to `false`; clicking the confirm button inside the dialog calls the parent's `onClear` prop and then also resets `confirmingClear` to `false`, all inline in the `onClick` handlers. The rest is conditional JSX: an empty-state message when `entries` is empty, otherwise a list of cards built with `entries.map(...)`, each showing the product name, headline, a truncated primary-text preview, a relative timestamp (via `formatRelativeTime` from `lib/history.ts`), and a "View" button that calls the parent's `onView` prop with that entry.

#### `components/HistoryEntryModal.tsx`

- **`Field({ label, value })`** — the same small pattern as in `MarketingSettingsForm.tsx` and `AdResults.tsx`'s `Row`, just named differently in this file: pairs a label with a value, reused four times for the four text fields of a past generation.
- The main `HistoryEntryModal` component takes the `entry` being viewed (or `null`) and returns `null` immediately if there's nothing to show — this is what lets `page.tsx` render `<HistoryEntryModal entry={viewingEntry} .../>` unconditionally without needing its own `if` check. It explicitly tells the user the original image isn't available, since history intentionally never stores the uploaded photo (see `lib/history.ts` below).

### `lib/`

#### `lib/types.ts`

No functions — this file is entirely type definitions (`MarketingSettings`, `AdCopyResult`, `GenerationHistoryEntry`, etc.) and a handful of constants (`CTA_OPTIONS`, `ACCEPTED_IMAGE_TYPES`, `MAX_IMAGE_SIZE_BYTES`, `HISTORY_LIMIT`). It exists as its own file specifically so that every other file — frontend components, the API route, and the Gemini integration — can import the exact same shape of data and never disagree about what a "setting" or a "result" looks like.

#### `lib/prompt.ts`

- **`buildAdCopyPrompt(settings)`** — the only exported function. Takes the user's `MarketingSettings` and returns the full instruction string sent to Gemini. It's a pure function (settings in, string out), which is deliberate: the prompt can be reviewed, tuned, or tested without touching the network call or the API route at all. Internally it builds a handful of small conditional instruction fragments using ternaries (for audience, product name, selling point) — each one gives Gemini an explicit fallback instruction when the user left that field blank, so the model never has to guess what "not provided" is supposed to mean. Two `Record<...>` lookup tables (`TONE_GUIDANCE`, `LANGUAGE_NAME`) map the UI's short option values (like `"friendly"` or `"sl"`) to fuller instruction sentences, so the settings dropdown values and the prompt's wording can change independently of each other.

#### `lib/gemini.ts`

- **`getClient()`** — reads `GEMINI_API_KEY` from `process.env` and constructs a `GoogleGenAI` client. Throws a typed `GeminiConfigError` if the key is missing, rather than letting the SDK fail later with a less specific error — this makes "the server forgot to set the env var" a distinct, recognizable failure mode instead of an opaque crash.
- **`extractJsonBlock(raw)`** — a defensive parsing helper. Gemini is instructed to return raw JSON with no markdown formatting, but models don't always comply perfectly, so this strips ` ```json ` code fences if present, and falls back to slicing out the first `{...}` block from the response text if no fence is found. Exists because trusting the model to always format its output exactly right would make real generations fail more often than necessary.
- **`parseAdCopyResponse(raw)`** — takes the raw text response and turns it into a validated `AdCopyResult`. Parses the JSON (throwing `GeminiParseError` on failure), checks that `primaryText`, `headline`, `description`, and `cta` are all present and non-empty strings, and defaults `productName` to `"Uploaded Product"` if Gemini omits it rather than failing the whole generation over one non-essential field. This function is where "don't trust the AI's output shape, verify it" actually happens in code.
- **`generateAdCopy(imageBase64, mimeType, settings)`** — the main exported entry point, called by the API route. Builds the client and the prompt, sends the image plus prompt to Gemini, and passes the response through `parseAdCopyResponse`. Afterward, it does two things deliberately *not* left up to the AI to get right: it overwrites the returned `cta` with `settings.cta` unconditionally, and overwrites `productName` with the user's own value if one was supplied. The prompt already instructs Gemini to respect both, but this function doesn't rely on the instruction being followed — it enforces the outcome in code, so neither value can end up wrong even if the model ignores what it was told.

#### `lib/history.ts`

- **`isBrowser()`** — returns whether `window` and `localStorage` exist. Every other function in this file checks this first, since Next.js renders this code on the server too (during server-side rendering), where `window` doesn't exist at all.
- **`isValidEntry(value)`** — a type guard checking that an unknown value has every field a `GenerationHistoryEntry` needs, with the right types. Used to filter out corrupted or old-shape data read back from `localStorage`, since anything read from browser storage should be treated as untrusted — a user could hand-edit it in devtools, or an older version of the app could have written a different shape.
- **`getGenerationHistory()`** — reads and parses the stored array, returning `[]` on the server, on missing data, or on any parse error, rather than throwing. Runs the result through `isValidEntry` so malformed entries silently drop instead of crashing the page.
- **`saveGeneration(result)`** — builds a new `GenerationHistoryEntry` (generating an id from a timestamp plus a random suffix, since there's no server available to issue one), prepends it to the existing list, and trims to `HISTORY_LIMIT` (10) before writing back. The `localStorage.setItem` write is wrapped in try/catch, since it can throw if storage is full — in that case the function still returns the new in-memory list so the UI updates, it just silently fails to persist that particular write, rather than crashing the whole generation flow over a storage quota issue.
- **`clearGenerationHistory()`** — removes the storage key entirely. Wrapped in try/catch for the same reason as above.
- **`formatRelativeTime(timestamp)`** — a pure function turning a millisecond timestamp into `"Just now"` / `"N min ago"` / `"N hour(s) ago"` / `"N day(s) ago"`. Kept separate from the storage functions since it's purely a display concern, not a persistence concern, and it's reused by both `RecentGenerations` and `HistoryEntryModal`.

#### `lib/useGenerationHistory.ts`

- **`useGenerationHistory()`** — the only function in the file, a React hook wrapping `lib/history.ts` for components to use. It starts with an empty array on the very first render, both on the server and on the client, and only loads the real `localStorage` contents inside a `useEffect`, which runs after the page has hydrated. This two-phase approach exists specifically to avoid a Next.js hydration error: if the hook read `localStorage` synchronously during render, the server-rendered HTML (which has no access to browser storage at all) would come out different from what the client renders on its first pass, and React would throw a mismatch error. `addEntry` and `clearAll` are thin wrappers that call the underlying storage functions from `history.ts` and then sync the result into React state so the UI re-renders immediately.

#### `lib/utils.ts`

- **`fileToBase64(file)`** — wraps the browser's `FileReader` (a callback-based API) in a Promise, and strips the `data:...;base64,` prefix from the result, since the API route expects raw base64 with no prefix. Called right before every `fetch("/api/generate")`.
- **`copyToClipboard(text)`** — a thin wrapper around `navigator.clipboard.writeText` that returns `true`/`false` instead of letting a rejected promise propagate, so every "Copy" button can show a simple success/fail state without needing its own try/catch.

(A third function, `urlToFile()`, previously lived in this file to support the original demo-product quick-select feature. That feature has since been removed from the UI, and the function is unused — see §5.)

## 4. How a single "Generate" click flows through these files

1. The user interacts with **`ImageUpload.tsx`** and **`MarketingSettingsForm.tsx`**; the actual state for both lives up in **`page.tsx`**, which passes it down as props and receives updates back via callbacks.
2. The user clicks **Generate**. `page.tsx`'s `runGeneration(false)` runs: it calls `fileToBase64()` from **`utils.ts`** to convert the uploaded image, then sends a `POST` request to `/api/generate` with the base64 image and the current settings.
3. **`app/api/generate/route.ts`**'s `POST` handler receives the request, validates the image and settings (`isValidSettings`, `estimateBase64Bytes`), and — if everything checks out — calls `generateAdCopy()` from **`lib/gemini.ts`**.
4. **`lib/gemini.ts`** builds the actual AI instructions by calling `buildAdCopyPrompt()` in **`lib/prompt.ts`**, sends that prompt plus the image to Google's Gemini API, and validates/normalizes whatever comes back via `parseAdCopyResponse()` — including force-setting the CTA and product name to match the user's selections exactly.
5. The result travels back up through the API route (wrapped as a clean JSON success response) to `page.tsx`.
6. `page.tsx` does two things with the result: it displays it via **`AdResults.tsx`** (the Facebook-post mockup and the copyable fields), and it saves it to history by calling `history.addEntry(result)`, which flows into **`useGenerationHistory.ts`** and then **`lib/history.ts`**'s `saveGeneration()`, which writes it into `localStorage`.
7. The next time **`RecentGenerations.tsx`** renders, the new entry appears at the top of the list.

If the user clicks **Regenerate** instead, the flow is identical from step 2 onward — `runGeneration(true)` reuses the same image and same settings, just setting a different loading flag so the UI shows "Regenerating…" instead of the initial loading state.

## 5. Potential Improvements

The current implementation intentionally focuses on providing a simple, functional MVP. The following improvements would be priorities when moving from a demonstration tool toward a production product.

### 1. Authentication & Server-Side History
Add user accounts and move generation history from browser `localStorage` to a database(eg. Supabase). This would allow users to access their history across browsers and devices while securely associating stored data with individual accounts.

### 2. Usage Limits & Rate Limiting
Implement server-side generation limits and API rate limiting to prevent abuse and control Gemini API costs. 

### 3. Multiple Ad Variations & A/B Testing
Allow users to generate multiple copy variations for the same product, using different marketing angles or hooks. This could later be extended into A/B testing to determine which variation performs better.

### 4. Product Catalog Integration
Integrate with an ecommerce product catalog or product feed so product images and information can be retrieved automatically instead of requiring users to upload and enter product details manually and adding to facebook account so the post can be automatically uploaded.

### 5. Automated Claim & Policy Validation
Add a validation layer that checks generated copy for unsupported product claims and common advertising-policy issues before displaying or publishing the copy. This would reduce the risk of misleading or non-compliant advertising content.

### 6. Personlisation 
Save tone/style presets per account, just like Facebook



