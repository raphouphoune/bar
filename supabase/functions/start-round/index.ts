// =========================================================================
//  Edge Function : start-round
//  Démarre une nouvelle manche : tire les mots (ConceptNet), attribue les
//  rôles, choisit le premier joueur. TOUT est fait côté serveur pour que
//  personne ne puisse lire les rôles/mots des autres.
//
//  Déploiement : supabase functions deploy start-round
// =========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'
import { assignRoles, pickFirstPlayer, type Settings } from '../_shared/roles.ts'
import { getWordPair } from '../_shared/words.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { roomId } = await req.json()
    if (!roomId) return json({ error: 'roomId requis' }, 400)

    const authHeader = req.headers.get('Authorization') ?? ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Client "utilisateur" pour identifier l'appelant
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await userClient.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return json({ error: 'Non authentifié' }, 401)

    // Client admin pour les écritures autoritaires
    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Vérifie que l'appelant est l'hôte
    const { data: room, error: roomErr } = await admin
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()
    if (roomErr || !room) return json({ error: 'Room introuvable' }, 404)
    if (room.host_id !== uid) return json({ error: 'Seul l\'hôte peut démarrer' }, 403)

    // 2. Joueurs de la room
    const { data: players, error: pErr } = await admin
      .from('players')
      .select('id')
      .eq('room_id', roomId)
    if (pErr || !players || players.length < 3) {
      return json({ error: 'Il faut au moins 3 joueurs' }, 400)
    }

    const settings = room.settings as Settings & { wordPack?: string }
    const playerIds = players.map((p) => p.id)

    // 3. Réinitialise tout le monde "vivant", remet l'ordre à plat
    await admin
      .from('players')
      .update({ is_alive: true, turn_order: null })
      .eq('room_id', roomId)

    // 4. Rôles + mots
    const { assignments } = assignRoles(playerIds, settings)
    const { civil, undercover } = await getWordPair(settings.wordPack)
    const firstPlayerId = pickFirstPlayer(assignments)
    const roundNumber = (room.current_round ?? 0) + 1

    // 5. Crée la manche
    const { data: round, error: rErr } = await admin
      .from('rounds')
      .insert({
        room_id: roomId,
        round_number: roundNumber,
        phase: 'clue',
        first_player_id: firstPlayerId,
        phase_started_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (rErr || !round) return json({ error: 'Création manche échouée' }, 500)

    // 6. Secret des mots (jamais lisible côté client)
    await admin.from('round_secrets').insert({
      round_id: round.id,
      civil_word: civil,
      undercover_word: undercover,
    })

    // 7. Rôles par joueur (RLS : chacun ne lira que sa ligne)
    const roleRows = assignments.map((a) => ({
      round_id: round.id,
      player_id: a.playerId,
      role: a.role,
      word:
        a.role === 'undercover' || a.role === 'parrain'
          ? undercover
          : a.role === 'mr_white'
            ? null
            : civil, // civil, taupe, kamikaze, traître, mercenaire reçoivent le mot civil
      knows_player_id: a.knowsPlayerId ?? null,
    }))
    await admin.from('round_roles').insert(roleRows)

    // 8. Ordre de parole : premier = firstPlayerId, puis ordre aléatoire
    const order = [firstPlayerId, ...playerIds.filter((id) => id !== firstPlayerId)]
    for (let i = 0; i < order.length; i++) {
      await admin.from('players').update({ turn_order: i }).eq('id', order[i])
    }

    // 9. Met la room en "playing"
    await admin
      .from('rooms')
      .update({ status: 'playing', current_round: roundNumber })
      .eq('id', roomId)

    return json({ ok: true, roundId: round.id, roundNumber })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
