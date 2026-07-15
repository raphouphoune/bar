// =========================================================================
//  MOTEUR DE JEU — logique pure, canonique (navigateur).
//  Utilisé directement par le mode local (LocalGame) et par les composants.
//
//  ⚠️ Les Edge Functions Deno (supabase/functions/_shared/*) NE PEUVENT PAS
//     importer depuis src/. Elles en sont une COPIE MIROIR : toute évolution
//     de ce fichier doit être répercutée dans _shared/{roles,outcome,words,
//     gages}.ts (et inversement). Les règles ci-dessous font foi.
// =========================================================================
import type { Role, WinnerTeam } from './types'

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---- Conditions de victoire ---------------------------------------------

/**
 * Rôles comptés dans la parité undercover. Le Kamikaze est un rôle SOLO :
 * il n'est PAS un imposteur ici (sa victoire est gérée à l'élimination).
 */
export const IMPOSTOR_ROLES: Role[] = ['undercover', 'mr_white', 'parrain']

/** Vérifie les conditions de victoire à partir des rôles ENCORE vivants. */
export function checkWinner(aliveRoles: Role[]): WinnerTeam {
  const impostors = aliveRoles.filter((r) => IMPOSTOR_ROLES.includes(r)).length
  const civils = aliveRoles.length - impostors
  if (impostors === 0) return 'civils'
  if (impostors >= civils) return 'undercover'
  return null
}

// ---- Attribution des rôles ----------------------------------------------

export interface RoleFlags {
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
  /** Taupe → l'undercover connu ; Mercenaire → la cible ; sinon null. */
  knowsPlayerId: string | null
}

/**
 * Distribue les rôles parmi les playerIds (ids mélangés en interne).
 * Ordre de transformation : Taupe → Parrain → Traître → Mercenaire.
 */
export function assignRoles(playerIds: string[], s: RoleFlags): Assignment[] {
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
    knowsPlayerId: null,
  }))

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

  // Parrain : transforme un undercover (mot undercover, révélé comme civil)
  if (s.enableParrain) {
    const undercovers = assignments.filter((a) => a.role === 'undercover')
    if (undercovers.length >= 1) {
      shuffle(undercovers)[0].role = 'parrain'
    }
  }

  // Traître : transforme un civil (mot civil, gagne avec les undercovers)
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

  return assignments
}

export interface WordPair {
  civil: string
  undercover: string
}

/** Mot reçu par un rôle. Seul Mr White n'a pas de mot. */
export function wordForRole(role: Role, pair: WordPair): string | null {
  if (role === 'undercover' || role === 'parrain') return pair.undercover
  if (role === 'mr_white') return null
  return pair.civil
}

/**
 * Premier joueur : tiré au sort parmi ceux qui ont un mot (tous sauf Mr White).
 * Renvoie l'ordre complet + le premier joueur.
 */
export function orderAlive(alive: { id: string; role: Role }[]): {
  order: string[]
  firstPlayerId: string
} {
  const shuffled = shuffle(alive)
  const eligible = shuffled.filter((a) => a.role !== 'mr_white')
  const first = (eligible[0] ?? shuffled[0]).id
  const order = [first, ...shuffled.map((a) => a.id).filter((id) => id !== first)]
  return { order, firstPlayerId: first }
}

// ---- Points --------------------------------------------------------------

const ROLE_POINTS: Record<Role, Partial<Record<NonNullable<WinnerTeam>, number>>> = {
  civil: { civils: 1 },
  undercover: { undercover: 2 },
  mr_white: { mr_white: 3 },
  kamikaze: { kamikaze: 3 },
  parrain: { undercover: 2 },
  traitre: { undercover: 2 },
  taupe: {}, // géré via ctx
  mercenaire: {}, // géré via ctx
}

/**
 * Points gagnés par un rôle selon l'équipe gagnante.
 * - Taupe : gagne avec les undercovers SI son protégé est encore en vie.
 * - Mercenaire : gagne (peu importe l'issue) SI sa cible a été éliminée.
 */
export function pointsFor(
  role: Role,
  winner: WinnerTeam,
  ctx: { protectedAlive?: boolean; targetEliminated?: boolean } = {},
): number {
  if (role === 'taupe') return winner === 'undercover' && ctx.protectedAlive ? 2 : 0
  if (role === 'mercenaire') return ctx.targetEliminated ? 3 : 0
  if (!winner) return 0
  return ROLE_POINTS[role]?.[winner] ?? 0
}

// ---- Normalisation (comparaison du mot de Mr White) ----------------------

/** Minuscule, sans accents ni ponctuation. Identique à l'Edge Function. */
export function normalizeWord(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '')
    .trim()
}

// ---- Packs de mots statiques --------------------------------------------

export interface WordPack {
  id: string
  label: string
  pairs: [string, string][]
}

export const WORD_PACKS: WordPack[] = [
  {
    id: 'classique',
    label: 'Classique',
    pairs: [
      ['chat', 'tigre'], ['café', 'thé'], ['vélo', 'moto'], ['plage', 'désert'],
      ['guitare', 'violon'], ['pizza', 'tarte'], ['roi', 'empereur'],
      ['médecin', 'infirmier'], ['château', 'palais'], ['lune', 'soleil'],
      ['requin', 'dauphin'], ['avion', 'hélicoptère'], ['livre', 'cahier'],
      ['fantôme', 'vampire'], ['fleur', 'arbre'], ['stylo', 'crayon'],
      ['bière', 'vin'], ['hamburger', 'sandwich'], ['chaussette', 'gant'],
      ['montagne', 'colline'], ['rivière', 'lac'], ['hiver', 'automne'],
      ['banane', 'mangue'], ['table', 'bureau'], ['couteau', 'fourchette'],
      ['football', 'rugby'], ['piscine', 'mer'], ['printemps', 'été'],
      ['corbeau', 'aigle'], ['souris', 'rat'], ['chocolat', 'caramel'],
      ['bus', 'tramway'], ['manteau', 'veste'], ['sorcière', 'fée'],
      ['prison', 'école'], ['chanteur', 'musicien'], ['bougie', 'lampe'],
      ['pelouse', 'gazon'], ['brosse', 'peigne'], ['valise', 'sac'],
      ['fraise', 'cerise'], ['orange', 'mandarine'], ['lapin', 'lièvre'],
      ['ski', 'surf'], ['kayak', 'canoë'], ['église', 'cathédrale'],
      ['boulanger', 'pâtissier'], ['professeur', 'instituteur'],
      ['perroquet', 'corbeau'], ['loup', 'renard'], ['épée', 'lance'],
      ['cinéma', 'théâtre'], ['usine', 'atelier'], ['marché', 'supermarché'],
    ],
  },
  {
    id: 'bar',
    label: 'Bar',
    pairs: [
      ['bière', 'vin'], ['mojito', 'margarita'], ['whisky', 'rhum'], ['vodka', 'gin'],
      ['pastis', 'martini'], ['champagne', 'crémant'], ['tequila', 'mezcal'],
      ['cacahuètes', 'chips'], ['glaçon', 'paille'], ['pinte', 'chope'],
      ['barman', 'serveur'], ['comptoir', 'terrasse'], ['tireuse', 'bouteille'],
      ['shooter', 'cocktail'], ['gueule de bois', 'migraine'], ['apéro', 'digestif'],
      ['cidre', 'kir'], ['limonade', 'soda'], ['café', 'thé'], ['tournée', 'addition'],
    ],
  },
  {
    id: 'pop',
    label: 'Culture pop',
    pairs: [
      ['Batman', 'Superman'], ['Mario', 'Luigi'], ['Pikachu', 'Salamèche'],
      ['Naruto', 'Sasuke'], ['Harry Potter', 'Gandalf'], ['Dark Vador', 'Yoda'],
      ['Iron Man', 'Captain America'], ['Sherlock', 'Poirot'], ['Zelda', 'Peach'],
      ['Goku', 'Vegeta'], ['Simpson', 'Griffin'], ['Netflix', 'Youtube'],
      ['TikTok', 'Instagram'], ['PlayStation', 'Xbox'], ['Marvel', 'DC'],
      ['Star Wars', 'Star Trek'], ['Pokémon', 'Digimon'], ['Minecraft', 'Fortnite'],
    ],
  },
  {
    id: 'soiree',
    label: 'Soirée',
    pairs: [
      ['crush', 'date'], ['ex', 'plan'], ['selfie', 'story'], ['dancefloor', 'bar'],
      ['flirt', 'drague'], ['bisou', 'câlin'], ['ghosting', 'friendzone'],
      ['after', 'apéro'], ['boîte', 'bar'], ['playlist', 'ambiance'],
      ['smartphone', 'appli de rencontre'], ['tinder', 'instagram'],
      ['soirée pyjama', 'boum'], ['karaoké', 'blind test'], ['gage', 'défi'],
    ],
  },
]

/** Tire une paire dans un pack statique (mélange civil/undercover). */
export function pickWordPair(packId: string): WordPair {
  const pack = WORD_PACKS.find((p) => p.id === packId) ?? WORD_PACKS[0]
  const [a, b] = pack.pairs[Math.floor(Math.random() * pack.pairs.length)]
  return Math.random() < 0.5 ? { civil: a, undercover: b } : { civil: b, undercover: a }
}

// ---- Gages (mode bar) ----------------------------------------------------

export const GAGES: string[] = [
  'Cul sec !',
  'Distribue 2 gorgées à qui tu veux.',
  'Bois une gorgée.',
  'Raconte ta pire soirée.',
  "Imite un autre joueur jusqu'au prochain vote.",
  "Fais une déclaration d'amour à ton voisin de gauche.",
  "Parle avec l'accent de ton choix jusqu'à la fin de la manche.",
  "Chante le refrain d'une chanson choisie par le groupe.",
  'Interdit de dire "oui" ou "non" jusqu\'au prochain vote.',
  "Offre la prochaine tournée (ou un verre d'eau, soyons sérieux).",
]

export function pickGage(): string {
  return GAGES[Math.floor(Math.random() * GAGES.length)]
}

// ---- Libellés / couleurs partagés ---------------------------------------

export const WINNER_LABELS: Record<NonNullable<WinnerTeam>, string> = {
  civils: 'Les Civils gagnent',
  undercover: 'Les Undercover gagnent',
  mr_white: 'Mr White gagne',
  kamikaze: 'Le Kamikaze gagne',
}

export const ROLE_COLOR: Record<Role, string> = {
  civil: 'text-emerald-400',
  undercover: 'text-rose-400',
  mr_white: 'text-sky-300',
  kamikaze: 'text-amber-400',
  taupe: 'text-purple-400',
  mercenaire: 'text-orange-400',
  traitre: 'text-red-500',
  parrain: 'text-fuchsia-400',
}
