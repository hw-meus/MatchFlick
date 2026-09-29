import { useState, type FormEvent } from 'react'
import { createCouple, joinCouple } from '../lib/api'
import { danishError } from '../lib/errors'

// Den første opretter et par og får en invitationskode, som den anden taster ind.
export function CoupleSetup({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone()
    } catch (e) {
      setError(danishError(e))
    } finally {
      setBusy(false)
    }
  }

  function join(e: FormEvent) {
    e.preventDefault()
    run(() => joinCouple(code))
  }

  return (
    <>
      <section className="card">
        <h2>Har din partner en kode?</h2>
        <form onSubmit={join} className="form">
          <label>
            Invitationskode
            <input
              className="code-input"
              autoCapitalize="characters"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="ABC234"
            />
          </label>
          <button className="primary" disabled={busy || code.length !== 6}>Kobl mig på</button>
        </form>
      </section>
      <section className="card">
        <h2>Eller start et nyt par</h2>
        <p>Du får en kode, som din partner skal taste ind på sin telefon.</p>
        <button onClick={() => run(createCouple)} disabled={busy}>Opret par</button>
      </section>
      {error && <p className="error">{error}</p>}
    </>
  )
}
