import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api, type TestRun } from '../api/client';
import { WhitelabelReport } from '../components/WhitelabelReport';

export function StandaloneReportPage({ runId }: { runId: number }) {
  const [run, setRun] = useState<TestRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRun(runId)
      .then((res) => setRun(res.run))
      .catch((err) => setError(err instanceof Error ? err.message : 'Rapport niet gevonden'));
  }, [runId]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">{error}</div>
      </div>
    );
  }

  if (!run) {
    return <div className="p-12 text-center text-sm text-slate-500">Rapport laden...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="no-print flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Terug naar Dashboard
          </a>
        </div>
        <WhitelabelReport run={run} />
      </div>
    </div>
  );
}
