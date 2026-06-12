import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, ensureAuth } from '../lib/supabase'
import type { MyRole, Player, Room, Round, Vote } from '../lib/types'

export interface RoomState {
  room: Room | null
  players: Player[]
  round: Round | null
  myRole: MyRole | null
  votes: Vote[]
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
      } else {
        setMyRole(null)
        setVotes([])
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
  useEffect(() => {
    if (!room) return
    const channel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, () => refreshRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, () => refreshRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `room_id=eq.${room.id}` }, () => refreshRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, () => refreshRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_roles' }, () => refreshRef.current())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [room?.id])

  const me = players.find((p) => p.user_id === uid) ?? null

  return { room, players, round, myRole, votes, me, uid, loading, error, refresh }
}
