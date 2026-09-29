// Edge Function "tmdb": al kommunikation med TMDB går herigennem, så nøglen aldrig
// når frontend. Titler caches i tabellen titles.
//
// Kaldes med POST og JSON { action, ... }:
//   { action: "queue", exclude?: string[] }  → { titles: Title[] }  næste portion kort (populære i DK)
//   { action: "providers" }                  → { providers: Provider[] }  streamingtjenester i DK
//
// Kræver en gyldig brugersession (Authorization: Bearer <access token>).
// Hemmeligheden TMDB_API_KEY kan være enten en v3-nøgle eller et v4 "read access token".

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const TMDB = 'https://api.themoviedb.org/3'
const REGION = 'DK'
const LANGUAGE = 'da-DK'
const BATCH_SIZE = 20
const MAX_PAGES = 15
// Streamingoplysninger ændrer sig, så cachede titler genindlæses efter en uge.
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type MediaType = 'movie' | 'tv'

interface Provider {
  id: number
  name: string
  logo: string | null
  priority: number
}

interface TitleMetadata {
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

interface TitleRow {
  id: string
  tmdb_id: number
  media_type: MediaType
  metadata: TitleMetadata
  fetched_at: string
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = Deno.env.get('TMDB_API_KEY')
  if (!key) throw new HttpError(500, 'TMDB_API_KEY er ikke sat som hemmelighed i Supabase.')

  const url = new URL(TMDB + path)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const headers: Record<string, string> = { Accept: 'application/json' }
  // v4-tokens er JWT'er; v3-nøgler er 32 hextegn og sendes som parameter.
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)

  const res = await fetch(url, { headers })
  if (!res.ok) throw new HttpError(502, `TMDB svarede ${res.status} på ${path}`)
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Streamingtjenester
// ---------------------------------------------------------------------------

interface TmdbProvider {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority?: number
  display_priorities?: Record<string, number>
}

function toProvider(p: TmdbProvider): Provider {
  return {
    id: p.provider_id,
    name: p.provider_name,
    logo: p.logo_path,
    priority: p.display_priorities?.[REGION] ?? p.display_priority ?? 999,
  }
}

let providerCache: { at: number; list: Provider[] } | null = null

async function listProviders(): Promise<Provider[]> {
  if (providerCache && Date.now() - providerCache.at < 6 * 60 * 60 * 1000) return providerCache.list
  const params = { watch_region: REGION, language: LANGUAGE }
  const [movie, tv] = await Promise.all([
    tmdb<{ results: TmdbProvider[] }>('/watch/providers/movie', params),
    tmdb<{ results: TmdbProvider[] }>('/watch/providers/tv', params),
  ])
  const byId = new Map<number, Provider>()
  for (const p of [...movie.results, ...tv.results]) {
    const provider = toProvider(p)
    const existing = byId.get(provider.id)
    if (!existing || provider.priority < existing.priority) byId.set(provider.id, provider)
  }
  const list = [...byId.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, 'da'))
  providerCache = { at: Date.now(), list }
  return list
}

// ---------------------------------------------------------------------------
// Titeldetaljer
// ---------------------------------------------------------------------------

interface TmdbDetails {
  id: number
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  release_date?: string
  first_air_date?: string
  genres?: { name: string }[]
  runtime?: number
  episode_run_time?: number[]
  number_of_seasons?: number
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  popularity?: number
  original_language?: string
  videos?: { results: { site: string; type: string; key: string; iso_639_1: string; official?: boolean }[] }
  'watch/providers'?: { results: Record<string, { flatrate?: TmdbProvider[]; free?: TmdbProvider[]; ads?: TmdbProvider[] }> }
  translations?: { translations: { iso_639_1: string; data: { overview?: string; title?: string; name?: string } }[] }
}

function pickTrailer(videos: TmdbDetails['videos']): string | null {
  const yt = (videos?.results ?? []).filter((v) => v.site === 'YouTube')
  const score = (v: (typeof yt)[number]) =>
    (v.type === 'Trailer' ? 4 : v.type === 'Teaser' ? 2 : 0) + (v.official ? 1 : 0) + (v.iso_639_1 === 'da' ? 0.5 : 0)
  const best = yt.sort((a, b) => score(b) - score(a))[0]
  return best && score(best) >= 2 ? best.key : null
}

function toMetadata(d: TmdbDetails, type: MediaType): TitleMetadata {
  const date = type === 'movie' ? d.release_date : d.first_air_date
  const dk = d['watch/providers']?.results?.[REGION]
  const providers = new Map<number, Provider>()
  for (const p of [...(dk?.flatrate ?? []), ...(dk?.free ?? []), ...(dk?.ads ?? [])]) {
    if (!providers.has(p.provider_id)) providers.set(p.provider_id, toProvider(p))
  }
  let overview = d.overview?.trim() ?? ''
  if (!overview) {
    const en = d.translations?.translations.find((t) => t.iso_639_1 === 'en')
    overview = en?.data.overview?.trim() ?? ''
  }
  return {
    title: (type === 'movie' ? d.title : d.name) ?? '',
    original_title: (type === 'movie' ? d.original_title : d.original_name) ?? '',
    year: date ? Number(date.slice(0, 4)) || null : null,
    media_type: type,
    genres: (d.genres ?? []).map((g) => g.name),
    runtime: type === 'movie' ? d.runtime || null : d.episode_run_time?.[0] || null,
    seasons: type === 'tv' ? d.number_of_seasons ?? null : null,
    overview,
    poster: d.poster_path ?? null,
    backdrop: d.backdrop_path ?? null,
    providers: [...providers.values()].sort((a, b) => a.priority - b.priority),
    trailer: pickTrailer(d.videos),
    vote_average: d.vote_average ?? null,
    popularity: d.popularity ?? null,
    original_language: d.original_language ?? null,
  }
}

async function fetchDetails(type: MediaType, tmdbId: number): Promise<TitleRow> {
  const d = await tmdb<TmdbDetails>(`/${type}/${tmdbId}`, {
    language: LANGUAGE,
    append_to_response: 'videos,watch/providers,translations',
    include_video_language: 'da,en,null',
  })
  return {
    id: `${type}-${tmdbId}`,
    tmdb_id: tmdbId,
    media_type: type,
    metadata: toMetadata(d, type),
    fetched_at: new Date().toISOString(),
  }
}

// Henter titlerne fra cachen og supplerer med TMDB for dem, der mangler eller er forældede.
async function ensureTitles(admin: SupabaseClient, refs: { type: MediaType; id: number }[]): Promise<Map<string, TitleRow>> {
  const ids = refs.map((r) => `${r.type}-${r.id}`)
  const { data, error } = await admin.from('titles').select('id, tmdb_id, media_type, metadata, fetched_at').in('id', ids)
  if (error) throw new HttpError(500, error.message)

  const rows = new Map<string, TitleRow>((data as TitleRow[]).map((r) => [r.id, r]))
  const missing = refs.filter((r) => {
    const row = rows.get(`${r.type}-${r.id}`)
    return !row || Date.now() - Date.parse(row.fetched_at) > STALE_AFTER_MS
  })

  const fetched = await Promise.allSettled(missing.map((r) => fetchDetails(r.type, r.id)))
  const fresh = fetched.flatMap((f) => (f.status === 'fulfilled' ? [f.value] : []))
  if (fresh.length) {
    const { error: upsertError } = await admin.from('titles').upsert(fresh)
    if (upsertError) throw new HttpError(500, upsertError.message)
    for (const row of fresh) rows.set(row.id, row)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Kø: populære titler i Danmark, som brugeren ikke har swipet eller sat til "ikke nu"
// ---------------------------------------------------------------------------

interface DiscoverResult {
  page: number
  total_pages: number
  results: { id: number; popularity: number }[]
}

async function buildQueue(admin: SupabaseClient, userId: string, exclude: string[]): Promise<TitleRow[]> {
  const [profileRes, swipesRes, snoozedRes] = await Promise.all([
    admin.from('profiles').select('providers, filter_providers').eq('id', userId).maybeSingle(),
    admin.from('swipes').select('title_id').eq('user_id', userId),
    admin.from('snoozed').select('title_id').eq('user_id', userId).gt('until', new Date().toISOString()),
  ])
  for (const r of [profileRes, swipesRes, snoozedRes]) if (r.error) throw new HttpError(500, r.error.message)

  const skip = new Set<string>([
    ...exclude,
    ...(swipesRes.data ?? []).map((s) => s.title_id as string),
    ...(snoozedRes.data ?? []).map((s) => s.title_id as string),
  ])

  const providers: number[] = profileRes.data?.providers ?? []
  const params: Record<string, string> = {
    language: LANGUAGE,
    watch_region: REGION,
    sort_by: 'popularity.desc',
    include_adult: 'false',
    'vote_count.gte': '50',
  }
  if (profileRes.data?.filter_providers && providers.length) {
    params.with_watch_providers = providers.join('|')
  } else {
    // Uden filter: alt, der kan streames i Danmark (abonnement, gratis eller med reklamer).
    params.with_watch_monetization_types = 'flatrate|free|ads'
  }

  // Film og serier flettes, så køen har en blanding af begge.
  const picked: { type: MediaType; id: number; popularity: number }[] = []
  const done: Record<MediaType, boolean> = { movie: false, tv: false }
  for (let page = 1; page <= MAX_PAGES && picked.length < BATCH_SIZE && !(done.movie && done.tv); page++) {
    const types = (['movie', 'tv'] as MediaType[]).filter((t) => !done[t])
    const pages = await Promise.all(
      types.map((t) => tmdb<DiscoverResult>(`/discover/${t}`, { ...params, page: String(page) }).then((r) => ({ t, r }))),
    )
    const round: typeof picked = []
    for (const { t, r } of pages) {
      if (page >= r.total_pages) done[t] = true
      for (const item of r.results) {
        if (!skip.has(`${t}-${item.id}`)) round.push({ type: t, id: item.id, popularity: item.popularity })
      }
    }
    round.sort((a, b) => b.popularity - a.popularity)
    picked.push(...round)
  }

  const refs = picked.slice(0, BATCH_SIZE)
  const rows = await ensureTitles(admin, refs)
  return refs.flatMap((r) => rows.get(`${r.type}-${r.id}`) ?? [])
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Brug POST.' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) throw new HttpError(401, 'Du skal være logget ind.')
    const { data: auth, error: authError } = await admin.auth.getUser(token)
    if (authError || !auth.user) throw new HttpError(401, 'Din session er udløbet. Log ind igen.')

    const body = await req.json().catch(() => ({}))
    switch (body.action) {
      case 'queue': {
        const exclude = Array.isArray(body.exclude) ? body.exclude.filter((x: unknown) => typeof x === 'string') : []
        return json({ titles: await buildQueue(admin, auth.user.id, exclude.slice(0, 500)) })
      }
      case 'providers':
        return json({ providers: await listProviders() })
      default:
        throw new HttpError(400, 'Ukendt handling.')
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const message = e instanceof Error ? e.message : String(e)
    console.error(message)
    return json({ error: message }, status)
  }
})
