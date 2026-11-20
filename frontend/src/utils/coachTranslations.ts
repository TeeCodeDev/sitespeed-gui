export interface TranslatedAdvice {
  title: string;
  explanation: string;
  action: string;
}

const NL_COACH_RULES: Record<string, TranslatedAdvice> = {
  // Performance
  lazyLoad: {
    title: 'Afbeeldingen onder de vouw lazy-loaden',
    explanation:
      'Afbeeldingen die pas zichtbaar worden als een bezoeker naar beneden scrolt worden nu al direct bij het openen van de pagina gedownload. Dat vertraagt de eerste weergave.',
    action:
      'Voeg loading="lazy" toe aan <img>-tags die onderaan de pagina staan (niet aan de hero-afbeelding bovenaan).',
  },
  modernImages: {
    title: 'Gebruik moderne afbeeldingsformaten (WebP / AVIF)',
    explanation:
      'Klassieke PNG- en JPEG-afbeeldingen zijn vaak 25% tot 50% groter dan moderne WebP- of AVIF-bestanden bij gelijke beeldkwaliteit.',
    action:
      'Converteer afbeeldingen naar WebP of AVIF (of gebruik een WordPress/CDN-plugin die dit automatisch serveert).',
  },
  avif: {
    title: 'Gebruik moderne afbeeldingsformaten (WebP / AVIF)',
    explanation:
      'Afbeeldingen worden nog in oudere formaten (JPEG/PNG) aangeboden terwijl WebP en AVIF veel kleiner zijn.',
    action: 'Serveer afbeeldingen in WebP of AVIF via <picture> of automatische beeldoptimalisatie.',
  },
  assetsCache: {
    title: 'Stel browser-caching (Cache-Control headers) in',
    explanation:
      'Bestanden zonder cache-tijd moeten bij elk bezoek opnieuw van de server worden gedownload, wat onnodige laadtijd en dataverkeer oplevert.',
    action:
      'Configureer Cache-Control (bijv. max-age=31536000 voor statische afbeeldingen, CSS, JS en fonts) op de webserver of CDN.',
  },
  cacheHeaders: {
    title: 'Stel browser-caching (Cache-Control headers) in',
    explanation:
      'Statische bestanden missen een geldige cache-header, waardoor terugkerende bezoekers ze steeds opnieuw moeten downloaden.',
    action: 'Voeg lange Cache-Control headers toe voor statische assets zoals CSS, JS, fonts en afbeeldingen.',
  },
  avoidScalingImages: {
    title: 'Serveer afbeeldingen op het juiste formaat',
    explanation:
      'Er worden afbeeldingen geladen die veel groter zijn dan de afmetingen waarin ze op het scherm worden getoond.',
    action: 'Verklein afbeeldingen naar de daadwerkelijke weergavegrootte en gebruik srcset voor responsive maten.',
  },
  fastRender: {
    title: 'Verwijder render-blokkerende CSS en JavaScript',
    explanation:
      'Scripts of stylesheets in de <head> pauzeren het tekenen van de pagina totdat ze volledig zijn gedownload en verwerkt.',
    action:
      'Laad niet-kritieke JavaScript met defer/async en plaats kritieke CSS inline of laad overige CSS asynchroon.',
  },
  inlineCss: {
    title: 'Beperk blokkerende CSS-bestanden',
    explanation:
      'Meerdere externe CSS-bestanden blokkeren de eerste weergave van de pagina.',
    action: 'Combineer of minimaliseer CSS-bestanden en inline alleen de kritieke CSS voor boven de vouw.',
  },
  optimalCssSize: {
    title: 'Verminder de grootte van CSS-bestanden',
    explanation:
      'De totale hoeveelheid CSS is groot, waardoor de browser meer tijd nodig heeft om stijlen te berekenen.',
    action: 'Verwijder ongebruikte CSS-regels (bijv. via PurgeCSS of thema-optimalisatie) en schakel minificatie in.',
  },
  javascriptSize: {
    title: 'Beperk de hoeveelheid JavaScript',
    explanation:
      'Grote JavaScript-bundels zorgen voor langere downloadtijd én belasten de processor van het apparaat.',
    action: 'Verwijder ongebruikte plugins/scripts, splits bundels op en laad scripts pas wanneer ze nodig zijn.',
  },
  cpuTime: {
    title: 'Verlaag CPU-belasting tijdens laden',
    explanation:
      'Zware JavaScript-uitvoering houdt de main thread bezig, waardoor de pagina traag reageert op klikken en scrollen.',
    action: 'Optimaliseer of vertraag zware scripts (zoals trackers, sliders of animatie-libraries).',
  },
  longTasks: {
    title: 'Splits lange JavaScript-taken op',
    explanation:
      'Er zijn JavaScript-taken langer dan 50 ms gemeten, wat haperingen in de interface kan veroorzaken.',
    action: 'Verdeel zwaar werk in kleinere chunks of verplaats niet-urgente initialisatie naar na de eerste render.',
  },
  compression: {
    title: 'Schakel tekstcompressie (Brotli / Gzip) in',
    explanation:
      'HTML-, CSS- en JavaScript-bestanden worden ongecomprimeerd of suboptimaal verstuurd.',
    action: 'Activeer Brotli (bij voorkeur) of Gzip compressie op de webserver of CDN.',
  },
  http2: {
    title: 'Gebruik HTTP/2 of HTTP/3',
    explanation:
      'Oudere HTTP/1.1-verbindingen kunnen minder bestanden tegelijk laden.',
    action: 'Schakel HTTP/2 en bij voorkeur HTTP/3 in op de webserver/proxy.',
  },
  thirdParty: {
    title: 'Beperk trage externe (3rd-party) scripts',
    explanation:
      'Externe domeinen (zoals trackers, chatwidgets of embeds) vertragen de laadtijd en staan buiten je eigen controle.',
    action: 'Verwijder overbodige externe scripts of laad ze pas na interactie / met defer.',
  },
  jquery: {
    title: 'Overweeg jQuery te verwijderen of te moderniseren',
    explanation:
      'jQuery voegt extra kilobytes en verwerkingstijd toe die moderne browsers niet meer nodig hebben.',
    action: 'Vervang simpele jQuery-acties door native JavaScript of laad het alleen waar vereist.',
  },
  pageSize: {
    title: 'Verklein de totale paginagrootte',
    explanation:
      'De totale hoeveelheid data voor deze pagina is aan de hoge kant, vooral merkbaar op mobiele verbindingen.',
    action: 'Comprimeer afbeeldingen, video’s en scripts en laad zware media pas bij scrollen.',
  },
  // Accessibility
  altImages: {
    title: 'Voeg alt-teksten toe aan alle afbeeldingen',
    explanation:
      'Afbeeldingen zonder alt-attribuut zijn onleesbaar voor schermlezers en slechter vindbaar voor zoekmachines (SEO).',
    action: 'Geef elke informatieve afbeelding een korte, beschrijvende alt-tekst (en alt="" voor puur decoratieve iconen).',
  },
  headings: {
    title: 'Gebruik een logische koppenstructuur (H1–H6)',
    explanation:
      'Koppen helpen bezoekers en zoekmachines de structuur van de pagina te begrijpen.',
    action: 'Gebruik één duidelijke H1 en sla geen kopniveaus over (bijv. van H2 direct naar H4).',
  },
  labelOnInput: {
    title: 'Koppel labels aan alle formuliervelden',
    explanation:
      'Invoervelden zonder label zijn moeilijk te gebruiken met schermlezers of spraakbesturing.',
    action: 'Voeg een <label for="..."> of aria-label toe aan elk invoerveld.',
  },
  // Best practices & SEO
  metaDescription: {
    title: 'Voeg een meta-beschrijving (SEO) toe',
    explanation:
      'De meta description verschijnt in Google-zoekresultaten en bepaalt mede hoe vaak mensen doorklikken.',
    action: 'Voeg een unieke <meta name="description" content="..."> van 120–155 tekens toe.',
  },
  https: {
    title: 'Serveer alle bronnen veilig via HTTPS',
    explanation:
      'Verbindingen zonder HTTPS zijn onveilig en worden door browsers als onbetrouwbaar gemarkeerd.',
    action: 'Zorg dat zowel de pagina als alle ingeladen assets via HTTPS lopen.',
  },
  csp: {
    title: 'Stel een Content Security Policy (CSP) header in',
    explanation:
      'Een CSP-header beschermt bezoekers tegen XSS-aanvallen en ongewenste ingeladen scripts.',
    action: 'Configureer een Content-Security-Policy response header op de webserver.',
  },
};

function matchRuleByTitleOrId(id: string, rawTitle: string): TranslatedAdvice | null {
  if (NL_COACH_RULES[id]) return NL_COACH_RULES[id];
  const hay = `${id} ${rawTitle}`.toLowerCase();
  if (hay.includes('lazy')) return NL_COACH_RULES.lazyLoad;
  if (hay.includes('avif') || hay.includes('webp') || hay.includes('modern format')) {
    return NL_COACH_RULES.modernImages;
  }
  if (hay.includes('cache')) return NL_COACH_RULES.assetsCache;
  if (hay.includes('scaling')) return NL_COACH_RULES.avoidScalingImages;
  if (hay.includes('render-blocking') || hay.includes('fastrender')) return NL_COACH_RULES.fastRender;
  if (hay.includes('inline css') || hay.includes('css')) return NL_COACH_RULES.optimalCssSize;
  if (hay.includes('javascript') || hay.includes('js')) return NL_COACH_RULES.javascriptSize;
  if (hay.includes('compress') || hay.includes('gzip') || hay.includes('brotli')) {
    return NL_COACH_RULES.compression;
  }
  if (hay.includes('alt ') || hay.includes('altimages')) return NL_COACH_RULES.altImages;
  if (hay.includes('meta description')) return NL_COACH_RULES.metaDescription;
  if (hay.includes('third party') || hay.includes('3rd party')) return NL_COACH_RULES.thirdParty;
  return null;
}

export function translateCoachItem(
  id: string,
  rawTitle: string,
  rawDescription: string,
  rawAdvice: string,
  lang: 'nl' | 'en'
): { title: string; explanation: string; action: string } {
  if (lang === 'en') {
    return { title: rawTitle, explanation: rawDescription, action: rawAdvice };
  }
  const match = matchRuleByTitleOrId(id, rawTitle);
  if (match) return match;
  return {
    title: rawTitle,
    explanation: rawDescription,
    action: rawAdvice,
  };
}
