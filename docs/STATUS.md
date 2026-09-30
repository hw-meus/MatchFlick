# Status og overlevering

Denne fil holder styr på, hvor langt projektet er, så en ny Claude-session kan fortsætte.
Opgavebeskrivelsen ligger i `docs/opgavebeskrivelse.md`.

## Arbejdsform (aftalt med Meus)

- Arbejd fase for fase, og stop efter hver fase, så Meus kan afprøve og godkende.
- Udvikl på den gren, sessionen får tildelt (fase 1: `claude/lag-denne-app-5s1bw2`, fase 2: `claude/dreamy-knuth-68sjam`). Når en fase er godkendt, må ændringerne pushes direkte til `main`, som deployer til GitHub Pages.
- Svar og skriv på dansk.
- Vejledninger til Meus skal altid være udførlige: en overskrift pr. opgave, direkte links til de relevante sider (fx i Supabase-dashboardet),
  nummererede trin for trin og tekst, der kan kopieres, i kodeblokke. Nævn feltnavne, som de står på skærmen, og bed Meus sige til,
  hvis en side ser anderledes ud (grænsefladerne ændrer sig).
- Bed aldrig Meus om at indsætte nøgler eller adgangskoder i chatten.

## Opsætning

- GitHub-repo: `hw-meus/MatchFlick` (offentligt). Pages-kilde: GitHub Actions. Standardgren: `main`.
- Side: https://hw-meus.github.io/MatchFlick/
- Repo-variabler (Actions → Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable-nøgle, `sb_publishable_…`).
- Supabase-projekt: ref `ecqqptlliylrdpggryur`, URL `https://ecqqptlliylrdpggryur.supabase.co`, region Europa.
  Oprettet med *Data API* slået til, *Automatically expose new tables* slået fra (så migrationer skal give GRANT eksplicit) og *automatic RLS* slået til.
- Claude-miljøet har `SUPABASE_ACCESS_TOKEN` som miljøvariabel. Brug Supabase CLI (`npx supabase … --project-ref ecqqptlliylrdpggryur`)
  eller Management API (`POST https://api.supabase.com/v1/projects/{ref}/database/query`) til migrationer og `supabase functions deploy --use-api` til Edge Functions.
  Databaseadgangskoden kender kun Meus.
- TMDB: Meus har konto og har søgt om API-adgang (Website, personlig brug). Meus lægger selv nøglen som Edge Function-hemmelighed `TMDB_API_KEY` i Supabase.

## Faser

- [x] **Fase 1 – opsætning:** Vite + React + TypeScript, hash-routing, `.env.example`, deploy-workflow med `check-dist`, README. Deployet og virker.
- [ ] **Fase 2 – grundfase:** login med e-mail-OTP (6 cifre), parkobling med invitationskode, swipe-kort via Edge Function mod TMDB, matchtrigger, Realtime, watch list. Kø = populære titler i DK.
  Migrationen er kørt i Supabase, RLS-testen består mod den rigtige database, og Edge Functionen `tmdb` er udrullet (uden JWT-kontrol).
  Koden er pushet til `main` med Meus' accept. **Mangler:** Meus skal afprøve med to telefoner og godkende.
- [ ] **Fase 3 – læring**
- [ ] **Fase 4 – PWA**
- [ ] **Fase 5 – statistik**

## Åbne punkter

- Fase 1 er godkendt af Meus.
- `SUPABASE_ACCESS_TOKEN` må (med Meus' accept) bruges til SQL via Management API og til `supabase functions deploy --use-api`.
  Tokenet mangler rettigheden `project_admin_write`, så login-indstillinger (e-mailskabeloner, kodelængde) skal Meus selv ændre.
- Login-e-mail er sat op: Gmail-SMTP (smtp.gmail.com:587, app-adgangskode, afsendernavn MatchFlick), kodelængde 6,
  Site URL https://hw-meus.github.io/MatchFlick/, og skabelonerne *Magic Link* og *Confirm signup* viser `{{ .Token }}` på dansk.
  Grænsen er 30 e-mails i timen. Supabase advarer om, at Gmail er beregnet til personlig e-mail; det er fint for to brugere.
- Watch listen sorterer i fase 2 efter dato eller TMDB-bedømmelse. Sortering efter forventet fælles glæde kommer med modellen i fase 3.
