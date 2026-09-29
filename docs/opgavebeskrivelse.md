# Opgavebeskrivelse: Filmmatch

Denne fil beskriver en webapp, som Claude Code skal bygge sammen med Meus. Læs hele filen, før du går i gang, og arbejd fase for fase.

## Formål

To personer, en iPhone-bruger og en Samsung-bruger, skal kunne swipe hver for sig på film og serier. Når begge har liket den samme titel, opstår et match, som lægges på en fælles watch list. Appen skal lære, hvad hver af de to kan lide, og bruge det til at vise titler, som begge sandsynligvis vil like, så andelen af matches stiger over tid.

## Arbejdsform

- Arbejd i de faser, der er beskrevet nedenfor, og stop efter hver fase, så Meus kan afprøve og godkende, før du fortsætter.
- Spørg, når noget er uklart, i stedet for at gætte, og foreslå gerne forbedringer, men gennemfør dem ikke uden accept.
- Når Meus skal gøre noget i GitHubs, Supabases eller TMDB's webgrænseflade, så beskriv, hvad han skal lede efter, frem for præcise klikforløb, fordi grænsefladerne ændrer sig, og bed ham sige til, hvis han ikke kan finde det.
- Commit aldrig hemmelige nøgler, og læg en `.env.example` med tomme værdier i repoet, mens de rigtige værdier ligger i `.env`, som står i `.gitignore`.
- Al tekst i brugerfladen skal være på dansk.

## Arkitektur

- Frontend bygges med Vite og TypeScript (React eller Svelte efter dit valg, men begrund valget kort) og hostes på GitHub Pages fra et offentligt repository.
- Deploy sker automatisk med GitHub Actions ved push til `main`, og Vite skal konfigureres med den korrekte `base`-sti til GitHub Pages.
- Routing skal være hash-baseret (fx `#/watchlist`), fordi GitHub Pages ikke understøtter fallback til `index.html` ved direkte links.
- Supabase står for login, database, live-opdateringer (Realtime) og serverfunktioner (Edge Functions).
- TMDB-nøglen må kun ligge som hemmelighed i Supabase og aldrig i frontend-koden, så al kommunikation med TMDB går gennem en Edge Function.
- Supabases offentlige anon-nøgle må gerne ligge i frontend, men alle tabeller skal være beskyttet med Row Level Security, så en bruger kun kan læse og skrive data for sit eget par.
- Appen skal være en PWA med manifest, ikoner (også `apple-touch-icon`) og en service worker, så den kan lægges på hjemmeskærmen på både iPhone og Android.

## Login og parkobling

- Login sker med e-mail og en engangskode på seks cifre (Supabase OTP), ikke med et magisk link, fordi en PWA på hjemmeskærmen på iPhone ikke deler session med Safari, og et link derfor ville åbne det forkerte sted.
- Den første bruger opretter et par og får en kort invitationskode, som den anden bruger indtaster for at blive koblet på.
- Et par består af præcis to personer i første version, men datamodellen må gerne tillade flere senere.

## Swipe-funktion

- Titler vises som kort med plakat, titel, år, type (film eller serie), genrer, spilletid eller antal sæsoner, kort handlingsresumé og de danske streamingtjenester, titlen ligger på.
- Brugeren kan swipe til højre for "vil gerne se", til venstre for "nej tak", opad for "har set den" og vælge "ikke nu" med en knap, og alle handlinger skal også kunne udføres med knapper, så appen kan bruges uden gestik.
- En "superlike" kan gives med et dobbelttryk eller en særskilt knap og tæller som et stærkt ønske.
- "Har set den" åbner en valgfri vurdering fra et til fem, som bruges i læringen, og titlen vises ikke igen.
- "Ikke nu" fjerner titlen fra køen i 30 dage og påvirker ikke læringen.
- Trailer skal kunne åbnes fra kortet, hvis TMDB har en.
- Hver bruger vælger i indstillingerne, hvilke streamingtjenester parret har, og køen filtreres efter dem, men det skal kunne slås fra.
- Listen over tjenester hentes fra TMDB's endpoint for watch providers med `watch_region=DK` og må ikke hardcodes.

## Match og watch list

- Når begge har liket (eller superliket) samme titel, oprettes et match automatisk af en databasetrigger, og begge får det vist med det samme via Realtime.
- Watch listen kan filtreres efter type, genre, streamingtjeneste og status (ikke set, set) og sorteres efter dato eller forventet fælles glæde.
- Et match kan markeres som set, og begge kan give en vurdering fra et til fem, som også bruges i læringen.

## Læring og anbefalinger

Målet er, at andelen af titler, som ender i et match, stiger over tid. Løsningen skal være enkel, gennemskuelig og kunne køre inden for Supabases gratisniveau.

### Titlernes egenskaber

- For hver titel gemmes en egenskabsvektor med genrer, de vigtigste nøgleord fra TMDB, instruktør eller skaber, de tre første skuespillere, årti, spilletidsinterval, originalsprog, type og et interval for TMDB-bedømmelsen.
- Titeldata caches i databasen, så TMDB ikke kaldes for de samme titler igen og igen.

### Præferencemodel pr. bruger

- Hver bruger har en vægt pr. egenskab og en grundværdi, og sandsynligheden for et like beregnes som sigmoid af grundværdien plus summen af vægtene for titlens egenskaber (en simpel logistisk regression).
- Vægtene opdateres løbende efter hvert swipe med online gradient descent, hvor et like tæller som 1, et nej som 0, en superlike som 1 med dobbelt vægt, og en vurdering efter "har set den" omsættes til en værdi mellem 0 og 1.
- Læringsrate og regularisering (L2) samles i en konfigurationsfil, så de kan justeres uden kodeændringer, og start med en læringsrate på 0,1.
- Beregningen af vægte og scorer sker i en Edge Function eller en Postgres-funktion, ikke i browseren, så begge telefoner altid bruger samme model.

### Fælles score og kø

- Den fælles score for en titel er den geometriske middelværdi af de to brugeres sandsynligheder, fordi den belønner titler, som begge sandsynligvis vil like, frem for titler, som kun den ene elsker.
- Hvis partneren allerede har liket en titel, er den fælles score lig med brugerens egen sandsynlighed, og sådanne titler skal prioriteres højt i køen.
- Kandidater hentes fra TMDB's discover-endpoint (filtreret efter parrets tjenester og region DK), fra TMDB's anbefalinger og lignende titler for parrets matches og højt vurderede titler samt fra det, der er populært i Danmark lige nu.
- Hver portion på 20 kort sammensættes af cirka 40 % titler, som partneren har liket, og som brugeren ikke har set endnu, cirka 45 % titler med den højeste fælles score og cirka 15 % udforskning med titler uden for de hidtidige præferencer, så appen ikke låser sig fast.
- Hvis der ikke er nok titler i en af kategorierne, fyldes op fra de øvrige.

### Opstart uden data

- Ved første login vælger hver bruger mindst fem titler, de har været glade for, blandt populære film og serier, og de valg bruges som startpunkt for modellen.
- Indtil en bruger har swipet 30 titler, vægtes udforskning og popularitet højere.

### Måling

- Hvert swipe gemmes med den modelversion og den forudsagte sandsynlighed, der lå til grund, så forudsigelser kan sammenlignes med de faktiske valg.
- Matchraten beregnes som antal matches divideret med antal titler, som begge har swipet, og vises i en statistikvisning som et glidende gennemsnit over de seneste 50 fælles titler.
- Statistikvisningen viser også hver brugers stærkeste positive og negative præferencer i almindeligt sprog (fx "kan godt lide krimi og nordiske serier"), så modellen er gennemskuelig.

## Datamodel (forslag)

- Tabellen `profiles` indeholder bruger-id, visningsnavn og valgte streamingtjenester.
- Tabellen `couples` og `couple_members` indeholder par, invitationskode og medlemmer.
- Tabellen `titles` cacher TMDB-id, type, metadata som JSON og egenskabsvektoren.
- Tabellen `swipes` indeholder bruger, titel, handling, eventuel vurdering, modelversion, forudsagt sandsynlighed og tidspunkt, med én række pr. bruger og titel.
- Tabellen `matches` indeholder par, titel, tidspunkt, status og begges vurderinger og udfyldes af en trigger.
- Tabellen `preference_weights` indeholder bruger, egenskab og vægt.
- Tabellen `snoozed` indeholder titler, der er sat til "ikke nu", med udløbstidspunkt.

## Krav fra TMDB og JustWatch

- Appen skal vise TMDB's logo og teksten "This product uses the TMDB API but is not endorsed or certified by TMDB" et synligt sted, fx under Om.
- Oplysninger om streamingtjenester kommer fra JustWatch via TMDB, og det skal fremgå med en kildeangivelse til JustWatch.

## Faser

1. I opsætningsfasen hjælper du Meus med at oprette GitHub-repo, Supabase-projekt og TMDB-konto med API-adgang, og du laver projektstruktur, `.env.example`, GitHub Actions-workflow og en tom side, der kan ses på GitHub Pages.
2. I grundfasen bygger du login, parkobling, swipe-kort med data fra TMDB via Edge Function, matchtrigger, Realtime og watch list, men køen er her blot populære titler i Danmark.
3. I læringsfasen bygger du egenskabsvektorer, præferencemodel, fælles score, køsammensætning, opstartsvalg og logning af forudsigelser.
4. I PWA-fasen tilføjer du manifest, ikoner, service worker og afprøvning på både iPhone (Safari, føj til hjemmeskærm) og Android (Chrome, installer app).
5. I statistikfasen bygger du matchrate over tid og visningen af præferencer i almindeligt sprog.

## Acceptkriterier

- Begge brugere kan logge ind fra hver sin telefon, koble sig sammen og se et nyt match dukke op hos den anden inden for få sekunder.
- Ingen hemmelig nøgle findes i repoet eller i den byggede frontend, hvilket du skal kontrollere med en søgning i `dist` før hver deploy.
- En bruger kan ikke læse eller ændre data fra et andet par, hvilket du skal dokumentere med en test af RLS-reglerne.
- Appen kan installeres på hjemmeskærmen på både iPhone og Android og fungerer uden adresselinje.
- Efter hvert swipe er vægtene opdateret, og statistikvisningen viser en matchrate, når begge har swipet mindst 50 fælles titler.
- En `README.md` på dansk beskriver opsætning, miljøvariabler, deploy og hvordan læringsparametrene justeres.
