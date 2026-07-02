-- =========================================================================
--  Migration 0002 : Mode à distance — table des indices tapés
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =========================================================================

create table if not exists public.clues (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.rounds(id) on delete cascade,
  player_id    uuid not null references public.players(id) on delete cascade,
  clue_text    text not null check (char_length(clue_text) between 1 and 100),
  submitted_at timestamptz not null default now(),
  unique (round_id, player_id) -- un indice par joueur par manche
);

alter table public.clues enable row level security;

-- Tout le monde peut lire les indices (visibilité partagée en fin de tour)
create policy clues_select on public.clues
  for select to authenticated using (true);

-- Chaque joueur peut insérer son propre indice
create policy clues_insert on public.clues
  for insert to authenticated with check (
    exists (
      select 1 from public.players p
      where p.id = clues.player_id and p.user_id = auth.uid()
    )
  );

-- Chaque joueur peut modifier son propre indice (tant que la phase est 'clue')
create policy clues_update on public.clues
  for update to authenticated using (
    exists (
      select 1 from public.players p
      where p.id = clues.player_id and p.user_id = auth.uid()
    )
  );

-- Les indices sont inclus dans le realtime pour propagation instantanée
alter publication supabase_realtime add table public.clues;
