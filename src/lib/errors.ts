// Oversætter kendte fejl fra Supabase til dansk. Ukendte fejl vises som de er.
export function danishError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e)
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Der er sendt for mange koder. Vent lidt, og prøv igen.'
  if (/expired|invalid.*otp|token has expired|otp.*invalid/i.test(msg)) return 'Koden er forkert eller udløbet. Prøv igen, eller få en ny kode.'
  if (/invalid.*email|email.*invalid/i.test(msg)) return 'E-mailadressen ser ikke gyldig ud.'
  if (/failed to fetch|network/i.test(msg)) return 'Ingen forbindelse. Tjek internettet, og prøv igen.'
  return msg
}
