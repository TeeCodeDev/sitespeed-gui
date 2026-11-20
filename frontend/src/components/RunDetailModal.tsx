import { useEffect, useState } from 'react';
import { ExternalLink, FileDown, Terminal, X } from 'lucide-react';
import { api, type TestRun } from '../api/client';

interface RunDetailModalProps {
  run: TestRun;
  onClose: () => void;
}

function MetricBox({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-white">
        {value !== null ? `${value}${unit}` : '—'}
      </div>
    </div>
  );
}

export function RunDetailModal({ run, onClose }: RunDetailModalProps) {
  const [logs, setLogs] = useState<string>('');

  useEffect(() => {
    let active = true;
    const fetchLogs = () => {
      api
        .getRunLogs(run.id)
        .then((res) => {
          if (active) setLogs(res.logs);
        })
        .catch(() => undefined);
    };
    fetchLogs();
    if (run.status === 'running' || run.status === 'queued') {
      const timer = setInterval(fetchLogs, 2000);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }
    return () => {
      active = false;
    };
  }, [run.id, run.status]);

  const isCompleted = run.status === 'completed';
  const reportUrl = isCompleted && run.report_dir ? `/reports/${run.report_dir}/index.html` : null;
  const videoUrl =
    isCompleted && run.report_dir && run.video_rel_path
      ? `/reports/${run.report_dir}/${run.video_rel_path}`
      : null;
  const harUrl =
    isCompleted && run.report_dir && run.har_rel_path
      ? `/reports/${run.report_dir}/${run.har_rel_path}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Meting #{run.id} — {run.client_name}
            </h2>
            <p className="text-xs text-slate-400">{run.url}</p>
          </div>
          <div className="flex items-center gap-2">
            {harUrl && (
              <a
                href={harUrl}
                download
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <FileDown className="h-4 w-4" />
                HAR
              </a>
            )}
            {reportUrl && (
              <a
                href={reportUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
              >
                <ExternalLink className="h-4 w-4" />
                Volledig Sitespeed Rapport
              </a>
            )}
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {(run.status === 'queued' || run.status === 'running') && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-200">
              {run.status === 'queued'
                ? 'Deze meting staat in de wachtrij en wordt binnenkort gestart...'
                : 'De Sitespeed.io / Browsertime meting is nu bezig. Het rapport en de laadvideo verschijnen automatisch zodra de run is afgerond.'}
            </div>
          )}

          {run.error_message && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {run.error_message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricBox label="LCP" value={run.lcp_ms !== null ? Math.round(run.lcp_ms) : null} unit=" ms" />
            <MetricBox label="FCP" value={run.fcp_ms !== null ? Math.round(run.fcp_ms) : null} unit=" ms" />
            <MetricBox label="CLS" value={run.cls !== null ? Number(run.cls.toFixed(3)) : null} unit="" />
            <MetricBox label="TBT" value={run.tbt_ms !== null ? Math.round(run.tbt_ms) : null} unit=" ms" />
            <MetricBox label="TTFB" value={run.ttfb_ms !== null ? Math.round(run.ttfb_ms) : null} unit=" ms" />
            <MetricBox
              label="SpeedIndex"
              value={run.speed_index_ms !== null ? Math.round(run.speed_index_ms) : null}
              unit=" ms"
            />
            <MetricBox
              label="Paginagrootte"
              value={run.page_size_bytes !== null ? Math.round(run.page_size_bytes / 1024) : null}
              unit=" KB"
            />
            <MetricBox label="Coach Score" value={run.coach_score} unit="/100" />
          </div>

          {videoUrl && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">
                Browsertime Laadvideo (Visual Recording)
              </h3>
              <video
                controls
                src={videoUrl}
                className="max-h-80 w-full rounded-lg border border-slate-800 bg-black"
              />
            </div>
          )}

          {reportUrl && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-200">
                Ingebouwd Sitespeed.io HTML Rapport
              </h3>
              <iframe
                title={`Sitespeed report ${run.id}`}
                src={reportUrl}
                className="h-[520px] w-full rounded-lg border border-slate-800 bg-white"
              />
            </div>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Terminal className="h-4 w-4 text-sky-400" />
              Runner Logs {run.status === 'running' ? '(live)' : ''}
            </h3>
            <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {logs || 'Nog geen logregels beschikbaar...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
