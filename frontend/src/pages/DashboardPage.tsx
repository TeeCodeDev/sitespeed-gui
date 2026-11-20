import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  GitCompareArrows,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCw,
  Share2,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  api,
  type BrowserType,
  type Client,
  type ConnectivityType,
  type Project,
  type TestRun,
} from '../api/client';
import { CompareRunsModal } from '../components/CompareRunsModal';
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
  queued: 'bg-amber-50 text-amber-700 border-amber-200',
  running: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

function vitalsDot(val: number | null, goodMax: number, warnMax: number): string {
  if (val === null) return 'bg-slate-300';
  if (val <= goodMax) return 'bg-emerald-500';
  if (val <= warnMax) return 'bg-amber-500';
  return 'bg-rose-500';
}

export function DashboardPage({ clients, projects, runs, onRefresh }: DashboardPageProps) {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showNewTest, setShowNewTest] = useState(false);
  const [activeRun, setActiveRun] = useState<TestRun | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const [quickClientId, setQuickClientId] = useState<number>(clients[0]?.id ?? 0);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickBrowser, setQuickBrowser] = useState<BrowserType>('chrome');
  const [quickConn, setQuickConn] = useState<ConnectivityType>('cable');
  const [quickRunning, setQuickRunning] = useState(false);

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
      avgCoach: avg(completed.map((r) => r.coach_score)),
    };
  }, [filteredRuns]);

  const handleQuickRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const targetClient = quickClientId || clients[0]?.id;
    if (!targetClient) {
      setShowNewTest(true);
      return;
    }
    setQuickRunning(true);
    try {
      await api.createRun({
        clientId: targetClient,
        url: quickUrl.trim(),
        browser: quickBrowser,
        connectivity: quickConn,
        iterations: 3,
        mobile: false,
        tags: [],
      });
      setQuickUrl('');
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Starten van meting mislukt');
    } finally {
      setQuickRunning(false);
    }
  };

  const handleRerun = async (run: TestRun) => {
    setActionError(null);
    try {
      const tags = JSON.parse(run.tags || '[]') as string[];
      await api.createRun({
        clientId: run.client_id,
        projectId: run.project_id,
        url: run.url,
        browser: run.browser,
        connectivity: run.connectivity,
        iterations: run.iterations,
        mobile: run.mobile === 1,
        tags,
      });
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Opnieuw starten mislukt');
    }
  };

  const handleCancelRun = async (id: number) => {
    setActionError(null);
    try {
      await api.cancelRun(id);
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Annuleren mislukt');
    }
  };

  const handleDeleteRun = async (id: number) => {
    setActionError(null);
    try {
      await api.deleteRun(id);
      setCompareIds((prev) => prev.filter((x) => x !== id));
      onRefresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    }
  };

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Klant', 'URL', 'Status', 'Browser', 'LCP_ms', 'FCP_ms', 'CLS', 'TBT_ms', 'TTFB_ms', 'SpeedIndex_ms', 'KB', 'Coach', 'Datum'];
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
      r.page_size_bytes !== null ? Math.round(r.page_size_bytes / 1024) : '',
      r.coach_score ?? '',
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
      setActionError('Selecteer eerst een klant in het filter om een deelbare klantlink te maken.');
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

  const comparePair =
    compareIds.length === 2
      ? [runs.find((r) => r.id === compareIds[0]), runs.find((r) => r.id === compareIds[1])]
      : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Metingen &amp; Historie</h1>
          <p className="text-sm text-slate-500">
            Core Web Vitals, vergelijkingen en whitelabel klantrapportages
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {compareIds.length === 2 && (
            <button
              onClick={() => setShowCompare(true)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Vergelijk (2)
            </button>
          )}
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </button>
          <button
            onClick={handleCreateShareLink}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <Share2 className="h-3.5 w-3.5" />
            Deel Klantlink
          </button>
        </div>
      </div>

      {/* Inline Quick-Run Bar */}
      <form
        onSubmit={handleQuickRun}
        className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
      >
        <select
          value={quickClientId || clients[0]?.id || ''}
          onChange={(e) => setQuickClientId(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800"
        >
          {clients.length === 0 && <option value="">Geen klant</option>}
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="url"
          required
          placeholder="https://voorbeeld.nl — directe snelheidstest starten..."
          value={quickUrl}
          onChange={(e) => setQuickUrl(e.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={quickBrowser}
          onChange={(e) => setQuickBrowser(e.target.value as BrowserType)}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          <option value="chrome">Chrome</option>
          <option value="firefox">Firefox</option>
        </select>
        <select
          value={quickConn}
          onChange={(e) => setQuickConn(e.target.value as ConnectivityType)}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          <option value="cable">Cable</option>
          <option value="4g">4G</option>
          <option value="3g">3G</option>
          <option value="native">Native</option>
        </select>
        <button
          type="submit"
          disabled={quickRunning}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {quickRunning ? 'Starten...' : 'Test Nu'}
        </button>
        <button
          type="button"
          onClick={() => setShowNewTest(true)}
          title="Geavanceerde opties & nieuwe klant"
          className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <Plus className="h-3.5 w-3.5" />
        </button>
      </form>

      {actionError && (
        <div className="no-print flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-medium underline">
            Sluiten
          </button>
        </div>
      )}

      {shareUrl && (
        <div className="no-print flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <span>
            Deelbare rapportlink (30 dagen geldig, gekopieerd):{' '}
            <a href={shareUrl} className="font-medium underline">
              {shareUrl}
            </a>
          </span>
          <button onClick={() => setShareUrl(null)} className="font-medium underline">
            Sluiten
          </button>
        </div>
      )}

      {/* Filterbar */}
      <div className="no-print grid grid-cols-1 gap-2 sm:grid-cols-5">
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs"
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
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-xs"
        />
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-xs sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Metingen</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {summary.completed}{' '}
            <span className="text-sm font-normal text-slate-400">/ {summary.total}</span>
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Gem. LCP</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {summary.avgLcp !== null ? `${summary.avgLcp} ms` : '—'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Gem. FCP</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {summary.avgFcp !== null ? `${summary.avgFcp} ms` : '—'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Gem. TTFB</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {summary.avgTtfb !== null ? `${summary.avgTtfb} ms` : '—'}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs font-medium text-slate-500">Gem. Coach</div>
          <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
            {summary.avgCoach !== null ? `${summary.avgCoach}/100` : '—'}
          </div>
        </div>
      </div>

      <MetricsChart runs={filteredRuns} />

      {/* History Table */}
      <div className="print-card overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="no-print w-10 px-4 py-3"></th>
                <th className="px-4 py-3">Klant / URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">LCP</th>
                <th className="px-4 py-3">FCP</th>
                <th className="px-4 py-3">CLS</th>
                <th className="px-4 py-3">TTFB</th>
                <th className="px-4 py-3">Grootte</th>
                <th className="px-4 py-3">Coach</th>
                <th className="px-4 py-3">Datum</th>
                <th className="no-print px-4 py-3 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                    Geen metingen gevonden voor deze filters.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run) => {
                  const tags = (() => {
                    try {
                      return JSON.parse(run.tags) as string[];
                    } catch {
                      return [];
                    }
                  })();
                  const isSelected = compareIds.includes(run.id);

                  return (
                    <tr key={run.id} className="hover:bg-slate-50/80">
                      <td className="no-print px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={run.status !== 'completed'}
                          onChange={() => toggleCompare(run.id)}
                          title="Selecteer 2 metingen om te vergelijken"
                          className="rounded border-slate-300 text-indigo-600 disabled:opacity-30"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{run.client_name}</span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                            {run.browser} · {run.connectivity}
                            {run.mobile ? ' · mobiel' : ''}
                          </span>
                        </div>
                        <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500">{run.url}</div>
                        {tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_BADGE[run.status] ?? STATUS_BADGE.queued
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-medium tabular-nums text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${vitalsDot(run.lcp_ms, 2500, 4000)}`} />
                          {run.lcp_ms !== null ? `${Math.round(run.lcp_ms)} ms` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                        {run.fcp_ms !== null ? `${Math.round(run.fcp_ms)} ms` : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                        {run.cls !== null ? run.cls.toFixed(3) : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-700">
                        {run.ttfb_ms !== null ? `${Math.round(run.ttfb_ms)} ms` : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-600">
                        {run.page_size_bytes !== null ? `${Math.round(run.page_size_bytes / 1024)} KB` : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold tabular-nums text-slate-800">
                        {run.coach_score !== null ? `${run.coach_score}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {new Date(run.created_at + 'Z').toLocaleString('nl-NL', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="no-print px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRerun(run)}
                            title="Opnieuw meten (1 klik)"
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50"
                          >
                            <RotateCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setActiveRun(run)}
                            title="Bekijk rapport & logs"
                            className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {(run.status === 'queued' || run.status === 'running') && (
                            <button
                              onClick={() => handleCancelRun(run.id)}
                              title="Annuleren"
                              className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {run.status !== 'running' && (
                            <button
                              onClick={() => handleDeleteRun(run.id)}
                              title="Verwijderen"
                              className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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
          onClientCreated={onRefresh}
        />
      )}

      {activeRun && <RunDetailModal run={activeRun} onClose={() => setActiveRun(null)} />}

      {showCompare && comparePair[0] && comparePair[1] && (
        <CompareRunsModal
          runA={comparePair[0]}
          runB={comparePair[1]}
          onClose={() => setShowCompare(false)}
        />
      )}
    </div>
  );
}
