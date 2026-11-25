"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_KEY } from "@/lib/theme";
import { ArrowLeft, ChevronRight, InfoIcon, MoonIcon, SunIcon } from "./Icons";

// Shared building blocks of the Afueni design system. Every screen uses these
// so the app reads as one product: icon first, short words, details on demand.

type IconType = (p: { className?: string }) => React.ReactNode;
export type Tone = "gold" | "good" | "warn" | "bad" | "plain";
const TILE: Record<Tone, string> = { gold: "tile", good: "tile tile-good", warn: "tile tile-warn", bad: "tile tile-bad", plain: "tile tile-plain" };

export function IconTile({ icon: Icon, tone = "gold", size = "md" }: { icon: IconType; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "!h-9 !w-9 !rounded-xl" : size === "lg" ? "!h-14 !w-14 !rounded-2xl" : "";
  return <span className={`${TILE[tone]} ${s}`}><Icon className={size === "lg" ? "h-7 w-7" : size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]"} /></span>;
}

export function PageHeader({ title, sub, back, action, icon }: {
  title: React.ReactNode; sub?: React.ReactNode; back?: { href: string; label: string }; action?: React.ReactNode; icon?: IconType;
}) {
  return (
    <header className="space-y-3 pt-1">
      {back ? (
        <Link href={back.href} className="inline-flex items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-semibold text-brand hover:opacity-80">
          <ArrowLeft className="h-4 w-4" />{back.label}
        </Link>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon ? <IconTile icon={icon} /> : null}
          <div className="min-w-0">
            <h1 className="text-[1.625rem] font-bold leading-tight md:text-3xl">{title}</h1>
            {sub ? <p className="mt-1 text-[0.9375rem] text-muted">{sub}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

// A tappable row: icon tile, a short title, one line below, and a chevron.
export function RowLink({ href, icon, tone = "gold", title, sub, trailing, className = "" }: {
  href: string; icon: IconType; tone?: Tone; title: React.ReactNode; sub?: React.ReactNode; trailing?: React.ReactNode; className?: string;
}) {
  return (
    <Link href={href} className={`card flex items-center gap-3.5 !p-3.5 ${className}`}>
      <IconTile icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug">{title}</span>
        {sub ? <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted">{sub}</span> : null}
      </span>
      {trailing ?? <ChevronRight className="h-5 w-5 shrink-0 text-muted" />}
    </Link>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string; icon?: IconType }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.icon ? <o.icon className="h-4 w-4" /> : null}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={onChange} />;
}

// Extra words, hidden until asked for. Keeps screens short for people who
// read slowly, without losing any explanation.
export function More({ children, label = "Why?", className = "" }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <details className={`group text-sm ${className}`}>
      <summary className="inline-flex items-center gap-1.5 rounded-full py-1 text-[0.8125rem] font-semibold text-brand">
        <InfoIcon className="h-4 w-4" />{label}
      </summary>
      <div className="mt-2 space-y-2 text-[0.8125rem] leading-relaxed text-muted">{children}</div>
    </details>
  );
}

export function Stat({ label, value, tone, sub, icon }: { label: string; value: React.ReactNode; tone?: "good" | "warn" | "bad" | "gold"; sub?: React.ReactNode; icon?: IconType }) {
  const color = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "gold" ? "text-brand" : "";
  const Icon = icon;
  return (
    <div className="card !p-4">
      <p className="eyebrow flex items-center gap-1.5">{Icon ? <Icon className="h-4 w-4" /> : null}{label}</p>
      <p className={`num mt-1 text-xl font-bold tracking-tight ${color}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function Notice({ tone, icon: Icon, title, children }: { tone: "good" | "warn" | "bad"; icon: IconType; title?: React.ReactNode; children?: React.ReactNode }) {
  const color = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : "text-bad";
  return (
    <div className={`alert alert-${tone}`} role={tone === "bad" ? "alert" : undefined}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
      <div className="min-w-0 space-y-1">
        {title ? <p className={`font-semibold ${color}`}>{title}</p> : null}
        {children ? <div className="text-foreground/80">{children}</div> : null}
      </div>
    </div>
  );
}

export function StepTitle({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-on-gold shadow-[inset_0_1px_0_rgba(255,255,255,.6)]">{n}</span>
      <div>
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
        {sub ? <p className="text-[0.8125rem] text-muted">{sub}</p> : null}
      </div>
    </div>
  );
}

export function Meter({ pct, label }: { pct: number; label?: string }) {
  return (
    <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label ?? "Progress"}>
      <span style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

// ---------- Light / dark ----------

export function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark">(DEFAULT_THEME);
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"); }, []);
  function pick(t: "light" | "dark") {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ }
  }
  return <Segmented label="Look" value={theme} onChange={pick} options={[{ value: "light", label: "Light", icon: SunIcon }, { value: "dark", label: "Dark", icon: MoonIcon }]} />;
}
