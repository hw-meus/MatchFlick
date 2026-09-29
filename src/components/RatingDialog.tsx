import { useState } from 'react'

interface Props {
  heading: string
  // null betyder "spring over".
  onDone: (rating: number | null) => void
  onCancel?: () => void
}

// Valgfri vurdering fra 1 til 5 stjerner.
export function RatingDialog({ heading, onDone, onCancel }: Props) {
  const [rating, setRating] = useState<number | null>(null)
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label={heading}>
      <div className="dialog">
        <h2>{heading}</h2>
        <p className="muted">Hvor god var den? Du kan også springe over.</p>
        <Stars value={rating} onChange={setRating} />
        <div className="row">
          {onCancel && <button className="link" onClick={onCancel}>Fortryd</button>}
          <button onClick={() => onDone(null)}>Spring over</button>
          <button className="primary" disabled={!rating} onClick={() => onDone(rating)}>Gem</button>
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
