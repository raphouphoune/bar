import type { Player, RoomSettings } from './types'

// Ré-export depuis le moteur canonique (compat. imports existants).
export { ROLE_COLOR } from './engine'

/**
 * Nombre de joueurs qui NE sont PAS de simples civils, pour vérifier l'équilibre.
 * On compte les undercovers, Mr White, Kamikaze, ainsi que la Taupe et le Traître
 * (qui jouent pour le camp undercover). Le Parrain remplace un undercover (déjà
 * compté) et le Mercenaire est neutre (compté comme un civil à l'affichage).
 */
export function impostorCount(s: RoomSettings): number {
  return (
    s.undercoverCount +
    (s.enableMrWhite ? 1 : 0) +
    (s.enableKamikaze ? 1 : 0) +
    (s.enableTaupe ? 1 : 0) +
    (s.enableTraitre ? 1 : 0)
  )
}

/** Réglages valides pour un nombre de joueurs donné ? (il faut une majorité de civils) */
export function settingsValid(s: RoomSettings, playerCount: number): string | null {
  if (playerCount < 3) return 'Il faut au moins 3 joueurs.'
  const imp = impostorCount(s)
  const civils = playerCount - imp
  if (s.undercoverCount < 1) return 'Il faut au moins 1 undercover.'
  if (imp >= playerCount) return 'Trop de rôles spéciaux pour ce nombre de joueurs.'
  if (civils <= imp) return 'Les civils doivent rester majoritaires.'
  return null
}

/** Réglages conseillés par défaut selon le nombre de joueurs. */
export function suggestedSettings(playerCount: number): Partial<RoomSettings> {
  if (playerCount <= 4) return { undercoverCount: 1, enableMrWhite: false }
  if (playerCount <= 6) return { undercoverCount: 1, enableMrWhite: true }
  if (playerCount <= 9) return { undercoverCount: 2, enableMrWhite: true }
  return { undercoverCount: 3, enableMrWhite: true }
}

export function alivePlayers(players: Player[]): Player[] {
  return players.filter((p) => p.is_alive)
}
