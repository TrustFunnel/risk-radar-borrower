// Line icons: one family, 24x24 grid, 1.8 stroke, round caps. No emoji anywhere.
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

export const ChevronRight = ({ className }: P) => <svg {...base(className)}><path d="m9 6 6 6-6 6" /></svg>;
export const ChevronDown = ({ className }: P) => <svg {...base(className)}><path d="m6 9 6 6 6-6" /></svg>;
export const ArrowLeft = ({ className }: P) => <svg {...base(className)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const ArrowRight = ({ className }: P) => <svg {...base(className)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const CheckIcon = ({ className }: P) => <svg {...base(className)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const CheckCircle = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 3 3 5-6" /></svg>;
export const CloseIcon = ({ className }: P) => <svg {...base(className)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const AlertIcon = ({ className }: P) => <svg {...base(className)}><path d="M10.3 4.1 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" /><path d="M12 9.5v4M12 17h.01" /></svg>;
export const InfoIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
export const DocIcon = ({ className }: P) => <svg {...base(className)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>;
export const ShieldIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>;
export const PhoneIcon = ({ className }: P) => <svg {...base(className)}><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>;
export const MessageIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z" /><path d="M8 10h8M8 13h5" /></svg>;
export const ChatIcon = ({ className }: P) => <svg {...base(className)}><path d="M20.5 11.6a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1.3-4.4A8.5 8.5 0 1 1 20.5 11.6z" /><path d="M8.6 9.2c.3 2.6 2.4 4.9 5.1 5.4l1-1.3 1.9.8c-.2 1.2-1.2 2-2.4 1.8-3.4-.6-6.2-3.3-6.8-6.8-.2-1.2.6-2.2 1.8-2.4l.8 1.9z" /></svg>;
export const BankIcon = ({ className }: P) => <svg {...base(className)}><path d="M3 9.5 12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18" /></svg>;
export const CalendarIcon = ({ className }: P) => <svg {...base(className)}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const ClockIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const PauseIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></svg>;
export const SparkleIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>;
export const UploadIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>;
export const DownloadIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 4v12M7 11l5 5 5-5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></svg>;
export const TrashIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const LogoutIcon = ({ className }: P) => <svg {...base(className)}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></svg>;
export const EditIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>;
export const BriefcaseIcon = ({ className }: P) => <svg {...base(className)}><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>;
export const CoinsIcon = ({ className }: P) => <svg {...base(className)}><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3" /></svg>;
export const TrendDownIcon = ({ className }: P) => <svg {...base(className)}><path d="m3 7 6 6 4-4 8 8" /><path d="M21 11v6h-6" /></svg>;
export const LockIcon = ({ className }: P) => <svg {...base(className)}><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>;
export const GradIcon = ({ className }: P) => <svg {...base(className)}><path d="M2.5 9 12 4.5 21.5 9 12 13.5z" /><path d="M6.5 11v5c1.5 1.6 3.4 2.5 5.5 2.5s4-.9 5.5-2.5v-5M21.5 9v5" /></svg>;
export const BoltIcon = ({ className }: P) => <svg {...base(className)}><path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12z" /></svg>;
export const ScaleIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 4v16M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></svg>;
export const SunIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>;
export const MoonIcon = ({ className }: P) => <svg {...base(className)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>;
export const SearchIcon = ({ className }: P) => <svg {...base(className)}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
export const HandIcon = ({ className }: P) => <svg {...base(className)}><path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 10.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.6-2.2L4 15.3a1.6 1.6 0 0 1 2.4-2l.6.7V11" /></svg>;
export const ListIcon = ({ className }: P) => <svg {...base(className)}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></svg>;
export const SendIcon = ({ className }: P) => <svg {...base(className)}><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z" /></svg>;
export const SettingsIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>;
