import { kes } from "@/lib/finance";
import type { PlainStatus } from "@/lib/oneplan";

const tone: Record<PlainStatus, string> = { "On track": "text-good", Stretched: "text-warn", Behind: "text-bad" };

// A plain status instead of a score: the score has not been tested on real
// outcomes, so it must not look like a prediction (strategy doc, section 7).
export function StatusCard({ s, owed, loans }: { s: { status: PlainStatus; why: string }; owed: number; loans: number }) {
  return (
    <section className="card">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-xl font-bold ${tone[s.status]}`}>{s.status}</span>
        <span className="num text-sm text-muted">{kes(owed)} across {loans} loan{loans === 1 ? "" : "s"}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{s.why}</p>
    </section>
  );
}
