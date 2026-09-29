export function About() {
  return (
    <section className="card about">
      <h2>Om MatchFlick</h2>
      <p>
        I swiper hver for sig på film og serier. Når I begge har sagt "vil gerne" til den samme titel, kommer den på
        jeres fælles watch list.
      </p>
      <h3>Kilder</h3>
      <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="tmdb-logo">
        <img
          src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
          alt="The Movie Database (TMDB)"
        />
      </a>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p>
        Oplysninger om, hvilke streamingtjenester titlerne ligger på, kommer fra{' '}
        <a href="https://www.justwatch.com/dk" target="_blank" rel="noreferrer">JustWatch</a>.
      </p>
    </section>
  )
}
