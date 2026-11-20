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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Metingen Vergelijken</h2>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
              <span>#{older.id} ({new Date(older.created_at + 'Z').toLocaleDateString('nl-NL')})</span>
              <ArrowRight className="h-3 w-3" />
              <span>#{newer.id} ({new Date(newer.created_at + 'Z').toLocaleDateString('nl-NL')})</span>
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
              <tr>
                <th className="pb-2.5 font-medium">Metric</th>
                <th className="pb-2.5 font-medium">Baseline (#{older.id})</th>
                <th className="pb-2.5 font-medium">Nieuw (#{newer.id})</th>
                <th className="pb-2.5 text-right font-medium">Verschil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {rows.map((r) => {
                let diffText = '—';
                let diffColor = 'text-zinc-500';
                if (r.valA !== null && r.valB !== null) {
                  const delta = r.valB - r.valA;
                  const pct = r.valA !== 0 ? Math.round((delta / r.valA) * 100) : 0;
                  const sign = delta > 0 ? '+' : '';
                  const formattedDelta =
                    r.decimals && r.decimals > 0 ? delta.toFixed(r.decimals) : Math.round(delta);
                  diffText = `${sign}${formattedDelta}${r.unit} (${sign}${pct}%)`;
                  if (delta !== 0) {
                    const improved = r.lowerIsBetter ? delta < 0 : delta > 0;
                    diffColor = improved ? 'text-emerald-400' : 'text-rose-400';
                  }
                }
                return (
                  <tr key={r.label}>
                    <td className="py-2.5 font-medium text-zinc-200">{r.label}</td>
                    <td className="py-2.5 font-mono text-xs tabular-nums text-zinc-400">
                      {fmt(r.valA, r.unit, r.decimals)}
                    </td>
                    <td className="py-2.5 font-mono text-xs tabular-nums text-zinc-100">
                      {fmt(r.valB, r.unit, r.decimals)}
                    </td>
                    <td className={`py-2.5 text-right font-mono text-xs font-semibold tabular-nums ${diffColor}`}>
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
