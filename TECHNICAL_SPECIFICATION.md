# Technical Specification — AI Facebook Ad Copy Generator

## 1. Overview

A Next.js 14 (App Router) MVP that lets a user upload a product image and marketing preferences, and returns AI-generated, structured Facebook ad copy. Single-user, no accounts, no database — state lives in the browser for the duration of a session (plus a small persisted usage counter).

## 2. Frontend architecture

`app/page.tsx` is the single client component orchestrating the flow. It owns:
- the uploaded `File` and its object-URL preview
- the `MarketingSettings` form state
- generation state machine (`idle` → `loading` → `success` | `error`)
- the usage-limit modal's open/closed state

It composes five presentational components (`ImageUpload`, `MarketingSettingsForm`, `DemoProducts`, `AdResults`, `UsageIndicator`, `UsageLimitModal`), each responsible for one piece of UI and taking plain props/callbacks — no component talks to the network or to `localStorage` directly except `useUsageLimit` (a small hook) and `page.tsx` itself (the `fetch` call). This keeps the components easy to test and reuse.

Why a single page component instead of a multi-step wizard/router: the flow is linear and short (upload → settings → generate → result), and the brief explicitly asks to avoid over-engineering. Conditional rendering based on state is simpler and easier to review than routed steps for this size of app.

## 3. Backend / API route

`app/api/generate/route.ts` is the only server-side entry point. It:
1. Parses and validates the request body (image present, accepted mime type, size under 8MB, settings shape valid, custom audience non-empty if selected)
2. Calls `generateAdCopy()` from `lib/gemini.ts`
3. Maps any thrown error to a specific HTTP status and a generic, user-safe message
4. Logs the real error server-side via `console.error` for debugging, but never returns stack traces, provider error text, or configuration details to the client

`runtime = "nodejs"` is set explicitly since the Gemini SDK needs the Node runtime, not the Edge runtime.

## 4. Gemini integration

`lib/gemini.ts` wraps `@google/generative-ai`:
- `getClient()` reads `GEMINI_API_KEY` from `process.env` (server-only) and throws a typed `GeminiConfigError` if missing
- `generateAdCopy()` sends the prompt text plus the image as `inlineData` (base64 + mime type) to `gemini-1.5-flash`, a multimodal model capable of reading the product photo
- The raw text response is parsed by `parseAdCopyResponse()`, which:
  - Strips markdown code fences if the model adds them despite instructions
  - Extracts the first `{...}` block as a fallback
  - Validates all four required string fields are present and non-empty (throws `GeminiParseError` otherwise)
  - Normalizes the `cta` field to one of the four allowed values via case-insensitive match, defaulting to `"Shop Now"` if the model returns something unexpected — this avoids a hard failure over a cosmetic mismatch

Three typed error classes (`GeminiConfigError`, `GeminiRequestError`, `GeminiParseError`) let the API route return the right HTTP status and message without string-matching error text.

## 5. Prompt construction

`lib/prompt.ts` builds one instruction string per request from the current `MarketingSettings`. It explicitly encodes the copywriter persona, the audience/tone/language/product-name/selling-point context (with sensible fallback instructions when optional fields are empty), the anti-hallucination rules (no invented stats, discounts, guarantees, or unsupported claims), and the exact JSON shape expected back. Keeping this in one pure function (settings in, string out) makes the prompt easy to review, version, and unit-test independently of the network call.

## 6. Image handling

- Client-side: `lib/utils.ts`'s `fileToBase64()` reads the `File` via `FileReader` and strips the `data:...;base64,` prefix before sending JSON to the API route (avoids multipart/form-data complexity for an MVP).
- Server-side: the base64 string and mime type are passed straight through to Gemini as `inlineData` — no server-side image processing/resizing in this MVP (see Potential Improvements).
- Size is checked twice: client-side against the real `File.size`, and server-side by estimating decoded byte length from the base64 string length (`(len * 3) / 4`), so a request can't bypass the client check.

## 7. Validation

- **Client**: file type/size checked in `ImageUpload` before accepting a file; "Generate" is disabled unless an image is present and, if "Custom" audience is selected, the description isn't empty.
- **Server**: the API route re-validates everything independently (never trusts the client) — file presence, mime type against `ACCEPTED_IMAGE_TYPES`, size, settings shape via `isValidSettings()`, and the custom-audience-non-empty rule.

## 8. Error handling

Every failure mode from the brief maps to a specific, human-readable message shown inline near the action that failed, never a raw exception or stack trace:
- No image / unsupported type / file too large → caught client-side in `ImageUpload`, or server-side as a 400 with a plain message
- Gemini not configured → 500, generic "not configured yet" message (details logged server-side only)
- Gemini request failure (network/provider) → 502, "AI service is unavailable right now"
- Invalid/unparseable Gemini response → 502, "AI response could not be understood — try Regenerate"
- Network failure from the browser's `fetch` → caught in `page.tsx`, generic network error message
- Usage limit reached → handled entirely client-side before a request is even sent, via the `UsageLimitModal`

## 9. Usage-limit logic

`lib/usageLimit.ts`'s `useUsageLimit()` hook reads/writes a single integer in `localStorage` (`fbAdGenerator.generationsUsed`). Both an initial generation and a regeneration call `recordGeneration()`, incrementing the same counter — per the brief, the limit counts generations, not unique products. `remaining` and `limitReached` are derived from `FREE_GENERATION_LIMIT - used`. Generation is blocked client-side (the modal opens instead of calling the API) once the limit is hit.

**This is explicitly not secure** — anyone can clear `localStorage` or use a private window to reset it. That's an accepted tradeoff for an assessment MVP with no auth/database; a production build would track usage server-side against an authenticated account (see Potential Improvements).

## 10. Product demo data

`lib/demoProducts.ts` exports a static array of 3 `DemoProduct` records (no database — matches the brief's "local JSON/TypeScript file" guidance). It currently ships with placeholder entries rather than invented Vigoshop.si product data — see `README.md` for how to complete this before submission. Selecting a demo card fetches its image (`urlToFile()` in `lib/utils.ts`), converts it into the same `File` object the upload flow uses, and pre-fills the product name / selling point fields, so the demo path exercises the exact same code as a real upload.

## 11. Security considerations

- `GEMINI_API_KEY` is read only in server-side code (`lib/gemini.ts`, executed inside the `app/api/generate` route handler) and is never referenced with a `NEXT_PUBLIC_` prefix, so Next.js never inlines it into client bundles.
- `.env.local` is gitignored; `.env.example` documents the required variable name with a placeholder value only.
- API error responses are deliberately generic — no stack traces, provider error bodies, or internal config state ever reach the client; real errors go to `console.error` server-side.
- Input is validated server-side independent of client checks (file type/size, settings shape) since the client can't be trusted.

## 12. Deployment

Standard Vercel deployment: push to GitHub, import into Vercel, set `GEMINI_API_KEY` in Project Settings → Environment Variables, deploy. No build-step configuration beyond the defaults `next build` provides — no database, no separate backend service.

## 13. Potential improvements

Realistic next steps beyond this MVP, not implemented here since they're out of scope for the assessment:

- **Authentication** — accounts so usage/history can be tied to a real user
- **Server-side usage enforcement** — move the 3-generation limit into the database/API layer, keyed to an authenticated user, so it can't be reset client-side
- **Subscription/payment integration** — real "Upgrade to Premium" flow (e.g. Stripe)
- **Persistent generation history** — let users revisit past ads
- **Brand voice configuration** — saved tone/style presets per account
- **Multiple ad variations per generation** — return 2-3 options to A/B test
- **A/B testing tools** — track which variant performs better once posted
- **Performance analytics** — surface real Meta Ads metrics for generated copy
- **Product catalog integration** — pull from a real store's product feed instead of manual upload
- **Direct Meta Ads integration** — push generated copy straight into Ads Manager
- **Better moderation/claim validation** — an automated pass checking generated copy against ad-policy rules before showing it to the user
- **Image optimization** — resize/compress uploads before sending to Gemini to cut latency and cost
- **Rate limiting** — protect the API route from abuse independent of the per-user generation limit
- **Logging/monitoring** — structured server-side logging and alerting for Gemini failures
