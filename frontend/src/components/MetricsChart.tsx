import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TestRun } from '../api/client';

interface MetricsChartProps {
  runs: TestRun[];
}

export function MetricsChart({ runs }: MetricsChartProps) {
  const completed = [...runs]
    .filter((r) => r.status === 'completed' && (r.lcp_ms !== null || r.fcp_ms !== null || r.ttfb_ms !== null))
    .reverse()
    .map((r) => ({
      label: new Date(r.created_at + 'Z').toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      LCP: r.lcp_ms !== null ? Math.round(r.lcp_ms) : null,
      FCP: r.fcp_ms !== null ? Math.round(r.fcp_ms) : null,
      SpeedIndex: r.speed_index_ms !== null ? Math.round(r.speed_index_ms) : null,
      TTFB: r.ttfb_ms !== null ? Math.round(r.ttfb_ms) : null,
    }));

  if (completed.length === 0) {
    return (
      <div className="print-card flex h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-sm text-slate-400">
        Nog geen voltooide metingen met timing-metrics om weer te geven.
      </div>
    );
  }

  return (
    <div className="print-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">
        Historische Snelheidstrend (ms — lager is beter)
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={completed} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={11} unit="ms" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="LCP" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="FCP" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="SpeedIndex" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="TTFB" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
