export type Role = 'civil' | 'undercover' | 'mr_white' | 'kamikaze' | 'taupe' | 'mercenaire' | 'traitre' | 'parrain'

export type RoomStatus = 'lobby' | 'playing' | 'finished'

export type RoundPhase =
  | 'assigning'
  | 'clue'
  | 'voting'
  | 'reveal'
  | 'mrwhite_guess'
  | 'finished'

export type WinnerTeam = 'civils' | 'undercover' | 'mr_white' | 'kamikaze' | null

export interface RoomSettings {
  undercoverCount: number
  enableMrWhite: boolean
  enableKamikaze: boolean
  enableTaupe: boolean
  enableMercenaire: boolean
  enableTraitre: boolean
  enableParrain: boolean
  remoteMode: boolean
  /** Score à atteindre pour gagner la soirée. 0 = parties illimitées. */
  targetScore: number
  /** Durée du minuteur de discussion en secondes. 0 = pas de minuteur. */
  timerSeconds: number
}

export const DEFAULT_SETTINGS: RoomSettings = {
  undercoverCount: 1,
  enableMrWhite: true,
  enableKamikaze: false,
  enableTaupe: false,
  enableMercenaire: false,
  enableTraitre: false,
  enableParrain: false,
  remoteMode: false,
  targetScore: 0,
  timerSeconds: 0,
}

export interface Clue {
  id: string
  round_id: string
  player_id: string
  clue_text: string
  submitted_at: string
}

export interface Room {
  id: string
  code: string
  host_id: string
  status: RoomStatus
  current_round: number
  settings: RoomSettings
  created_at: string
}

export interface Player {
  id: string
  room_id: string
  user_id: string
  name: string
  is_host: boolean
  is_alive: boolean
  score: number
  turn_order: number | null
  joined_at: string
}

export interface Round {
  id: string
  room_id: string
  round_number: number
  phase: RoundPhase
  first_player_id: string | null
  eliminated_player_id: string | null
  eliminated_role: Role | null
  winner_team: WinnerTeam
  revealed_civil_word: string | null
  revealed_undercover_word: string | null
  created_at: string
}

/** Rôle révélé d'un joueur (lecture autorisée seulement en fin de manche). */
export interface RevealedRole {
  player_id: string
  role: Role
  word: string | null
}

/** Lecture restreinte par RLS : un joueur ne lit que SA ligne. */
export interface MyRole {
  round_id: string
  player_id: string
  role: Role
  word: string | null
  // Taupe : id de l'undercover connu. Mercenaire : id de la cible.
  knows_player_id: string | null
}

export interface Vote {
  id: string
  round_id: string
  voter_player_id: string
  target_player_id: string
}

export const ROLE_LABELS: Record<Role, string> = {
  civil: 'Civil',
  undercover: 'Undercover',
  mr_white: 'Mr White',
  kamikaze: 'Kamikaze',
  taupe: 'La Taupe',
  mercenaire: 'Le Mercenaire',
  traitre: 'Le Traître',
  parrain: 'Le Parrain',
}
