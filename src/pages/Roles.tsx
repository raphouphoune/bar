import { useNavigate } from 'react-router-dom'

interface RoleInfo {
  name: string
  color: string
  bgColor: string
  borderColor: string
  word: string
  team: string
  teamColor: string
  win: string
  special?: string
}

const ROLES: RoleInfo[] = [
  {
    name: 'Civil',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'ring-emerald-400/30',
    word: 'Mot des civils',
    team: 'Civils',
    teamColor: 'text-emerald-400',
    win: 'Tous les imposteurs sont éliminés.',
    special: undefined,
  },
  {
    name: 'La Taupe',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'ring-purple-400/30',
    word: 'Mot des civils',
    team: 'Civils (secrètement Undercover)',
    teamColor: 'text-purple-400',
    win: "Les undercovers gagnent ET le joueur qu'elle protège est encore en vie.",
    special: "Au début, elle apprend l'identité d'un undercover. Sa mission : le protéger des votes.",
  },
  {
    name: 'Le Mercenaire',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'ring-orange-400/30',
    word: 'Mot des civils',
    team: 'Neutre',
    teamColor: 'text-orange-400',
    win: 'Sa cible secrète est éliminée — peu importe quand ou par qui.',
    special: "Au début, il apprend l'identité d'une cible aléatoire. Il joue pour l'éliminer.",
  },
  {
    name: 'Undercover',
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'ring-rose-400/30',
    word: 'Mot undercover (différent des civils)',
    team: 'Undercover',
    teamColor: 'text-rose-400',
    win: 'Les imposteurs sont au moins aussi nombreux que les civils.',
    special: 'Doit donner des indices proches du mot civil sans se trahir.',
  },
  {
    name: 'Mr White',
    color: 'text-sky-300',
    bgColor: 'bg-sky-500/10',
    borderColor: 'ring-sky-400/30',
    word: 'Aucun mot',
    team: 'Undercover',
    teamColor: 'text-rose-400',
    win: "Les imposteurs gagnent, ou il devine le mot des civils après son élimination.",
    special: 'Doit bluffer sans connaître le sujet. Si éliminé, une chance de tout renverser en devinant le mot civil.',
  },
  {
    name: 'Kamikaze',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'ring-amber-400/30',
    word: 'Mot des civils',
    team: 'Undercover',
    teamColor: 'text-rose-400',
    win: "Il est éliminé par vote alors qu'au moins un undercover est encore en vie.",
    special: "Doit se faire éliminer sans que les autres comprennent qu'il le veut — sinon ils refuseront de voter pour lui.",
  },
  {
    name: 'Le Traître',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'ring-red-400/30',
    word: 'Mot des civils',
    team: 'Undercover (en secret)',
    teamColor: 'text-rose-400',
    win: 'Les undercovers gagnent.',
    special: "Ne connaît pas l'identité des undercovers. Joue comme un civil mais vote pour nuire aux civils.",
  },
  {
    name: 'Le Parrain',
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'ring-fuchsia-400/30',
    word: 'Mot undercover',
    team: 'Undercover',
    teamColor: 'text-rose-400',
    win: 'Les undercovers gagnent.',
    special: "S'il est éliminé, l'écran affiche \"Civil\" — les autres croient avoir voté un innocent.",
  },
]

const POINTS: Record<string, number> = {
  Civil: 1,
  'La Taupe': 2,
  'Le Mercenaire': 3,
  Undercover: 2,
  'Mr White': 3,
  Kamikaze: 3,
  'Le Traître': 2,
  'Le Parrain': 2,
}

export default function Roles() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 p-4 pb-10">
      <header className="flex items-center gap-3 pt-1">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/60 text-slate-400 ring-1 ring-white/10 active:scale-95"
        >
          ←
        </button>
        <div>
          <h1 className="text-xl font-black">Guide des rôles</h1>
          <p className="text-xs text-slate-400">Toutes les missions en un coup d'œil</p>
        </div>
      </header>

      <div className="flex flex-col gap-3">
        {ROLES.map((r) => (
          <div
            key={r.name}
            className={`rounded-2xl ${r.bgColor} p-4 ring-1 ${r.borderColor}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-lg font-black ${r.color}`}>{r.name}</p>
                <p className={`text-xs font-semibold ${r.teamColor}`}>{r.team}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-slate-300">
                  {r.word}
                </span>
                <span className="rounded-full bg-slate-900/60 px-2 py-0.5 text-xs text-amber-300">
                  +{POINTS[r.name]} pt{POINTS[r.name] > 1 ? 's' : ''} si victoire
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <div className="rounded-xl bg-slate-900/40 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Condition de victoire</p>
                <p className="mt-0.5 text-sm text-slate-200">{r.win}</p>
              </div>
              {r.special && (
                <div className="rounded-xl bg-slate-900/40 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Pouvoir / Contrainte</p>
                  <p className="mt-0.5 text-sm text-slate-200">{r.special}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-slate-600">
        Les rôles en italique sont optionnels (activables dans les réglages)
      </p>
    </div>
  )
}
