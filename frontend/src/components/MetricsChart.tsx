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
      <div className="print-card flex h-56 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-500">
        Nog geen voltooide metingen met timing-metrics om weer te geven.
      </div>
    );
  }

  return (
    <div className="print-card rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
        Snelheidstrend (ms — lager is beter)
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={completed} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} unit="ms" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#09090b',
                borderColor: '#27272a',
                borderRadius: '6px',
                color: '#f4f4f5',
                fontSize: '12px',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="LCP" stroke="#10b981" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
            <Line type="monotone" dataKey="FCP" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
            <Line type="monotone" dataKey="SpeedIndex" stroke="#a855f7" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
            <Line type="monotone" dataKey="TTFB" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
