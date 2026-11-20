import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, Gauge, Users } from 'lucide-react';
import { api, type Client, type Project, type Schedule, type TestRun } from './api/client';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { SharedReportPage } from './pages/SharedReportPage';

type Tab = 'dashboard' | 'clients' | 'schedules';

export function App() {
  const shareToken = new URLSearchParams(window.location.search).get('share');
  if (shareToken) {
    return <SharedReportPage token={shareToken} />;
  }

  return <MainApp />;
}

function MainApp() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      const [cRes, pRes, rRes, sRes] = await Promise.all([
        api.getClients(),
        api.getProjects(),
        api.getRuns({ limit: 200 }),
        api.getSchedules(),
      ]);
      setClients(cRes.clients);
      setProjects(pRes.projects);
      setRuns(rRes.runs);
      setSchedules(sRes.schedules);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laden van data mislukt');
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  // Poll automatically while any run is queued or running
  useEffect(() => {
    const hasActive = runs.some((r) => r.status === 'queued' || r.status === 'running');
    if (!hasActive) return;
    const timer = setInterval(() => void refreshAll(), 4000);
    return () => clearInterval(timer);
  }, [runs, refreshAll]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="no-print w-full border-b border-slate-800 bg-slate-900/80 p-4 md:w-60 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Gauge className="h-6 w-6 text-sky-400" />
          <div>
            <div className="text-sm font-bold text-white">SiteSpeed GUI</div>
            <div className="text-[11px] text-slate-400">Sitespeed.io &amp; Browsertime</div>
          </div>
        </div>
        <nav className="space-y-1">
          <button
            onClick={() => setTab('dashboard')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'dashboard' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" />
            Dashboard &amp; Historie
          </button>
          <button
            onClick={() => setTab('clients')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'clients' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            Klanten &amp; Websites
          </button>
          <button
            onClick={() => setTab('schedules')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'schedules' ? 'bg-sky-500/15 text-sky-300' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <CalendarClock className="h-4 w-4" />
            Geplande Metingen
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {tab === 'dashboard' && (
          <DashboardPage
            clients={clients}
            projects={projects}
            runs={runs}
            onRefresh={refreshAll}
          />
        )}
        {tab === 'clients' && (
          <ClientsPage clients={clients} projects={projects} onRefresh={refreshAll} />
        )}
        {tab === 'schedules' && (
          <SchedulesPage clients={clients} schedules={schedules} onRefresh={refreshAll} />
        )}
      </main>
    </div>
  );
}
export default App;
