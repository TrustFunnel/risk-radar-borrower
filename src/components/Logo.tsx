// Risk Radar mark: a speech bubble holding an open hand reaching forward,
// "we're here to talk and to help". Gold on dark.
export function BubbleMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="6 6 88 88" className={className} aria-hidden>
      <path d="M39.7 79.8A36 36 0 1 0 20.8 64L10 88Z" fill="none" stroke="#f0b90b" strokeWidth="4.5" strokeLinejoin="round" />
      <g fill="#f0b90b" transform="translate(28.2 21.8) scale(.95)">
        <rect x="2" y="21" width="6" height="18" rx="2" />
        <path d="M10 23.5c0-1.4 1.1-2.5 2.5-2.5H22v17.5H12.5c-1.4 0-2.5-1.1-2.5-2.5z" />
        <rect x="19" y="21" width="25" height="3.8" rx="1.9" />
        <rect x="19" y="25.7" width="23.5" height="3.8" rx="1.9" />
        <rect x="19" y="30.4" width="21" height="3.8" rx="1.9" />
        <rect x="19" y="35.1" width="17" height="3.4" rx="1.7" />
        <rect x="16" y="13" width="4.4" height="12" rx="2.2" transform="rotate(38 18.2 23)" />
      </g>
    </svg>
  );
}

export const TAGLINE = "Personal Debt Management";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={`Risk Radar, ${TAGLINE}`}>
      <BubbleMark className={lg ? "h-12 w-12" : "h-9 w-9"} />
      <span className="flex flex-col">
        <span className={`font-bold uppercase leading-none tracking-[0.08em] text-brand ${lg ? "text-2xl" : "text-lg"}`}>Risk Radar</span>
        <span className={`mt-1 uppercase leading-none tracking-[0.22em] text-[#c99a08] ${lg ? "text-[11px]" : "text-[8.5px]"}`}>{TAGLINE}</span>
      </span>
    </span>
  );
}
