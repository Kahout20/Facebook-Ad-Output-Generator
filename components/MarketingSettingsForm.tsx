"use client";

import { MarketingSettings, Tone } from "@/lib/types";

interface MarketingSettingsFormProps {
  settings: MarketingSettings;
  onChange: (next: MarketingSettings) => void;
}

const TONE_OPTIONS: { value: Tone; label: string }[] = [
  { value: "persuasive", label: "Persuasive" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent", label: "Urgent" },
  { value: "premium", label: "Premium" },
];

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {optional && (
          <span className="text-xs text-muted">Optional · helps the AI be more accurate</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputClasses =
  "focus-ring w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70";

const pillBase =
  "focus-ring cursor-pointer select-none rounded-full border px-4 py-2 text-sm font-medium transition-colors";

export function MarketingSettingsForm({ settings, onChange }: MarketingSettingsFormProps) {
  const set = <K extends keyof MarketingSettings>(key: K, value: MarketingSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="animate-fadeUp space-y-6 rounded-xl2 border border-line bg-surface p-5 shadow-card sm:p-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Marketing settings</h2>
        <p className="mt-1 text-sm text-muted">
          Tell us a bit more so the AI can tailor the copy. Everything here is optional except the tone and language.
        </p>
      </div>

      <Field label="Target audience">
        <div className="flex flex-wrap gap-2">
          {(["auto", "custom"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set("targetAudienceMode", mode)}
              className={`${pillBase} ${
                settings.targetAudienceMode === mode
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink hover:border-brand/40"
              }`}
              aria-pressed={settings.targetAudienceMode === mode}
            >
              {mode === "auto" ? "Auto" : "Custom"}
            </button>
          ))}
        </div>
        {settings.targetAudienceMode === "custom" && (
          <input
            type="text"
            value={settings.customAudience}
            onChange={(e) => set("customAudience", e.target.value)}
            placeholder="Describe your target audience..."
            className={`${inputClasses} mt-3`}
          />
        )}
      </Field>

      <Field label="Tone">
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("tone", opt.value)}
              className={`${pillBase} ${
                settings.tone === opt.value
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-paper text-ink hover:border-brand/40"
              }`}
              aria-pressed={settings.tone === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Language">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => set("language", "sl")}
            className={`${pillBase} ${
              settings.language === "sl"
                ? "border-brand bg-brand text-white"
                : "border-line bg-paper text-ink hover:border-brand/40"
            }`}
            aria-pressed={settings.language === "sl"}
          >
            Slovenian
          </button>
          <button
            type="button"
            onClick={() => set("language", "en")}
            className={`${pillBase} ${
              settings.language === "en"
                ? "border-brand bg-brand text-white"
                : "border-line bg-paper text-ink hover:border-brand/40"
            }`}
            aria-pressed={settings.language === "en"}
          >
            English
          </button>
        </div>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Product name" optional>
          <input
            type="text"
            value={settings.productName}
            onChange={(e) => set("productName", e.target.value)}
            placeholder="e.g. AeroGlide Hair Dryer"
            className={inputClasses}
          />
        </Field>
        <Field label="Key selling point" optional>
          <input
            type="text"
            value={settings.keySellingPoint}
            onChange={(e) => set("keySellingPoint", e.target.value)}
            placeholder="e.g. Dries hair 2x faster"
            className={inputClasses}
          />
        </Field>
      </div>
    </div>
  );
}
