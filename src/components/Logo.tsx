import { useId } from "react";

// Risk Radar mark: a speech bubble holding a person flanked by two others,
// "we're here to talk and to help". Gold tones on dark.
export function BubbleMark({ className = "h-8 w-8" }: { className?: string }) {
  const clip = useId();
  const body = "M45 46Q52 40 59 46L66 64Q52 67.5 38 64Z";
  return (
    <svg viewBox="6 6 88 88" className={className} aria-hidden>
      <defs><clipPath id={clip}><circle cx="52" cy="40" r="8.5" /></clipPath></defs>
      <path d="M39.7 79.8A36 36 0 1 0 20.8 64L10 88Z" fill="none" stroke="#f0b90b" strokeWidth="4.5" strokeLinejoin="round" />
      <circle cx="33" cy="41" r="6" fill="#c99a08" />
      <circle cx="71" cy="41" r="6" fill="#c99a08" />
      <circle cx="52" cy="40" r="8.5" fill="#f0b90b" />
      <path d={body} fill="#fcd535" />
      <path d={body} fill="#a87d05" clipPath={`url(#${clip})`} />
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
