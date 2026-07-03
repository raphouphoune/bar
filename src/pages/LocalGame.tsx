import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

type Role = 'civil' | 'undercover' | 'mr_white' | 'kamikaze' | 'taupe' | 'mercenaire' | 'traitre' | 'parrain'
type WinnerTeam = 'civils' | 'undercover' | 'mr_white' | 'kamikaze' | null
type Phase = 'setup' | 'revealing' | 'clue' | 'voting' | 'vote_result' | 'mr_white_guess' | 'manche_over'

interface Player {
  id: string
  name: string
  isAlive: boolean
  score: number
  role: Role | null
  word: string | null
  taupeKnows: string | null
  mercenaireTarget: string | null
}

interface Settings {
  undercoverCount: number
  enableMrWhite: boolean
  enableKamikaze: boolean
  enableTaupe: boolean
  enableMercenaire: boolean
  enableTraitre: boolean
  enableParrain: boolean
}

const DEFAULT_SETTINGS: Settings = {
  undercoverCount: 1,
  enableMrWhite: true,
  enableKamikaze: false,
  enableTaupe: false,
  enableMercenaire: false,
  enableTraitre: false,
  enableParrain: false,
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const WORD_PAIRS: [string, string][] = [
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
]

function pickWordPair(): { civil: string; undercover: string } {
  const [a, b] = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)]
  return Math.random() < 0.5 ? { civil: a, undercover: b } : { civil: b, undercover: a }
}

function assignRoles(
  alive: Player[],
  s: Settings,
  words: { civil: string; undercover: string },
): Player[] {
  const shuffled = shuffle(alive)
  const n = shuffled.length

  let uc = Math.max(1, Math.min(s.undercoverCount, n - 2))
  const mw = s.enableMrWhite && n - uc > 2 ? 1 : 0
  const kk = s.enableKamikaze && n - uc - mw > 2 ? 1 : 0
  while (uc + mw + kk >= n - uc && uc > 1) uc--

  const roles: Role[] = []
  for (let i = 0; i < uc; i++) roles.push('undercover')
  for (let i = 0; i < mw; i++) roles.push('mr_white')
  for (let i = 0; i < kk; i++) roles.push('kamikaze')
  while (roles.length < n) roles.push('civil')

  const result: Player[] = shuffled.map((p, i) => ({
    ...p,
    role: roles[i],
    word:
      roles[i] === 'undercover' ? words.undercover
      : roles[i] === 'mr_white' ? null
      : words.civil,
    taupeKnows: null,
    mercenaireTarget: null,
  }))

  // Taupe : transforme un civil en taupe (connaît un undercover)
  if (s.enableTaupe) {
    const civils = result.filter((p) => p.role === 'civil')
    const undercovers = result.filter((p) => p.role === 'undercover')
    if (civils.length >= 2 && undercovers.length >= 1) {
      const taupe = shuffle(civils)[0]
      const target = shuffle(undercovers)[0]
      const idx = result.findIndex((p) => p.id === taupe.id)
      result[idx] = { ...result[idx], role: 'taupe', word: words.civil, taupeKnows: target.id }
    }
  }

  // Parrain : transforme un undercover en parrain (garde le mot undercover)
  if (s.enableParrain) {
    const undercovers = result.filter((p) => p.role === 'undercover')
    if (undercovers.length >= 1) {
      const parrain = shuffle(undercovers)[0]
      const idx = result.findIndex((p) => p.id === parrain.id)
      result[idx] = { ...result[idx], role: 'parrain' }
    }
  }

  // Traître : transforme un civil en traître (garde le mot civil, gagne avec undercovers)
  if (s.enableTraitre) {
    const civils = result.filter((p) => p.role === 'civil')
    if (civils.length >= 2) {
      const traitre = shuffle(civils)[0]
      const idx = result.findIndex((p) => p.id === traitre.id)
      result[idx] = { ...result[idx], role: 'traitre' }
    }
  }

  // Mercenaire : transforme un civil en mercenaire, lui assigne une cible aléatoire
  if (s.enableMercenaire) {
    const civils = result.filter((p) => p.role === 'civil')
    if (civils.length >= 1) {
      const mercenaire = shuffle(civils)[0]
      const others = result.filter((p) => p.id !== mercenaire.id)
      const target = shuffle(others)[0]
      const idx = result.findIndex((p) => p.id === mercenaire.id)
      result[idx] = { ...result[idx], role: 'mercenaire', mercenaireTarget: target.id }
    }
  }

  return result
}

function checkWinner(players: Player[]): WinnerTeam {
  const alive = players.filter((p) => p.isAlive)
  const impostors = alive.filter((p) =>
    ['undercover', 'mr_white', 'kamikaze', 'parrain'].includes(p.role ?? ''),
  ).length
  const civils = alive.length - impostors
  if (impostors === 0) return 'civils'
  if (impostors >= civils) return 'undercover'
  return null
}

const POINTS: Partial<Record<Role, Partial<Record<NonNullable<WinnerTeam>, number>>>> = {
  civil: { civils: 1 },
  undercover: { undercover: 2 },
  mr_white: { mr_white: 3 },
  kamikaze: { kamikaze: 3 },
  parrain: { undercover: 2 },
  traitre: { undercover: 2 },
  // taupe et mercenaire : gérés séparément dans awardPoints
}

function awardPoints(players: Player[], w: NonNullable<WinnerTeam>): Player[] {
  return players.map((p) => {
    if (p.role === 'taupe') {
      if (w === 'undercover') {
        const protectedAlive = players.some((u) => u.id === p.taupeKnows && u.isAlive)
        return { ...p, score: p.score + (protectedAlive ? 2 : 0) }
      }
      return p
    }
    if (p.role === 'mercenaire') {
      // Gagne si sa cible a été éliminée à un moment dans la partie
      const targetEliminated = players.some((u) => u.id === p.mercenaireTarget && !u.isAlive)
      return { ...p, score: p.score + (targetEliminated ? 3 : 0) }
    }
    return { ...p, score: p.score + (p.role ? (POINTS[p.role]?.[w] ?? 0) : 0) }
  })
}

function settingsError(s: Settings, n: number): string | null {
  if (n < 3) return 'Il faut au moins 3 joueurs.'
  const imp = s.undercoverCount + (s.enableMrWhite ? 1 : 0) + (s.enableKamikaze ? 1 : 0)
  if (imp >= n) return 'Trop de rôles spéciaux pour ce nombre de joueurs.'
  if (n - imp <= imp) return 'Les civils doivent rester majoritaires.'
  return null
}

const ROLE_LABELS: Record<Role, string> = {
  civil: 'Civil',
  undercover: 'Undercover',
  mr_white: 'Mr White',
  kamikaze: 'Kamikaze',
  taupe: 'La Taupe',
  mercenaire: 'Le Mercenaire',
  traitre: 'Le Traître',
  parrain: 'Le Parrain',
}

const ROLE_COLOR: Record<Role, string> = {
  civil: 'text-emerald-400',
  undercover: 'text-rose-400',
  mr_white: 'text-sky-300',
  kamikaze: 'text-amber-400',
  taupe: 'text-purple-400',
  mercenaire: 'text-orange-400',
  traitre: 'text-red-500',
  parrain: 'text-fuchsia-400',
}

const WINNER_LABEL: Record<NonNullable<WinnerTeam>, string> = {
  civils: 'Les Civils gagnent',
  undercover: 'Les Undercover gagnent',
  mr_white: 'Mr White gagne',
  kamikaze: 'Le Kamikaze gagne',
}

type ToggleKey = 'enableMrWhite' | 'enableKamikaze' | 'enableTaupe' | 'enableMercenaire' | 'enableTraitre' | 'enableParrain'
const TOGGLES: [ToggleKey, string, string][] = [
  ['enableMrWhite', 'Mr White', 'sans mot, doit bluffer puis deviner'],
  ['enableKamikaze', 'Kamikaze', "gagne s'il se fait éliminer avant les undercovers"],
  ['enableTaupe', 'La Taupe', 'civil qui connaît un undercover, gagne avec eux'],
  ['enableMercenaire', 'Le Mercenaire', 'gagne si sa cible secrète est éliminée'],
  ['enableTraitre', 'Le Traître', 'civil qui gagne avec les undercovers (sans les connaître)'],
  ['enableParrain', 'Le Parrain', "undercover révélé comme Civil à l'élimination"],
]

const card = 'rounded-2xl bg-slate-800/60 p-5 ring-1 ring-white/10'

export default function LocalGame() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<Player[]>([])
  const [nameInput, setNameInput] = useState('')
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [civilWord, setCivilWord] = useState('')
  const [undercoverWord, setUndercoverWord] = useState('')
  const [turnOrder, setTurnOrder] = useState<string[]>([])
  const [revealIndex, setRevealIndex] = useState(0)
  const [wordShown, setWordShown] = useState(false)
  const [eliminatedId, setEliminatedId] = useState<string | null>(null)
  const [winner, setWinner] = useState<WinnerTeam>(null)
  const [mrGuess, setMrGuess] = useState('')
  const [selectedVote, setSelectedVote] = useState<string | null>(null)
  const [manche, setManche] = useState(0)
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewPlayerId, setReviewPlayerId] = useState<string | null>(null)
  const [reviewWordShown, setReviewWordShown] = useState(false)

  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? '—'

  function openReview() {
    setReviewMode(true)
    setReviewPlayerId(null)
    setReviewWordShown(false)
  }

  function closeReview() {
    setReviewMode(false)
    setReviewPlayerId(null)
    setReviewWordShown(false)
  }

  function addPlayer() {
    const n = nameInput.trim()
    if (n.length < 2 || players.some((p) => p.name.toLowerCase() === n.toLowerCase())) return
    setPlayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: n, isAlive: true, score: 0, role: null, word: null, taupeKnows: null, mercenaireTarget: null },
    ])
    setNameInput('')
  }

  function startGame(basePlayers: Player[], resetScores = false) {
    const base = basePlayers.map((p) => ({
      ...p,
      score: resetScores ? 0 : p.score,
      isAlive: true,
      role: null as Role | null,
      word: null as string | null,
      taupeKnows: null as string | null,
      mercenaireTarget: null as string | null,
    }))
    const words = pickWordPair()
    setCivilWord(words.civil)
    setUndercoverWord(words.undercover)
    const assigned = assignRoles(base, settings, words)
    setPlayers(assigned)
    const order = shuffle(assigned.filter((p) => p.isAlive)).map((p) => p.id)
    setTurnOrder(order)
    setRevealIndex(0)
    setWordShown(false)
    setEliminatedId(null)
    setWinner(null)
    setMrGuess('')
    setSelectedVote(null)
    setManche((m) => m + 1)
    setPhase('revealing')
  }

  function handleEliminate() {
    if (!selectedVote) return
    const id = selectedVote
    setSelectedVote(null)
    const updated = players.map((p) => (p.id === id ? { ...p, isAlive: false } : p))
    const elim = updated.find((p) => p.id === id)!
    setEliminatedId(id)

    if (elim.role === 'kamikaze') {
      const undercoverAlive = updated.some(
        (p) => p.isAlive && (p.role === 'undercover' || p.role === 'mr_white' || p.role === 'parrain'),
      )
      if (undercoverAlive) {
        setPlayers(awardPoints(updated, 'kamikaze'))
        setWinner('kamikaze')
        setPhase('vote_result')
        return
      }
      // Plus d'undercover en vie → kamikaze éliminé sans gagner, flux normal
      const w = checkWinner(updated)
      if (w) {
        setPlayers(awardPoints(updated, w))
        setWinner(w)
      } else {
        setPlayers(updated)
      }
      setPhase('vote_result')
      return
    }

    if (elim.role === 'mr_white') {
      setPlayers(updated)
      setPhase('vote_result')
      return
    }

    const w = checkWinner(updated)
    if (w) {
      setPlayers(awardPoints(updated, w))
      setWinner(w)
    } else {
      setPlayers(updated)
    }
    setPhase('vote_result')
  }

  function handleContinueFromResult() {
    if (winner) {
      setPhase('manche_over')
      return
    }
    const elim = players.find((p) => p.id === eliminatedId)
    if (elim?.role === 'mr_white') {
      setPhase('mr_white_guess')
      return
    }
    setTurnOrder((prev) => prev.filter((id) => id !== eliminatedId))
    setPhase('clue')
  }

  function handleMrWhiteSubmit() {
    const correct = mrGuess.trim().toLowerCase() === civilWord.toLowerCase()
    if (correct) {
      setPlayers(awardPoints(players, 'mr_white'))
      setWinner('mr_white')
      setPhase('manche_over')
      return
    }
    const w = checkWinner(players)
    if (w) {
      setPlayers(awardPoints(players, w))
      setWinner(w)
      setPhase('manche_over')
    } else {
      setTurnOrder((prev) => prev.filter((id) => id !== eliminatedId))
      setPhase('clue')
    }
  }

  // ---- Setup ----
  if (phase === 'setup') {
    const err = settingsError(settings, players.length)
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-4">
        <header className="text-center">
          <h1 className="text-3xl font-black">
            Mode <span className="text-amber-400">Meneur</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Un seul téléphone pour tout le groupe</p>
        </header>

        <div className={card}>
          <h2 className="mb-3 text-sm font-bold text-slate-300">Joueurs ({players.length})</h2>
          <ul className="mb-3 flex flex-col gap-1">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2"
              >
                <span>{p.name}</span>
                <button
                  onClick={() => setPlayers((prev) => prev.filter((x) => x.id !== p.id))}
                  className="text-slate-500 hover:text-rose-400"
                >
                  ✕
                </button>
              </li>
            ))}
            {players.length === 0 && (
              <li className="text-center text-sm text-slate-500">Aucun joueur</li>
            )}
          </ul>
          <div className="flex gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
              placeholder="Prénom du joueur"
              maxLength={16}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2 outline-none ring-1 ring-white/10 focus:ring-rose-400"
            />
            <button
              onClick={addPlayer}
              className="rounded-xl bg-slate-700 px-4 py-2 text-xl font-bold active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        <div className={card}>
          <h2 className="mb-3 text-sm font-bold text-slate-300">Réglages</h2>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm">Nombre d'undercover</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setSettings((s) => ({ ...s, undercoverCount: Math.max(1, s.undercoverCount - 1) }))
                }
                className="h-8 w-8 rounded-lg bg-slate-700 text-lg"
              >
                −
              </button>
              <span className="w-6 text-center font-bold">{settings.undercoverCount}</span>
              <button
                onClick={() =>
                  setSettings((s) => ({ ...s, undercoverCount: s.undercoverCount + 1 }))
                }
                className="h-8 w-8 rounded-lg bg-slate-700 text-lg"
              >
                +
              </button>
            </div>
          </div>
          {TOGGLES.map(([key, label, hint]) => (
            <button
              key={key}
              onClick={() => setSettings((s) => ({ ...s, [key]: !s[key] }))}
              className="mb-2 flex w-full items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-left"
            >
              <span>
                <span className="block text-sm">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
              <span
                className={`h-6 w-11 rounded-full p-0.5 transition ${settings[key] ? 'bg-rose-500' : 'bg-slate-600'}`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white transition ${settings[key] ? 'translate-x-5' : ''}`}
                />
              </span>
            </button>
          ))}
        </div>

        {err && <p className="text-center text-sm text-amber-400">{err}</p>}

        <button
          disabled={!!err}
          onClick={() => startGame(players, true)}
          className="rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold disabled:opacity-40"
        >
          Lancer la partie
        </button>
        <div className="flex justify-center gap-5 text-sm text-slate-500">
          <button onClick={() => navigate('/')} className="underline">
            Retour à l'accueil
          </button>
          <Link to="/roles" className="underline">
            Guide des rôles
          </Link>
        </div>
      </div>
    )
  }

  // ---- Reveal ----
  if (phase === 'revealing') {
    const currentId = turnOrder[revealIndex]
    const current = players.find((p) => p.id === currentId)!
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400">
          Manche {manche} · {revealIndex + 1} / {turnOrder.length}
        </p>

        {!wordShown ? (
          <>
            <div className={`${card} w-full`}>
              <p className="text-slate-300">Passe le téléphone à</p>
              <p className="mt-2 text-4xl font-black">{current.name}</p>
              <p className="mt-2 text-xs text-slate-500">
                Les autres ne doivent pas regarder l'écran.
              </p>
            </div>
            <button
              onClick={() => setWordShown(true)}
              className="w-full rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold active:scale-[0.99]"
            >
              Je suis {current.name} — voir mon mot
            </button>
          </>
        ) : (
          <>
            <div className={`${card} w-full`}>
              <p className="text-xs uppercase tracking-widest text-slate-400">Ton mot</p>
              {current.word ? (
                <p className="my-2 text-5xl font-black">{current.word}</p>
              ) : (
                <p className="my-2 text-2xl font-bold text-sky-300">Tu n'as pas de mot…</p>
              )}
              {current.role === 'mr_white' && (
                <p className="text-sm text-sky-300">
                  Tu es Mr White. Bluffe, puis devine le mot des civils.
                </p>
              )}
              {current.role === 'kamikaze' && (
                <p className="text-sm text-amber-300">
                  Tu es le Kamikaze. Fais-toi éliminer tant qu'un undercover est encore en vie.
                </p>
              )}
              {current.role === 'taupe' && (
                <p className="text-sm text-purple-300">
                  Tu es la Taupe. L'undercover est{' '}
                  <b>{nameOf(current.taupeKnows)}</b>. Protège-le !
                </p>
              )}
              {current.role === 'mercenaire' && (
                <p className="text-sm text-orange-300">
                  Tu es le Mercenaire. Ta cible secrète est{' '}
                  <b>{nameOf(current.mercenaireTarget)}</b>. Fais-la éliminer pour gagner !
                </p>
              )}
              {current.role === 'traitre' && (
                <p className="text-sm text-red-400">
                  Tu es le Traître. Tu gagnes avec les undercovers, mais tu ne sais pas qui ils sont.
                </p>
              )}
              {current.role === 'parrain' && (
                <p className="text-sm text-fuchsia-300">
                  Tu es le Parrain. Si tu es éliminé, tu seras révélé comme Civil.
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setWordShown(false)
                if (revealIndex + 1 >= turnOrder.length) {
                  setPhase('clue')
                } else {
                  setRevealIndex((i) => i + 1)
                }
              }}
              className="w-full rounded-xl bg-slate-700 px-4 py-4 text-lg font-bold active:scale-[0.99]"
            >
              Continuer
            </button>
          </>
        )}
      </div>
    )
  }

  // ---- Revoir mon mot (overlay pendant clue / voting) ----
  if ((phase === 'clue' || phase === 'voting') && reviewMode) {
    const reviewPlayer = reviewPlayerId ? players.find((p) => p.id === reviewPlayerId) : null

    if (!reviewPlayerId) {
      return (
        <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-4">
          <header className="text-center">
            <h2 className="text-xl font-bold">Revoir son mot</h2>
            <p className="mt-1 text-sm text-slate-400">Qui a oublié son mot ?</p>
          </header>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <button
                key={p.id}
                onClick={() => { setReviewPlayerId(p.id); setReviewWordShown(false) }}
                className={`rounded-xl px-4 py-4 text-left text-lg font-bold ring-1 bg-slate-800/60 ring-white/10 active:scale-[0.99] ${!p.isAlive ? 'opacity-50' : ''}`}
              >
                {p.name}{!p.isAlive && ' (éliminé)'}
              </button>
            ))}
          </div>
          <button onClick={closeReview} className="text-center text-sm text-slate-500 underline">
            Annuler
          </button>
        </div>
      )
    }

    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        {!reviewWordShown ? (
          <>
            <div className={`${card} w-full`}>
              <p className="text-slate-300">Passe le téléphone à</p>
              <p className="mt-2 text-4xl font-black">{reviewPlayer!.name}</p>
              <p className="mt-2 text-xs text-slate-500">Les autres ne doivent pas regarder l'écran.</p>
            </div>
            <button
              onClick={() => setReviewWordShown(true)}
              className="w-full rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold active:scale-[0.99]"
            >
              Je suis {reviewPlayer!.name} — voir mon mot
            </button>
            <button onClick={() => setReviewPlayerId(null)} className="text-sm text-slate-500 underline">
              Choisir un autre joueur
            </button>
          </>
        ) : (
          <>
            <div className={`${card} w-full`}>
              <p className="text-xs uppercase tracking-widest text-slate-400">Ton mot</p>
              {reviewPlayer!.word ? (
                <p className="my-2 text-5xl font-black">{reviewPlayer!.word}</p>
              ) : (
                <p className="my-2 text-2xl font-bold text-sky-300">Tu n'as pas de mot…</p>
              )}
              {reviewPlayer!.role === 'mr_white' && (
                <p className="text-sm text-sky-300">Tu es Mr White. Bluffe, puis devine le mot des civils.</p>
              )}
              {reviewPlayer!.role === 'kamikaze' && (
                <p className="text-sm text-amber-300">Tu es le Kamikaze. Fais-toi éliminer tant qu'un undercover est encore en vie.</p>
              )}
              {reviewPlayer!.role === 'taupe' && (
                <p className="text-sm text-purple-300">
                  Tu es la Taupe. L'undercover est <b>{nameOf(reviewPlayer!.taupeKnows)}</b>. Protège-le !
                </p>
              )}
              {reviewPlayer!.role === 'mercenaire' && (
                <p className="text-sm text-orange-300">
                  Tu es le Mercenaire. Ta cible est <b>{nameOf(reviewPlayer!.mercenaireTarget)}</b>.
                </p>
              )}
              {reviewPlayer!.role === 'traitre' && (
                <p className="text-sm text-red-400">
                  Tu es le Traître. Tu gagnes avec les undercovers.
                </p>
              )}
              {reviewPlayer!.role === 'parrain' && (
                <p className="text-sm text-fuchsia-300">
                  Tu es le Parrain. Si tu es éliminé, tu seras révélé comme Civil.
                </p>
              )}
            </div>
            <button
              onClick={closeReview}
              className="w-full rounded-xl bg-slate-700 px-4 py-4 text-lg font-bold active:scale-[0.99]"
            >
              Continuer
            </button>
          </>
        )}
      </div>
    )
  }

  // ---- Clue ----
  if (phase === 'clue') {
    const ordered = turnOrder.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[]
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-4">
        <header className="text-center">
          <h2 className="text-xl font-bold">Phase d'indices</h2>
          <p className="mt-1 text-sm text-slate-400">Manche {manche}</p>
        </header>
        <div className={card}>
          <h3 className="mb-2 text-sm font-bold text-slate-300">Ordre de parole</h3>
          <ol className="flex flex-col gap-1">
            {ordered.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  i === 0 ? 'bg-rose-500/20 ring-1 ring-rose-400/40' : 'bg-slate-900/60'
                } ${!p.isAlive ? 'opacity-40 line-through' : ''}`}
              >
                <span className="w-5 text-slate-500">{i + 1}.</span>
                <span>{p.name}</span>
                {i === 0 && <span className="ml-auto text-xs text-rose-300">commence</span>}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            Chacun dit UN indice sur son mot sans le prononcer.
          </p>
        </div>
        <button
          onClick={() => { setSelectedVote(null); setPhase('voting') }}
          className="rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold"
        >
          Passer au vote
        </button>
        <div className="flex justify-center gap-5 text-sm">
          <button onClick={openReview} className="text-slate-400 underline">
            Revoir mon mot
          </button>
          <Link to="/roles" className="text-slate-500 underline">
            Guide des rôles
          </Link>
        </div>
      </div>
    )
  }

  // ---- Voting ----
  if (phase === 'voting') {
    const alive = players.filter((p) => p.isAlive)
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-4">
        <header className="text-center">
          <h2 className="text-xl font-bold">Vote</h2>
          <p className="mt-1 text-sm text-slate-400">
            Le groupe décide qui est éliminé. Le meneur valide.
          </p>
        </header>
        <div className="flex flex-col gap-2">
          {alive.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedVote(selectedVote === p.id ? null : p.id)}
              className={`rounded-xl px-4 py-4 text-left text-lg font-bold ring-1 transition active:scale-[0.99] ${
                selectedVote === p.id
                  ? 'bg-rose-500/30 ring-rose-400'
                  : 'bg-slate-800/60 ring-white/10'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {selectedVote && (
          <button
            onClick={handleEliminate}
            className="rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold"
          >
            Éliminer {nameOf(selectedVote)}
          </button>
        )}
        <div className="flex justify-center gap-5 text-sm">
          <button onClick={openReview} className="text-slate-400 underline">
            Revoir mon mot
          </button>
          <Link to="/roles" className="text-slate-500 underline">
            Guide des rôles
          </Link>
        </div>
        <button
          onClick={() => setPhase('clue')}
          className="text-center text-sm text-slate-500 underline"
        >
          Retour
        </button>
      </div>
    )
  }

  // ---- Vote result ----
  if (phase === 'vote_result') {
    const elim = players.find((p) => p.id === eliminatedId)
    // Le Parrain est révélé comme "Civil" à l'élimination (bluff posthume)
    const elimDisplayRole: Role | null = elim?.role === 'parrain' ? 'civil' : (elim?.role ?? null)
    const continueLabel = winner
      ? 'Voir les résultats de la manche'
      : elim?.role === 'mr_white'
        ? 'Mr White — devine le mot !'
        : 'Continuer la partie'
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        <div className={`${card} w-full`}>
          {elim ? (
            <>
              <p className="text-lg">
                <b>{elim.name}</b> est éliminé !
              </p>
              {elimDisplayRole && (
                <p className={`mt-1 text-3xl font-black ${ROLE_COLOR[elimDisplayRole]}`}>
                  {ROLE_LABELS[elimDisplayRole]}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg">Égalité — personne n'est éliminé.</p>
          )}
          {winner && <p className="mt-3 text-xl font-bold">{WINNER_LABEL[winner]}</p>}
          {!winner && elim?.role !== 'mr_white' && (
            <p className="mt-2 text-sm text-slate-400">La partie continue.</p>
          )}
        </div>
        <button
          onClick={handleContinueFromResult}
          className="w-full rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold"
        >
          {continueLabel}
        </button>
      </div>
    )
  }

  // ---- Mr White guess ----
  if (phase === 'mr_white_guess') {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="w-full rounded-2xl bg-sky-500/10 p-5 ring-1 ring-sky-400/30">
          <p className="text-xl text-sky-200">Mr White a été démasqué !</p>
          <p className="mt-1 text-sm text-slate-300">
            Il peut encore sauver sa mise en devinant le mot des civils.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <p className="text-slate-300">Mr White, quel est le mot des civils ?</p>
          <input
            value={mrGuess}
            onChange={(e) => setMrGuess(e.target.value)}
            placeholder="Le mot des civils…"
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-lg outline-none ring-1 ring-white/10 focus:ring-sky-400"
          />
          <button
            disabled={mrGuess.trim().length < 2}
            onClick={handleMrWhiteSubmit}
            className="w-full rounded-xl bg-sky-500 px-4 py-4 text-lg font-bold disabled:opacity-50"
          >
            Valider
          </button>
        </div>
      </div>
    )
  }

  // ---- Manche over ----
  if (phase === 'manche_over') {
    const scoreboard = [...players].sort((a, b) => b.score - a.score)
    const taupe = players.find((p) => p.role === 'taupe')
    const taupeTarget = taupe?.taupeKnows ? players.find((p) => p.id === taupe.taupeKnows) : null
    const taupeWon = winner === 'undercover' && taupeTarget?.isAlive === true
    const mercenaire = players.find((p) => p.role === 'mercenaire')
    const mercTarget = mercenaire?.mercenaireTarget ? players.find((p) => p.id === mercenaire.mercenaireTarget) : null
    const mercWon = mercTarget != null && !mercTarget.isAlive
    const traitre = players.find((p) => p.role === 'traitre')
    const traitreWon = winner === 'undercover'
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-5 p-4">
        <div className={`${card} text-center`}>
          <p className="text-2xl font-black">{winner ? WINNER_LABEL[winner] : 'Fin de manche'}</p>
          <div className="mt-3 flex justify-center gap-6 text-sm">
            <span>
              Civils : <b className="text-emerald-400">{civilWord}</b>
            </span>
            <span>
              Undercover : <b className="text-rose-400">{undercoverWord}</b>
            </span>
          </div>
          {taupe && (
            <p className={`mt-3 text-sm font-semibold ${taupeWon ? 'text-purple-400' : 'text-slate-400'}`}>
              {taupeWon
                ? `La Taupe (${taupe.name}) a protégé son undercover — +2 pts`
                : `La Taupe (${taupe.name}) n'a pas protégé son undercover.`}
            </p>
          )}
          {mercenaire && (
            <p className={`mt-2 text-sm font-semibold ${mercWon ? 'text-orange-400' : 'text-slate-400'}`}>
              {mercWon
                ? `Le Mercenaire (${mercenaire.name}) a éliminé sa cible (${mercTarget!.name}) — +3 pts`
                : `Le Mercenaire (${mercenaire.name}) n'a pas éliminé sa cible (${mercTarget?.name ?? '?'}).`}
            </p>
          )}
          {traitre && (
            <p className={`mt-2 text-sm font-semibold ${traitreWon ? 'text-red-400' : 'text-slate-400'}`}>
              {traitreWon
                ? `Le Traître (${traitre.name}) gagne avec les undercovers — +2 pts`
                : `Le Traître (${traitre.name}) n'a pas gagné avec les undercovers.`}
            </p>
          )}
        </div>

        <div className={card}>
          <h3 className="mb-2 text-sm font-bold text-slate-300">Les rôles</h3>
          <ul className="flex flex-col gap-1">
            {players.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2"
              >
                <span className={!p.isAlive ? 'line-through opacity-50' : ''}>{p.name}</span>
                {p.role && (
                  <span className={`text-sm font-bold ${ROLE_COLOR[p.role]}`}>
                    {ROLE_LABELS[p.role]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className={card}>
          <h3 className="mb-2 text-sm font-bold text-slate-300">Scores</h3>
          <ul className="flex flex-col gap-1">
            {scoreboard.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2"
              >
                <span>
                  {p.name}
                </span>
                <b>{p.score}</b>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => startGame(players)}
          className="rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold"
        >
          Nouvelle manche
        </button>
        <button
          onClick={() => {
            setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })))
            setPhase('setup')
          }}
          className="text-center text-sm text-slate-500 underline"
        >
          Nouvelle partie (remettre les scores à zéro)
        </button>
      </div>
    )
  }

  return null
}
