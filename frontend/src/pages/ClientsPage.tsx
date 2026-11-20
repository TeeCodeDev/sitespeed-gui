import { useState } from 'react';
import { FolderPlus, Trash2, UserPlus } from 'lucide-react';
import { api, type Client, type Project } from '../api/client';

interface ClientsPageProps {
  clients: Client[];
  projects: Project[];
  onRefresh: () => void;
}

export function ClientsPage({ clients, projects, onRefresh }: ClientsPageProps) {
  const [clientName, setClientName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [projClientId, setProjClientId] = useState<number>(clients[0]?.id ?? 0);
  const [projName, setProjName] = useState('');
  const [projUrl, setProjUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createClient({
        name: clientName,
        contactEmail: contactEmail || undefined,
      });
      setClientName('');
      setContactEmail('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klant aanmaken mislukt');
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetClientId = projClientId || clients[0]?.id;
    if (!targetClientId) {
      setError('Maak eerst een klant aan.');
      return;
    }
    try {
      await api.createProject(targetClientId, { name: projName, baseUrl: projUrl });
      setProjName('');
      setProjUrl('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project aanmaken mislukt');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Klanten &amp; Websites</h1>
        <p className="text-sm text-slate-500">
          Beheer klanten en bijbehorende websites om metingen te groeperen en te filteren
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleAddClient}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <UserPlus className="h-4 w-4 text-indigo-600" />
            Nieuwe Klant
          </h2>
          <input
            type="text"
            required
            placeholder="Klantnaam (bijv. Acme B.V.)"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <input
            type="email"
            placeholder="Contact e-mail (optioneel)"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Klant Toevoegen
          </button>
        </form>

        <form
          onSubmit={handleAddProject}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FolderPlus className="h-4 w-4 text-emerald-600" />
            Nieuwe Website / Project
          </h2>
          <select
            value={projClientId || clients[0]?.id || ''}
            onChange={(e) => setProjClientId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Projectnaam (bijv. Webshop)"
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="url"
              required
              placeholder="https://voorbeeld.nl"
              value={projUrl}
              onChange={(e) => setProjUrl(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Project Toevoegen
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {clients.map((client) => {
          const clientProjs = projects.filter((p) => p.client_id === client.id);
          return (
            <div
              key={client.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{client.name}</h3>
                  <p className="text-xs text-slate-500">
                    Slug: {client.slug} {client.contact_email ? `· ${client.contact_email}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => api.deleteClient(client.id).then(onRefresh)}
                  className="rounded-md p-1.5 text-rose-600 hover:bg-rose-50"
                  title="Klant verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {clientProjs.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {clientProjs.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-800">{p.name}</div>
                        <div className="text-slate-500">{p.base_url}</div>
                      </div>
                      <button
                        onClick={() => api.deleteProject(p.id).then(onRefresh)}
                        className="text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
