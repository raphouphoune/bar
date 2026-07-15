-- =========================================================================
--  Migration 0004 : mode Binôme coopératif — partenaire secret par joueur.
--  À exécuter dans Supabase : SQL Editor > coller > Run
-- =========================================================================

-- Le partenaire est stocké dans round_roles (protégé par RLS : un joueur ne
-- lit que SA ligne, donc son binôme reste secret pour les autres).
alter table public.round_roles
  add column if not exists partner_player_id uuid references public.players(id);
