import { useState } from 'react';
import { Check, Palette } from 'lucide-react';

export interface BrandingSettings {
  companyName: string;
  subtitle: string;
  defaultLang: 'nl' | 'en';
}

const STORAGE_KEY = 'sitespeed_branding_v1';

export function getBrandingSettings(): BrandingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BrandingSettings>;
      return {
        companyName: parsed.companyName || 'TeeCode Performance',
        subtitle: parsed.subtitle || 'Website Snelheid & Core Web Vitals Analyse',
        defaultLang: parsed.defaultLang === 'en' ? 'en' : 'nl',
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    companyName: 'TeeCode Performance',
    subtitle: 'Website Snelheid & Core Web Vitals Analyse',
    defaultLang: 'nl',
  };
}

export function SettingsPage() {
  const initial = getBrandingSettings();
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [defaultLang, setDefaultLang] = useState<'nl' | 'en'>(initial.defaultLang);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ companyName: companyName.trim() || 'TeeCode Performance', subtitle, defaultLang })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Whitelabel &amp; Instellingen</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Pas de bedrijfsnaam en standaardtaal aan voor je klantrapporten en PDF-exports.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Palette className="h-4 w-4 text-zinc-400" />
          Rapport Branding
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Bedrijfsnaam / Label op rapporten
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">Ondertitel</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            Standaard rapporttaal
          </label>
          <select
            value={defaultLang}
            onChange={(e) => setDefaultLang(e.target.value as 'nl' | 'en')}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
          >
            <option value="nl">Nederlands (NL)</option>
            <option value="en">Engels (EN)</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-md bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-white"
          >
            Instellingen Opslaan
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Opgeslagen
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
