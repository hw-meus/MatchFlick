import { useRoute } from './router'

const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export function App() {
  const route = useRoute()

  return (
    <main className="shell">
      <h1>MatchFlick</h1>
      <p className="lead">Swipe film og serier hver for sig, og find dem, I begge gerne vil se.</p>

      <nav className="nav">
        <a href="#/" aria-current={route === '/' ? 'page' : undefined}>Forside</a>
        <a href="#/om" aria-current={route === '/om' ? 'page' : undefined}>Om</a>
      </nav>

      {route === '/om' ? (
        <section className="card">
          <h2>Om MatchFlick</h2>
          <p>MatchFlick er under opbygning. Her kommer oplysninger om TMDB og JustWatch senere.</p>
        </section>
      ) : (
        <section className="card">
          <h2>Snart klar</h2>
          <p>Appen er under opbygning. Denne side viser, at deploy til GitHub Pages virker.</p>
          <p className="status">
            Supabase-opsætning: {supabaseConfigured ? 'fundet' : 'mangler endnu'}
          </p>
        </section>
      )}
    </main>
  )
}
