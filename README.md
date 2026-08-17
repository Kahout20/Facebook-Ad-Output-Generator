# AI Facebook Ad Copy Generator

An MVP web app that turns a product photo into ready-to-use Facebook/Instagram ad copy, powered by Google's Gemini API. Built as a job assessment exercise.

## What it does

Upload a product image (or pick one of the demo products), choose a target audience, tone, and language, and get back structured Facebook ad copy: primary text, headline, description, and call-to-action — shown both as a live ad preview and as individually copyable fields.

## Main features

- Drag-and-drop image upload with validation (type, size)
- Marketing settings: target audience (auto or custom), tone, language, optional product name and key selling point
- AI-generated, structured ad copy (not one paragraph — primary text / headline / description / CTA)
- Live Facebook-ad-style preview of the generated copy
- Copy-to-clipboard per field and "Copy all"
- Regenerate (same image/settings) and "Generate another ad" (reset)
- Free usage limit: 3 AI generations, with a clear indicator and an upgrade modal once used up
- 3 quick-select demo products (Vigoshop.si) — see note below
- Full loading / empty / success / error / usage-limit states

## Tech stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Google Gemini API (`gemini-1.5-flash`, multimodal) via `@google/generative-ai`
- Deployed on Vercel
- No database — demo product data lives in `lib/demoProducts.ts`

## Architecture

```
app/
  page.tsx                 Main generator page (client component, holds all UI state)
  layout.tsx                Root layout, fonts, metadata
  globals.css                Tailwind entrypoint + small global rules
  api/generate/route.ts       Server-side API route — the only place that talks to Gemini
components/
  ImageUpload.tsx              Drag-and-drop + file picker + preview
  MarketingSettingsForm.tsx     Audience / tone / language / optional fields
  DemoProducts.tsx               Quick-select demo product cards
  AdResults.tsx                    Ad preview mockup + copyable result fields
  UsageIndicator.tsx                "Free generations: x / 3" pill
  UsageLimitModal.tsx                Upgrade modal shown at the limit
lib/
  types.ts        Shared TypeScript types + constants
  prompt.ts         Builds the Gemini prompt from marketing settings
  gemini.ts           Gemini client, request + response parsing/validation
  demoProducts.ts       Demo product data (see note below)
  usageLimit.ts           Client-side generation-count hook (localStorage)
  utils.ts                   File <-> base64 helpers, clipboard helper
```

The API key never reaches the browser: the frontend sends the image (base64) and settings to `POST /api/generate`, which runs server-side, calls Gemini, validates/normalizes the response, and returns clean JSON. Errors from Gemini are logged server-side and mapped to generic, user-safe messages.

## How the AI works

`lib/prompt.ts` builds a single instruction prompt from the marketing settings (audience, tone, language, product name, selling point) with explicit rules: focus on benefits, no invented stats/discounts/guarantees, no unsupported claims, output must be one JSON object with exactly `primaryText`, `headline`, `description`, `cta`. `lib/gemini.ts` sends that prompt plus the image to Gemini, then parses and validates the JSON response (including normalizing the CTA to one of the four allowed values), throwing typed errors the API route can map to safe messages.

## Demo products — action needed before submission

The brief requires 3 *real* products from Vigoshop.si. `lib/demoProducts.ts` ships with clearly-marked placeholder entries instead of invented product data (I didn't have confirmed product picks to use). To finish this:

1. Pick 3 real products from https://vigoshop.si
2. Save their photos into `public/demo-products/`
3. Replace the placeholder entries in `lib/demoProducts.ts` with the real name, image path, description, optional selling point, and product URL

Everything else in the app works today without this step — it only affects the 3 quick-select demo cards. Once real products are wired in, fill in `SAMPLE_OUTPUTS.md` with their actual generated output (don't fabricate it).

## Running locally

```bash
npm install
cp .env.example .env.local
# edit .env.local and set GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Server-side only. Never prefix with `NEXT_PUBLIC_`. Get one at https://aistudio.google.com/apikey |

`.env.local` is gitignored. `.env.example` documents the variable name without a real value.

## Deploying to Vercel

1. Push this repo to GitHub
2. Import the repo in Vercel
3. In Project Settings → Environment Variables, add `GEMINI_API_KEY`
4. Deploy — no other configuration needed

## How the 3-generation limit works

The MVP tracks generation count client-side in `localStorage` (`lib/usageLimit.ts`). Both a fresh "Generate" and a "Regenerate" count as one generation. At 3, the button is blocked and an upgrade modal appears instead of calling the API. This is intentionally simple for the assessment — see "Known limitations" below.

## Known limitations

- **Usage limit is client-side only.** It's stored in `localStorage`, so clearing browser storage resets it. A production version would enforce this server-side, tied to an authenticated account. This is called out again in `TECHNICAL_SPECIFICATION.md`.
- **No authentication, database, or payments** — intentionally out of scope for this MVP per the brief.
- **Demo products need real data** — see the section above.
- **No automated tests** — out of scope for an MVP assessment exercise; see "Potential Improvements" in `TECHNICAL_SPECIFICATION.md`.

## Other docs

- `USER_MANUAL.md` — how to use the app, end-user perspective
- `TECHNICAL_SPECIFICATION.md` — architecture, decisions, and what would change for production
- `SAMPLE_OUTPUTS.md` — generated outputs for the 3 demo products (fill in after wiring real products)
