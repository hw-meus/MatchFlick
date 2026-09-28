import { useEffect, useState } from 'react'

// Hash-baseret routing (fx #/watchlist), fordi GitHub Pages ikke kan falde
// tilbage til index.html ved direkte links til undersider.
export function currentRoute(): string {
  const hash = window.location.hash.replace(/^#/, '')
  return hash.startsWith('/') ? hash : '/'
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute)
  useEffect(() => {
    const onChange = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(path: string): void {
  window.location.hash = path
}
