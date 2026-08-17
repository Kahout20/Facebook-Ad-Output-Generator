# Sample Outputs

This file is meant to hold real, generated Facebook ad copy for the 3 Vigoshop.si demo products, as evidence the tool actually works end-to-end.

**Not filled in yet, on purpose.** `lib/demoProducts.ts` currently ships with placeholder product entries rather than invented Vigoshop data (see `README.md`). Per the brief, these outputs should not be fabricated before the real tool has actually been run against real products.

## How to fill this in

1. Complete the demo product data in `lib/demoProducts.ts` (real name, image, description, URL) for all 3 products
2. Run the app locally with a real `GEMINI_API_KEY`
3. For each of the 3 products, select it from the demo cards and click **Generate Facebook Ad**
4. Paste the actual output below, in this format:

```md
## Product 1 — <real product name>
Source: <vigoshop.si product URL>
Settings used: audience=Auto, tone=Persuasive, language=English

**Primary text:** <paste generated text>
**Headline:** <paste generated text>
**Description:** <paste generated text>
**CTA:** <paste generated text>
```

Repeat for products 2 and 3. Feel free to include more than one settings combination (e.g. one Slovenian, one English) if useful for the review.
