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
import { orderAlive, type Role } from '../_shared/roles.ts'

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

    const now = new Date().toISOString()

    if (phase === 'clue') {
      // Nouveau tour de discussion : on efface les votes et les indices...
      await ctx.admin.from('votes').delete().eq('round_id', roundId)
      await ctx.admin.from('clues').delete().eq('round_id', roundId)

      // ...et on recalcule l'ordre de parole parmi les joueurs ENCORE vivants
      // (sinon un joueur éliminé garderait sa place / le badge "commence").
      const { data: alivePlayers } = await ctx.admin
        .from('players')
        .select('id')
        .eq('room_id', roomId)
        .eq('is_alive', true)
      const { data: roleRows } = await ctx.admin
        .from('round_roles')
        .select('player_id, role')
        .eq('round_id', roundId)
      const roleOf = new Map<string, Role>(
        (roleRows ?? []).map((r) => [r.player_id, r.role as Role]),
      )
      const alive = (alivePlayers ?? []).map((p) => ({ id: p.id, role: roleOf.get(p.id) ?? 'civil' }))

      if (alive.length > 0) {
        const { order, firstPlayerId } = orderAlive(alive)
        // Remet tout le monde à null (les morts sortent de l'ordre), puis réordonne les vivants.
        await ctx.admin.from('players').update({ turn_order: null }).eq('room_id', roomId)
        for (let i = 0; i < order.length; i++) {
          await ctx.admin.from('players').update({ turn_order: i }).eq('id', order[i])
        }
        await ctx.admin
          .from('rounds')
          .update({ phase, first_player_id: firstPlayerId, phase_started_at: now })
          .eq('id', roundId)
        return json({ ok: true })
      }
    }

    await ctx.admin.from('rounds').update({ phase, phase_started_at: now }).eq('id', roundId)

    return json({ ok: true })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
