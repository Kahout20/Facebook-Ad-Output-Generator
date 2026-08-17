# AI Facebook Ad Copy Generator

An MVP web app that turns a product photo into ready-to-use Facebook/Instagram ad copy, powered by Google's Gemini API. Built as a job assessment exercise.

## What it does

Upload a product image, choose marketing settings (target audience, tone, language, call to action, optional product name and key selling point), and get back structured Facebook ad copy — primary text, headline, description, and call-to-action — shown both as a live ad preview and as individually copyable fields. Every successful generation is also saved to a local "Recent Generations" list so you can revisit past copy.

## Main features

- Drag-and-drop image upload with validation (type, size)
- Marketing settings: target audience (auto or custom), tone, language, call to action (Shop Now / Learn More / Get Offer), optional product name and key selling point / benefit
- AI-generated, structured ad copy (not one paragraph — product name / primary text / headline / description / CTA)
- A prompt tuned to sound like an experienced human performance copywriter, not generic AI copy — see "How the AI works" below
- Live Facebook-ad-style preview of the generated copy
- Copy-to-clipboard per field and "Copy all"
- Regenerate (same image/settings) and "Generate another ad" (starts a fresh product — clears image, product name, custom audience text, and key selling point, but keeps your tone/language/CTA preferences)
- Recent Generations: the last 10 generations persist locally (per browser) with a relative timestamp and a "View" modal; "Clear history" with a confirmation step
- Unlimited generations — no usage cap for this build
- Full loading / empty / success / error states
- Dark, purple/teal-accented UI with a top nav bar

## Tech stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Google Gemini API (`gemini-3.6-flash`, multimodal) via `@google/genai`
- Deployed on Vercel
- No database — generation history lives in the browser's `localStorage`

## Architecture

```
app/
  page.tsx                 Main generator page (client component, holds all UI state)
  layout.tsx                 Root layout, fonts, top nav, metadata
  globals.css                 Tailwind entrypoint + dark color-scheme base styles
  api/generate/route.ts        Server-side API route — the only place that talks to Gemini
components/
  SiteNav.tsx                   Top nav bar ("AdStudio AI" + "Powered by Gemini")
  ImageUpload.tsx                 Drag-and-drop + file picker + preview
  MarketingSettingsForm.tsx        Audience / tone / language / CTA / optional fields
  AdResults.tsx                      Ad preview mockup + copyable result fields
  RecentGenerations.tsx                List of past generations, empty state, clear-history
  HistoryEntryModal.tsx                  Read-only view of one past generation's text fields
lib/
  types.ts        Shared TypeScript types + constants
  prompt.ts         Builds the Gemini prompt from marketing settings
  gemini.ts           Gemini client, request + response parsing/validation
  history.ts             localStorage read/write/clear + relative-time formatting
  useGenerationHistory.ts  React hook wrapping history.ts (hydration-safe)
  utils.ts                   File <-> base64 helper, clipboard helper
```

The API key never reaches the browser: the frontend sends the image (base64) and settings to `POST /api/generate`, which runs server-side, calls Gemini, validates/normalizes the response, and returns clean JSON. Errors from Gemini are logged server-side and mapped to generic, user-safe messages.

## How the AI works

`lib/prompt.ts` builds a single instruction prompt per generation, tuned to read like an experienced Facebook/Instagram performance copywriter rather than generic AI-generated copy:

- Prioritizes, in order: the customer's problem, the product's practical benefit, the user's key selling point (if given), an appropriate emotional angle, a clear value proposition, and a natural lead into the CTA
- Explicitly bans generic filler phrases and AI-copywriter clichés ("elevate your lifestyle," "effortless," "seamlessly," "approachable," "luxury," etc.) and asks for concrete, customer-focused language instead
- Asks for concise Primary Text (roughly 40–80 words as a soft target, shorter when the message is already complete — never padded to hit a word count)
- Never invents specs, prices, discounts, guarantees, statistics, or medical/health claims
- Treats target audience, tone, and output language as hard constraints
- Treats the user-selected CTA as a hard constraint in the prompt *and* the code forces the final `cta` field to exactly match the user's selection regardless of what Gemini returns, so it's structurally impossible for the AI to override it
- A user-supplied product name always overrides AI-inferred naming; if not supplied, Gemini infers a generic descriptive name rather than inventing a brand/model it can't verify
- Runs an internal quality checklist before responding (is the benefit clear, is the CTA exact, any leftover clichés, any unsupported claim, etc.)

`lib/gemini.ts` sends that prompt plus the image to Gemini (`gemini-3.6-flash`), then parses and validates the JSON response, throwing typed errors (`GeminiConfigError`, `GeminiRequestError`, `GeminiParseError`) that the API route maps to safe, generic client-facing messages.

## Recent Generations

Every successful generation (including regenerates) is saved to `localStorage` — up to the 10 most recent; the oldest is dropped once an 11th is added. Each entry stores `productName`, `headline`, `primaryText`, `description`, `cta`, and a timestamp — the original uploaded image is intentionally **not** stored. Clicking "View" on a past entry opens a read-only modal with the text fields (no image, since none is kept). This is per-browser, not tied to an account — clearing browser storage or switching browsers/devices resets it.

## Running locally

```bash
npm install
```

Create a file named `.env.local` in the project root with:

```
GEMINI_API_KEY=your_gemini_api_key_here
```

Then start the dev server:

```bash
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Server-side only. Never prefix with `NEXT_PUBLIC_`. Get one at https://aistudio.google.com/apikey. Google's newer "Auth keys" start with `AQ.` (older `AIza...` keys are being phased out) — either format works as long as the `@google/genai` SDK is used, which this project does. |

`.env.local` is gitignored — it never gets committed to GitHub, so anyone cloning the repo needs to create their own copy with their own key.

## Deploying to Vercel

1. Push this repo to GitHub
2. Import the repo in Vercel
3. In Project Settings → Environment Variables, add `GEMINI_API_KEY` (for Production, Preview, and Development as needed)
4. Deploy — no other configuration needed

## Known limitations

- **Generation history is client-side only.** It's stored in `localStorage`, per browser, with no server-side or database persistence. A production version would associate history with an authenticated account and store it server-side.
- **No authentication, database, or payments** — intentionally out of scope for this MVP.
- **No usage limit** — generation is currently unlimited; there is no rate limiting or abuse protection on the API route.
- **No automated tests** — out of scope for an MVP assessment exercise; see "Potential Improvements" in `TECHNICAL_SPECIFICATION.md`.

## Other docs

- `USER_MANUAL.md` — how to use the app, end-user perspective
- `TECHNICAL_SPECIFICATION.md` — architecture, decisions, and what would change for production