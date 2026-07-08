-- Weeko: Supabase-Setup für den Direkt-Zugriff (ohne PowerSync).
-- Einmalig im Supabase SQL-Editor ausführen. Idempotent.
--
-- Hinweis: Deine DB hat bereits native Typen (boolean/jsonb), daher entfällt
-- die frühere int/text->native-Umwandlung. Es fehlen nur: ein paar neuere
-- Spalten und die Tabellen-Rechte für die API-Rollen.

-- Körperdaten: neuere Messwerte nachziehen (falls DB vor deren Einführung erstellt).
alter table public.body_measurement add column if not exists muscle_mass_kg double precision;
alter table public.body_measurement add column if not exists bone_mass_kg double precision;
alter table public.body_measurement add column if not exists bmr_kcal double precision;

-- ---------------------------------------------------------------------------
-- API-Rollen brauchen Tabellen-Rechte (sonst "permission denied for table ...").
-- RLS bleibt der eigentliche Schutz: anon sieht/ändert keine Zeilen (kein
-- auth.uid()), authenticated nur die eigenen (user_id = auth.uid()).
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
