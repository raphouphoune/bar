// ⚠️ checkWinner / points : COPIE MIROIR de src/lib/engine.ts. Garder synchronisé.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { Role } from './roles.ts'

export type WinnerTeam = 'civils' | 'undercover' | 'mr_white' | 'kamikaze'

// Le Kamikaze est un rôle SOLO : il ne compte pas dans la parité undercover.
// (Sa victoire est gérée séparément dans resolve-vote.)
const IMPOSTOR: Role[] = ['undercover', 'mr_white', 'parrain']

/** Vérifie les conditions de victoire à partir des rôles ENCORE vivants. */
export function checkWinner(aliveRoles: Role[]): WinnerTeam | null {
  const impostors = aliveRoles.filter((r) => IMPOSTOR.includes(r)).length
  const civils = aliveRoles.length - impostors
  if (impostors === 0) return 'civils'
  if (impostors >= civils) return 'undercover'
  return null
}

/** Points attribués à l'équipe gagnante (par rôle). */
const POINTS: Record<Role, Partial<Record<WinnerTeam, number>>> = {
  civil: { civils: 1 },
  taupe: {}, // géré séparément
  mercenaire: {}, // géré séparément
  undercover: { undercover: 2 },
  mr_white: { mr_white: 3 },
  kamikaze: { kamikaze: 3 },
  parrain: { undercover: 2 },
  traitre: { undercover: 2 },
}

/**
 * Termine la manche : révèle les mots, enregistre le gagnant et distribue
 * les points aux joueurs concernés.
 */
export async function finishRound(
  admin: SupabaseClient,
  roundId: string,
  winner: WinnerTeam,
) {
  const { data: secret } = await admin
    .from('round_secrets')
    .select('civil_word, undercover_word')
    .eq('round_id', roundId)
    .single()

  await admin
    .from('rounds')
    .update({
      phase: 'finished',
      winner_team: winner,
      revealed_civil_word: secret?.civil_word ?? null,
      revealed_undercover_word: secret?.undercover_word ?? null,
    })
    .eq('id', roundId)

  // Attribution des points
  const { data: roles } = await admin
    .from('round_roles')
    .select('player_id, role, knows_player_id')
    .eq('round_id', roundId)

  // État de vie actuel des joueurs (pour la Taupe)
  const playerIds = (roles ?? []).map((r) => r.player_id)
  const { data: alivePlayers } = await admin
    .from('players')
    .select('id, is_alive')
    .in('id', playerIds)
  const isAlive = new Map<string, boolean>(
    (alivePlayers ?? []).map((p) => [p.id, p.is_alive]),
  )

  for (const r of roles ?? []) {
    let pts: number
    if (r.role === 'taupe') {
      // Gagne avec undercovers si le joueur protégé est encore en vie
      pts =
        winner === 'undercover' && r.knows_player_id && isAlive.get(r.knows_player_id)
          ? 2
          : 0
    } else if (r.role === 'mercenaire') {
      // Gagne si sa cible (knows_player_id) a été éliminée
      pts = r.knows_player_id && !isAlive.get(r.knows_player_id) ? 3 : 0
    } else {
      pts = POINTS[r.role as Role]?.[winner] ?? 0
    }
    if (!pts) continue
    const { data: pl } = await admin
      .from('players')
      .select('score')
      .eq('id', r.player_id)
      .single()
    await admin
      .from('players')
      .update({ score: (pl?.score ?? 0) + pts })
      .eq('id', r.player_id)
  }
}
