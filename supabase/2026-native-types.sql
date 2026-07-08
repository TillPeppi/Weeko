-- Weeko: Spalten auf native Postgres-Typen ziehen (PowerSync-Altlast: bool als
-- integer, JSON als text) + fehlende Spalten nachziehen + GRANTs.
-- Einmalig im Supabase SQL-Editor ausführen. Sicher auf leeren Tabellen.

-- Körperdaten: neuere Messwerte nachziehen (falls DB vor deren Einführung erstellt).
alter table public.body_measurement add column if not exists muscle_mass_kg double precision;
alter table public.body_measurement add column if not exists bone_mass_kg double precision;
alter table public.body_measurement add column if not exists bmr_kcal double precision;


-- Booleans: integer(0/1) -> boolean
alter table public.profile          alter column onboarding_done drop default;
alter table public.profile          alter column onboarding_done type boolean using (onboarding_done <> 0);
alter table public.profile          alter column onboarding_done set default false;

alter table public.equipment         alter column available drop default;
alter table public.equipment         alter column available type boolean using (available <> 0);
alter table public.equipment         alter column available set default true;

alter table public.exercise           alter column is_weighted drop default;
alter table public.exercise           alter column is_weighted type boolean using (is_weighted <> 0);
alter table public.exercise           alter column is_weighted set default false;

alter table public.set_log             alter column done drop default;
alter table public.set_log             alter column done type boolean using (done <> 0);
alter table public.set_log             alter column done set default false;

alter table public.notification_pref  alter column enabled drop default;
alter table public.notification_pref  alter column enabled type boolean using (enabled <> 0);
alter table public.notification_pref  alter column enabled set default true;

-- JSON payloads: text -> jsonb
alter table public.profile           alter column nutrition_goals drop default;
alter table public.profile           alter column nutrition_goals type jsonb using (nullif(nutrition_goals, '')::jsonb);

alter table public.weekly_structure  alter column fixed_blocks drop default;
alter table public.weekly_structure  alter column fixed_blocks type jsonb using (nullif(fixed_blocks, '')::jsonb);
alter table public.weekly_structure  alter column fixed_blocks set default '[]'::jsonb;

alter table public.block             alter column details type jsonb using (nullif(details, '')::jsonb);

alter table public.workout_session   alter column context type jsonb using (nullif(context, '')::jsonb);

alter table public.session_template  alter column items drop default;
alter table public.session_template  alter column items type jsonb using (nullif(items, '')::jsonb);
alter table public.session_template  alter column items set default '[]'::jsonb;

alter table public.week_template     alter column data type jsonb using (nullif(data, '')::jsonb);

alter table public.food_entry        alter column nutrients type jsonb using (nullif(nutrients, '')::jsonb);

-- ---------------------------------------------------------------------------
-- API-Rollen brauchen Tabellen-Rechte (sonst "permission denied for table ...").
-- RLS bleibt der eigentliche Schutz: anon sieht/ändert keine Zeilen (kein
-- auth.uid()), authenticated nur die eigenen (user_id = auth.uid()).
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
