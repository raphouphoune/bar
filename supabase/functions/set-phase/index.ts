// =========================================================================
//  Edge Function : set-phase
//  Transitions de phase déclenchées par l'hôte qui ne révèlent aucun secret :
//   - 'voting' : clôt la phase d'indices, ouvre le vote
//   - 'clue'   : relance un tour de discussion (après une élimination non
//                décisive ou une égalité) ; efface les votes en cours
//  Déploiement : supabase functions deploy set-phase
// =========================================================================
import { corsHeaders, json } from '../_shared/cors.ts'
import { getCtx, requireHost } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { roomId, roundId, phase } = await req.json()
    if (!roomId || !roundId || !phase) return json({ error: 'paramètres manquants' }, 400)
    if (!['voting', 'clue'].includes(phase)) return json({ error: 'phase non autorisée' }, 400)

    const ctx = await getCtx(req)
    if ('error' in ctx) return json({ error: ctx.error }, ctx.status)
    const host = await requireHost(ctx.admin, roomId, ctx.uid)
    if ('error' in host) return json({ error: host.error }, host.status)

    if (phase === 'clue') {
      // nouveau tour de discussion : on efface les votes et les indices
      await ctx.admin.from('votes').delete().eq('round_id', roundId)
      await ctx.admin.from('clues').delete().eq('round_id', roundId)
    }
    await ctx.admin.from('rounds').update({ phase }).eq('id', roundId)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
