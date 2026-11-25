import { kes } from "@/lib/finance";
import type { PlainStatus } from "@/lib/oneplan";
import { AlertIcon, CheckCircle, ClockIcon } from "./Icons";
import { IconTile } from "./ui";

const LOOK: Record<PlainStatus, { tone: "good" | "warn" | "bad"; icon: typeof CheckCircle; text: string }> = {
  "On track": { tone: "good", icon: CheckCircle, text: "text-good" },
  Stretched: { tone: "warn", icon: ClockIcon, text: "text-warn" },
  Behind: { tone: "bad", icon: AlertIcon, text: "text-bad" },
};

// A plain status instead of a score: the score has not been tested on real
// outcomes, so it must not look like a prediction (strategy doc, section 7).
export function StatusCard({ s, owed, loans }: { s: { status: PlainStatus; why: string }; owed: number; loans: number }) {
  const l = LOOK[s.status];
  return (
    <section className="card flex items-center gap-4">
      <IconTile icon={l.icon} tone={l.tone} size="lg" />
      <div className="min-w-0 flex-1">
        <p className={`text-xl font-bold leading-tight ${l.text}`}>{s.status}</p>
        <p className="mt-0.5 text-sm text-muted">{s.why}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-lg font-bold">{kes(owed)}</p>
        <p className="text-xs text-muted">{loans} loan{loans === 1 ? "" : "s"}</p>
      </div>
    </section>
  );
}
