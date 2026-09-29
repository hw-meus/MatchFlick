import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { danishError } from '../lib/errors'

// Login med e-mail og en sekscifret engangskode (ikke et link), fordi en app på
// hjemmeskærmen på iPhone ikke deler session med Safari.
export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } })
    setBusy(false)
    if (error) setError(danishError(error))
    else {
      setStep('code')
      setCode('')
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setError(danishError(error))
  }

  return (
    <section className="card">
      <h2>Log ind</h2>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="form">
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dig@eksempel.dk"
            />
          </label>
          <button className="primary" disabled={busy || !email.trim()}>
            {busy ? 'Sender …' : 'Send kode'}
          </button>
          <p className="hint">Du får en e-mail med en kode på seks cifre. Har du ikke en konto, bliver den oprettet.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="form">
          <p>Vi har sendt en kode til <strong>{email}</strong>.</p>
          <label>
            Kode
            <input
              className="code-input"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
          </label>
          <button className="primary" disabled={busy || code.length < 6}>
            {busy ? 'Tjekker …' : 'Log ind'}
          </button>
          <div className="row">
            <button type="button" className="link" onClick={() => sendCode()} disabled={busy}>
              Send en ny kode
            </button>
            <button type="button" className="link" onClick={() => setStep('email')} disabled={busy}>
              Brug en anden e-mail
            </button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
