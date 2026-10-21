import type { HealthResult } from "@/lib/finance";

const tone: Record<HealthResult["band"], string> = {
  Healthy: "text-good",
  Watch: "text-warn",
  "At risk": "text-warn",
  Distressed: "text-bad",
};

export function HealthCard({ h }: { h: HealthResult }) {
  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted">Loan health</h2>
        <span className="text-xs text-muted">Debt-to-income {h.debtToIncome.toFixed(0)}%</span>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`num text-4xl font-bold ${tone[h.band]}`}>{h.score}</span>
        <span className={`font-semibold ${tone[h.band]}`}>{h.band}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${h.score}%` }} />
      </div>
      {h.signals.length ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {h.signals.map((s) => <li key={s} className="flex gap-2"><span className="text-warn">•</span>{s}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No warning signs. Keep paying on time.</p>
      )}
    </section>
  );
}
