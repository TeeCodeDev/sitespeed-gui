import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { api, type SharedReportPayload } from '../api/client';
import { MetricsChart } from '../components/MetricsChart';
import { getBrandingSettings } from './SettingsPage';

export function SharedReportPage({ token }: { token: string }) {
  const [report, setReport] = useState<SharedReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const branding = getBrandingSettings();

  useEffect(() => {
    api
      .getSharedReport(token)
      .then((res) => setReport(res.report))
      .catch((err) => setError(err instanceof Error ? err.message : 'Rapport niet gevonden'));
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!report) {
    return <div className="p-8 text-center text-slate-500">Rapport laden...</div>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {branding.companyName}
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{report.title}</h1>
          <p className="text-sm text-slate-500">
            Klant: {report.clientName} · {report.runs.length} metingen
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Printer className="h-4 w-4" />
          Print / Opslaan als PDF
        </button>
      </div>

      <MetricsChart runs={report.runs} />

      <div className="print-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">LCP</th>
              <th className="px-4 py-3">FCP</th>
              <th className="px-4 py-3">CLS</th>
              <th className="px-4 py-3">TTFB</th>
              <th className="px-4 py-3">Datum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.runs.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs text-slate-800">{r.url}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-800">
                  {r.lcp_ms !== null ? `${Math.round(r.lcp_ms)} ms` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {r.fcp_ms !== null ? `${Math.round(r.fcp_ms)} ms` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {r.cls !== null ? r.cls.toFixed(3) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {r.ttfb_ms !== null ? `${Math.round(r.ttfb_ms)} ms` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(r.created_at + 'Z').toLocaleDateString('nl-NL')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
