# SiteSpeed GUI (Sitespeed.io + Browsertime)

Een Docker-gebaseerde web-GUI, historie-database en rapportageplatform rondom **Sitespeed.io** en **Browsertime** voor Linux-servers.

## Functies
- **Metingen starten vanuit de GUI:** Kies klant, project/URL, browser (`chrome` of `firefox`), netwerkprofiel (`cable`, `4g`, `3g`, `native`), mobiel/desktop, iteraties en tags.
- **Geïsoleerde Docker-runners:** Elke meting draait in een tijdelijke `sitespeedio/sitespeed.io` container via `/var/run/docker.sock` met geheugen-, CPU-, SHM- en timeout-limieten.
- **Historie & Trendgrafieken:** Core Web Vitals (LCP, FCP, CLS, TBT, TTFB, SpeedIndex, paginagrootte, Coach-score) opgeslagen in SQLite.
- **Filters:** Filter direct op klant, tag, zoekterm of datumbereik.
- **Ingebouwde Rapporten & Video:** Bekijk het volledige Sitespeed.io HTML-rapport, de Browsertime MP4-laadvideo en download het HAR-bestand direct vanuit de GUI.
- **Rapportages Exporteren & Delen:** Exporteer naar CSV, print/opslaan als PDF, of genereer een unieke deelbare klantlink (`?share=<token>`).
- **Geplande Metingen:** Periodieke metingen via cron-expressies.

## Installatie & Starten in Dockhand (zonder zelf te bouwen)

1. Plak de inhoud van `docker-compose.yml` direct als nieuwe Stack in **Dockhand**.
2. Optioneel: stel in Dockhand bij *Environment Variables* `AUTH_USERNAME` en `AUTH_PASSWORD` in als de GUI bereikbaar is via LAN/VPN.
3. Deploy de stack — Dockhand haalt automatisch `ghcr.io/teecodedev/sitespeed-gui:latest` binnen.
4. Open de GUI op `http://<jouw-server-ip>:3000` en controleer `/healthz`.

> **Let op:** Als de GitHub-repository *private* is, moet je in Dockhand een GHCR-registry credential toevoegen, óf het GHCR-package op GitHub op *Public* zetten.

### Handmatig starten via CLI
```bash
docker compose pull
docker compose up -d
curl http://127.0.0.1:3000/healthz
```

## Beveiligingsmaatregelen
- **Geen command injection:** Containers worden via de Docker Engine API (`dockerode`) gestart met een strikte allowlist van CLI-argumenten.
- **SSRF-bescherming:** Privé-IP's, `localhost` en cloud-metadata (`169.254.169.254`) worden geblokkeerd tenzij `ALLOW_PRIVATE_NETWORKS=true` expliciet is ingesteld.
- **Resource-limieten:** Sequential/bounded queue (`MAX_CONCURRENT_RUNS=1`), container geheugen/CPU-limieten en `RUN_TIMEOUT_MS`.
