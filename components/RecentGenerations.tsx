"use client";

import { useState } from "react";
import { GenerationHistoryEntry } from "@/lib/types";
import { formatRelativeTime } from "@/lib/history";

interface RecentGenerationsProps {
  entries: GenerationHistoryEntry[];
  hydrated: boolean;
  onView: (entry: GenerationHistoryEntry) => void;
  onClear: () => void;
}
// Renders generation history, handles clear-history confirmation, and uses formatRelativeTime() from lib/history.ts for timestamps.
export function RecentGenerations({ entries, hydrated, onView, onClear }: RecentGenerationsProps) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  if (!hydrated) return null;

  return (
    <section className="rounded-xl2 border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-base font-semibold text-ink">Recent Generations</h2>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">Your recently generated ads.</p>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="focus-ring shrink-0 rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted hover:text-danger"
          >
            Clear history
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No generations yet. Your generated ads will appear here.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-line p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0 text-brand">
                    <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
                  </svg>
                  <span className="truncate">{entry.productName}</span>
                </div>
                <span className="shrink-0 text-xs text-muted">{formatRelativeTime(entry.timestamp)}</span>
              </div>
              <p className="mt-2 font-display text-base font-bold text-ink">{entry.headline}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{entry.primaryText}</p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => onView(entry)}
                  className="focus-ring rounded-md border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-light"
                >
                  View
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmingClear && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
          onClick={() => setConfirmingClear(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl2 bg-surface p-6 shadow-pop"
          >
            <h3 className="font-display text-base font-semibold text-ink">Clear all history?</h3>
            <p className="mt-2 text-sm text-muted">
              This removes all recent generations from this browser. This can&rsquo;t be undone.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setConfirmingClear(false);
                }}
                className="focus-ring flex-1 rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white"
              >
                Clear history
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="focus-ring flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand/40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}