// Sammensætning af køen. Justér tallene her for at ændre blandingen.
//
// Hver portion kort bygges sådan:
//  1. Titler, som partneren har liket, og som brugeren ikke har swipet endnu, kommer først
//     (højst PARTNER_LIKES_MAX pr. portion), så de ikke skal vente længe.
//  2. Resten fyldes efter kilderne nedenfor. `share` er andelen af de resterende kort.
//     Giver en kilde færre titler end sin andel, fyldes der op med populære titler.
//
// Alle kilder følger brugerens filter for streamingtjenester. Uden filter kræves det,
// at titlen kan streames i Danmark (abonnement, gratis eller med reklamer), undtagen
// for kilden "instruktører", der også viser film, som ikke streames lige nu.

export const BATCH_SIZE = 12
export const PARTNER_LIKES_MAX = 6

export type SourceKey = 'popular' | 'danish' | 'danishClassic' | 'indian' | 'directors'

export interface Source {
  key: SourceKey
  share: number
  types: ('movie' | 'tv')[]
  // Ekstra parametre til TMDB's discover. Datoerne sættes pr. type (film/serie) i koden.
  params: Record<string, string>
  from?: string // tidligste udgivelsesdato (ÅÅÅÅ-MM-DD)
  to?: string // seneste udgivelsesdato
  requireStreaming: boolean
}

export const SOURCES: Source[] = [
  {
    // Det, der er populært i Danmark lige nu.
    key: 'popular',
    share: 0.55,
    types: ['movie', 'tv'],
    params: { 'vote_count.gte': '50' },
    requireStreaming: true,
  },
  {
    // Nyere danske film og serier.
    key: 'danish',
    share: 0.15,
    types: ['movie', 'tv'],
    params: { with_original_language: 'da', 'vote_count.gte': '5' },
    from: '2000-01-01',
    requireStreaming: true,
  },
  {
    // Ældre danske film og serier fra 1953 til 1999.
    key: 'danishClassic',
    share: 0.12,
    types: ['movie', 'tv'],
    params: { with_original_language: 'da', 'vote_count.gte': '3' },
    from: '1953-01-01',
    to: '1999-12-31',
    requireStreaming: true,
  },
  {
    // Højt bedømte indiske film og serier.
    key: 'indian',
    share: 0.1,
    types: ['movie', 'tv'],
    params: { with_origin_country: 'IN', 'vote_average.gte': '7', 'vote_count.gte': '50' },
    requireStreaming: true,
  },
  {
    // Film af udvalgte instruktører (se DIRECTORS), sorteret efter bedømmelse.
    key: 'directors',
    share: 0.08,
    types: ['movie'],
    params: { sort_by: 'vote_average.desc', 'vote_count.gte': '20' },
    requireStreaming: false,
  },
]

// Instruktører, hvis film altid skal med i køen engang imellem. Navnene slås op hos TMDB.
export const DIRECTORS = [
  'Sanjay Leela Bhansali',
  'Ashutosh Gowariker',
  'Mira Nair',
  'Yash Chopra',
  'Aditya Chopra',
]
