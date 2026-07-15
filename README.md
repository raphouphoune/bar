# Undercover — Bar Edition

Une version maison du jeu **Undercover**. Deux façons de jouer :

- **Un seul téléphone** (mode *Meneur*) : le téléphone tourne de joueur en
  joueur, aucune connexion requise. Thèmes de mots + gages (mode bar).
- **Chacun son téléphone** (mode *multi*) : chacun rejoint avec un code. Les
  mots peuvent être **tirés en direct** (ConceptNet, en français) pour que
  **personne — même l'hôte — ne connaisse la liste**, ou choisis dans un thème.

- **Rôles** : Civil · Undercover · Mr White · **Kamikaze** (gagne s'il se fait
  éliminer *tant qu'un undercover est encore en vie*) · **La Taupe** (civil qui
  connaît un undercover et doit le protéger) · **Le Mercenaire** (neutre : gagne
  si sa cible secrète est éliminée) · **Le Traître** (civil qui gagne avec les
  undercovers sans les connaître) · **Le Parrain** (undercover révélé comme
  « Civil » à son élimination).
- **Temps réel** : tous les téléphones se synchronisent (lobby, votes, révélations).
- **Anti-triche** : chaque joueur ne voit que **son** mot (Row Level Security) ;
  votes et transitions validés côté serveur (Edge Functions).
- **100 % gratuit** : front sur Vercel, backend sur Supabase.

## Pile technique

| Couche        | Techno                                            |
| ------------- | ------------------------------------------------- |
| Front         | React 19 + Vite + TypeScript + Tailwind 4 (Vercel)|
| Données       | Supabase Postgres + Row Level Security            |
| Temps réel    | Supabase Realtime                                 |
| Identité      | Supabase Auth anonyme (1 device = 1 identité)     |
| Logique secrète | Edge Functions (Deno) : rôles + tirage des mots |
| Mots          | ConceptNet (`api.conceptnet.io`, gratuit, FR)     |

## Développement local

```bash
npm install
cp .env.example .env   # puis remplis avec tes clés Supabase
npm run dev
```

## Déploiement (de zéro)

### 1. Projet Supabase
1. Crée un projet sur [supabase.com](https://supabase.com) (plan gratuit).
2. **SQL Editor** → exécute **dans l'ordre** le contenu de :
   `supabase/migrations/0001_init.sql`, puis `0002_clues.sql`, puis `0003_settings_timer_gages.sql`.
3. **Authentication → Sign In / Providers → Anonymous** : active les connexions anonymes.
4. Note dans **Project Settings → API** : l'`URL` et la clé `anon public`.

### 2. Edge Functions
Avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :
```bash
supabase login
supabase link --project-ref <ton-ref>
supabase functions deploy start-round
supabase functions deploy set-phase
supabase functions deploy resolve-vote
supabase functions deploy mrwhite-guess
supabase functions deploy leave-room
```
> Les variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY`
> sont **injectées automatiquement** dans les Edge Functions — rien à configurer.

### 3. Front sur Vercel
1. Pousse le repo sur GitHub (déjà fait).
2. Sur [vercel.com](https://vercel.com) → **New Project** → importe le repo.
3. **Environment Variables** :
   - `VITE_SUPABASE_URL` = ton URL Supabase
   - `VITE_SUPABASE_ANON_KEY` = ta clé anon
4. Deploy. Le `vercel.json` gère le routage SPA (`/room/CODE`).

## Règles du jeu (rappel)

1. L'hôte crée une partie → un **code** à 5 lettres.
2. Les potes rejoignent avec le code, sur leur téléphone.
3. L'hôte règle les rôles puis **démarre** : chacun reçoit son mot secret.
4. À tour de rôle (à l'oral), chacun donne **un indice** sur son mot.
5. Tout le monde **vote** pour éliminer un joueur.
6. Révélation, puis :
   - **Kamikaze** éliminé (tant qu'un undercover est en vie) → il gagne
   - **Mr White** éliminé → il tente de **deviner** le mot des civils
   - sinon on vérifie les conditions de victoire, et on continue.
7. Les **civils** gagnent quand tous les imposteurs sont éliminés ; les
   **undercover** gagnent à parité numérique.

## Structure

```
src/
  pages/        Home (accueil), Room (orchestrateur multi), LocalGame (mode 1 tel.), Roles (guide)
  components/   Lobby, Game (toutes les phases de jeu), Timer
  hooks/        useRoom (état + temps réel)
  lib/          supabase, api, types, game (logique d'affichage)
supabase/
  migrations/   schéma SQL + RLS (0001 → 0003)
  functions/    start-round, set-phase, resolve-vote, mrwhite-guess, leave-room
    _shared/    roles, words (ConceptNet + packs), outcome, gages, auth, cors
```
