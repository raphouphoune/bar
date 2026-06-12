import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface Ctx {
  admin: SupabaseClient
  uid: string
}

/** Identifie l'appelant et renvoie un client admin (service role). */
export async function getCtx(req: Request): Promise<Ctx | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data } = await userClient.auth.getUser()
  const uid = data.user?.id
  if (!uid) return { error: 'Non authentifié', status: 401 }

  return { admin: createClient(supabaseUrl, serviceKey), uid }
}

/** Vérifie que uid est bien l'hôte de la room ; renvoie la room. */
export async function requireHost(admin: SupabaseClient, roomId: string, uid: string) {
  const { data: room } = await admin.from('rooms').select('*').eq('id', roomId).single()
  if (!room) return { error: 'Room introuvable', status: 404 as const }
  if (room.host_id !== uid) return { error: "Seul l'hôte peut faire ça", status: 403 as const }
  return { room }
}
