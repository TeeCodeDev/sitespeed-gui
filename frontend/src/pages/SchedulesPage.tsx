import { useState } from 'react';
import { CalendarClock, Power, Trash2 } from 'lucide-react';
import { api, type BrowserType, type Client, type ConnectivityType, type Schedule } from '../api/client';

interface SchedulesPageProps {
  clients: Client[];
  schedules: Schedule[];
  onRefresh: () => void;
}

export function SchedulesPage({ clients, schedules, onRefresh }: SchedulesPageProps) {
  const [clientId, setClientId] = useState<number>(clients[0]?.id ?? 0);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [cronExpression, setCronExpression] = useState('0 6 * * *');
  const [browser, setBrowser] = useState<BrowserType>('chrome');
  const [connectivity, setConnectivity] = useState<ConnectivityType>('cable');
  const [mobile, setMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetClient = clientId || clients[0]?.id;
    if (!targetClient) {
      setError('Maak eerst een klant aan.');
      return;
    }
    try {
      await api.createSchedule({
        clientId: targetClient,
        name,
        url,
        cronExpression,
        browser,
        connectivity,
        iterations: 3,
        mobile,
        tags: ['scheduled'],
      });
      setName('');
      setUrl('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Planning opslaan mislukt');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Geplande Metingen</h1>
        <p className="text-sm text-slate-500">
          Automatische periodieke metingen via cron-schema (bijv. dagelijks om 06:00)
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-3"
      >
        <select
          value={clientId || clients[0]?.id || ''}
          onChange={(e) => setClientId(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          required
          placeholder="Naam (bijv. Dagelijkse homepage check)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
        <input
          type="url"
          required
          placeholder="https://voorbeeld.nl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        />
        <input
          type="text"
          required
          placeholder="Cron (bijv. 0 6 * * *)"
          value={cronExpression}
          onChange={(e) => setCronExpression(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
        />
        <div className="flex gap-2">
          <select
            value={browser}
            onChange={(e) => setBrowser(e.target.value as BrowserType)}
            className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
          >
            <option value="chrome">Chrome</option>
            <option value="firefox">Firefox</option>
          </select>
          <select
            value={connectivity}
            onChange={(e) => setConnectivity(e.target.value as ConnectivityType)}
            className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
          >
            <option value="cable">Cable</option>
            <option value="4g">4G</option>
            <option value="3g">3G</option>
            <option value="native">Native</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={mobile}
              onChange={(e) => setMobile(e.target.checked)}
            />
            Mobiel
          </label>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            <CalendarClock className="h-4 w-4" />
            Schema Toevoegen
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {schedules.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{s.name}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-indigo-700">
                  {s.cron_expression}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {s.enabled ? 'Actief' : 'Gepauzeerd'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {s.url} · {s.browser} · {s.connectivity}
                {s.last_run_at ? ` · Laatste run: ${new Date(s.last_run_at + 'Z').toLocaleString('nl-NL')}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => api.toggleSchedule(s.id).then(onRefresh)}
                className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                title="Aan/uit zetten"
              >
                <Power className="h-4 w-4" />
              </button>
              <button
                onClick={() => api.deleteSchedule(s.id).then(onRefresh)}
                className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                title="Verwijderen"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
