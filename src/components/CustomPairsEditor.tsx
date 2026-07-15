import { useState } from 'react'

/** Éditeur de paires de mots « perso » (partagé entre le lobby online et le mode local). */
export default function CustomPairsEditor({
  pairs,
  disabled,
  onChange,
}: {
  pairs: [string, string][]
  disabled?: boolean
  onChange: (p: [string, string][]) => void
}) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  function add() {
    const x = a.trim()
    const y = b.trim()
    if (x.length < 2 || y.length < 2) return
    onChange([...pairs, [x, y]])
    setA('')
    setB('')
  }
  return (
    <div className="mb-2 flex flex-col gap-2">
      <p className="text-xs text-slate-500">Ajoute tes propres paires (mot des civils / mot undercover).</p>
      {!disabled && (
        <div className="flex gap-2">
          <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Mot civils" maxLength={24} className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-rose-400" />
          <input value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="Mot undercover" maxLength={24} className="min-w-0 flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-rose-400" />
          <button onClick={add} className="rounded-lg bg-slate-700 px-3 text-xl font-bold active:scale-95">+</button>
        </div>
      )}
      {pairs.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {pairs.map(([x, y], i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-slate-900/60 px-3 py-1.5 text-sm">
              <span>{x} <span className="text-slate-500">/</span> {y}</span>
              {!disabled && (
                <button onClick={() => onChange(pairs.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-400">✕</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-amber-400">Aucune paire — ajoute-en au moins une.</p>
      )}
    </div>
  )
}
