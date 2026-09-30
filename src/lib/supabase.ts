import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

const CLOCK_SKEW_RETRIES = 4
const CLOCK_SKEW_DELAY_MS = 1500

// Lige efter login eller fornyelse af sessionen kan databasens API afvise den nye
// token med "JWT issued at future", fordi Supabases servere har lidt forskudte ure.
// Det går over af sig selv efter et par sekunder, så vent og prøv igen.
async function fetchWithClockSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init)
    if (res.status !== 401 || attempt >= CLOCK_SKEW_RETRIES) return res
    const body = await res.clone().text().catch(() => '')
    if (!/issued at future/i.test(body)) return res
    await new Promise((resolve) => setTimeout(resolve, CLOCK_SKEW_DELAY_MS))
  }
}

// Uden konfiguration bruges en pladsholder, så appen kan vise en fejlside i stedet for at gå ned.
export const supabase = createClient(url || 'http://localhost', key || 'mangler', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: fetchWithClockSkewRetry },
})
