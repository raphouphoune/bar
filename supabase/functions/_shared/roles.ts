// Attribution des rôles, côté serveur (autoritaire et secret).

export type Role = 'civil' | 'undercover' | 'mr_white' | 'kamikaze' | 'taupe' | 'mercenaire' | 'traitre' | 'parrain'

export interface Settings {
  undercoverCount: number
  enableMrWhite: boolean
  enableKamikaze: boolean
  enableTaupe: boolean
  enableMercenaire: boolean
  enableTraitre: boolean
  enableParrain: boolean
}

export interface Assignment {
  playerId: string
  role: Role
  knowsPlayerId?: string // taupe → id undercover connu ; mercenaire → id de la cible
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
 * knowsPlayerId dans Assignment : taupe → undercover connu ; mercenaire → cible.
 */
export function assignRoles(
  playerIds: string[],
  s: Settings,
): { assignments: Assignment[] } {
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

  const assignments: Assignment[] = ids.map((playerId, i) => ({ playerId, role: roles[i] }))

  // Taupe : transforme un civil (connaît un undercover)
  if (s.enableTaupe) {
    const civils = assignments.filter((a) => a.role === 'civil')
    const undercovers = assignments.filter((a) => a.role === 'undercover')
    if (civils.length >= 2 && undercovers.length >= 1) {
      const c = shuffle(civils)[0]
      c.role = 'taupe'
      c.knowsPlayerId = shuffle(undercovers)[0].playerId
    }
  }

  // Parrain : transforme un undercover (garde le mot undercover, révélé comme civil)
  if (s.enableParrain) {
    const undercovers = assignments.filter((a) => a.role === 'undercover')
    if (undercovers.length >= 1) {
      shuffle(undercovers)[0].role = 'parrain'
    }
  }

  // Traître : transforme un civil (garde le mot civil, gagne avec undercovers)
  if (s.enableTraitre) {
    const civils = assignments.filter((a) => a.role === 'civil')
    if (civils.length >= 2) {
      shuffle(civils)[0].role = 'traitre'
    }
  }

  // Mercenaire : transforme un civil (gagne si sa cible aléatoire est éliminée)
  if (s.enableMercenaire) {
    const civils = assignments.filter((a) => a.role === 'civil')
    if (civils.length >= 1) {
      const merc = shuffle(civils)[0]
      merc.role = 'mercenaire'
      const others = assignments.filter((a) => a.playerId !== merc.playerId)
      merc.knowsPlayerId = shuffle(others)[0].playerId
    }
  }

  return { assignments }
}

/** Premier joueur : tiré au sort parmi ceux qui ont un mot (jamais Mr White / Kamikaze). */
export function pickFirstPlayer(assignments: Assignment[]): string {
  const eligible = assignments.filter(
    (a) => a.role === 'civil' || a.role === 'undercover' || a.role === 'taupe',
  )
  return shuffle(eligible)[0].playerId
}
