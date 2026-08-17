"use client";

import { GenerationHistoryEntry } from "@/lib/types";
import { formatRelativeTime } from "@/lib/history";

interface HistoryEntryModalProps {
  entry: GenerationHistoryEntry | null;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink">{value}</p>
    </div>
  );
}

export function HistoryEntryModal({ entry, onClose }: HistoryEntryModalProps) {
  if (!entry) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-entry-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl2 bg-surface p-6 shadow-pop"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="history-entry-title" className="font-display text-lg font-semibold text-ink">
              {entry.productName}
            </h3>
            <p className="mt-0.5 text-xs text-muted">{formatRelativeTime(entry.timestamp)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring rounded-md p-1 text-muted hover:bg-paper"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          The original image isn&rsquo;t saved with history — this shows the generated text only.
        </p>

        <div className="mt-2 divide-y divide-line">
          <Field label="Primary text" value={entry.primaryText} />
          <Field label="Headline" value={entry.headline} />
          <Field label="Description" value={entry.description} />
          <Field label="Call to action" value={entry.cta} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="focus-ring mt-4 w-full rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand/40"
        >
          Close
        </button>
      </div>
    </div>
  );
}