export type MediaType = 'movie' | 'tv'
export type SwipeAction = 'like' | 'superlike' | 'nope' | 'seen'

export interface Provider {
  id: number
  name: string
  logo: string | null
  priority: number
}

// Skal svare til TitleMetadata i supabase/functions/tmdb/index.ts.
export interface TitleMetadata {
  title: string
  original_title: string
  year: number | null
  media_type: MediaType
  genres: string[]
  runtime: number | null
  seasons: number | null
  overview: string
  poster: string | null
  backdrop: string | null
  providers: Provider[]
  trailer: string | null
  vote_average: number | null
  popularity: number | null
  original_language: string | null
}

export interface Title {
  id: string
  tmdb_id: number
  media_type: MediaType
  metadata: TitleMetadata
}

export interface Profile {
  id: string
  display_name: string
  providers: number[]
  filter_providers: boolean
}

export interface Couple {
  id: string
  invite_code: string
  max_members: number
  members: Profile[]
}

export interface Match {
  id: string
  couple_id: string
  title_id: string
  created_at: string
  status: 'unseen' | 'seen'
  seen_at: string | null
  ratings: Record<string, number>
  titles: Title
}

// Hvilke sæsoner en bruger har set af en serie.
export interface SeasonsSeen {
  seen: number[]
  all: boolean
}

export interface SeenSwipe {
  user_id: string
  title_id: string
  rating: number | null
  seasons_seen: number[] | null
  all_seasons: boolean
  created_at: string
}

// En titel, som begge har markeret som set, med hver persons swipe.
export interface SeenTogether {
  title: Title
  mine: SeenSwipe
  partner: SeenSwipe
}
