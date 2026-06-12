import type { Player, RoomSettings, Role } from './types'

/** Nombre total d'imposteurs (undercover + mr white + kamikaze) selon les réglages. */
export function impostorCount(s: RoomSettings): number {
  return (
    s.undercoverCount +
    (s.enableMrWhite ? 1 : 0) +
    (s.enableKamikaze ? 1 : 0)
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

/** Couleur d'accent par rôle (pour les écrans de révélation). */
export const ROLE_COLOR: Record<Role, string> = {
  civil: 'text-emerald-400',
  undercover: 'text-rose-400',
  mr_white: 'text-sky-300',
  kamikaze: 'text-amber-400',
  taupe: 'text-purple-400',
}
