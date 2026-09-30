# MatchFlick

To personer swiper hver for sig på film og serier. Når begge har liket den samme titel, opstår et match, som lægges på en fælles watch list. Appen lærer, hvad hver af jer kan lide, så andelen af matches stiger over tid.

> Status: fase 2 (grundfase): login, parkobling, swipe, matches og watch list. Læring kommer i fase 3.

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

## Supabase

Alt i Supabase ligger i mappen `supabase`:

| Sti | Indhold |
| --- | --- |
| `migrations/` | Tabeller, Row Level Security, parkobling, matchtrigger og Realtime |
| `functions/tmdb/` | Edge Function, som henter titler og streamingtjenester fra TMDB og cacher titler i tabellen `titles` |
| `functions/tmdb/queue-config.ts` | Køens sammensætning: andele af populære, nyere og ældre danske, indiske titler og udvalgte instruktørers film |
| `tests/rls_test.sql` | Test af RLS-reglerne og matchtriggeren |
| `config.toml` | Indstillinger til Supabase CLI |

### Datamodel

- `profiles`: visningsnavn, valgte streamingtjenester og om køen skal filtreres efter dem. Oprettes automatisk ved første login.
- `couples` og `couple_members`: par med invitationskode og medlemmer. Et par har højst `max_members` (2) personer, og en bruger kan kun være i ét par. Oprettes med funktionerne `create_couple()` og `join_couple(code)`.
- `titles`: TMDB-data som JSON. Id'et har formen `movie-603` eller `tv-1399`. Kun Edge Functionen skriver her.
- `swipes`: én række pr. bruger og titel med handlingen `like`, `superlike`, `nope` eller `seen`, en valgfri vurdering og, for serier, hvilke sæsoner man har set (`seasons_seen`, `all_seasons`). Siden *Set* viser titler, som begge har markeret som set.
- `snoozed`: titler sat til "ikke nu" med udløbstidspunkt (30 dage).
- `matches`: udfyldes af triggeren `swipes_create_match`, når alle i parret har liket eller superliket samme titel. Status og vurderinger rettes af medlemmerne (vurderinger via `rate_match()`).

En bruger kan kun læse og ændre data for sit eget par. Partnerens profil og swipes kan læses, men ikke ændres.

### Køen

Hver portion kort (12 ad gangen) bygges sådan:

1. Titler, som partneren har liket, og som man ikke selv har taget stilling til, kommer først (superlikes og de ældste først). I appen lægges de lige efter det kort, man står ved.
2. Resten blandes fra kilderne i `supabase/functions/tmdb/queue-config.ts`: populære titler i Danmark, nyere danske titler, danske titler fra 1953 til 1999, højt bedømte indiske titler og film af udvalgte instruktører. Andelene og instruktørerne kan ændres i filen; derefter skal funktionen udrulles igen.

Titler, man har swipet, og titler sat til "ikke nu" (30 dage), kommer ikke igen.

### Udrulning

Migrationer køres mod databasen, fx ved at indsætte filen i SQL-editoren i Supabase eller med Management API'et. Edge Functionen udrulles med Supabase CLI:

```bash
npx supabase functions deploy tmdb --project-ref <ref> --use-api --no-verify-jwt
```

Funktionen tjekker selv brugerens session, derfor `--no-verify-jwt`. Den bruger hemmeligheden `TMDB_API_KEY` (en v3-nøgle eller et v4-token fra TMDB), som lægges under Edge Function-hemmelighederne i Supabase.

Under login-indstillingerne i Supabase skal e-mailskabelonerne for *Magic Link* og *Confirm signup* (den bruges ved første login) indeholde `{{ .Token }}`, så e-mailen viser den sekscifrede kode, og kodelængden skal være 6. Supabases indbyggede e-mail må kun sende få mails i timen; opsæt egen SMTP, hvis det bliver et problem.

### Test af RLS

`supabase/tests/rls_test.sql` opretter to par og en enlig bruger og kontrollerer bl.a., at et par ikke kan læse eller ændre et andet pars profiler, swipes og matches, at matches kun oprettes af triggeren, og at man ikke kan komme med i et fuldt par. Den kører i én transaktion, som rulles tilbage, så den efterlader ingen data.

- Mod den rigtige database: indsæt filen i SQL-editoren og kør den. Den stopper med en fejl, der begynder med `FEJL:`, hvis en regel ikke holder.
- Lokalt uden Docker (kræver PostgreSQL): `npm run test:rls`. Scriptet starter en midlertidig database med en lille attrap af Supabases `auth`-skema og kører migrationerne og testen.

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
