// Risk Radar mark: an open hand reaching forward, offering support.
// Drawn on a 48x48 grid so it stays crisp from favicon size upwards.
export function HandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 9 48 32" className={className} fill="currentColor" aria-hidden>
      <rect x="2" y="21" width="6" height="18" rx="2" />
      <path d="M10 23.5c0-1.4 1.1-2.5 2.5-2.5H22v17.5H12.5c-1.4 0-2.5-1.1-2.5-2.5z" />
      <rect x="19" y="21" width="25" height="3.8" rx="1.9" />
      <rect x="19" y="25.7" width="23.5" height="3.8" rx="1.9" />
      <rect x="19" y="30.4" width="21" height="3.8" rx="1.9" />
      <rect x="19" y="35.1" width="17" height="3.4" rx="1.7" />
      <rect x="16" y="13" width="4.4" height="12" rx="2.2" transform="rotate(38 18.2 23)" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className="inline-flex items-center gap-2 text-brand" aria-label="Risk Radar">
      <HandMark className={lg ? "h-9 w-12" : "h-6 w-9"} />
      <span className={`font-bold uppercase leading-none tracking-[0.14em] ${lg ? "text-2xl" : "text-base"}`}>Risk Radar</span>
    </span>
  );
}
