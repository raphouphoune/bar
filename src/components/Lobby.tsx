import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RoomState } from '../hooks/useRoom'
import type { RoomSettings } from '../lib/types'
import { ONLINE_WORD_PACKS } from '../lib/types'
import { updateSettings, startRound, leaveRoom } from '../lib/api'
import CustomPairsEditor from './CustomPairsEditor'
import { settingsValid, impostorCount, suggestedSettings } from '../lib/game'

function formatTimer(v: number): string {
  if (v <= 0) return 'off'
  if (v < 60) return `${v}s`
  const m = Math.floor(v / 60)
  const s = v % 60
  return s === 0 ? `${m} min` : `${m}:${s.toString().padStart(2, '0')}`
}

export default function Lobby({ state }: { state: RoomState }) {
  const navigate = useNavigate()
  const { room, players, me } = state
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!room || !me) return null
  const isHost = me.is_host
  const s = room.settings

  async function patch(p: Partial<RoomSettings>) {
    if (!isHost || !room) return
    try {
      await updateSettings(room.id, { ...s, ...p })
    } catch (e) {
      setErr(String(e))
    }
  }

  const validation =
    settingsValid(s, players.length) ??
    (s.wordPack === 'perso' && (s.customPairs?.length ?? 0) === 0
      ? 'Ajoute au moins une paire de mots perso.'
      : null)

  async function handleStart() {
    if (!room) return
    setBusy(true)
    setErr(null)
    try {
      await startRound(room.id)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  function share() {
    const url = `${location.origin}/room/${room!.code}`
    if (navigator.share) navigator.share({ title: 'Undercover', text: 'Rejoins la partie !', url })
    else navigator.clipboard?.writeText(url)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-slate-800/60 p-5 text-center ring-1 ring-white/10">
        <p className="text-xs uppercase tracking-widest text-slate-400">Code de la partie</p>
        <p className="my-1 font-mono text-5xl font-black tracking-[0.3em] text-rose-400">
          {room.code}
        </p>
        <button onClick={share} className="text-sm text-slate-300 underline">
          Partager le lien
        </button>
      </div>

      <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
        <h3 className="mb-2 text-sm font-bold text-slate-300">
          Joueurs ({players.length})
        </h3>
        <ul className="flex flex-col gap-1">
          {players.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2">
              <span>{p.name}</span>
              {p.is_host && <span className="text-xs text-amber-400">hôte</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300">Réglages</h3>
          {isHost && (
            <button
              onClick={() => patch(suggestedSettings(players.length))}
              className="rounded-lg bg-slate-700 px-3 py-1 text-xs font-semibold active:scale-95"
            >
              Réglages conseillés
            </button>
          )}
        </div>
        <Stepper
          label="Nombre d'undercover"
          value={s.undercoverCount}
          disabled={!isHost}
          onChange={(v) => patch({ undercoverCount: Math.max(1, v) })}
        />
        <Toggle label="Mr White" hint="sans mot, doit bluffer puis deviner" checked={s.enableMrWhite} disabled={!isHost} onChange={(v) => patch({ enableMrWhite: v })} />
        <Toggle label="Kamikaze" hint="gagne s'il se fait éliminer avant les undercovers" checked={s.enableKamikaze} disabled={!isHost} onChange={(v) => patch({ enableKamikaze: v })} />
        <Toggle label="La Taupe" hint="civil qui connaît un undercover, gagne avec eux" checked={s.enableTaupe} disabled={!isHost} onChange={(v) => patch({ enableTaupe: v })} />
        <Toggle label="Le Mercenaire" hint="civil neutre — gagne si sa cible secrète est éliminée" checked={s.enableMercenaire} disabled={!isHost} onChange={(v) => patch({ enableMercenaire: v })} />
        <Toggle label="Le Traître" hint="civil qui gagne avec les undercovers (sans les connaître)" checked={s.enableTraitre} disabled={!isHost} onChange={(v) => patch({ enableTraitre: v })} />
        <Toggle label="Le Parrain" hint="undercover révélé comme Civil à l'élimination" checked={s.enableParrain} disabled={!isHost} onChange={(v) => patch({ enableParrain: v })} />
        <Toggle label="Les Complices" hint="les undercovers se connaissent (dès 2 undercovers)" checked={s.enableComplices ?? false} disabled={!isHost} onChange={(v) => patch({ enableComplices: v })} />
        <div className="my-2 h-px bg-white/10" />
        <Toggle label="Mode à distance" hint="les joueurs tapent leurs indices dans l'app (jeu en ligne)" checked={s.remoteMode ?? false} disabled={!isHost} onChange={(v) => patch({ remoteMode: v })} />
        <Toggle label="Indices simultanés" hint="indices révélés d'un coup + votes cachés (mode à distance)" checked={s.blindMode ?? false} disabled={!isHost} onChange={(v) => patch({ blindMode: v })} />
        <Toggle label="Indices guidés" hint="l'app impose le type d'indice à chaque manche" checked={s.enableClueAngles ?? false} disabled={!isHost} onChange={(v) => patch({ enableClueAngles: v })} />
        <Toggle label="Binôme" hint="chaque joueur a un partenaire secret, scores par duo" checked={s.enableBinome ?? false} disabled={!isHost} onChange={(v) => patch({ enableBinome: v })} />
        <Toggle label="Gages" hint="le joueur éliminé pioche un gage" checked={s.enableGages ?? false} disabled={!isHost} onChange={(v) => patch({ enableGages: v })} />
        <div className="my-2 h-px bg-white/10" />
        <p className="mb-2 text-sm">Thème des mots</p>
        <div className="mb-1 grid grid-cols-2 gap-2">
          {ONLINE_WORD_PACKS.map((pack) => (
            <button
              key={pack.id}
              disabled={!isHost}
              onClick={() => patch({ wordPack: pack.id })}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition active:scale-[0.98] disabled:opacity-60 ${
                (s.wordPack ?? 'conceptnet') === pack.id
                  ? 'bg-rose-500/30 ring-rose-400'
                  : 'bg-slate-900/60 ring-white/10'
              }`}
            >
              {pack.label}
            </button>
          ))}
        </div>
        {(s.wordPack ?? 'conceptnet') === 'conceptnet' && (
          <p className="mb-2 text-xs text-slate-500">
            « Mystère » génère les mots automatiquement : personne, même l'hôte, ne les connaît à l'avance.
          </p>
        )}
        {s.wordPack === 'perso' && (
          <CustomPairsEditor
            pairs={s.customPairs ?? []}
            disabled={!isHost}
            onChange={(customPairs) => patch({ customPairs })}
          />
        )}
        <div className="my-2 h-px bg-white/10" />
        <Stepper
          label="Score cible (soirée)"
          value={s.targetScore ?? 0}
          disabled={!isHost}
          format={(v) => (v <= 0 ? 'illimité' : `${v} pts`)}
          onChange={(v) => patch({ targetScore: Math.max(0, v) })}
        />
        <Stepper
          label="Minuteur de discussion"
          value={s.timerSeconds ?? 0}
          step={15}
          disabled={!isHost}
          format={formatTimer}
          onChange={(v) => patch({ timerSeconds: Math.max(0, v) })}
        />
        <p className="mt-2 text-xs text-slate-500">
          {impostorCount(s)} rôle(s) spécial(aux) · {Math.max(0, players.length - impostorCount(s))} civils
        </p>
      </div>

      {err && <p className="text-sm text-rose-400">{err}</p>}

      {isHost ? (
        <>
          {validation && <p className="text-center text-sm text-amber-400">{validation}</p>}
          <button
            disabled={busy || !!validation}
            onClick={handleStart}
            className="rounded-xl bg-rose-500 px-4 py-4 text-lg font-bold disabled:opacity-40"
          >
            Démarrer la manche
          </button>
        </>
      ) : (
        <p className="text-center text-slate-400">En attente que l'hôte démarre…</p>
      )}

      <button
        onClick={async () => {
          await leaveRoom(me.id)
          navigate('/')
        }}
        className="text-center text-sm text-slate-500 underline"
      >
        Quitter la partie
      </button>
    </div>
  )
}

function Stepper({ label, value, onChange, disabled, step = 1, format }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; step?: number; format?: (v: number) => string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button disabled={disabled} onClick={() => onChange(value - step)} className="h-8 w-8 rounded-lg bg-slate-700 text-lg disabled:opacity-30">−</button>
        <span className="min-w-[3.5rem] text-center font-bold">{format ? format(value) : value}</span>
        <button disabled={disabled} onClick={() => onChange(value + step)} className="h-8 w-8 rounded-lg bg-slate-700 text-lg disabled:opacity-30">+</button>
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="mb-2 flex w-full items-center justify-between rounded-lg bg-slate-900/60 px-3 py-2 text-left disabled:opacity-60"
    >
      <span>
        <span className="block text-sm">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <span className={`h-6 w-11 rounded-full p-0.5 transition ${checked ? 'bg-rose-500' : 'bg-slate-600'}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  )
}
