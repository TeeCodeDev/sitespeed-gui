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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Meting #{run.id} — {run.client_name}
            </h2>
            <p className="text-xs text-slate-500">{run.url}</p>
          </div>
          <div className="flex items-center gap-2">
            {harUrl && (
              <a
                href={harUrl}
                download
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-4 w-4" />
                Raw Sitespeed HTML
              </a>
            )}
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="no-print flex gap-2 border-b border-slate-200 bg-slate-50 px-6 py-2">
          <button
            onClick={() => setTab('whitelabel')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === 'whitelabel'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Whitelabel Rapport (NL/EN)
          </button>
          {reportUrl && (
            <button
              onClick={() => setTab('technical')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                tab === 'technical'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Technisch Rapport (Sitespeed)
            </button>
          )}
          <button
            onClick={() => setTab('logs')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              tab === 'logs'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Runner Logs {run.status === 'running' ? '(live)' : ''}
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {(run.status === 'queued' || run.status === 'running') && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
              {run.status === 'queued'
                ? 'Deze meting staat in de wachtrij en wordt binnenkort gestart...'
                : 'De meting is nu bezig. Bekijk het tabblad Runner Logs voor de live voortgang.'}
            </div>
          )}

          {run.error_message && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {run.error_message}
            </div>
          )}

          {tab === 'whitelabel' && <WhitelabelReport run={run} />}

          {tab === 'technical' && reportUrl && (
            <iframe
              title={`Sitespeed report ${run.id}`}
              src={reportUrl}
              className="h-[600px] w-full rounded-lg border border-slate-200 bg-white"
            />
          )}

          {tab === 'logs' && (
            <pre className="max-h-[500px] overflow-auto rounded-lg border border-slate-200 bg-slate-900 p-4 font-mono text-xs text-slate-100 whitespace-pre-wrap">
              {logs || 'Nog geen logregels beschikbaar...'}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
