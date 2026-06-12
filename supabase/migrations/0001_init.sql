-- =========================================================================
--  Undercover Bar Edition — schéma initial
--  À exécuter dans Supabase : SQL Editor > coller > Run
--  (ou via la CLI : supabase db push)
-- =========================================================================

-- ---- ROOMS --------------------------------------------------------------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  host_id       uuid not null,                       -- auth.uid() de l'hôte
  status        text not null default 'lobby',       -- lobby | playing | finished
  current_round int  not null default 0,
  settings      jsonb not null default '{
                    "undercoverCount": 1,
                    "enableMrWhite": true,
                    "enableKamikaze": false,
                    "enableTaupe": false
                  }'::jsonb,
  created_at    timestamptz not null default now()
);

-- ---- PLAYERS ------------------------------------------------------------
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null,                         -- auth.uid() du device
  name        text not null,
  is_host     boolean not null default false,
  is_alive    boolean not null default true,
  score       int not null default 0,
  turn_order  int,
  joined_at   timestamptz not null default now(),
  unique (room_id, user_id)
);

-- ---- ROUNDS -------------------------------------------------------------
create table if not exists public.rounds (
  id                       uuid primary key default gen_random_uuid(),
  room_id                  uuid not null references public.rooms(id) on delete cascade,
  round_number             int  not null,
  phase                    text not null default 'assigning', -- assigning|clue|voting|reveal|mrwhite_guess|finished
  first_player_id          uuid references public.players(id),
  eliminated_player_id     uuid references public.players(id),
  eliminated_role          text,                      -- rôle révélé du dernier éliminé
  winner_team              text,                      -- civils|undercover|mr_white|kamikaze|null
  -- Mots révélés UNIQUEMENT en fin de manche (sinon null => pas de triche)
  revealed_civil_word      text,
  revealed_undercover_word text,
  created_at               timestamptz not null default now(),
  unique (room_id, round_number)
);

-- ---- ROUND_SECRETS (jamais lisible côté client) -------------------------
create table if not exists public.round_secrets (
  round_id         uuid primary key references public.rounds(id) on delete cascade,
  civil_word       text not null,
  undercover_word  text not null
);

-- ---- ROUND_ROLES (chaque joueur ne lit QUE sa ligne) --------------------
create table if not exists public.round_roles (
  id               uuid primary key default gen_random_uuid(),
  round_id         uuid not null references public.rounds(id) on delete cascade,
  player_id        uuid not null references public.players(id) on delete cascade,
  role             text not null,                    -- civil|undercover|mr_white|kamikaze|taupe
  word             text,                             -- mot du joueur (null pour mr_white/kamikaze)
  knows_player_id  uuid references public.players(id),-- pour la Taupe : l'undercover qu'elle connaît
  unique (round_id, player_id)
);

-- ---- VOTES --------------------------------------------------------------
create table if not exists public.votes (
  id                uuid primary key default gen_random_uuid(),
  round_id          uuid not null references public.rounds(id) on delete cascade,
  voter_player_id   uuid not null references public.players(id) on delete cascade,
  target_player_id  uuid not null references public.players(id) on delete cascade,
  created_at        timestamptz not null default now(),
  unique (round_id, voter_player_id)                 -- un vote par joueur par manche
);

-- =========================================================================
--  ROW LEVEL SECURITY
-- =========================================================================
alter table public.rooms         enable row level security;
alter table public.players       enable row level security;
alter table public.rounds        enable row level security;
alter table public.round_secrets enable row level security;
alter table public.round_roles   enable row level security;
alter table public.votes         enable row level security;

-- ROOMS : tout le monde (authentifié) peut lire (pour rejoindre par code),
-- créer une room dont il est l'hôte, et l'hôte peut la modifier.
create policy rooms_select on public.rooms
  for select to authenticated using (true);
create policy rooms_insert on public.rooms
  for insert to authenticated with check (host_id = auth.uid());
create policy rooms_update_host on public.rooms
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

-- PLAYERS : lecture ouverte (liste des joueurs), insertion/maj/suppression de soi.
create policy players_select on public.players
  for select to authenticated using (true);
create policy players_insert on public.players
  for insert to authenticated with check (user_id = auth.uid());
create policy players_update_self on public.players
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy players_delete_self on public.players
  for delete to authenticated using (user_id = auth.uid());

-- ROUNDS : lecture ouverte. Écriture réservée au serveur (service role bypass RLS).
create policy rounds_select on public.rounds
  for select to authenticated using (true);

-- ROUND_SECRETS : AUCUNE policy => inaccessible au client. Seul le service role lit.

-- ROUND_ROLES : un joueur ne lit QUE la ligne de SON player...
create policy round_roles_select_own on public.round_roles
  for select to authenticated using (
    exists (
      select 1 from public.players p
      where p.id = round_roles.player_id and p.user_id = auth.uid()
    )
  );

-- ...sauf en fin de manche : tous les rôles deviennent visibles (révélation).
create policy round_roles_select_finished on public.round_roles
  for select to authenticated using (
    exists (
      select 1 from public.rounds r
      where r.id = round_roles.round_id and r.phase = 'finished'
    )
  );

-- VOTES : lecture ouverte (compteur de votes), insertion de son propre vote.
create policy votes_select on public.votes
  for select to authenticated using (true);
create policy votes_insert_self on public.votes
  for insert to authenticated with check (
    exists (
      select 1 from public.players p
      where p.id = votes.voter_player_id and p.user_id = auth.uid()
    )
  );
create policy votes_delete_self on public.votes
  for delete to authenticated using (
    exists (
      select 1 from public.players p
      where p.id = votes.voter_player_id and p.user_id = auth.uid()
    )
  );

-- =========================================================================
--  REALTIME : publier les changements de ces tables
-- =========================================================================
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.round_roles;
alter publication supabase_realtime add table public.votes;
