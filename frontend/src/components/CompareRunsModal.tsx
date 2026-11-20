import { ArrowRight, X } from 'lucide-react';
import type { TestRun } from '../api/client';

interface CompareRunsModalProps {
  runA: TestRun;
  runB: TestRun;
  onClose: () => void;
}

interface CompareRow {
  label: string;
  valA: number | null;
  valB: number | null;
  unit: string;
  lowerIsBetter: boolean;
  decimals?: number;
}

export function CompareRunsModal({ runA, runB, onClose }: CompareRunsModalProps) {
  // Ensure chronological order: older = Baseline (A), newer = Current (B)
  const [older, newer] = runA.id <= runB.id ? [runA, runB] : [runB, runA];

  const rows: CompareRow[] = [
    { label: 'LCP', valA: older.lcp_ms, valB: newer.lcp_ms, unit: ' ms', lowerIsBetter: true },
    { label: 'FCP', valA: older.fcp_ms, valB: newer.fcp_ms, unit: ' ms', lowerIsBetter: true },
    { label: 'CLS', valA: older.cls, valB: newer.cls, unit: '', lowerIsBetter: true, decimals: 3 },
    { label: 'TBT', valA: older.tbt_ms, valB: newer.tbt_ms, unit: ' ms', lowerIsBetter: true },
    { label: 'TTFB', valA: older.ttfb_ms, valB: newer.ttfb_ms, unit: ' ms', lowerIsBetter: true },
    { label: 'Speed Index', valA: older.speed_index_ms, valB: newer.speed_index_ms, unit: ' ms', lowerIsBetter: true },
    {
      label: 'Paginagrootte',
      valA: older.page_size_bytes !== null ? Math.round(older.page_size_bytes / 1024) : null,
      valB: newer.page_size_bytes !== null ? Math.round(newer.page_size_bytes / 1024) : null,
      unit: ' KB',
      lowerIsBetter: true,
    },
    { label: 'Requests', valA: older.requests_count, valB: newer.requests_count, unit: '', lowerIsBetter: true },
    { label: 'Coach Score', valA: older.coach_score, valB: newer.coach_score, unit: '/100', lowerIsBetter: false },
  ];

  const fmt = (val: number | null, unit: string, decimals = 0) => {
    if (val === null) return '—';
    return `${decimals > 0 ? val.toFixed(decimals) : Math.round(val)}${unit}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Metingen Vergelijken</h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
              <span>#{older.id} ({new Date(older.created_at + 'Z').toLocaleDateString('nl-NL')})</span>
              <ArrowRight className="h-3 w-3" />
              <span>#{newer.id} ({new Date(newer.created_at + 'Z').toLocaleDateString('nl-NL')})</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="pb-2.5 font-semibold">Metric</th>
                <th className="pb-2.5 font-semibold">Baseline (#{older.id})</th>
                <th className="pb-2.5 font-semibold">Nieuw (#{newer.id})</th>
                <th className="pb-2.5 text-right font-semibold">Verschil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                let diffText = '—';
                let diffColor = 'text-slate-400';
                if (r.valA !== null && r.valB !== null) {
                  const delta = r.valB - r.valA;
                  const pct = r.valA !== 0 ? Math.round((delta / r.valA) * 100) : 0;
                  const sign = delta > 0 ? '+' : '';
                  const formattedDelta =
                    r.decimals && r.decimals > 0 ? delta.toFixed(decimalsOrZero(r.decimals)) : Math.round(delta);
                  diffText = `${sign}${formattedDelta}${r.unit} (${sign}${pct}%)`;
                  if (delta !== 0) {
                    const improved = r.lowerIsBetter ? delta < 0 : delta > 0;
                    diffColor = improved ? 'text-emerald-600' : 'text-rose-600';
                  }
                }
                return (
                  <tr key={r.label}>
                    <td className="py-3 font-medium text-slate-800">{r.label}</td>
                    <td className="py-3 font-mono text-xs tabular-nums text-slate-500">
                      {fmt(r.valA, r.unit, r.decimals)}
                    </td>
                    <td className="py-3 font-mono text-xs font-semibold tabular-nums text-slate-900">
                      {fmt(r.valB, r.unit, r.decimals)}
                    </td>
                    <td className={`py-3 text-right font-mono text-xs font-semibold tabular-nums ${diffColor}`}>
                      {diffText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function decimalsOrZero(d: number): number {
  return d;
}
