import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Plus,
  Printer,
  RefreshCw,
  Share2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api, type Client, type Project, type TestRun } from '../api/client';
import { MetricsChart } from '../components/MetricsChart';
import { NewTestModal } from '../components/NewTestModal';
import { RunDetailModal } from '../components/RunDetailModal';

interface DashboardPageProps {
  clients: Client[];
  projects: Project[];
  runs: TestRun[];
  onRefresh: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  running: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  cancelled: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export function DashboardPage({ clients, projects, runs, onRefresh }: DashboardPageProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showNewTest, setShowNewTest] = useState(false);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of runs) {
      try {
        (JSON.parse(r.tags) as string[]).forEach((t) => set.add(t));
      } catch {
        // ignore
      }
    }
    return [...set].sort();
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (selectedClientId && r.client_id !== Number(selectedClientId)) return false;
      if (selectedTag) {
        try {
          const tags = JSON.parse(r.tags) as string[];
          if (!tags.includes(selectedTag)) return false;
        } catch {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        if (!r.url.toLowerCase().includes(q) && !r.client_name.toLowerCase().includes(q)) return false;
      }
      if (fromDate && r.created_at < fromDate) return false;
      if (toDate && r.created_at > toDate + ' 23:59:59') return false;
      return true;
    });
  }, [runs, selectedClientId, selectedTag, search, fromDate, toDate]);

  const summary = useMemo(() => {
    const completed = filteredRuns.filter((r) => r.status === 'completed');
    const avg = (vals: (number | null)[]) => {
      const valid = vals.filter((v): v is number => v !== null);
      if (valid.length === 0) return null;
      return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
    };
    return {
      total: filteredRuns.length,
      completed: completed.length,
      avgLcp: avg(completed.map((r) => r.lcp_ms)),
      avgFcp: avg(completed.map((r) => r.fcp_ms)),
      avgTtfb: avg(completed.map((r) => r.ttfb_ms)),
    };
  }, [filteredRuns]);

  const handleExportCsv = () => {
    const headers = ['ID', 'Klant', 'URL', 'Status', 'Browser', 'LCP_ms', 'FCP_ms', 'CLS', 'TBT_ms', 'TTFB_ms', 'SpeedIndex_ms', 'Datum'];
    const rows = filteredRuns.map((r) => [
      r.id,
      `"${r.client_name.replace(/"/g, '""')}"`,
      `"${r.url.replace(/"/g, '""')}"`,
      r.status,
      r.browser,
      r.lcp_ms ?? '',
      r.fcp_ms ?? '',
      r.cls ?? '',
      r.tbt_ms ?? '',
      r.ttfb_ms ?? '',
      r.speed_index_ms ?? '',
      r.created_at,
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sitespeed-rapport-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateShareLink = async () => {
    if (!selectedClientId) {
      alert('Selecteer eerst een klant in het filter om een deelbare klantlink te maken.');
      return;
    }
    const client = clients.find((c) => c.id === Number(selectedClientId));
    const res = await api.createShareLink({
      clientId: Number(selectedClientId),
      title: `Prestatierapport — ${client?.name ?? 'Klant'}`,
      filters: {
        tag: selectedTag || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      },
      expiresInDays: 30,
    });
    const link = `${window.location.origin}/?share=${res.share.token}`;
    setShareUrl(link);
    await navigator.clipboard?.writeText(link).catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Performance Dashboard</h1>
          <p className="text-sm text-slate-400">
            Historische Sitespeed.io &amp; Browsertime metingen per klant en tag
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Vernieuwen
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            PDF / Print
          </button>
          <button
            onClick={handleCreateShareLink}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Share2 className="h-4 w-4" />
            Deel Klantrapport
          </button>
          <button
            onClick={() => setShowNewTest(true)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
          >
            <Plus className="h-4 w-4" />
            Nieuwe Test
          </button>
        </div>
      </div>

      {shareUrl && (
        <div className="no-print flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          <span>
            Deelbare rapportlink (30 dagen geldig, gekopieerd naar klembord):{' '}
            <a href={shareUrl} className="underline">
              {shareUrl}
            </a>
          </span>
          <button onClick={() => setShareUrl(null)} className="text-xs underline">
            Sluiten
          </button>
        </div>
      )}

      {/* Filterbar */}
      <div className="no-print grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-5">
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value="">Alle klanten</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        >
          <option value="">Alle tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Zoek URL of klant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="print-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400">Totaal Metingen</div>
          <div className="mt-1 text-2xl font-bold text-white">
            {summary.completed} / {summary.total}
          </div>
        </div>
        <div className="print-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400">Gem. LCP</div>
          <div className="mt-1 text-2xl font-bold text-sky-400">
            {summary.avgLcp !== null ? `${summary.avgLcp} ms` : '—'}
          </div>
        </div>
        <div className="print-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400">Gem. FCP</div>
          <div className="mt-1 text-2xl font-bold text-emerald-400">
            {summary.avgFcp !== null ? `${summary.avgFcp} ms` : '—'}
          </div>
        </div>
        <div className="print-card rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs text-slate-400">Gem. TTFB</div>
          <div className="mt-1 text-2xl font-bold text-amber-400">
            {summary.avgTtfb !== null ? `${summary.avgTtfb} ms` : '—'}
          </div>
        </div>
      </div>

      <MetricsChart runs={filteredRuns} />

      {/* History Table */}
      <div className="print-card overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Klant / URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Profiel</th>
                <th className="px-4 py-3">LCP</th>
                <th className="px-4 py-3">FCP</th>
                <th className="px-4 py-3">CLS</th>
                <th className="px-4 py-3">Datum</th>
                <th className="no-print px-4 py-3 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    Geen metingen gevonden voor deze filters.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{run.client_name}</div>
                      <div className="max-w-xs truncate text-xs text-slate-400">{run.url}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[run.status] ?? STATUS_BADGE.queued
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {run.browser} · {run.connectivity}
                      {run.mobile ? ' · mobiel' : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">
                      {run.lcp_ms !== null ? `${Math.round(run.lcp_ms)} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">
                      {run.fcp_ms !== null ? `${Math.round(run.fcp_ms)} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">
                      {run.cls !== null ? run.cls.toFixed(3) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(run.created_at + 'Z').toLocaleString('nl-NL')}
                    </td>
                    <td className="no-print px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveRun(run)}
                          title="Bekijk rapport & video"
                          className="rounded p-1.5 text-sky-400 hover:bg-slate-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {(run.status === 'queued' || run.status === 'running') && (
                          <button
                            onClick={() => api.cancelRun(run.id).then(onRefresh)}
                            title="Annuleren"
                            className="rounded p-1.5 text-amber-400 hover:bg-slate-800"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {run.status !== 'running' && (
                          <button
                            onClick={() => api.deleteRun(run.id).then(onRefresh)}
                            title="Verwijderen"
                            className="rounded p-1.5 text-red-400 hover:bg-slate-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewTest && (
        <NewTestModal
          clients={clients}
          projects={projects}
          onClose={() => setShowNewTest(false)}
          onCreated={onRefresh}
        />
      )}

      {activeRun && <RunDetailModal run={activeRun} onClose={() => setActiveRun(null)} />}
    </div>
  );
}
