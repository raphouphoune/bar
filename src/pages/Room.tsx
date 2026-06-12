import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import { joinRoom } from '../lib/api'
import Lobby from '../components/Lobby'
import Game from '../components/Game'

export default function Room() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const state = useRoom(code)
  const { room, me, loading, error } = state

  if (loading) {
    return <Centered>Chargement…</Centered>
  }
  if (error || !room) {
    return (
      <Centered>
        <p className="text-rose-400">{error ?? 'Partie introuvable'}</p>
        <button className="mt-4 underline" onClick={() => navigate('/')}>
          Retour à l'accueil
        </button>
      </Centered>
    )
  }

  // Arrivé par lien direct sans être inscrit : on propose de rejoindre.
  if (!me) {
    return <JoinPrompt code={code} onJoined={state.refresh} />
  }

  return (
    <div className="mx-auto min-h-full max-w-md p-4">
      {room.status === 'lobby' ? <Lobby state={state} /> : <Game state={state} />}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center p-6 text-center">
      {children}
    </div>
  )
}

function JoinPrompt({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState(localStorage.getItem('uc_name') ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <Centered>
      <h2 className="text-2xl font-bold">Rejoindre la partie {code}</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ton prénom"
        className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-lg ring-1 ring-white/10"
      />
      <button
        disabled={busy}
        onClick={async () => {
          if (name.trim().length < 2) return setErr('Prénom trop court')
          setBusy(true)
          try {
            localStorage.setItem('uc_name', name.trim())
            await joinRoom(code, name.trim())
            onJoined()
          } catch (e) {
            setErr(String(e))
          } finally {
            setBusy(false)
          }
        }}
        className="mt-3 w-full rounded-xl bg-rose-500 px-4 py-3 font-bold disabled:opacity-50"
      >
        Rejoindre
      </button>
      {err && <p className="mt-2 text-sm text-rose-400">{err}</p>}
    </Centered>
  )
}
