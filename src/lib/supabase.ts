import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  // Aide au debug pendant le dev : message clair si le .env n'est pas rempli.
  console.error(
    'Variables Supabase manquantes. Copie .env.example en .env et remplis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

/** S'assure qu'on a une identité (anonyme) ; renvoie l'user id. */
export async function ensureAuth(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user.id
  const { data: signed, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signed.user!.id
}
