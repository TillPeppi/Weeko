-- Weeko — Supabase (Postgres) Schema + Row-Level-Security  [PowerSync-Ziel]
-- ============================================================================
-- Server-Spiegel der lokalen SQLite-Tabellen. PowerSync lädt beim Upload JEDE
-- lokale Spalte hoch (inkl. id, user_id, updated_at), daher spiegeln die Typen
-- die lokale SQLite 1:1:
--   text→text · integer (auch Booleans 0/1)→integer · real→double precision
--   JSON (lokal als Text gespeichert)→text
-- So round-trippen Werte ohne Konvertierung. (jsonb später möglich, wenn der
-- Connector JSON parst.)
--
-- NICHT hier (LOCAL-ONLY, werden nie hochgeladen): food_product, coach_dismissal.
--
-- ⚠️ Falls du eine frühere Version dieses Schemas schon ausgeführt hast: die
-- alten Tabellen zuerst droppen (sie haben ein anderes Layout). Auf einer noch
-- leeren DB einfach ausführen. Zum kompletten Reset:
--   drop schema public cascade; create schema public;  -- (Vorsicht!)
-- ============================================================================

create or replace function public.set_user_id()
returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end; $$;

-- ---------------------------------------------------------------------------
create table if not exists public.profile (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  height_cm double precision,
  age integer,
  sex text,
  weight_kg double precision,
  goal text,
  goal_rate_kg_per_week double precision,
  nutrition_goals text,
  language text,
  theme text,
  onboarding_done integer,
  updated_at text
);

create table if not exists public.weekly_structure (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday integer not null,
  work_start text,
  work_end text,
  work_location text,
  done_by text,
  fixed_blocks text,
  updated_at text
);

create table if not exists public.notification_pref (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  enabled integer,
  quiet_start text,
  quiet_end text,
  escalation_minutes integer,
  digest_time text,
  snooze_minutes integer,
  updated_at text
);

create table if not exists public.equipment (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  available integer,
  updated_at text
);

create table if not exists public.exercise (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  equipment_id text,
  is_weighted integer,
  notes text,
  slug text,
  muscle_group text,
  updated_at text
);

create table if not exists public.week (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year integer not null,
  iso_week integer not null,
  status text,
  source text,
  created_at text,
  updated_at text
);

create table if not exists public.block (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_id text,
  date text,
  type text,
  start text,
  "end" text,
  title text,
  details text,
  status text,
  updated_at text
);

create table if not exists public.task (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  category text,
  estimated_minutes integer,
  recurrence text,
  status text,
  window_day text,
  window_start text,
  window_end text,
  context text,
  block_id text,
  week_id text,
  created_at text,
  completed_at text,
  updated_at text
);

create table if not exists public.session_template (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  name_key text,
  items text,
  updated_at text
);

create table if not exists public.workout_session (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  block_id text,
  template_id text,
  title text,
  started_at text,
  ended_at text,
  status text,
  updated_at text
);

create table if not exists public.set_log (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id text,
  exercise_id text,
  set_index integer,
  reps integer,
  weight_kg double precision,
  done integer,
  superset_group integer,
  created_at text,
  updated_at text
);

create table if not exists public.week_template (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  data text,
  created_at text,
  updated_at text
);

create table if not exists public.food_entry (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text,
  meal text,
  barcode text,
  name text,
  amount_g double precision,
  nutrients text,
  created_at text,
  updated_at text
);

create table if not exists public.body_measurement (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date text,
  weight_kg double precision,
  fat_percent double precision,
  muscle_mass_kg double precision,
  bone_mass_kg double precision,
  bmr_kcal double precision,
  created_at text,
  updated_at text
);

-- ---------------------------------------------------------------------------
-- Row-Level-Security: jeder Nutzer sieht/ändert nur eigene Zeilen.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profile','weekly_structure','notification_pref','equipment','exercise',
    'week','block','task','session_template','workout_session','set_log',
    'week_template','food_entry','body_measurement'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($f$
      create policy %1$s_owner on public.%1$I
        for all using (user_id = auth.uid()) with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;
