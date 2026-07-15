import { useEffect, useRef, useState } from 'react'

/** Petit bip via WebAudio (aucun asset à charger). */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
    osc.onended = () => ctx.close()
  } catch {
    /* audio indisponible : on ignore */
  }
}

/**
 * Minuteur de discussion (indicatif : n'avance pas la partie tout seul).
 * - `startedAt` (ISO) : début de phase côté serveur → synchronise tous les
 *   téléphones et survit à un rafraîchissement (mode multi).
 * - Sans `startedAt` : décompte basé sur le montage (mode local, 1 téléphone).
 * Se relance quand `resetKey`, `startedAt` ou `seconds` changent.
 */
export default function Timer({
  seconds,
  resetKey,
  startedAt,
}: {
  seconds: number
  resetKey?: string | number
  startedAt?: string | null
}) {
  const startMs = startedAt ? Date.parse(startedAt) : null
  const initial =
    startMs != null ? Math.max(0, seconds - Math.floor((Date.now() - startMs) / 1000)) : seconds
  const [left, setLeft] = useState(initial)
  const firedRef = useRef(false)

  useEffect(() => {
    firedRef.current = false
    if (seconds <= 0) return
    const start = startMs ?? Date.now()
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const remaining = Math.max(0, seconds - elapsed)
      setLeft(remaining)
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true
        beep()
        navigator.vibrate?.([200, 100, 200])
        clearInterval(id)
      }
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [seconds, resetKey, startedAt])

  if (seconds <= 0) return null

  const mm = Math.floor(left / 60)
  const ss = left % 60
  const pct = Math.max(0, (left / seconds) * 100)
  const done = left === 0
  const urgent = left <= 10 && left > 0

  return (
    <div className={`rounded-2xl p-3 ring-1 ${done ? 'bg-rose-500/20 ring-rose-400/40' : 'bg-slate-800/60 ring-white/10'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">
          {done ? 'Temps écoulé — au vote !' : 'Temps de discussion'}
        </span>
        <span
          className={`font-mono text-lg font-black tabular-nums ${done ? 'text-rose-300' : urgent ? 'text-amber-300' : 'text-white'}`}
        >
          {mm}:{ss.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900/70">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${done ? 'bg-rose-400' : urgent ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
