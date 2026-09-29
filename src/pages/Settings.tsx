import { useEffect, useState } from 'react'
import { fetchProviders, leaveCouple, updateProfile } from '../lib/api'
import { danishError } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { imageUrl } from '../lib/tmdb'
import type { Couple, Profile, Provider } from '../lib/types'

interface Props {
  profile: Profile
  couple: Couple
  onChange: () => void
}

export function Settings({ profile, couple, onChange }: Props) {
  const [name, setName] = useState(profile.display_name)
  const [selected, setSelected] = useState(new Set(profile.providers))
  const [filter, setFilter] = useState(profile.filter_providers)
  const [providers, setProviders] = useState<Provider[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProviders().then(setProviders).catch((e) => setError(danishError(e)))
  }, [])

  async function save(changes: Partial<Omit<Profile, 'id'>>) {
    setError(null)
    setMessage(null)
    try {
      await updateProfile(profile.id, changes)
      setMessage('Gemt.')
      onChange()
    } catch (e) {
      setError(danishError(e))
    }
  }

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
    save({ providers: [...next] })
  }

  async function leave() {
    if (!confirm('Vil du forlade parret? Jeres fælles watch list forsvinder, hvis I begge forlader det.')) return
    try {
      await leaveCouple()
      onChange()
    } catch (e) {
      setError(danishError(e))
    }
  }

  // De største tjenester vises først; resten kan foldes ud.
  const visible = providers && (showAll ? providers : providers.filter((p, i) => i < 16 || selected.has(p.id)))
  const partner = couple.members.find((m) => m.id !== profile.id)

  return (
    <div className="settings">
      <section className="card">
        <h2>Dit navn</h2>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            save({ display_name: name.trim() })
          }}
        >
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Visningsnavn" />
          <button disabled={name.trim() === profile.display_name}>Gem</button>
        </form>
      </section>

      <section className="card">
        <h2>Streamingtjenester</h2>
        <p className="muted">Vælg de tjenester, I har. Køen viser så kun titler, der ligger på dem.</p>
        <label className="check">
          <input
            type="checkbox"
            checked={filter}
            onChange={(e) => {
              setFilter(e.target.checked)
              save({ filter_providers: e.target.checked })
            }}
          />
          Vis kun titler på mine tjenester
        </label>
        {!visible ? (
          <p className="muted">Henter tjenester …</p>
        ) : (
          <>
            <ul className="provider-picker">
              {visible.map((p) => {
                const logo = imageUrl(p.logo, 'w92')
                return (
                  <li key={p.id}>
                    <label className={selected.has(p.id) ? 'on' : ''}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                      {logo && <img src={logo} alt="" />}
                      <span>{p.name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
            {providers && providers.length > visible.length && (
              <button className="link" onClick={() => setShowAll(true)}>Vis alle {providers.length} tjenester</button>
            )}
          </>
        )}
        {filter && selected.size === 0 && <p className="hint">Du har ikke valgt nogen tjenester, så køen er ikke filtreret.</p>}
      </section>

      <section className="card">
        <h2>Jeres par</h2>
        {partner ? (
          <p>Du er koblet sammen med <strong>{partner.display_name || 'din partner'}</strong>.</p>
        ) : (
          <p>
            Din partner mangler endnu. Invitationskoden er <strong className="code">{couple.invite_code}</strong>.
          </p>
        )}
        <div className="row wrap">
          <button onClick={leave}>Forlad parret</button>
          <button onClick={() => supabase.auth.signOut()}>Log ud</button>
        </div>
      </section>

      {message && <p className="ok">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
