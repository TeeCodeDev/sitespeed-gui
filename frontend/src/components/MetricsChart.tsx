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
      <div className="print-card flex h-56 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 shadow-xs">
        Nog geen voltooide metingen met timing-metrics om weer te geven.
      </div>
    );
  }

  return (
    <div className="print-card rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">
        Snelheidstrend over tijd (ms — lager is beter)
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={completed} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} unit="ms" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="LCP" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
            <Line type="monotone" dataKey="FCP" stroke="#059669" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
            <Line type="monotone" dataKey="SpeedIndex" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
            <Line type="monotone" dataKey="TTFB" stroke="#d97706" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
