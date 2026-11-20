import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, Gauge, Settings, Users } from 'lucide-react';
import { api, type Client, type Project, type Schedule, type TestRun } from './api/client';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SharedReportPage } from './pages/SharedReportPage';

type Tab = 'dashboard' | 'clients' | 'schedules' | 'settings';

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

  const activeCount = runs.filter((r) => r.status === 'queued' || r.status === 'running').length;

  useEffect(() => {
    if (activeCount === 0) return;
    const timer = setInterval(() => void refreshAll(), 4000);
    return () => clearInterval(timer);
  }, [activeCount, refreshAll]);

  const navItem = (id: Tab, label: string, Icon: typeof Activity, badge?: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        tab === id
          ? 'bg-zinc-800 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 md:flex-row">
      <aside className="no-print flex w-full flex-col justify-between border-b border-zinc-800/80 bg-zinc-950 p-3 md:w-56 md:border-b-0 md:border-r">
        <div>
          <div className="mb-5 flex items-center gap-2.5 px-2 py-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900">
              <Gauge className="h-4 w-4 text-zinc-100" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-tight text-zinc-100">SiteSpeed</div>
              <div className="text-[10px] text-zinc-500">Performance Workbench</div>
            </div>
          </div>
          <nav className="space-y-1">
            {navItem('dashboard', 'Metingen & Historie', Activity, activeCount)}
            {navItem('clients', 'Klanten & Sites', Users)}
            {navItem('schedules', 'Planning (Cron)', CalendarClock)}
            {navItem('settings', 'Whitelabel & Setup', Settings)}
          </nav>
        </div>
        <div className="hidden px-2 pt-4 text-[10px] text-zinc-600 md:block">
          Sitespeed.io + Browsertime
        </div>
      </aside>

      <main className="flex-1 p-5 md:p-6">
        {error && (
          <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
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
        {tab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
export default App;
