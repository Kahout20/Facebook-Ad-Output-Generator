export function SiteNav() {
  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-brand" aria-hidden="true">
            <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z" />
          </svg>
          AdStudio AI
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1 text-xs font-semibold text-brand">
          Powered by Gemini
        </span>
      </div>
    </nav>
  );
}