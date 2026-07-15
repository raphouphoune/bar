import { useEffect, useState } from 'react'
import type { RoomState } from '../hooks/useRoom'
import type { RevealedRole, Role } from '../lib/types'
import { ROLE_LABELS } from '../lib/types'
import { ROLE_COLOR, WINNER_LABELS, clueAngle, duoGroups } from '../lib/engine'
import { supabase } from '../lib/supabase'
import { setPhase, resolveVote, submitGuess, castVote, startRound, submitClue } from '../lib/api'
import Timer from './Timer'

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
        <span className="text-slate-400">Appuie pour voir ton mot — cache ton écran</span>
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
              Tu es la Taupe. L'undercover est <b>{nameOf(myRole.knows_player_id)}</b>. Protège-le.
            </p>
          )}
          {myRole.role === 'mr_white' && (
            <p className="text-sm text-sky-300">Tu es Mr White. Bluffe, puis devine le mot des civils.</p>
          )}
          {myRole.role === 'kamikaze' && (
            <p className="text-sm text-amber-300">Tu es le Kamikaze. Fais-toi éliminer tant qu'un undercover est encore en vie.</p>
          )}
          {myRole.role === 'mercenaire' && (
            <p className="text-sm text-orange-300">
              Tu es le Mercenaire. Ta cible secrète est <b>{nameOf(myRole.knows_player_id)}</b>. Fais-la éliminer pour gagner !
            </p>
          )}
          {myRole.role === 'traitre' && (
            <p className="text-sm text-red-400">Tu es le Traître. Tu gagnes avec les undercovers, mais tu ne sais pas qui ils sont.</p>
          )}
          {myRole.role === 'parrain' && (
            <p className="text-sm text-fuchsia-300">Tu es le Parrain. Si tu es éliminé, tu seras révélé comme Civil.</p>
          )}
          {(myRole.role === 'undercover' || myRole.role === 'parrain') && myRole.knows_player_id && (
            <p className="text-sm text-rose-300">
              Complice : <b>{nameOf(myRole.knows_player_id)}</b>
            </p>
          )}
          {myRole.partner_player_id && (
            <p className="text-sm text-cyan-300">
              Binôme : <b>{nameOf(myRole.partner_player_id)}</b>
            </p>
          )}
        </div>
      )}
    </button>
  )
}

function ClueAngleBanner({ round, room }: { round: RoomState['round']; room: RoomState['room'] }) {
  if (!round || !room?.settings?.enableClueAngles) return null
  return (
    <div className="rounded-2xl bg-indigo-500/15 p-3 text-center ring-1 ring-indigo-400/30">
      <p className="text-xs uppercase tracking-widest text-indigo-300">Ton indice doit être…</p>
      <p className="text-lg font-bold text-indigo-100">{clueAngle(round.round_number)}</p>
    </div>
  )
}

// ---- Phase indices ------------------------------------------------------
function CluePhase({ state }: { state: RoomState }) {
  const { room } = state
  const isRemote = room?.settings?.remoteMode ?? false
  if (isRemote) return <RemoteCluePhase state={state} />
  return <VerbalCluePhase state={state} />
}

function VerbalCluePhase({ state }: { state: RoomState }) {
  const { players, room, round, me } = state
  if (!me || !round || !room) return null
  const ordered = [...players]
    .filter((p) => p.turn_order != null)
    .sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0))
  return (
    <div className="flex flex-col gap-4">
      <Timer seconds={room.settings?.timerSeconds ?? 0} resetKey={round.id} startedAt={round.phase_started_at} />
      <ClueAngleBanner round={round} room={room} />
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

function RemoteCluePhase({ state }: { state: RoomState }) {
  const { players, room, round, me, clues } = state
  const [myClue, setMyClue] = useState('')
  const [busy, setBusy] = useState(false)

  if (!me || !round || !room) return null

  const ordered = [...players]
    .filter((p) => p.turn_order != null)
    .sort((a, b) => (a.turn_order ?? 0) - (b.turn_order ?? 0))

  const mySubmitted = clues.find((c) => c.player_id === me.id)
  const alive = players.filter((p) => p.is_alive)
  const submittedCount = clues.filter((c) => alive.some((p) => p.id === c.player_id)).length
  const blind = room.settings?.blindMode ?? false
  const allIn = submittedCount >= alive.length
  // Mode caché : les indices ne se révèlent que lorsque TOUT le monde a joué.
  const revealed = blind ? allIn || !me.is_alive : !!mySubmitted || !me.is_alive

  async function handleSubmit() {
    if (!round || myClue.trim().length < 1) return
    setBusy(true)
    try {
      await submitClue(round.id, me!.id, myClue.trim())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Timer seconds={room.settings?.timerSeconds ?? 0} resetKey={round.id} startedAt={round.phase_started_at} />
      <ClueAngleBanner round={round} room={room} />
      <div className="flex items-center justify-between rounded-2xl bg-slate-800/60 px-4 py-3 ring-1 ring-white/10">
        <span className="text-sm font-bold text-slate-300">Mode à distance</span>
        <span className="text-sm text-slate-400">{submittedCount}/{alive.length} indices</span>
      </div>

      <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
        <h3 className="mb-2 text-sm font-bold text-slate-300">Indices</h3>
        <ol className="flex flex-col gap-2">
          {ordered.map((p, i) => {
            if (!p.is_alive) return null
            const submitted = clues.find((c) => c.player_id === p.id)
            const isMe = p.id === me.id
            return (
              <li
                key={p.id}
                className={`rounded-xl px-3 py-2 ${isMe ? 'bg-rose-500/10 ring-1 ring-rose-400/20' : 'bg-slate-900/60'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 text-xs text-slate-500">{i + 1}.</span>
                    <span className={isMe ? 'font-bold' : ''}>{p.name}{isMe && ' (toi)'}</span>
                  </span>
                  {submitted
                    ? <span className="text-xs text-emerald-400">✓</span>
                    : <span className="text-xs text-slate-500">···</span>
                  }
                </div>
                {submitted && revealed && (
                  <p className="mt-1 pl-6 text-sm italic text-slate-300">"{submitted.clue_text}"</p>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      {me.is_alive && (
        <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
          {mySubmitted ? (
            <p className="text-sm text-slate-300">
              Ton indice : <span className="font-bold text-white">"{mySubmitted.clue_text}"</span>
              <span className="ml-2 text-xs text-emerald-400">✓ envoyé</span>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-400">Tape ton indice (un seul mot)</label>
              <input
                value={myClue}
                onChange={(e) => setMyClue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="Un mot…"
                maxLength={50}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-lg outline-none ring-1 ring-white/10 focus:ring-rose-400"
              />
              <button
                disabled={busy || myClue.trim().length < 1}
                onClick={handleSubmit}
                className="w-full rounded-xl bg-rose-500 py-2.5 font-bold disabled:opacity-40"
              >
                {busy ? '…' : 'Envoyer'}
              </button>
            </div>
          )}
        </div>
      )}

      {!revealed && me.is_alive && (
        <p className="text-center text-xs text-slate-500">
          {blind
            ? 'Les indices seront révélés quand tout le monde aura joué.'
            : 'Tu verras les indices des autres après avoir envoyé le tien.'}
        </p>
      )}

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
  const { players, room, round, me, votes, clues } = state
  const [busy, setBusy] = useState(false)
  if (!me || !round || !room) return null
  const isRemote = room.settings?.remoteMode ?? false
  const blind = room.settings?.blindMode ?? false
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
      {isRemote && clues.length > 0 && (
        <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
          <h3 className="mb-2 text-sm font-bold text-slate-300">Récapitulatif des indices</h3>
          <ul className="flex flex-col gap-1">
            {clues.map((clue) => {
              const player = players.find((p) => p.id === clue.player_id)
              return (
                <li key={clue.id} className="flex items-center gap-2 rounded-lg bg-slate-900/60 px-3 py-2 text-sm">
                  <span className="font-bold">{player?.name ?? '—'}</span>
                  <span className="text-slate-500">—</span>
                  <span className="italic text-slate-300">"{clue.clue_text}"</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
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
              <span className="text-sm text-slate-400">{!blind && count > 0 ? `${count} vote${count > 1 ? 's' : ''}` : ''}</span>
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
      {eliminated && round.eliminated_gage && (
        <div className="rounded-2xl bg-amber-500/15 p-4 text-center ring-1 ring-amber-400/40">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Gage pour {nameOf(eliminated)}
          </p>
          <p className="mt-1 text-lg font-semibold text-amber-100">{round.eliminated_gage}</p>
        </div>
      )}
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
        <p className="text-lg text-sky-200">Mr White a été démasqué !</p>
        <p className="mt-1 text-sm text-slate-300">Il tente de deviner le mot des civils…</p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-sky-500/10 p-5 ring-1 ring-sky-400/30">
      <p className="text-center text-lg text-sky-200">Tu es démasqué, Mr White !</p>
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
function Results({ state }: { state: RoomState }) {
  const { round, room, me, players } = state
  const [roles, setRoles] = useState<RevealedRole[]>([])
  const [busy, setBusy] = useState(false)
  const roundId = round?.id

  useEffect(() => {
    if (!roundId) return
    let active = true
    const cols = 'player_id, role, word' + (room?.settings?.enableBinome ? ', partner_player_id' : '')
    supabase
      .from('round_roles')
      .select(cols)
      .eq('round_id', roundId)
      .then(({ data }) => { if (active) setRoles((data as unknown as RevealedRole[]) ?? []) })
    return () => { active = false }
  }, [roundId, room?.settings?.enableBinome])

  if (!me || !round || !room) return null
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? '—'

  const enableBinome = room.settings?.enableBinome ?? false
  const scoreOf = (id: string) => players.find((p) => p.id === id)?.score ?? 0
  const partnerOf: Record<string, string> = {}
  for (const r of roles) if (r.partner_player_id) partnerOf[r.player_id] = r.partner_player_id

  // Classement par duo (mode Binôme) ou par joueur.
  const groups = enableBinome
    ? duoGroups(players.map((p) => p.id), partnerOf)
    : players.map((p) => [p.id])
  const ranked = groups
    .map((ids) => ({ ids, total: ids.reduce((sum, id) => sum + scoreOf(id), 0) }))
    .sort((a, b) => b.total - a.total)
  const groupLabel = (ids: string[]) => ids.map(nameOf).join(' & ')

  const targetScore = room.settings?.targetScore ?? 0
  const topTotal = ranked[0]?.total ?? 0
  const nightWinners =
    targetScore > 0 && topTotal >= targetScore ? ranked.filter((g) => g.total === topTotal) : []

  return (
    <div className="flex flex-col gap-4">
      {nightWinners.length > 0 && (
        <div className="rounded-2xl bg-amber-500/15 p-5 text-center ring-1 ring-amber-400/40">
          <p className="mt-1 text-xl font-black text-amber-300">
            {nightWinners.map((g) => groupLabel(g.ids)).join(' · ')} {nightWinners.length > 1 ? 'remportent' : 'remporte'} la soirée !
          </p>
          <p className="mt-1 text-sm text-slate-300">{topTotal} points atteints (objectif : {targetScore}).</p>
        </div>
      )}
      <div className="rounded-2xl bg-slate-800/80 p-5 text-center ring-1 ring-white/10">
        <p className="text-2xl font-black">{(round!.winner_team && WINNER_LABELS[round!.winner_team]) ?? 'Fin de manche'}</p>
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
        <h3 className="mb-2 text-sm font-bold text-slate-300">{enableBinome ? 'Scores (par binôme)' : 'Scores'}</h3>
        <ul className="flex flex-col gap-1">
          {ranked.map((g) => (
            <li key={g.ids.join('-')} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
              <span>{groupLabel(g.ids)}</span>
              <b>{g.total}</b>
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
