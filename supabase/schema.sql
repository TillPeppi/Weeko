-- Weeko — Supabase (Postgres) schema + Row-Level-Security
-- ============================================================================
-- Ziel: server-seitiger Spiegel der lokalen SQLite-Tabellen für den Cloud-Sync
-- (docs/SYNC_CONCEPT.md). Pro Nutzer isoliert über `user_id` + RLS.
--
-- WICHTIG:
--  * Für den REINEN LOGIN (Schritt 3) wird diese Datei NICHT gebraucht — es
--    reicht ein Supabase-Projekt mit aktiviertem E-Mail-Provider (siehe
--    docs/SUPABASE_SETUP.md). Daten synchronisieren erst mit PowerSync (Schritt 4).
--  * Diese Datei ist die VORBEREITETE Zielstruktur für den Sync-Schritt. Spalten,
--    die lokal noch fehlen (`updated_at`), werden dort ergänzt; dann hier
--    angleichen. Spaltennamen sind bewusst snake_case = identisch zur lokalen
--    SQLite (PowerSync repliziert spaltenweise).
--  * IDs sind `text` (nicht `uuid`), damit sie zu den client-generierten UUIDs
--    UND zu evtl. aus der Alt-DB übernommenen numerischen IDs passen.
--  * `food_product` wird NICHT gespiegelt (lokaler Open-Food-Facts-Cache).
-- ============================================================================

-- Helper: setzt user_id automatisch auf den eingeloggten Nutzer, falls nicht gesetzt.
create or replace function public.set_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end; $$;

-- Generisches RLS-Setup pro Tabelle (per Hand aufgerufen, s. u.).
-- Policy: ein Nutzer sieht/ändert nur eigene Zeilen.

-- ---------------------------------------------------------------------------
-- profile  (lokal Singleton id=1 → serverseitig eine Zeile pro Nutzer)
-- ---------------------------------------------------------------------------
create table if not exists public.profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  height_cm double precision,
  age integer,
  sex text,
  weight_kg double precision,
  goal text,
  goal_rate_kg_per_week double precision,
  nutrition_goals jsonb,
  language text not null default 'de',
  theme text not null default 'light',
  onboarding_done boolean not null default false
);

-- ---------------------------------------------------------------------------
-- weekly_structure  (lokal keyed by weekday → serverseitig (user_id, weekday))
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_structure (
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null,
  work_start text,
  work_end text,
  work_location text,
  done_by text,
  fixed_blocks jsonb not null default '[]',
  primary key (user_id, weekday)
);

-- ---------------------------------------------------------------------------
-- Daten-Tabellen mit text-UUID-PK + user_id
-- ---------------------------------------------------------------------------
create table if not exists public.equipment (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  available boolean not null default true
);

create table if not exists public.exercise (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  equipment_id text,
  is_weighted boolean not null default false,
  notes text,
  slug text,
  muscle_group text
);

create table if not exists public.week (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year integer not null,
  iso_week integer not null,
  status text not null default 'planned',
  source text not null default 'manual',
  created_at text not null
);

create table if not exists public.block (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_id text not null,
  date text not null,
  type text not null,
  start text not null,
  "end" text not null,
  title text not null,
  details jsonb,
  status text not null default 'planned'
);

create table if not exists public.task (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text not null,
  estimated_minutes integer,
  recurrence text not null default 'none',
  status text not null default 'open',
  window_day text,
  window_start text,
  window_end text,
  context jsonb,
  block_id text,
  week_id text,
  created_at text not null,
  completed_at text
);

create table if not exists public.session_template (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name_key text not null,
  items jsonb not null default '[]'
);

create table if not exists public.workout_session (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_id text,
  template_id text,
  title text not null,
  started_at text not null,
  ended_at text,
  status text not null default 'active'
);

create table if not exists public.set_log (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id text not null,
  exercise_id text not null,
  set_index integer not null,
  reps integer,
  weight_kg double precision,
  done boolean not null default false,
  superset_group integer,
  created_at text not null
);

create table if not exists public.week_template (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  data jsonb not null,
  created_at text not null
);

create table if not exists public.food_entry (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text not null,
  meal text not null default 'snack',
  barcode text,
  name text not null,
  amount_g double precision not null,
  nutrients jsonb not null,
  created_at text not null
);

create table if not exists public.body_measurement (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text not null,
  weight_kg double precision not null,
  fat_percent double precision,
  created_at text not null
);

create table if not exists public.notification_pref (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  quiet_start text,
  quiet_end text,
  escalation_minutes integer not null default 30,
  digest_time text,
  snooze_minutes integer,
  primary key (user_id, category)
);

create table if not exists public.coach_dismissal (
  id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  until text,
  created_at text not null,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------------
-- Row-Level-Security: jede Tabelle nur für den eigenen Nutzer
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profile','weekly_structure','equipment','exercise','week','block','task',
    'session_template','workout_session','set_log','week_template','food_entry',
    'body_measurement','notification_pref','coach_dismissal'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy %1$s_owner on public.%1$I
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- user_id-Autofill-Trigger für die Tabellen ohne DEFAULT auth.uid()
-- (profile/weekly_structure/notification_pref sind zusammengesetzte Keys)
create trigger set_user_id_weekly_structure before insert on public.weekly_structure
  for each row execute function public.set_user_id();
create trigger set_user_id_notification_pref before insert on public.notification_pref
  for each row execute function public.set_user_id();
