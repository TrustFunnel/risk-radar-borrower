// Line icons for navigation and quick actions. 24x24 grid, 1.8 stroke.
type P = { className?: string };
const base = (className = "h-5 w-5") => ({
  className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
});

export const HomeIcon = ({ className }: P) => <svg {...base(className)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></svg>;
export const WalletIcon = ({ className }: P) => <svg {...base(className)}><rect x="3" y="6" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><path d="M16 15h2" /><path d="M6 6V5a2 2 0 0 1 2-2h8" /></svg>;
export const PlanIcon = ({ className }: P) => <svg {...base(className)}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /><path d="m9 15 2 2 4-4" /></svg>;
export const CompareIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
export const HelpIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="m5.6 5.6 3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" /></svg>;
export const UserIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const PlusIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 5v14M5 12h14" /></svg>;
export const HeartIcon = ({ className }: P) => <svg {...base(className)} fill="currentColor" stroke="none"><path d="M12 21s-7.5-4.6-9.6-9.4C.9 8 3.1 4 7 4c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.9 0 6.1 4 4.6 7.6C19.5 16.4 12 21 12 21z" /></svg>;
