import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useRoute } from './router'
import { supabase, supabaseConfigured } from './lib/supabase'
import { loadCouple, loadMatch, loadProfile } from './lib/api'
import { danishError } from './lib/errors'
import type { Couple, Profile } from './lib/types'
import { Login } from './pages/Login'
import { CoupleSetup } from './pages/CoupleSetup'
import { Swipe } from './pages/Swipe'
import { Watchlist } from './pages/Watchlist'
import { SeenTogether } from './pages/SeenTogether'
import { Search } from './pages/Search'
import { Settings } from './pages/Settings'
import { About } from './pages/About'

// Mens man venter på, at partneren taster koden, tjekkes der jævnligt.
const PARTNER_POLL_MS = 5000

export function App() {
  const route = useRoute()
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabaseConfigured) {
    return (
      <Shell route={route}>
        <p className="error">Supabase er ikke sat op. Se README.</p>
      </Shell>
    )
  }
  if (session === undefined) return <Shell route={route}><p className="muted">Indlæser …</p></Shell>
  if (route === '/om') return <Shell route={route} nav={Boolean(session)}><About /></Shell>
  if (!session) return <Shell route={route}><Login /></Shell>
  return <LoggedIn key={session.user.id} userId={session.user.id} route={route} />
}

function LoggedIn({ userId, route }: { userId: string; route: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [couple, setCouple] = useState<Couple | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [matchVersion, setMatchVersion] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([loadProfile(userId), loadCouple(userId)])
      setProfile(p)
      setCouple(c)
      setError(null)
    } catch (e) {
      setError(danishError(e))
    }
  }, [userId])

  useEffect(() => {
    reload()
  }, [reload])

  const waitingForPartner = couple && couple.members.length < 2
  useEffect(() => {
    if (!waitingForPartner) return
    const t = setInterval(reload, PARTNER_POLL_MS)
    return () => clearInterval(t)
  }, [waitingForPartner, reload])

  // Realtime: nye matches vises med det samme på begge telefoner.
  const coupleId = couple?.id
  useEffect(() => {
    if (!coupleId) return
    const channel = supabase
      .channel(`matches:${coupleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `couple_id=eq.${coupleId}` },
        async (payload) => {
          setMatchVersion((v) => v + 1)
          if (payload.eventType === 'INSERT') {
            const match = await loadMatch((payload.new as { id: string }).id).catch(() => null)
            setToast(match ? `Nyt match: ${match.titles.metadata.title}` : 'Nyt match!')
          }
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [coupleId])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  let content
  if (error) {
    content = (
      <p className="error">
        {error} <button className="link" onClick={reload}>Prøv igen</button>
      </p>
    )
  } else if (!profile || couple === undefined) {
    content = <p className="muted">Indlæser …</p>
  } else if (!couple) {
    content = <CoupleSetup onDone={reload} />
  } else if (route === '/watchlist') {
    content = <Watchlist userId={userId} couple={couple} version={matchVersion} />
  } else if (route === '/soeg') {
    content = <Search userId={userId} />
  } else if (route === '/set') {
    content = <SeenTogether userId={userId} couple={couple} />
  } else if (route === '/indstillinger') {
    content = <Settings profile={profile} couple={couple} onChange={reload} />
  } else {
    content = (
      <>
        {waitingForPartner && (
          <p className="banner">
            Giv din partner koden <strong className="code">{couple.invite_code}</strong>. I kan først få matches, når I
            begge er med.
          </p>
        )}
        <Swipe userId={userId} />
      </>
    )
  }

  return (
    <Shell route={route} nav={Boolean(couple)}>
      {content}
      {toast && (
        <a className="toast" href="#/watchlist" role="status" onClick={() => setToast(null)}>
          🎉 {toast}
        </a>
      )}
    </Shell>
  )
}

function Shell({ route, nav, children }: { route: string; nav?: boolean; children: ReactNode }) {
  const link = (path: string, label: string) => (
    <a href={`#${path}`} aria-current={route === path ? 'page' : undefined}>{label}</a>
  )
  return (
    <main className="shell">
      <header className="top">
        <h1><a href="#/">MatchFlick</a></h1>
        {nav && (
          <nav className="nav">
            {link('/', 'Swipe')}
            {link('/soeg', 'Søg')}
            {link('/watchlist', 'Watch list')}
            {link('/set', 'Set')}
            {link('/indstillinger', 'Indstillinger')}
          </nav>
        )}
      </header>
      {children}
      {/* Om-siden med kildeangivelse til TMDB og JustWatch kan altid nås herfra. */}
      {route !== '/om' && (!nav || route !== '/') && (
        <p className="footer"><a href="#/om">Om MatchFlick og kilder</a></p>
      )}
    </main>
  )
}
