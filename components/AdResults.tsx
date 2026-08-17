"use client";

import { useState } from "react";
import Image from "next/image";
import { AdCopyResult } from "@/lib/types";
import { copyToClipboard } from "@/lib/utils";

interface AdResultsProps {
  result: AdCopyResult;
  imagePreviewUrl: string;
  onRegenerate: () => void;
  onGenerateAnother: () => void;
  regenerating: boolean;
}
// Self-contained copy button using copyToClipboard() from lib/utils.ts and local copied state for temporary feedback.
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }
      }}
      className="focus-ring rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-light"
      aria-label={`Copy ${label}`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

// Reusable result row with a label, value, and CopyButtons(all four); AdResults also handles copy-all state and Facebook-style preview rendering.
function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{value}</p>
      </div>
      <CopyButton text={value} label={label} />
    </div>
  );
}

export function AdResults({
  result,
  imagePreviewUrl,
  onRegenerate,
  onGenerateAnother,
  regenerating,
}: AdResultsProps) {
  const allText = `${result.primaryText}\n\n${result.headline}\n${result.description}\n${result.cta}`;
  const [copiedAll, setCopiedAll] = useState(false);

  return (
    <div className="animate-fadeUp space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Live ad preview mockup — the signature element: the output is shown
            the way it will actually appear as a Facebook ad, not as a plain
            text card. */}
        <div className="overflow-hidden rounded-xl2 border border-line bg-white shadow-card">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-neutral-200" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">Your Page</p>
              <p className="text-xs text-neutral-500">Sponsored</p>
            </div>
          </div>
          <p className="whitespace-pre-line px-4 py-3 text-sm text-neutral-900">{result.primaryText}</p>
          <div className="relative aspect-square w-full bg-neutral-100">
            <Image src={imagePreviewUrl} alt="Product" fill className="object-contain p-6" unoptimized />
          </div>
          <div className="flex items-center justify-between gap-3 bg-neutral-50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-wide text-neutral-500">yoursite.com</p>
              <p className="truncate text-sm font-semibold text-neutral-900">{result.headline}</p>
              <p className="truncate text-xs text-neutral-500">{result.description}</p>
            </div>
            <span className="shrink-0 rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white">
              {result.cta}
            </span>
          </div>
        </div>

        {/* Structured, individually-copyable fields */}
        <div className="rounded-xl2 border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">Your ad copy</h2>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(allText);
                if (ok) {
                  setCopiedAll(true);
                  setTimeout(() => setCopiedAll(false), 1500);
                }
              }}
              className="focus-ring rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand/40"
            >
              {copiedAll ? "Copied ✓" : "Copy all"}
            </button>
          </div>
          <div className="divide-y divide-line">
            <Row label="Primary text" value={result.primaryText} />
            <Row label="Headline" value={result.headline} />
            <Row label="Description" value={result.description} />
            <Row label="Call to action" value={result.cta} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-card transition-colors hover:border-brand/40 disabled:opacity-50"
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
        <button
          type="button"
          onClick={onGenerateAnother}
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-pop transition-transform hover:-translate-y-0.5"
        >
          Generate another ad
        </button>
      </div>
    </div>
  );
}
