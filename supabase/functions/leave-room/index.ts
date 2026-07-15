// =========================================================================
//  Edge Function : leave-room
//  Un joueur quitte la partie. S'il était l'hôte, l'hôte est réattribué au
//  plus ancien joueur restant (sinon plus personne ne peut faire avancer la
//  partie — la RLS empêche un client de transférer host_id à quelqu'un d'autre).
//  Si la room est vide, elle est supprimée.
//  Déploiement : supabase functions deploy leave-room
// =========================================================================
import { corsHeaders, json } from '../_shared/cors.ts'
import { getCtx } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { playerId } = await req.json()
    if (!playerId) return json({ error: 'playerId requis' }, 400)

    const ctx = await getCtx(req)
    if ('error' in ctx) return json({ error: ctx.error }, ctx.status)
    const { admin, uid } = ctx

    // Le joueur doit appartenir à l'appelant.
    const { data: me } = await admin
      .from('players')
      .select('id, room_id, user_id, is_host')
      .eq('id', playerId)
      .single()
    if (!me || me.user_id !== uid) return json({ error: 'Joueur introuvable' }, 403)

    await admin.from('players').delete().eq('id', playerId)

    if (me.is_host) {
      const { data: remaining } = await admin
        .from('players')
        .select('id, user_id')
        .eq('room_id', me.room_id)
        .order('joined_at', { ascending: true })
        .limit(1)

      if (remaining && remaining.length > 0) {
        const next = remaining[0]
        await admin.from('players').update({ is_host: true }).eq('id', next.id)
        await admin.from('rooms').update({ host_id: next.user_id }).eq('id', me.room_id)
        return json({ ok: true, newHostId: next.id })
      }
      // Plus personne : on supprime la room (cascade sur rounds/votes/…).
      await admin.from('rooms').delete().eq('id', me.room_id)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
