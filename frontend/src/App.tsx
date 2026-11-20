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
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        tab === id
          ? 'bg-indigo-50 text-indigo-700'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={`h-4 w-4 ${tab === id ? 'text-indigo-600' : 'text-slate-400'}`} />
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 md:flex-row">
      <aside className="no-print flex w-full flex-col justify-between border-b border-slate-200 bg-white p-4 md:w-60 md:border-b-0 md:border-r">
        <div>
          <div className="mb-6 flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Gauge className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-slate-900">SiteSpeed</div>
              <div className="text-[11px] text-slate-500">Performance Monitor</div>
            </div>
          </div>
          <nav className="space-y-1">
            {navItem('dashboard', 'Metingen', Activity, activeCount)}
            {navItem('clients', 'Klanten & Sites', Users)}
            {navItem('schedules', 'Planning', CalendarClock)}
            {navItem('settings', 'Whitelabel', Settings)}
          </nav>
        </div>
        <div className="hidden border-t border-slate-100 px-2 pt-3 text-[11px] text-slate-400 md:block">
          Sitespeed.io &amp; Browsertime
        </div>
      </aside>

      <main className="flex-1 p-5 md:p-8">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
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
        </div>
      </main>
    </div>
  );
}
export default App;
