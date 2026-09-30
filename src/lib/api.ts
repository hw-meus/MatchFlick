import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Couple, Match, Profile, Provider, SwipeAction, Title } from './types'

async function invokeTmdb<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('tmdb', { body })
  if (error) {
    // Funktionen svarer med { error: "..." } på dansk; vis den besked frem for den generiske.
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      if (payload?.error) throw new Error(payload.error)
    }
    throw error
  }
  return data as T
}

// partnerLiked er de titler i portionen, som partneren har liket, og som derfor skal vises snart.
export async function fetchQueue(exclude: string[]): Promise<{ titles: Title[]; partnerLiked: string[] }> {
  return invokeTmdb<{ titles: Title[]; partnerLiked: string[] }>({ action: 'queue', exclude })
}

export async function fetchProviders(): Promise<Provider[]> {
  const { providers } = await invokeTmdb<{ providers: Provider[] }>({ action: 'providers' })
  return providers
}

export async function loadProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, providers, filter_providers')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (data) return data
  // Profilen oprettes normalt af en trigger ved første login, men opret den hvis den mangler.
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId })
    .select('id, display_name, providers, filter_providers')
    .single()
  if (insertError) throw insertError
  return created
}

export async function updateProfile(userId: string, changes: Partial<Omit<Profile, 'id'>>): Promise<void> {
  const { error } = await supabase.from('profiles').update(changes).eq('id', userId)
  if (error) throw error
}

export async function loadCouple(userId: string): Promise<Couple | null> {
  const { data: membership, error } = await supabase
    .from('couple_members')
    .select('couple_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!membership) return null

  const [coupleRes, membersRes] = await Promise.all([
    supabase.from('couples').select('id, invite_code, max_members').eq('id', membership.couple_id).single(),
    supabase.from('couple_members').select('user_id, joined_at').eq('couple_id', membership.couple_id).order('joined_at'),
  ])
  if (coupleRes.error) throw coupleRes.error
  if (membersRes.error) throw membersRes.error

  const ids = membersRes.data.map((m) => m.user_id)
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name, providers, filter_providers')
    .in('id', ids)
  if (profilesError) throw profilesError

  const members = ids.map(
    (id) => profiles.find((p) => p.id === id) ?? { id, display_name: '', providers: [], filter_providers: true },
  )
  return { ...coupleRes.data, members }
}

export async function createCouple(): Promise<string> {
  const { data, error } = await supabase.rpc('create_couple')
  if (error) throw error
  return data as string
}

export async function joinCouple(code: string): Promise<void> {
  const { error } = await supabase.rpc('join_couple', { code })
  if (error) throw error
}

export async function leaveCouple(): Promise<void> {
  const { error } = await supabase.rpc('leave_couple')
  if (error) throw error
}

export async function saveSwipe(userId: string, titleId: string, action: SwipeAction, rating?: number | null): Promise<void> {
  const { error } = await supabase.from('swipes').upsert({
    user_id: userId,
    title_id: titleId,
    action,
    rating: action === 'seen' ? rating ?? null : null,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
}

const SNOOZE_DAYS = 30

export async function snooze(userId: string, titleId: string): Promise<void> {
  const until = new Date(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase.from('snoozed').upsert({ user_id: userId, title_id: titleId, until })
  if (error) throw error
}

const MATCH_SELECT = 'id, couple_id, title_id, created_at, status, seen_at, ratings, titles(id, tmdb_id, media_type, metadata)'

export async function loadMatches(): Promise<Match[]> {
  const { data, error } = await supabase.from('matches').select(MATCH_SELECT).order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Match[]
}

export async function loadMatch(id: string): Promise<Match | null> {
  const { data, error } = await supabase.from('matches').select(MATCH_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as Match | null
}

export async function setMatchStatus(id: string, status: Match['status']): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .update({ status, seen_at: status === 'seen' ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

export async function rateMatch(id: string, rating: number | null): Promise<void> {
  const { error } = await supabase.rpc('rate_match', { match_id: id, rating })
  if (error) throw error
}
