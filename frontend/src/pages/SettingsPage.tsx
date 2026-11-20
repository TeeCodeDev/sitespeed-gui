import { useState } from 'react';
import { Check, Palette, Trash2, Upload } from 'lucide-react';

export interface BrandingSettings {
  companyName: string;
  subtitle: string;
  defaultLang: 'nl' | 'en';
  logoDataUrl: string | null;
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
        logoDataUrl:
          typeof parsed.logoDataUrl === 'string' && parsed.logoDataUrl.startsWith('data:image/')
            ? parsed.logoDataUrl
            : null,
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    companyName: 'TeeCode Performance',
    subtitle: 'Website Snelheid & Core Web Vitals Analyse',
    defaultLang: 'nl',
    logoDataUrl: null,
  };
}

export function SettingsPage() {
  const initial = getBrandingSettings();
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [subtitle, setSubtitle] = useState(initial.subtitle);
  const [defaultLang, setDefaultLang] = useState<'nl' | 'en'>(initial.defaultLang);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(initial.logoDataUrl);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Alleen afbeeldingsbestanden (PNG, JPG, SVG, WebP) zijn toegestaan.');
      return;
    }
    if (file.size > 512 * 1024) {
      setLogoError('Logo mag maximaal 512 KB zijn.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        companyName: companyName.trim() || 'TeeCode Performance',
        subtitle,
        defaultLang,
        logoDataUrl,
      })
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Whitelabel &amp; Instellingen</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pas het logo, de bedrijfsnaam en standaardtaal aan voor je klantrapporten en PDF-exports.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Palette className="h-4 w-4 text-indigo-600" />
          Rapport Branding
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-700">
            Bedrijfslogo (PNG, SVG, JPG — max 512 KB)
          </label>
          <div className="flex flex-wrap items-center gap-4">
            {logoDataUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <img src={logoDataUrl} alt="Bedrijfslogo" className="h-10 max-w-[180px] object-contain" />
                <button
                  type="button"
                  onClick={() => setLogoDataUrl(null)}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50"
                  title="Logo verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              {logoDataUrl ? 'Ander logo kiezen' : 'Logo uploaden'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>
          {logoError && <p className="mt-1.5 text-xs text-rose-600">{logoError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Bedrijfsnaam / Label op rapporten
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">Ondertitel</label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Standaard rapporttaal
          </label>
          <select
            value={defaultLang}
            onChange={(e) => setDefaultLang(e.target.value as 'nl' | 'en')}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          >
            <option value="nl">Nederlands (NL)</option>
            <option value="en">Engels (EN)</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Instellingen Opslaan
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" />
              Opgeslagen
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
