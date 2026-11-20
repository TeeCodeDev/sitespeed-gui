import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, Printer, XCircle } from 'lucide-react';
import type { TestRun } from '../api/client';
import { getBrandingSettings } from '../pages/SettingsPage';

type Lang = 'nl' | 'en';

interface AdviceItem {
  category: 'performance' | 'bestpractice' | 'accessibility' | 'privacy';
  id: string;
  title: string;
  description: string;
  advice: string;
  score: number;
  offending: string[];
}

type Grade = 'good' | 'warn' | 'poor' | 'na';

function gradeMetric(value: number | null, goodMax: number, warnMax: number): Grade {
  if (value === null) return 'na';
  if (value <= goodMax) return 'good';
  if (value <= warnMax) return 'warn';
  return 'poor';
}

const GRADE_STYLE: Record<Grade, string> = {
  good: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  poor: 'border-red-500/40 bg-red-500/10 text-red-300',
  na: 'border-slate-800 bg-slate-950/70 text-slate-400',
};

const COPY = {
  nl: {
    reportTitle: 'Website Prestatierapport',
    client: 'Klant',
    measuredAt: 'Gemeten op',
    profile: 'Profiel',
    printPdf: 'Opslaan als PDF / Print',
    vitalsTitle: 'Core Web Vitals & Laadsnelheid',
    good: 'Goed',
    warn: 'Kan beter',
    poor: 'Actie nodig',
    adviceTitle: 'Concrete Verbeterpunten',
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
    client: 'Client',
    measuredAt: 'Measured on',
    profile: 'Profile',
    printPdf: 'Save as PDF / Print',
    vitalsTitle: 'Core Web Vitals & Loading Speed',
    good: 'Good',
    warn: 'Needs work',
    poor: 'Action needed',
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
  const t = COPY[lang];

  let adviceList: AdviceItem[] = [];
  if (run.advice_json) {
    try {
      adviceList = JSON.parse(run.advice_json) as AdviceItem[];
    } catch {
      adviceList = [];
    }
  }

  const videoUrl =
    run.status === 'completed' && run.report_dir && run.video_rel_path
      ? `/reports/${run.report_dir}/${run.video_rel_path}`
      : null;

  const cards = [
    {
      key: 'lcp' as const,
      value: run.lcp_ms !== null ? `${Math.round(run.lcp_ms)} ms` : '—',
      grade: gradeMetric(run.lcp_ms, 2500, 4000),
    },
    {
      key: 'fcp' as const,
      value: run.fcp_ms !== null ? `${Math.round(run.fcp_ms)} ms` : '—',
      grade: gradeMetric(run.fcp_ms, 1800, 3000),
    },
    {
      key: 'cls' as const,
      value: run.cls !== null ? run.cls.toFixed(3) : '—',
      grade: gradeMetric(run.cls, 0.1, 0.25),
    },
    {
      key: 'tbt' as const,
      value: run.tbt_ms !== null ? `${Math.round(run.tbt_ms)} ms` : '—',
      grade: gradeMetric(run.tbt_ms, 200, 600),
    },
    {
      key: 'ttfb' as const,
      value: run.ttfb_ms !== null ? `${Math.round(run.ttfb_ms)} ms` : '—',
      grade: gradeMetric(run.ttfb_ms, 800, 1800),
    },
    {
      key: 'si' as const,
      value: run.speed_index_ms !== null ? `${Math.round(run.speed_index_ms)} ms` : '—',
      grade: gradeMetric(run.speed_index_ms, 3400, 5800),
    },
  ];

  const badgeIcon = (grade: Grade) => {
    if (grade === 'good') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    if (grade === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    if (grade === 'poor') return <XCircle className="h-4 w-4 text-red-400" />;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="print-card flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {branding.companyName} · {t.reportTitle}
          </div>
          <h3 className="mt-1 text-xl font-bold text-white">{run.client_name}</h3>
          <div className="mt-1 text-xs text-zinc-400">
            {branding.subtitle} · {run.url} · {t.measuredAt}:{' '}
            {new Date(run.created_at + 'Z').toLocaleString('nl-NL')} · {t.profile}: {run.browser} /{' '}
            {run.connectivity}
            {run.mobile ? ' / mobile' : ''}
          </div>
        </div>
        <div className="no-print flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'nl' ? 'en' : 'nl')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === 'nl' ? 'NL → EN' : 'EN → NL'}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
          >
            <Printer className="h-3.5 w-3.5" />
            {t.printPdf}
          </button>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-sm font-semibold text-slate-200">{t.vitalsTitle}</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {cards.map((c) => {
            const meta = t.metrics[c.key];
            return (
              <div key={c.key} className={`print-card rounded-xl border p-4 ${GRADE_STYLE[c.grade]}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{meta.name}</span>
                  <div className="flex items-center gap-1.5">
                    {badgeIcon(c.grade)}
                    <span className="text-lg font-bold text-white">{c.value}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-300">{meta.desc}</p>
                {(c.grade === 'warn' || c.grade === 'poor') && (
                  <p className="mt-2 rounded bg-black/25 p-2 text-xs text-slate-200">
                    <strong>Tip:</strong> {meta.tip}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {videoUrl && (
        <div className="no-print">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">{t.videoTitle}</h4>
          <video
            controls
            src={videoUrl}
            className="max-h-72 w-full rounded-lg border border-slate-800 bg-black"
          />
        </div>
      )}

      <div>
        <h4 className="mb-3 text-sm font-semibold text-slate-200">{t.adviceTitle}</h4>
        {adviceList.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {t.noAdvice}
          </div>
        ) : (
          <div className="space-y-3">
            {adviceList.map((item) => (
              <div
                key={`${item.category}-${item.id}`}
                className="print-card rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-300">
                      {item.category}
                    </span>
                    <span className="text-sm font-semibold text-white">{item.title}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {item.score}/100
                  </span>
                </div>
                {item.description && (
                  <p className="mt-1.5 text-xs text-slate-400">{item.description}</p>
                )}
                {item.advice && <p className="mt-2 text-xs text-slate-200">{item.advice}</p>}
                {item.offending.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] font-medium text-slate-400">{t.affectedUrls}:</div>
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-400">
                      {item.offending.slice(0, 5).map((u) => (
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
    </div>
  );
}
