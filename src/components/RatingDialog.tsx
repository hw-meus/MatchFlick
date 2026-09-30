import { useState } from 'react'
import type { SeasonsSeen } from '../lib/types'

interface Props {
  heading: string
  // Antal sæsoner, hvis titlen er en serie. Så kan man også angive, hvilke sæsoner man har set.
  seasonCount?: number | null
  initialRating?: number | null
  initialSeasons?: SeasonsSeen | null
  // Begge er null ved "spring over".
  onDone: (rating: number | null, seasons: SeasonsSeen | null) => void
  onCancel?: () => void
}

// Valgfri vurdering fra 1 til 5 stjerner og, for serier, hvilke sæsoner man har set.
export function RatingDialog({ heading, seasonCount, initialRating = null, initialSeasons = null, onDone, onCancel }: Props) {
  const [rating, setRating] = useState<number | null>(initialRating)
  const [seen, setSeen] = useState(new Set(initialSeasons?.seen ?? []))
  const [all, setAll] = useState(Boolean(initialSeasons?.all))
  const count = seasonCount ?? 0
  const numbers = Array.from({ length: count }, (_, i) => i + 1)

  function toggle(n: number) {
    const next = new Set(seen)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    setSeen(next)
    setAll(next.size === count)
  }

  function toggleAll() {
    const next = !all
    setAll(next)
    setSeen(new Set(next ? numbers : []))
  }

  const seasons: SeasonsSeen | null = count && (all || seen.size) ? { seen: [...seen].sort((a, b) => a - b), all } : null

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={heading}>
      <div className="dialog">
        <h2>{heading}</h2>
        <p className="muted">Hvor god var den? Du kan også springe over.</p>
        <Stars value={rating} onChange={setRating} />
        {count > 0 && (
          <>
            <p className="muted">Hvilke sæsoner har du set?</p>
            <div className="season-picker">
              <button type="button" className={`chip all${all ? ' on' : ''}`} aria-pressed={all} onClick={toggleAll}>
                Alle sæsoner
              </button>
              {numbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`chip${seen.has(n) ? ' on' : ''}`}
                  aria-pressed={seen.has(n)}
                  aria-label={`Sæson ${n}`}
                  onClick={() => toggle(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="row">
          {onCancel && <button className="link" onClick={onCancel}>Fortryd</button>}
          <button onClick={() => onDone(null, null)}>Spring over</button>
          <button className="primary" disabled={!rating && !seasons} onClick={() => onDone(rating, seasons)}>Gem</button>
        </div>
      </div>
    </div>
  )
}

export function Stars({ value, onChange, small }: { value: number | null; onChange?: (v: number) => void; small?: boolean }) {
  return (
    <div className={`stars${small ? ' small' : ''}`} role={onChange ? 'radiogroup' : undefined} aria-label="Vurdering">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ud af 5`}
            className={value !== null && n <= value ? 'on' : ''}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ) : (
          <span key={n} className={value !== null && n <= value ? 'on' : ''} aria-hidden="true">★</span>
        ),
      )}
      {!onChange && <span className="sr-only">{value ? `${value} ud af 5` : 'Ingen vurdering'}</span>}
    </div>
  )
}
