import { useEffect, useState } from 'react'
import type { RoomState } from '../hooks/useRoom'
import type { RevealedRole, Role } from '../lib/types'
import { ROLE_LABELS } from '../lib/types'
import { ROLE_COLOR } from '../lib/game'
import { supabase } from '../lib/supabase'
import { setPhase, resolveVote, submitGuess, castVote, startRound } from '../lib/api'

export default function Game({ state }: { state: RoomState }) {
  const { room, players, round, myRole, votes, me } = state
  if (!room || !round || !me) return null

  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? '—'

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between text-sm text-slate-400">
        <span>Manche {round.round_number}</span>
        <PhaseBadge phase={round.phase} />
      </header>

      {round.phase !== 'finished' && <MyWord myRole={myRole} nameOf={nameOf} />}

      {round.phase === 'clue' && <CluePhase state={state} />}
      {round.phase === 'voting' && <VotingPhase state={state} />}
      {round.phase === 'reveal' && <RevealPhase state={state} />}
      {round.phase === 'mrwhite_guess' && <MrWhiteGuess state={state} />}
      {round.phase === 'finished' && <Results state={state} />}

      {/* compteur de votes visible en phase de vote */}
      {round.phase === 'voting' && (
        <p className="text-center text-xs text-slate-500">
          {votes.length} / {players.filter((p) => p.is_alive).length} ont voté
        </p>
      )}
    </div>
  )
}

function PhaseBadge({ phase }: { phase: string }) {
  const label: Record<string, string> = {
    clue: 'Indices', voting: 'Vote', reveal: 'Révélation',
    mrwhite_guess: 'Mr White devine', finished: 'Terminé',
  }
  return <span className="rounded-full bg-slate-700 px-3 py-1 text-xs">{label[phase] ?? phase}</span>
}

// ---- Ma carte secrète (tap pour révéler) --------------------------------
function MyWord({ myRole, nameOf }: { myRole: RoomState['myRole']; nameOf: (id: string | null) => string }) {
  const [shown, setShown] = useState(false)
  if (!myRole) return <div className="rounded-2xl bg-slate-800/60 p-4 text-center text-slate-500">Attribution en cours…</div>

  const hasWord = myRole.word != null
  return (
    <button
      onClick={() => setShown((v) => !v)}
      className="rounded-2xl bg-slate-800/80 p-5 text-center ring-1 ring-white/10 active:scale-[0.99]"
    >
      {!shown ? (
        <span className="text-slate-400">👆 Appuie pour voir ton mot (cache ton écran)</span>
      ) : (
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">Ton mot</p>
          {hasWord ? (
            <p className="my-1 text-4xl font-black">{myRole.word}</p>
          ) : (
            <p className="my-1 text-2xl font-bold text-sky-300">Tu n'as pas de mot…</p>
          )}
          {myRole.role === 'taupe' && (
            <p className="text-sm text-purple-300">
              🕵️ Tu es la Taupe. L'undercover est <b>{nameOf(myRole.knows_player_id)}</b>. Protège-le !
            </p>
          )}
          {myRole.role === 'mr_white' && (
            <p className="text-sm text-sky-300">Tu es Mr White. Bluffe, puis devine le mot des civils.</p>
          )}
          {myRole.role === 'kamikaze' && (
            <p className="text-sm text-amber-300">Tu es le Kamikaze : fais-toi éliminer tant qu'un undercover est encore en vie 😈</p>
          )}
        </div>
      )}
    </button>
  )
}

// ---- Phase indices ------------------------------------------------------
function CluePhase({ state }: { state: RoomState }) {
  const { players, room, round, me } = state
  if (!me || !round || !room) return null
  const ordered = [...players]
    .filter((p) => p.turn_order != null)
    .sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0))
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
        <h3 className="mb-2 text-sm font-bold text-slate-300">Ordre de parole (à l'oral)</h3>
        <ol className="flex flex-col gap-1">
          {ordered.map((p, i) => (
            <li key={p.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${i === 0 ? 'bg-rose-500/20 ring-1 ring-rose-400/40' : 'bg-slate-900/60'} ${!p.is_alive ? 'opacity-40 line-through' : ''}`}>
              <span className="w-5 text-slate-500">{i + 1}.</span>
              <span>{p.name}</span>
              {i === 0 && <span className="ml-auto text-xs text-rose-300">commence</span>}
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          Chacun dit UN indice sur son mot, sans le prononcer.
        </p>
      </div>
      {me.is_host && (
        <HostButton onClick={() => setPhase(room!.id, round!.id, 'voting')}>
          Passer au vote
        </HostButton>
      )}
    </div>
  )
}

// ---- Phase vote ---------------------------------------------------------
function VotingPhase({ state }: { state: RoomState }) {
  const { players, room, round, me, votes } = state
  const [busy, setBusy] = useState(false)
  if (!me || !round || !room) return null
  const alive = players.filter((p) => p.is_alive)
  const myVote = votes.find((v) => v.voter_player_id === me.id)
  const tally = new Map<string, number>()
  for (const v of votes) tally.set(v.target_player_id, (tally.get(v.target_player_id) ?? 0) + 1)

  const myId = me.id
  const myAlive = me.is_alive
  const roundId = round.id
  async function vote(targetId: string) {
    if (!myAlive) return
    await castVote(roundId, myId, targetId)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-slate-300">
        {me.is_alive ? 'Vote pour éliminer un joueur' : 'Tu es éliminé : tu ne votes pas.'}
      </p>
      <div className="flex flex-col gap-2">
        {alive.map((p) => {
          const count = tally.get(p.id) ?? 0
          const isMine = myVote?.target_player_id === p.id
          return (
            <button
              key={p.id}
              disabled={!me.is_alive || p.id === me.id}
              onClick={() => vote(p.id)}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 transition active:scale-[0.99] disabled:opacity-40 ${isMine ? 'bg-rose-500/30 ring-rose-400' : 'bg-slate-800/60 ring-white/10'}`}
            >
              <span>{p.name}{p.id === me.id && ' (toi)'}</span>
              <span className="text-sm text-slate-400">{count > 0 ? `${count} vote${count > 1 ? 's' : ''}` : ''}</span>
            </button>
          )
        })}
      </div>
      {me.is_host && (
        <HostButton
          busy={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await resolveVote(room!.id, round!.id)
            } finally {
              setBusy(false)
            }
          }}
        >
          Dépouiller les votes
        </HostButton>
      )}
    </div>
  )
}

// ---- Phase révélation (partie continue) ---------------------------------
function RevealPhase({ state }: { state: RoomState }) {
  const { round, room, me } = state
  if (!me || !round || !room) return null
  const nameOf = (id: string | null) => state.players.find((p) => p.id === id)?.name ?? '—'
  const eliminated = round.eliminated_player_id
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-slate-800/60 p-5 text-center ring-1 ring-white/10">
        {eliminated ? (
          <>
            <p className="text-lg"><b>{nameOf(eliminated)}</b> est éliminé.</p>
            {round!.eliminated_role && (
              <p className={`mt-1 text-2xl font-black ${ROLE_COLOR[round!.eliminated_role]}`}>
                {ROLE_LABELS[round!.eliminated_role]}
              </p>
            )}
          </>
        ) : (
          <p className="text-lg">Égalité — personne n'est éliminé.</p>
        )}
        <p className="mt-2 text-sm text-slate-400">La partie continue.</p>
      </div>
      {me.is_host && (
        <HostButton onClick={() => setPhase(room!.id, round!.id, 'clue')}>
          Tour suivant
        </HostButton>
      )}
    </div>
  )
}

// ---- Mr White devine ----------------------------------------------------
function MrWhiteGuess({ state }: { state: RoomState }) {
  const { round, me } = state
  if (!me || !round) return null
  const amMrWhite = me.id === round.eliminated_player_id
  const [guess, setGuess] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  if (!amMrWhite) {
    return (
      <div className="rounded-2xl bg-sky-500/10 p-5 text-center ring-1 ring-sky-400/30">
        <p className="text-lg text-sky-200">🎩 Mr White a été démasqué !</p>
        <p className="mt-1 text-sm text-slate-300">Il tente de deviner le mot des civils…</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-sky-500/10 p-5 ring-1 ring-sky-400/30">
      <p className="text-center text-lg text-sky-200">🎩 Tu es démasqué, Mr White !</p>
      <p className="mt-1 text-center text-sm text-slate-300">Devine le mot des civils pour gagner :</p>
      <input
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        placeholder="Le mot des civils…"
        className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-lg ring-1 ring-white/10"
      />
      <button
        disabled={busy || guess.trim().length < 2}
        onClick={async () => {
          setBusy(true)
          setErr(null)
          try {
            await submitGuess(round!.id, guess.trim())
          } catch (e) {
            setErr(String(e))
          } finally {
            setBusy(false)
          }
        }}
        className="mt-3 w-full rounded-xl bg-sky-500 px-4 py-3 font-bold disabled:opacity-50"
      >
        Valider ma réponse
      </button>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
    </div>
  )
}

// ---- Résultats / fin de manche ------------------------------------------
const WINNER_LABEL: Record<string, string> = {
  civils: '🟢 Les Civils gagnent !',
  undercover: '🔴 Les Undercover gagnent !',
  mr_white: '🎩 Mr White gagne !',
  kamikaze: '😈 Le Kamikaze gagne !',
}

function Results({ state }: { state: RoomState }) {
  const { round, room, me, players } = state
  const [roles, setRoles] = useState<RevealedRole[]>([])
  const [busy, setBusy] = useState(false)
  const roundId = round?.id

  useEffect(() => {
    if (!roundId) return
    let active = true
    supabase
      .from('round_roles')
      .select('player_id, role, word')
      .eq('round_id', roundId)
      .then(({ data }) => { if (active) setRoles((data as RevealedRole[]) ?? []) })
    return () => { active = false }
  }, [roundId])

  if (!me || !round || !room) return null
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—'
  const scoreboard = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-slate-800/80 p-5 text-center ring-1 ring-white/10">
        <p className="text-2xl font-black">{WINNER_LABEL[round!.winner_team ?? ''] ?? 'Fin de manche'}</p>
        <div className="mt-3 flex justify-center gap-6 text-sm">
          <span>Civils : <b className="text-emerald-400">{round!.revealed_civil_word}</b></span>
          <span>Undercover : <b className="text-rose-400">{round!.revealed_undercover_word}</b></span>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
        <h3 className="mb-2 text-sm font-bold text-slate-300">Les rôles</h3>
        <ul className="flex flex-col gap-1">
          {roles.map((r) => (
            <li key={r.player_id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
              <span>{nameOf(r.player_id)}</span>
              <span className={`text-sm font-bold ${ROLE_COLOR[r.role as Role]}`}>{ROLE_LABELS[r.role as Role]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
        <h3 className="mb-2 text-sm font-bold text-slate-300">Scores</h3>
        <ul className="flex flex-col gap-1">
          {scoreboard.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
              <span>{i === 0 ? '👑 ' : ''}{p.name}</span>
              <b>{p.score}</b>
            </li>
          ))}
        </ul>
      </div>

      {me.is_host && (
        <HostButton
          busy={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await startRound(room!.id)
            } finally {
              setBusy(false)
            }
          }}
        >
          Nouvelle manche
        </HostButton>
      )}
      {!me.is_host && <p className="text-center text-slate-400">En attente de la prochaine manche…</p>}
    </div>
  )
}

// ---- Bouton hôte --------------------------------------------------------
function HostButton({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className="rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold disabled:opacity-50"
    >
      {children}
    </button>
  )
}
