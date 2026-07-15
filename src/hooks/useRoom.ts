import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, ensureAuth } from '../lib/supabase'
import type { Clue, MyRole, Player, Room, Round, Vote } from '../lib/types'

export interface RoomState {
  room: Room | null
  players: Player[]
  round: Round | null
  myRole: MyRole | null
  votes: Vote[]
  clues: Clue[]
  me: Player | null
  uid: string | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useRoom(code: string): RoomState {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [round, setRound] = useState<Round | null>(null)
  const [myRole, setMyRole] = useState<MyRole | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [clues, setClues] = useState<Clue[]>([])
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const roundIdRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const myUid = await ensureAuth()
      setUid(myUid)

      const { data: r } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', code.toUpperCase())
        .maybeSingle()
      if (!r) {
        setError('Partie introuvable')
        setLoading(false)
        return
      }
      const roomRow = r as Room
      setRoom(roomRow)

      const { data: pls } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomRow.id)
        .order('joined_at', { ascending: true })
      setPlayers((pls as Player[]) ?? [])

      // Manche courante (la plus récente)
      let currentRound: Round | null = null
      if (roomRow.current_round > 0) {
        const { data: rd } = await supabase
          .from('rounds')
          .select('*')
          .eq('room_id', roomRow.id)
          .order('round_number', { ascending: false })
          .limit(1)
          .maybeSingle()
        currentRound = (rd as Round) ?? null
      }
      setRound(currentRound)
      roundIdRef.current = currentRound?.id ?? null

      if (currentRound) {
        // Mon rôle (RLS : ne renvoie que ma ligne)
        const { data: mine } = await supabase
          .from('round_roles')
          .select('round_id, player_id, role, word, knows_player_id')
          .eq('round_id', currentRound.id)
          .maybeSingle()
        setMyRole((mine as MyRole) ?? null)

        const { data: vts } = await supabase
          .from('votes')
          .select('*')
          .eq('round_id', currentRound.id)
        setVotes((vts as Vote[]) ?? [])

        const { data: cls } = await supabase
          .from('clues')
          .select('*')
          .eq('round_id', currentRound.id)
          .order('submitted_at', { ascending: true })
        setClues((cls as Clue[]) ?? [])
      } else {
        setMyRole(null)
        setVotes([])
        setClues([])
      }

      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [code])

  // garde une réf vers le dernier refresh pour les callbacks realtime
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    refresh()
  }, [refresh])

  // Abonnement realtime : tout changement déclenche un refresh.
  // votes / clues / round_roles n'ont pas de room_id → on les filtre par la
  // manche courante (sinon on écouterait TOUTES les parties du serveur).
  const roundId = round?.id
  useEffect(() => {
    if (!room) return
    const cb = () => refreshRef.current()
    let channel = supabase
      .channel(`room:${room.id}:${roundId ?? 'lobby'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, cb)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${room.id}` }, cb)
    if (roundId) {
      channel = channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: `round_id=eq.${roundId}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'round_roles', filter: `round_id=eq.${roundId}` }, cb)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clues', filter: `round_id=eq.${roundId}` }, cb)
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [room?.id, roundId])

  const me = players.find((p) => p.user_id === uid) ?? null

  return { room, players, round, myRole, votes, clues, me, uid, loading, error, refresh }
}
