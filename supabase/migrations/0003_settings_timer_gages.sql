-- =========================================================================
--  Migration 0003 : réglages complets, minuteur synchronisé, gages, et
--  durcissement de la policy des indices.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =========================================================================

-- ---- Défaut complet des réglages (aligné sur DEFAULT_SETTINGS côté front) --
alter table public.rooms
  alter column settings set default '{
    "undercoverCount": 1,
    "enableMrWhite": true,
    "enableKamikaze": false,
    "enableTaupe": false,
    "enableMercenaire": false,
    "enableTraitre": false,
    "enableParrain": false,
    "remoteMode": false,
    "targetScore": 0,
    "timerSeconds": 0,
    "wordPack": "conceptnet",
    "enableGages": false
  }'::jsonb;

-- ---- Minuteur synchronisé : horodatage de début de phase --------------------
alter table public.rounds
  add column if not exists phase_started_at timestamptz;

-- ---- Gage (mode bar) attribué au joueur éliminé -----------------------------
alter table public.rounds
  add column if not exists eliminated_gage text;

-- ---- Indices : on ne peut insérer/modifier QUE pendant la phase 'clue' -------
drop policy if exists clues_insert on public.clues;
create policy clues_insert on public.clues
  for insert to authenticated with check (
    exists (
      select 1 from public.players p
      where p.id = clues.player_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.rounds r
      where r.id = clues.round_id and r.phase = 'clue'
    )
  );

drop policy if exists clues_update on public.clues;
create policy clues_update on public.clues
  for update to authenticated using (
    exists (
      select 1 from public.players p
      where p.id = clues.player_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.rounds r
      where r.id = clues.round_id and r.phase = 'clue'
    )
  );
