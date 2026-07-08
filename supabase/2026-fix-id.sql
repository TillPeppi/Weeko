-- Weeko: fehlende id-Spalte in Config-Tabellen nachziehen (idempotent).
-- Die App nutzt ueberall 'id text' als Kennung; alte Config-Tabellen hatten keine.
alter table public.profile add column if not exists id text;
alter table public.weekly_structure add column if not exists id text;
alter table public.notification_pref add column if not exists id text;
alter table public.equipment add column if not exists id text;
alter table public.exercise add column if not exists id text;
alter table public.week add column if not exists id text;
alter table public.block add column if not exists id text;
alter table public.task add column if not exists id text;
alter table public.session_template add column if not exists id text;
alter table public.workout_session add column if not exists id text;
alter table public.set_log add column if not exists id text;
alter table public.week_template add column if not exists id text;
alter table public.food_entry add column if not exists id text;
alter table public.body_measurement add column if not exists id text;

-- Schema-Cache neu laden, damit PostgREST die neue Spalte kennt
notify pgrst, 'reload schema';
