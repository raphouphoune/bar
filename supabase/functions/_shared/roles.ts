// Attribution des rôles, côté serveur (autoritaire et secret).

export type Role = 'civil' | 'undercover' | 'mr_white' | 'kamikaze' | 'taupe'

export interface Settings {
  undercoverCount: number
  enableMrWhite: boolean
  enableKamikaze: boolean
  enableTaupe: boolean
}

export interface Assignment {
  playerId: string
  role: Role
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Distribue les rôles parmi les playerIds.
 * La Taupe est un civil "amélioré" : elle compte côté civils mais connaît
 * un undercover. On la prélève donc sur le quota de civils.
 */
export function assignRoles(
  playerIds: string[],
  s: Settings,
): { assignments: Assignment[]; taupeKnows?: string } {
  const ids = shuffle(playerIds)
  const n = ids.length

  let undercover = Math.max(1, Math.min(s.undercoverCount, n - 2))
  const mrWhite = s.enableMrWhite && n - undercover > 2 ? 1 : 0
  const kamikaze = s.enableKamikaze && n - undercover - mrWhite > 2 ? 1 : 0

  // garde une majorité de civils
  while (undercover + mrWhite + kamikaze >= n - undercover) {
    if (undercover > 1) undercover--
    else break
  }

  const roles: Role[] = []
  for (let i = 0; i < undercover; i++) roles.push('undercover')
  for (let i = 0; i < mrWhite; i++) roles.push('mr_white')
  for (let i = 0; i < kamikaze; i++) roles.push('kamikaze')
  while (roles.length < n) roles.push('civil')

  const assignments: Assignment[] = ids.map((playerId, i) => ({
    playerId,
    role: roles[i],
  }))

  // Taupe : transforme un civil en taupe s'il y a au moins un undercover.
  let taupeKnows: string | undefined
  if (s.enableTaupe) {
    const civils = assignments.filter((a) => a.role === 'civil')
    const undercovers = assignments.filter((a) => a.role === 'undercover')
    if (civils.length >= 2 && undercovers.length >= 1) {
      const c = shuffle(civils)[0]
      c.role = 'taupe'
      taupeKnows = shuffle(undercovers)[0].playerId
    }
  }

  return { assignments, taupeKnows }
}

/** Premier joueur : tiré au sort parmi ceux qui ont un mot (jamais Mr White / Kamikaze). */
export function pickFirstPlayer(assignments: Assignment[]): string {
  const eligible = assignments.filter(
    (a) => a.role === 'civil' || a.role === 'undercover' || a.role === 'taupe',
  )
  return shuffle(eligible)[0].playerId
}
