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

## 13. Potential improvements

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