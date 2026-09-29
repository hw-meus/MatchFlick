import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key)

// Uden konfiguration bruges en pladsholder, så appen kan vise en fejlside i stedet for at gå ned.
export const supabase = createClient(url || 'http://localhost', key || 'mangler', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
