import { useEffect, useState } from 'react';
import { ExternalLink, FileDown, FileText, Terminal, X } from 'lucide-react';
import { api, type TestRun } from '../api/client';
import { WhitelabelReport } from './WhitelabelReport';

interface RunDetailModalProps {
  run: TestRun;
  onClose: () => void;
}

type ModalTab = 'whitelabel' | 'technical' | 'logs';

export function RunDetailModal({ run: initialRun, onClose }: RunDetailModalProps) {
  const [run, setRun] = useState<TestRun>(initialRun);
  const [logs, setLogs] = useState<string>('');
  const [tab, setTab] = useState<ModalTab>(
    initialRun.status === 'running' || initialRun.status === 'queued' ? 'logs' : 'whitelabel'
  );

  useEffect(() => {
    api
      .getRun(initialRun.id)
      .then((res) => setRun(res.run))
      .catch(() => undefined);
  }, [initialRun.id, initialRun.status]);

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
  const harUrl =
    isCompleted && run.report_dir && run.har_rel_path
      ? `/reports/${run.report_dir}/${run.har_rel_path}`
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
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
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <ExternalLink className="h-4 w-4" />
                Raw Sitespeed HTML
              </a>
            )}
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="no-print flex gap-2 border-b border-slate-800 bg-slate-950/50 px-6 py-2">
          <button
            onClick={() => setTab('whitelabel')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === 'whitelabel' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Whitelabel Rapport (NL/EN)
          </button>
          {reportUrl && (
            <button
              onClick={() => setTab('technical')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                tab === 'technical'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Technisch Rapport (Sitespeed)
            </button>
          )}
          <button
            onClick={() => setTab('logs')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              tab === 'logs' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Runner Logs {run.status === 'running' ? '(live)' : ''}
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {(run.status === 'queued' || run.status === 'running') && (
            <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-200">
              {run.status === 'queued'
                ? 'Deze meting staat in de wachtrij en wordt binnenkort gestart...'
                : 'De meting is nu bezig. Bekijk het tabblad Runner Logs voor de live voortgang.'}
            </div>
          )}

          {run.error_message && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
              {run.error_message}
            </div>
          )}

          {tab === 'whitelabel' && <WhitelabelReport run={run} />}

          {tab === 'technical' && reportUrl && (
            <iframe
              title={`Sitespeed report ${run.id}`}
              src={reportUrl}
              className="h-[600px] w-full rounded-lg border border-slate-800 bg-white"
            />
          )}

          {tab === 'logs' && (
            <pre className="max-h-[500px] overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {logs || 'Nog geen logregels beschikbaar...'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
