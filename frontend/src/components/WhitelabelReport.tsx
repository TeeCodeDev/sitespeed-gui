import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, Printer, Search, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TestRun } from '../api/client';
import { getBrandingSettings } from '../pages/SettingsPage';

type Lang = 'nl' | 'en';
type ReportTab = 'summary' | 'advice' | 'detailed' | 'domains' | 'toplist' | 'assets';

interface AdviceItem {
  category: 'performance' | 'bestpractice' | 'accessibility' | 'privacy';
  id: string;
  title: string;
  description: string;
  advice: string;
  score: number;
  offending: string[];
}

interface AssetEntry {
  url: string;
  type: string;
  status?: number | null;
  transferSizeBytes: number;
  contentSizeBytes?: number | null;
  expires?: string | null;
}

interface StatRow {
  label: string;
  min: number | null;
  median: number | null;
  p90: number | null;
  max: number | null;
  unit: string;
}

interface RunDetails {
  categoryScores: {
    performance: number | null;
    bestpractice: number | null;
    accessibility: number | null;
    privacy: number | null;
  };
  milestones: {
    firstVisualChangeMs: number | null;
    domContentLoadedMs: number | null;
    visualComplete85Ms: number | null;
    lastVisualChangeMs: number | null;
  };
  detailedStats?: StatRow[];
  contentTypes: Array<{ type: string; transferSizeBytes: number; requests: number }>;
  heaviestAssets: AssetEntry[];
  allAssets?: AssetEntry[];
  domains?: Array<{ domain: string; transferSizeBytes: number; requests: number }>;
  firstPartyBytes?: number | null;
  firstPartyRequests?: number | null;
  thirdPartyBytes?: number | null;
  thirdPartyRequests?: number | null;
  responseCodes?: Record<string, number>;
}

type Grade = 'good' | 'warn' | 'poor' | 'na';

function gradeMetric(value: number | null, goodMax: number, warnMax: number): Grade {
  if (value === null) return 'na';
  if (value <= goodMax) return 'good';
  if (value <= warnMax) return 'warn';
  return 'poor';
}

const GRADE_STYLE: Record<Grade, string> = {
  good: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
  warn: 'border-amber-200 bg-amber-50/70 text-amber-900',
  poor: 'border-rose-200 bg-rose-50/70 text-rose-900',
  na: 'border-slate-200 bg-slate-50 text-slate-600',
};

function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const s = score ?? 0;
  const r = 34;
  const c = 2 * Math.PI * r;
  const offset = score !== null ? c - (Math.min(Math.max(s, 0), 100) / 100) * c : c;
  const color = score === null ? '#cbd5e1' : s >= 90 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold text-slate-900">
          {score !== null ? Math.round(score) : '—'}
        </div>
      </div>
      <span className="mt-1 text-xs font-medium text-slate-600">{label}</span>
    </div>
  );
}

const COPY = {
  nl: {
    reportTitle: 'Website Prestatierapport',
    measuredAt: 'Gemeten op',
    profile: 'Profiel',
    printPdf: 'Opslaan als PDF / Print',
    overallScore: 'Totaalscore',
    tabs: {
      summary: 'Overzicht',
      advice: 'Aanbevelingen',
      detailed: 'Gedetailleerd',
      domains: 'Domeinen',
      toplist: 'Toplist',
      assets: 'Alle Bestanden',
    },
    catPerf: 'Performance',
    catBp: 'Best Practices',
    catA11y: 'Toegankelijkheid',
    catPriv: 'Privacy',
    vitalsTitle: 'Core Web Vitals & Laadsnelheid',
    timelineTitle: 'Laad-tijdlijn (Visual Milestones)',
    compositionTitle: 'Pagina-opbouw & Bestanden',
    totalTransfer: 'Totale overdracht',
    totalRequests: 'Totaal requests',
    typeCol: 'Type',
    sizeCol: 'Grootte',
    reqCol: 'Requests',
    adviceTitle: 'Concrete Verbeterpunten & Actieplan',
    noAdvice: 'Geen openstaande verbeterpunten gevonden — uitstekende score!',
    affectedUrls: 'Betrokken bestanden / URLs',
    videoTitle: 'Visuele Laadopname',
    metrics: {
      lcp: {
        name: 'Largest Contentful Paint (LCP)',
        desc: 'Hoe snel het grootste zichtbare element (bijv. hero-afbeelding of hoofdkop) in beeld staat. Doel: ≤ 2500 ms.',
        tip: 'Optimaliseer hero-afbeeldingen (WebP/AVIF + preload) en verbeter server-reactietijd.',
      },
      fcp: {
        name: 'First Contentful Paint (FCP)',
        desc: 'Moment waarop de bezoeker de eerste tekst of afbeelding op het scherm ziet. Doel: ≤ 1800 ms.',
        tip: 'Beperk render-blocking CSS/JS in de <head> en gebruik snelle caching.',
      },
      cls: {
        name: 'Cumulative Layout Shift (CLS)',
        desc: 'Mate waarin elementen onverwacht verspringen tijdens het laden. Doel: ≤ 0.10.',
        tip: 'Geef afbeeldingen, video’s en advertenties altijd vaste width/height attributen.',
      },
      tbt: {
        name: 'Total Blocking Time (TBT)',
        desc: 'Totale tijd dat de browser geblokkeerd is door zware JavaScript-taken. Doel: ≤ 200 ms.',
        tip: 'Splits grote JS-bundels op en verplaats niet-kritieke scripts naar defer/async.',
      },
      ttfb: {
        name: 'Time to First Byte (TTFB)',
        desc: 'Reactietijd van de webserver tot de eerste byte wordt teruggestuurd. Doel: ≤ 800 ms.',
        tip: 'Schakel page-caching / CDN in en optimaliseer trage database-queries.',
      },
      si: {
        name: 'Speed Index',
        desc: 'Hoe snel de zichtbare inhoud gemiddeld wordt opgebouwd. Doel: ≤ 3400 ms.',
        tip: 'Prioriteer kritieke CSS (above-the-fold) en laad onderliggende media lazy.',
      },
    },
  },
  en: {
    reportTitle: 'Website Performance Report',
    measuredAt: 'Measured on',
    profile: 'Profile',
    printPdf: 'Save as PDF / Print',
    overallScore: 'Overall Score',
    tabs: {
      summary: 'Summary',
      advice: 'Recommendations',
      detailed: 'Detailed Stats',
      domains: 'Domains',
      toplist: 'Toplist',
      assets: 'Assets',
    },
    catPerf: 'Performance',
    catBp: 'Best Practices',
    catA11y: 'Accessibility',
    catPriv: 'Privacy',
    vitalsTitle: 'Core Web Vitals & Loading Speed',
    timelineTitle: 'Loading Timeline (Visual Milestones)',
    compositionTitle: 'Page Composition & Assets',
    totalTransfer: 'Total transfer',
    totalRequests: 'Total requests',
    typeCol: 'Type',
    sizeCol: 'Size',
    reqCol: 'Requests',
    adviceTitle: 'Actionable Improvements',
    noAdvice: 'No open improvement items found — great score!',
    affectedUrls: 'Affected files / URLs',
    videoTitle: 'Visual Loading Recording',
    metrics: {
      lcp: {
        name: 'Largest Contentful Paint (LCP)',
        desc: 'Time until the largest visible element (hero image or main heading) renders. Target: ≤ 2500 ms.',
        tip: 'Optimize hero images (WebP/AVIF + preload) and reduce server response time.',
      },
      fcp: {
        name: 'First Contentful Paint (FCP)',
        desc: 'Time until the visitor sees the first text or image on screen. Target: ≤ 1800 ms.',
        tip: 'Eliminate render-blocking CSS/JS in <head> and enable edge/browser caching.',
      },
      cls: {
        name: 'Cumulative Layout Shift (CLS)',
        desc: 'Measures unexpected layout jumps while the page loads. Target: ≤ 0.10.',
        tip: 'Always set explicit width and height attributes on images, videos, and embeds.',
      },
      tbt: {
        name: 'Total Blocking Time (TBT)',
        desc: 'Total time the main thread was blocked by heavy JavaScript tasks. Target: ≤ 200 ms.',
        tip: 'Code-split large JS bundles and defer non-critical third-party scripts.',
      },
      ttfb: {
        name: 'Time to First Byte (TTFB)',
        desc: 'Server response time before the first byte reaches the browser. Target: ≤ 800 ms.',
        tip: 'Enable full-page caching / CDN and optimize slow backend queries.',
      },
      si: {
        name: 'Speed Index',
        desc: 'How quickly visible content is populated on screen. Target: ≤ 3400 ms.',
        tip: 'Inline critical CSS for above-the-fold content and lazy-load offscreen media.',
      },
    },
  },
} as const;

export function WhitelabelReport({ run }: { run: TestRun }) {
  const branding = getBrandingSettings();
  const [lang, setLang] = useState<Lang>(branding.defaultLang);
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [adviceCat, setAdviceCat] = useState<string>('all');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState('all');
  const t = COPY[lang];

  const adviceList: AdviceItem[] = useMemo(() => {
    if (!run.advice_json) return [];
    try {
      return JSON.parse(run.advice_json) as AdviceItem[];
    } catch {
      return [];
    }
  }, [run.advice_json]);

  const details: RunDetails | null = useMemo(() => {
    if (!run.details_json) return null;
    try {
      return JSON.parse(run.details_json) as RunDetails;
    } catch {
      return null;
    }
  }, [run.details_json]);

  const videoUrl =
    run.status === 'completed' && run.report_dir && run.video_rel_path
      ? `/reports/${run.report_dir}/${run.video_rel_path}`
      : null;

  const cards = [
    { key: 'lcp' as const, value: run.lcp_ms !== null ? `${Math.round(run.lcp_ms)} ms` : '—', grade: gradeMetric(run.lcp_ms, 2500, 4000) },
    { key: 'fcp' as const, value: run.fcp_ms !== null ? `${Math.round(run.fcp_ms)} ms` : '—', grade: gradeMetric(run.fcp_ms, 1800, 3000) },
    { key: 'cls' as const, value: run.cls !== null ? run.cls.toFixed(3) : '—', grade: gradeMetric(run.cls, 0.1, 0.25) },
    { key: 'tbt' as const, value: run.tbt_ms !== null ? `${Math.round(run.tbt_ms)} ms` : '—', grade: gradeMetric(run.tbt_ms, 200, 600) },
    { key: 'ttfb' as const, value: run.ttfb_ms !== null ? `${Math.round(run.ttfb_ms)} ms` : '—', grade: gradeMetric(run.ttfb_ms, 800, 1800) },
    { key: 'si' as const, value: run.speed_index_ms !== null ? `${Math.round(run.speed_index_ms)} ms` : '—', grade: gradeMetric(run.speed_index_ms, 3400, 5800) },
  ];

  const milestones = [
    { label: 'First Visual Change', ms: details?.milestones.firstVisualChangeMs ?? null },
    { label: 'First Contentful Paint', ms: run.fcp_ms },
    { label: 'DOM Content Loaded', ms: details?.milestones.domContentLoadedMs ?? null },
    { label: 'Largest Contentful Paint', ms: run.lcp_ms },
    { label: 'Speed Index', ms: run.speed_index_ms },
    { label: 'Visual Complete 85%', ms: details?.milestones.visualComplete85Ms ?? null },
    { label: 'Fully Loaded', ms: run.fully_loaded_ms },
    { label: 'Last Visual Change', ms: details?.milestones.lastVisualChangeMs ?? null },
  ].filter((m) => m.ms !== null);
  const maxMilestoneMs = Math.max(...milestones.map((m) => m.ms ?? 0), 1);

  const chartData = (details?.contentTypes ?? []).map((ct) => ({
    name: ct.type,
    KB: Math.round(ct.transferSizeBytes / 1024),
    Requests: ct.requests,
  }));

  const allAssets = details?.allAssets ?? details?.heaviestAssets ?? [];
  const assetTypes = useMemo(() => [...new Set(allAssets.map((a) => a.type))].sort(), [allAssets]);
  const filteredAssets = useMemo(() => {
    return allAssets.filter((a) => {
      if (assetTypeFilter !== 'all' && a.type !== assetTypeFilter) return false;
      if (assetQuery && !a.url.toLowerCase().includes(assetQuery.toLowerCase())) return false;
      return true;
    });
  }, [allAssets, assetTypeFilter, assetQuery]);

  const filteredAdvice = useMemo(
    () => adviceList.filter((a) => adviceCat === 'all' || a.category === adviceCat),
    [adviceList, adviceCat]
  );

  const badgeIcon = (grade: Grade) => {
    if (grade === 'good') return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (grade === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    if (grade === 'poor') return <XCircle className="h-4 w-4 text-rose-600" />;
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="print-card flex flex-wrap items-center justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {branding.companyName} · {t.reportTitle}
          </div>
          <h3 className="text-2xl font-bold text-slate-900">{run.client_name}</h3>
          <div className="text-xs text-slate-500">
            {branding.subtitle} · <span className="font-medium text-slate-700">{run.url}</span>
          </div>
          <div className="text-xs text-slate-500">
            {t.measuredAt}: {new Date(run.created_at + 'Z').toLocaleString('nl-NL')} · {t.profile}:{' '}
            {run.browser} / {run.connectivity}
            {run.mobile ? ' / mobile' : ''} · {run.iterations}x
          </div>
          <div className="no-print flex items-center gap-2 pt-3">
            <button
              onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Globe className="h-3.5 w-3.5" />
              {lang === 'nl' ? 'NL → EN' : 'EN → NL'}
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              <Printer className="h-3.5 w-3.5" />
              {t.printPdf}
            </button>
          </div>
        </div>
        <ScoreRing score={run.coach_score} label={t.overallScore} />
      </div>

      {/* Sub-navigation matching Sitespeed.io's 6 sections */}
      <div className="no-print flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
        {(
          [
            ['summary', t.tabs.summary],
            ['advice', `${t.tabs.advice} (${adviceList.length})`],
            ['detailed', t.tabs.detailed],
            ['domains', `${t.tabs.domains} (${details?.domains?.length ?? 0})`],
            ['toplist', t.tabs.toplist],
            ['assets', `${t.tabs.assets} (${allAssets.length})`],
          ] as Array<[ReportTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === id
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: SUMMARY */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {details && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t.catPerf, val: details.categoryScores.performance },
                { label: t.catBp, val: details.categoryScores.bestpractice },
                { label: t.catA11y, val: details.categoryScores.accessibility },
                { label: t.catPriv, val: details.categoryScores.privacy },
              ].map((cat) => (
                <div key={cat.label} className="print-card rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="text-xs font-medium text-slate-500">{cat.label}</div>
                  <div className="mt-1 font-mono text-2xl font-bold text-slate-900">
                    {cat.val !== null ? `${Math.round(cat.val)}` : '—'}
                    <span className="text-xs font-normal text-slate-400"> / 100</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-800">{t.vitalsTitle}</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {cards.map((c) => {
                const meta = t.metrics[c.key];
                return (
                  <div key={c.key} className={`print-card rounded-xl border p-4 ${GRADE_STYLE[c.grade]}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{meta.name}</span>
                      <div className="flex items-center gap-1.5">
                        {badgeIcon(c.grade)}
                        <span className="font-mono text-lg font-bold text-slate-900">{c.value}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{meta.desc}</p>
                    {(c.grade === 'warn' || c.grade === 'poor') && (
                      <p className="mt-2 rounded-lg border border-slate-200/80 bg-white/80 p-2 text-xs text-slate-700">
                        <strong>Tip:</strong> {meta.tip}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {(run.page_size_bytes !== null || chartData.length > 0) && (
            <div className="print-card space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-800">{t.compositionTitle}</h4>
                <div className="flex gap-4 text-xs text-slate-600">
                  <span>
                    {t.totalTransfer}:{' '}
                    <strong className="font-mono text-slate-900">
                      {run.page_size_bytes !== null ? `${(run.page_size_bytes / 1024).toFixed(0)} KB` : '—'}
                    </strong>
                  </span>
                  <span>
                    {t.totalRequests}:{' '}
                    <strong className="font-mono text-slate-900">{run.requests_count ?? '—'}</strong>
                  </span>
                </div>
              </div>
              {chartData.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} unit=" KB" />
                        <Tooltip />
                        <Bar dataKey="KB" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 font-semibold">{t.typeCol}</th>
                        <th className="py-2 text-right font-semibold">{t.sizeCol}</th>
                        <th className="py-2 text-right font-semibold">{t.reqCol}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chartData.map((ct) => (
                        <tr key={ct.name}>
                          <td className="py-2 font-medium capitalize text-slate-800">{ct.name}</td>
                          <td className="py-2 text-right font-mono text-slate-700">{ct.KB} KB</td>
                          <td className="py-2 text-right font-mono text-slate-600">{ct.Requests}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {videoUrl && (
            <div className="no-print rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h4 className="mb-3 text-sm font-semibold text-slate-800">{t.videoTitle}</h4>
              <video controls src={videoUrl} className="max-h-80 w-full rounded-lg border border-slate-200 bg-black" />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RECOMMENDATIONS / ADVICE */}
      {activeTab === 'advice' && (
        <div className="space-y-4">
          <div className="no-print flex flex-wrap gap-2">
            {['all', 'performance', 'bestpractice', 'accessibility', 'privacy'].map((cat) => (
              <button
                key={cat}
                onClick={() => setAdviceCat(cat)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
                  adviceCat === cat
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat === 'all' ? (lang === 'nl' ? 'Alle categorieën' : 'All categories') : cat}
              </button>
            ))}
          </div>

          {filteredAdvice.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
              {t.noAdvice}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAdvice.map((item) => (
                <div key={`${item.category}-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                        {item.category}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-700">{item.score}/100</span>
                  </div>
                  {item.description && <p className="mt-1.5 text-xs text-slate-500">{item.description}</p>}
                  {item.advice && <p className="mt-2 text-xs text-slate-800">{item.advice}</p>}
                  {item.offending.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[11px] font-medium text-slate-500">{t.affectedUrls}:</div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                        {item.offending.map((u) => (
                          <li key={u} className="truncate font-mono">
                            • {u}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DETAILED STATS & TIMELINE */}
      {activeTab === 'detailed' && (
        <div className="space-y-6">
          {milestones.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h4 className="mb-4 text-sm font-semibold text-slate-800">{t.timelineTitle}</h4>
              <div className="space-y-2.5">
                {milestones.map((m) => (
                  <div key={m.label} className="grid grid-cols-12 items-center gap-3 text-xs">
                    <div className="col-span-4 font-medium text-slate-700">{m.label}</div>
                    <div className="col-span-6 h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.max(4, Math.round(((m.ms ?? 0) / maxMilestoneMs) * 100))}%` }}
                      />
                    </div>
                    <div className="col-span-2 text-right font-mono font-semibold text-slate-800">
                      {Math.round(m.ms ?? 0)} ms
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {details?.detailedStats && details.detailedStats.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <h4 className="mb-3 text-sm font-semibold text-slate-800">
                {lang === 'nl' ? 'Statistische verdeling (Min / Mediaan / P90 / Max)' : 'Statistical Breakdown'}
              </h4>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 font-semibold">Metric</th>
                    <th className="py-2 text-right font-semibold">Min</th>
                    <th className="py-2 text-right font-semibold">Median</th>
                    <th className="py-2 text-right font-semibold">P90</th>
                    <th className="py-2 text-right font-semibold">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {details.detailedStats.map((s) => {
                    const fmt = (v: number | null) =>
                      v === null ? '—' : s.unit === '' ? v.toFixed(3) : `${Math.round(v)} ${s.unit}`;
                    return (
                      <tr key={s.label}>
                        <td className="py-2.5 font-sans font-medium text-slate-800">{s.label}</td>
                        <td className="py-2.5 text-right text-slate-600">{fmt(s.min)}</td>
                        <td className="py-2.5 text-right font-semibold text-slate-900">{fmt(s.median)}</td>
                        <td className="py-2.5 text-right text-slate-600">{fmt(s.p90)}</td>
                        <td className="py-2.5 text-right text-slate-600">{fmt(s.max)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DOMAINS */}
      {activeTab === 'domains' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-slate-800">
              {lang === 'nl' ? 'Domeinen & Externe Scripts' : 'Domains & Third-Party Requests'}
            </h4>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              {details?.firstPartyBytes != null && (
                <span>
                  1st-party:{' '}
                  <strong className="font-mono text-slate-900">
                    {Math.round(details.firstPartyBytes / 1024)} KB ({details.firstPartyRequests ?? 0} req)
                  </strong>
                </span>
              )}
              {details?.thirdPartyBytes != null && (
                <span>
                  3rd-party:{' '}
                  <strong className="font-mono text-slate-900">
                    {Math.round(details.thirdPartyBytes / 1024)} KB ({details.thirdPartyRequests ?? 0} req)
                  </strong>
                </span>
              )}
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2 font-semibold">{lang === 'nl' ? 'Domein' : 'Domain'}</th>
                <th className="py-2 text-right font-semibold">{t.sizeCol}</th>
                <th className="py-2 text-right font-semibold">{t.reqCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(details?.domains ?? []).map((d) => (
                <tr key={d.domain}>
                  <td className="py-2.5 font-mono text-slate-800">{d.domain}</td>
                  <td className="py-2.5 text-right font-mono text-slate-700">
                    {Math.round(d.transferSizeBytes / 1024)} KB
                  </td>
                  <td className="py-2.5 text-right font-mono text-slate-600">{d.requests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: TOPLIST */}
      {activeTab === 'toplist' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {['image', 'javascript', 'css', 'font'].map((kind) => {
            const list = allAssets.filter((a) => a.type === kind).slice(0, 8);
            return (
              <div key={kind} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <h4 className="mb-3 text-sm font-semibold capitalize text-slate-800">
                  {lang === 'nl' ? `Grootste ${kind} bestanden` : `Largest ${kind} assets`}
                </h4>
                {list.length === 0 ? (
                  <div className="text-xs text-slate-400">—</div>
                ) : (
                  <div className="space-y-2">
                    {list.map((a, idx) => (
                      <div key={`${a.url}-${idx}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-mono text-[11px] text-slate-700">{a.url}</span>
                        <span className="shrink-0 font-mono font-semibold text-slate-900">
                          {Math.round(a.transferSizeBytes / 1024)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 6: ALL ASSETS */}
      {activeTab === 'assets' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'nl' ? 'Zoek op bestandsnaam of URL...' : 'Filter by URL...'}
                value={assetQuery}
                onChange={(e) => setAssetQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900"
              />
            </div>
            <select
              value={assetTypeFilter}
              onChange={(e) => setAssetTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700"
            >
              <option value="all">{lang === 'nl' ? 'Alle types' : 'All types'}</option>
              {assetTypes.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2 font-semibold">URL</th>
                  <th className="py-2 font-semibold">{t.typeCol}</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 text-right font-semibold">{t.sizeCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((a, idx) => (
                  <tr key={`${a.url}-${idx}`}>
                    <td className="max-w-lg truncate py-2 font-mono text-[11px] text-slate-700">{a.url}</td>
                    <td className="py-2 capitalize text-slate-500">{a.type}</td>
                    <td className="py-2 font-mono text-slate-600">{a.status ?? '—'}</td>
                    <td className="py-2 text-right font-mono font-medium text-slate-900">
                      {(a.transferSizeBytes / 1024).toFixed(1)} KB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
