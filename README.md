# MatchFlick

To personer swiper hver for sig på film og serier. Når begge har liket den samme titel, opstår et match, som lægges på en fælles watch list. Appen lærer, hvad hver af jer kan lide, så andelen af matches stiger over tid.

> Status: fase 1 (opsætning). Login, swipe, matches og læring kommer i de næste faser.

## Teknologi

- **Frontend:** Vite, TypeScript og React, hostet på GitHub Pages.
- **Backend:** Supabase (login, database, Realtime og Edge Functions).
- **Data:** TMDB, med streamingoplysninger fra JustWatch via TMDB.

React er valgt frem for Svelte, fordi økosystemet er størst (fx til gestik og PWA), og fordi det er det mest udbredte valg, hvis andre skal hjælpe med koden senere.

Routing er hash-baseret (fx `#/watchlist`), fordi GitHub Pages ikke kan sende direkte links til undersider videre til `index.html`.

## Lokal udvikling

Kræver Node.js 22 eller nyere.

```bash
npm install
cp .env.example .env   # udfyld værdierne
npm run dev
```

Appen kører så på den adresse, Vite skriver i terminalen.

## Miljøvariabler

| Navn | Hvor | Beskrivelse |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` og GitHub-repoets *variables* | Projektets URL i Supabase |
| `VITE_SUPABASE_ANON_KEY` | `.env` og GitHub-repoets *variables* | Supabases offentlige anon-nøgle (må gerne være offentlig, fordi alle tabeller er beskyttet med Row Level Security) |
| `TMDB_API_KEY` | Kun som hemmelighed i Supabase | TMDB-nøglen, som bruges af Edge Functions. Må aldrig ligge i frontend eller i repoet |

`.env` står i `.gitignore` og må aldrig committes. `.env.example` viser, hvilke værdier der skal udfyldes.

## Deploy

Hvert push til `main` bygger appen og lægger den på GitHub Pages via workflowet i `.github/workflows/deploy.yml`. Workflowet:

1. installerer afhængigheder og bygger appen med `base` sat til `/<repo-navn>/`,
2. kører `npm run check-dist`, som søger i `dist` efter hemmelige nøgler (TMDB-nøgler, `service_role`, andre JWT'er end anon-nøglen) og stopper deployet, hvis der findes noget,
3. udgiver `dist` på GitHub Pages.

Engangsopsætning i GitHub:

- Repoet skal være offentligt.
- Under repoets indstillinger for Pages skal kilden sættes til *GitHub Actions*.
- Under repoets indstillinger for Actions skal der oprettes to *variables* (ikke secrets): `VITE_SUPABASE_URL` og `VITE_SUPABASE_ANON_KEY`.

Appen ligger derefter på `https://<brugernavn>.github.io/MatchFlick/`.

Kontrollen kan også køres lokalt:

```bash
npm run build && npm run check-dist
```

## Læringsparametre

Beskrives i fase 3, hvor præferencemodellen bygges. Læringsrate og L2-regularisering kommer til at ligge i én konfigurationsfil.

## Kildeangivelse

This product uses the TMDB API but is not endorsed or certified by TMDB. Oplysninger om streamingtjenester kommer fra JustWatch.
