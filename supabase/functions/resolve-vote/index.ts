// =========================================================================
//  Edge Function : resolve-vote
//  Dépouille les votes, élimine le joueur visé, gère les cas spéciaux
//  (Kamikaze démasqué = victoire ; Mr White démasqué = phase de devinette)
//  et vérifie les conditions de victoire. Tout est autoritaire (service role).
//  Déploiement : supabase functions deploy resolve-vote
// =========================================================================
import { corsHeaders, json } from '../_shared/cors.ts'
import { getCtx, requireHost } from '../_shared/auth.ts'
import { checkWinner, finishRound } from '../_shared/outcome.ts'
import { pickGage } from '../_shared/gages.ts'
import type { Role } from '../_shared/roles.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { roomId, roundId } = await req.json()
    if (!roomId || !roundId) return json({ error: 'paramètres manquants' }, 400)

    const ctx = await getCtx(req)
    if ('error' in ctx) return json({ error: ctx.error }, ctx.status)
    const host = await requireHost(ctx.admin, roomId, ctx.uid)
    if ('error' in host) return json({ error: host.error }, host.status)
    const { admin } = ctx
    const enableGages = !!(host.room.settings as { enableGages?: boolean })?.enableGages

    const { data: round } = await admin.from('rounds').select('*').eq('id', roundId).single()
    if (!round || round.phase !== 'voting') return json({ error: 'pas en phase de vote' }, 400)

    // Joueurs + rôles
    const { data: players } = await admin
      .from('players')
      .select('id, is_alive')
      .eq('room_id', roomId)
    const { data: roleRows } = await admin
      .from('round_roles')
      .select('player_id, role')
      .eq('round_id', roundId)
    const roleOf = new Map<string, Role>((roleRows ?? []).map((r) => [r.player_id, r.role as Role]))

    // Dépouillement — on ne compte QUE les votes valides côté serveur :
    // votant vivant ET cible vivante (la RLS n'empêche pas un client trafiqué
    // de voter en étant mort, ou de viser un joueur déjà éliminé).
    const aliveSet = new Set((players ?? []).filter((p) => p.is_alive).map((p) => p.id))
    const { data: votes } = await admin
      .from('votes')
      .select('voter_player_id, target_player_id')
      .eq('round_id', roundId)
    const tally = new Map<string, number>()
    for (const v of votes ?? []) {
      if (!aliveSet.has(v.voter_player_id) || !aliveSet.has(v.target_player_id)) continue
      tally.set(v.target_player_id, (tally.get(v.target_player_id) ?? 0) + 1)
    }
    let max = 0
    let leaders: string[] = []
    for (const [pid, c] of tally) {
      if (c > max) { max = c; leaders = [pid] }
      else if (c === max) leaders.push(pid)
    }

    // Égalité ou aucun vote => personne n'est éliminé, on revient discuter
    if (leaders.length !== 1 || max === 0) {
      await admin
        .from('rounds')
        .update({ phase: 'reveal', eliminated_player_id: null, eliminated_gage: null })
        .eq('id', roundId)
      return json({ ok: true, tie: true })
    }

    const eliminatedId = leaders[0]
    const eliminatedRole = roleOf.get(eliminatedId)!
    await admin.from('players').update({ is_alive: false }).eq('id', eliminatedId)
    await admin
      .from('rounds')
      .update({
        phase: 'reveal',
        eliminated_player_id: eliminatedId,
        // Le Parrain est révélé comme "civil" pour tromper les joueurs
        eliminated_role: eliminatedRole === 'parrain' ? 'civil' : eliminatedRole,
        eliminated_gage: enableGages ? pickGage() : null,
      })
      .eq('id', roundId)

    // Cas spéciaux
    if (eliminatedRole === 'kamikaze') {
      // Le Kamikaze ne gagne que s'il reste au moins un undercover (ou Mr White) en vie
      const undercoverAlive = (players ?? [])
        .filter((p) => p.id !== eliminatedId && p.is_alive)
        .some((p) => {
          const r = roleOf.get(p.id)
          return r === 'undercover' || r === 'mr_white' || r === 'parrain'
        })
      if (undercoverAlive) {
        await finishRound(admin, roundId, 'kamikaze')
        return json({ ok: true, eliminatedId, role: eliminatedRole, winner: 'kamikaze' })
      }
      // Plus d'undercover en vie → kamikaze éliminé sans gagner, flux normal
      const aliveRolesAfterKk: Role[] = (players ?? [])
        .filter((p) => p.id !== eliminatedId && p.is_alive)
        .map((p) => roleOf.get(p.id)!)
      const winnerAfterKk = checkWinner(aliveRolesAfterKk)
      if (winnerAfterKk) {
        await finishRound(admin, roundId, winnerAfterKk)
        return json({ ok: true, eliminatedId, role: eliminatedRole, winner: winnerAfterKk })
      }
      return json({ ok: true, eliminatedId, role: eliminatedRole, winner: null })
    }
    if (eliminatedRole === 'mr_white') {
      // Mr White a droit à sa tentative de devinette
      await admin.from('rounds').update({ phase: 'mrwhite_guess' }).eq('id', roundId)
      return json({ ok: true, eliminatedId, role: eliminatedRole, guess: true })
    }

    // Conditions de victoire à partir des survivants
    const aliveRoles: Role[] = (players ?? [])
      .filter((p) => p.id !== eliminatedId && p.is_alive)
      .map((p) => roleOf.get(p.id)!)
    const winner = checkWinner(aliveRoles)
    if (winner) {
      await finishRound(admin, roundId, winner)
      return json({ ok: true, eliminatedId, role: eliminatedRole, winner })
    }

    // Sinon la partie continue (l'hôte relancera un tour via set-phase 'clue')
    return json({ ok: true, eliminatedId, role: eliminatedRole, winner: null })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
