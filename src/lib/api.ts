import { supabase, ensureAuth } from './supabase'
import type { Room, RoomSettings } from './types'

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans I/O/0/1 ambigus
  let c = ''
  for (let i = 0; i < 5; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)]
  return c
}

/** Crée une room + insère l'hôte comme joueur. Renvoie le code. */
export async function createRoom(name: string): Promise<string> {
  const uid = await ensureAuth()
  // quelques tentatives en cas de collision de code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({ code, host_id: uid })
      .select()
      .single()
    if (error) {
      if (error.code === '23505') continue // code déjà pris
      throw error
    }
    await supabase.from('players').insert({
      room_id: (room as Room).id,
      user_id: uid,
      name,
      is_host: true,
    })
    return code
  }
  throw new Error('Impossible de générer un code de partie, réessaie.')
}

/** Rejoint une room existante par code. */
export async function joinRoom(code: string, name: string): Promise<void> {
  const uid = await ensureAuth()
  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  if (error || !room) throw new Error('Partie introuvable. Vérifie le code.')

  // déjà dans la partie ? on met juste le nom à jour
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('room_id', (room as Room).id)
    .eq('user_id', uid)
    .maybeSingle()

  if (existing) {
    await supabase.from('players').update({ name }).eq('id', existing.id)
  } else {
    const { error: insErr } = await supabase
      .from('players')
      .insert({ room_id: (room as Room).id, user_id: uid, name })
    if (insErr) throw insErr
  }
}

export async function updateSettings(roomId: string, settings: RoomSettings) {
  const { error } = await supabase.from('rooms').update({ settings }).eq('id', roomId)
  if (error) throw error
}

export async function castVote(roundId: string, voterPlayerId: string, targetPlayerId: string) {
  const { error } = await supabase
    .from('votes')
    .upsert(
      { round_id: roundId, voter_player_id: voterPlayerId, target_player_id: targetPlayerId },
      { onConflict: 'round_id,voter_player_id' },
    )
  if (error) throw error
}

export async function leaveRoom(playerId: string) {
  await supabase.from('players').delete().eq('id', playerId)
}

/** Appelle une Edge Function avec le JWT courant. */
async function invoke<T = unknown>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) throw error
  if (data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error)
  }
  return data as T
}

export async function submitClue(roundId: string, playerId: string, clueText: string) {
  const { error } = await supabase
    .from('clues')
    .upsert(
      { round_id: roundId, player_id: playerId, clue_text: clueText },
      { onConflict: 'round_id,player_id' },
    )
  if (error) throw error
}

export const startRound = (roomId: string) => invoke('start-round', { roomId })
export const setPhase = (roomId: string, roundId: string, phase: 'voting' | 'clue') =>
  invoke('set-phase', { roomId, roundId, phase })
export const resolveVote = (roomId: string, roundId: string) =>
  invoke('resolve-vote', { roomId, roundId })
export const submitGuess = (roundId: string, guess: string) =>
  invoke<{ correct: boolean; winner: string | null }>('mrwhite-guess', { roundId, guess })
