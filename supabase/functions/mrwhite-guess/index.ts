// =========================================================================
//  Edge Function : mrwhite-guess
//  Appelée par le joueur Mr White démasqué : il propose un mot. S'il devine
//  le mot des civils, il gagne. Sinon on reprend les conditions de victoire.
//  Déploiement : supabase functions deploy mrwhite-guess
// =========================================================================
import { corsHeaders, json } from '../_shared/cors.ts'
import { getCtx } from '../_shared/auth.ts'
import { checkWinner, finishRound } from '../_shared/outcome.ts'
import type { Role } from '../_shared/roles.ts'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlève les accents
    .replace(/[^a-z]/g, '')
    .trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { roundId, guess } = await req.json()
    if (!roundId || typeof guess !== 'string') return json({ error: 'paramètres manquants' }, 400)

    const ctx = await getCtx(req)
    if ('error' in ctx) return json({ error: ctx.error }, ctx.status)
    const { admin, uid } = ctx

    const { data: round } = await admin.from('rounds').select('*').eq('id', roundId).single()
    if (!round || round.phase !== 'mrwhite_guess') return json({ error: 'pas le moment' }, 400)

    // L'appelant doit être le Mr White éliminé
    const { data: me } = await admin
      .from('players')
      .select('id')
      .eq('room_id', round.room_id)
      .eq('user_id', uid)
      .single()
    if (!me || me.id !== round.eliminated_player_id) {
      return json({ error: "Seul Mr White peut deviner" }, 403)
    }

    const { data: secret } = await admin
      .from('round_secrets')
      .select('civil_word')
      .eq('round_id', roundId)
      .single()

    const correct = normalize(guess) === normalize(secret?.civil_word ?? '')

    if (correct) {
      await finishRound(admin, roundId, 'mr_white')
      return json({ ok: true, correct: true, winner: 'mr_white' })
    }

    // Raté : on reprend les conditions de victoire (Mr White déjà éliminé)
    const { data: players } = await admin
      .from('players')
      .select('id, is_alive')
      .eq('room_id', round.room_id)
    const { data: roleRows } = await admin
      .from('round_roles')
      .select('player_id, role')
      .eq('round_id', roundId)
    const roleOf = new Map<string, Role>((roleRows ?? []).map((r) => [r.player_id, r.role as Role]))
    const aliveRoles: Role[] = (players ?? [])
      .filter((p) => p.is_alive)
      .map((p) => roleOf.get(p.id)!)

    const winner = checkWinner(aliveRoles)
    if (winner) {
      await finishRound(admin, roundId, winner)
      return json({ ok: true, correct: false, winner })
    }
    // La partie continue
    await admin.from('rounds').update({ phase: 'reveal' }).eq('id', roundId)
    return json({ ok: true, correct: false, winner: null })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
