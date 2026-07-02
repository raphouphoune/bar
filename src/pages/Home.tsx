import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, joinRoom } from '../lib/api'

type Mode = null | 'multi'

export default function Home() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(null)
  const [name, setName] = useState(localStorage.getItem('uc_name') ?? '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function rememberName() {
    localStorage.setItem('uc_name', name.trim())
  }

  async function handleCreate() {
    if (name.trim().length < 2) return setError('Entre ton prénom (2 lettres min).')
    setBusy(true)
    setError(null)
    try {
      rememberName()
      const c = await createRoom(name.trim())
      navigate(`/room/${c}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    if (name.trim().length < 2) return setError('Entre ton prénom (2 lettres min).')
    if (code.trim().length < 4) return setError('Entre le code de la partie.')
    setBusy(true)
    setError(null)
    try {
      rememberName()
      await joinRoom(code.trim(), name.trim())
      navigate(`/room/${code.trim().toUpperCase()}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  // Mode selection screen
  if (mode === null) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight">
            Under<span className="text-rose-400">cover</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Bar Edition 🍻 — mots tirés en direct</p>
        </header>

        <p className="text-center text-sm text-slate-300">Comment voulez-vous jouer ?</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/local')}
            className="flex flex-col items-center rounded-2xl bg-amber-500/20 px-6 py-5 ring-1 ring-amber-400/40 transition active:scale-[0.99]"
          >
            <span className="text-2xl">📱</span>
            <span className="mt-1 text-lg font-bold text-amber-300">Un seul téléphone</span>
            <span className="mt-1 text-center text-xs text-slate-400">
              Le meneur gère la partie. Le téléphone tourne de joueur en joueur.
            </span>
          </button>

          <button
            onClick={() => setMode('multi')}
            className="flex flex-col items-center rounded-2xl bg-slate-800/60 px-6 py-5 ring-1 ring-white/10 transition active:scale-[0.99]"
          >
            <span className="text-2xl">📲</span>
            <span className="mt-1 text-lg font-bold">Chacun son téléphone</span>
            <span className="mt-1 text-center text-xs text-slate-400">
              Chaque joueur rejoint avec son propre appareil via un code.
            </span>
          </button>
        </div>

        <button
          onClick={() => navigate('/roles')}
          className="text-center text-sm text-slate-500 underline"
        >
          📖 Guide des rôles
        </button>
      </div>
    )
  }

  // Multi-phone mode (existing flow)
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight">
          Under<span className="text-rose-400">cover</span>
        </h1>
        <p className="mt-1 text-sm text-slate-400">Bar Edition 🍻 — mots tirés en direct</p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl bg-slate-800/60 p-5 ring-1 ring-white/10">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-300">Ton prénom</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Raph"
            maxLength={16}
            className="rounded-xl bg-slate-900 px-4 py-3 text-lg outline-none ring-1 ring-white/10 focus:ring-rose-400"
          />
        </label>

        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded-xl bg-rose-500 px-4 py-3 text-lg font-bold text-white transition active:scale-95 disabled:opacity-50"
        >
          Créer une partie
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-white/10" /> ou rejoindre
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={5}
            className="w-32 rounded-xl bg-slate-900 px-4 py-3 text-center text-lg font-mono tracking-widest outline-none ring-1 ring-white/10 focus:ring-rose-400"
          />
          <button
            onClick={handleJoin}
            disabled={busy}
            className="flex-1 rounded-xl bg-slate-700 px-4 py-3 text-lg font-bold transition active:scale-95 disabled:opacity-50"
          >
            Rejoindre
          </button>
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      <button
        onClick={() => setMode(null)}
        className="text-center text-xs text-slate-600 underline"
      >
        ← Changer de mode
      </button>
    </div>
  )
}
