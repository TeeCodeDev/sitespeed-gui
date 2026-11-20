import { useState } from 'react';
import { X } from 'lucide-react';
import { api, type BrowserType, type Client, type ConnectivityType, type Project } from '../api/client';

interface NewTestModalProps {
  clients: Client[];
  projects: Project[];
  onClose: () => void;
  onCreated: () => void;
}

export function NewTestModal({ clients, projects, onClose, onCreated }: NewTestModalProps) {
  const [clientId, setClientId] = useState<number>(clients[0]?.id ?? 0);
  const [projectId, setProjectId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [browser, setBrowser] = useState<BrowserType>('chrome');
  const [connectivity, setConnectivity] = useState<ConnectivityType>('cable');
  const [iterations, setIterations] = useState(3);
  const [mobile, setMobile] = useState(false);
  const [tagsText, setTagsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clientProjects = projects.filter((p) => p.client_id === clientId);

  const handleProjectChange = (pid: string) => {
    setProjectId(pid);
    const proj = clientProjects.find((p) => p.id === Number(pid));
    if (proj) {
      setUrl(proj.base_url);
      try {
        const parsedTags = JSON.parse(proj.default_tags) as string[];
        if (parsedTags.length > 0 && !tagsText) setTagsText(parsedTags.join(', '));
      } catch {
        // ignore invalid json
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError('Selecteer eerst een klant.');
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.createRun({
        clientId,
        projectId: projectId ? Number(projectId) : null,
        url,
        browser,
        connectivity,
        iterations,
        mobile,
        tags,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Starten van test mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Nieuwe Snelheidstest Starten</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Klant *</label>
              <select
                value={clientId}
                onChange={(e) => {
                  setClientId(Number(e.target.value));
                  setProjectId('');
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Project (optioneel)</label>
              <select
                value={projectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="">-- Handmatige URL --</option>
                {clientProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Te testen URL *</label>
            <input
              type="url"
              required
              placeholder="https://voorbeeld.nl/"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Browser</label>
              <select
                value={browser}
                onChange={(e) => setBrowser(e.target.value as BrowserType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="chrome">Chrome</option>
                <option value="firefox">Firefox</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Netwerkprofiel</label>
              <select
                value={connectivity}
                onChange={(e) => setConnectivity(e.target.value as ConnectivityType)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="cable">Cable (5/1 Mbps)</option>
                <option value="4g">4G</option>
                <option value="3g">3G</option>
                <option value="native">Native (Onbeperkt)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Iteraties (1-10)</label>
              <input
                type="number"
                min={1}
                max={10}
                value={iterations}
                onChange={(e) => setIterations(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={mobile}
                onChange={(e) => setMobile(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950"
              />
              Mobiele viewport &amp; emulatie
            </label>
            <input
              type="text"
              placeholder="Tags (bijv. homepage, release)"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {submitting ? 'Starten...' : 'Test in Wachtrij Zetten'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
