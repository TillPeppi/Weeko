# Weeko — Sync live schalten: Schritt-für-Schritt

> Deine Aufgabenliste, um Supabase + PowerSync anzulegen. Danach mache ich mit dir den
> Code-Swap (verifiziert). Reihenfolge einhalten. Detaildocs:
> [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) · [POWERSYNC_SETUP.md](./POWERSYNC_SETUP.md).

**Wichtig vorab:** Login (Supabase Auth) und Datensync (PowerSync) sind zwei getrennte
Dienste. Teil A macht den Login live, Teil B den Sync.

---

## Teil A — Supabase (Accounts/Login)

### A1. Projekt anlegen
1. [supabase.com](https://supabase.com) → einloggen → **New project**.
2. Organisation wählen, **Name** „weeko", ein **Database Password** setzen (im Passwort-
   manager speichern), **Region: EU (Frankfurt)**.
3. **Create new project** → ~2 Min warten.

### A2. Zugangsdaten → .env
1. Linke Sidebar: **Project Settings** (Zahnrad) → **API**.
2. Kopiere **Project URL** und den client-sicheren Key: in neueren Projekten
   **„Publishable key"** (`sb_publishable_…`), in älteren **„anon public"**. (NICHT den
   „Secret key" / `service_role` — der darf nie in die App.)
3. Im Projektordner:
   ```bash
   cp .env.example .env
   ```
   Trage ein:
   ```
   EXPO_PUBLIC_SUPABASE_URL=<Project URL>
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   ```

### A3. E-Mail-Login aktivieren
1. Sidebar: **Authentication** → **Sign In / Providers** → **Email** aktivieren.
2. Zum schnellen Testen: **Confirm email = OFF** (unter Email-Provider bzw. Auth →
   Settings). Später wieder anschalten.

### A4. DB-Schema + RLS anlegen
1. Sidebar: **SQL Editor** → **New query**.
2. Inhalt von **`supabase/schema.sql`** einfügen → **Run**.
   - Hinweis: Dieses Schema deckt die Datentabellen ab. Die Feinmodellierung von
     `profile` / `weekly_structure` / `notification_pref` / `coach_dismissal` für den
     Sync machen wir gemeinsam beim Swap (dort passe ich schema.sql final an) — für den
     reinen Login ist A4 nicht mal nötig.

### ✅ Checkpoint A
Dev-Server neu starten (`npm run web`). Die App sollte jetzt auf dem **Login-Screen**
starten. Registrieren → (ggf. Mail bestätigen) → anmelden → App. Abmelden über
**Settings → Konto**. Funktioniert das, ist der Login live.

---

## Teil B — PowerSync (Datensync)

### B1. Postgres für PowerSync freischalten
1. Logische Replikation ist bei neuen Supabase-Projekten an (`wal_level=logical`).
2. **Publication `powersync` anlegen** — Supabase → **SQL Editor** → ausführen:
   ```sql
   create publication powersync for all tables;
   ```
   Ohne diese Publication schlägt PowerSyncs „Test connection" mit
   **„Publication 'powersync' not found"** fehl. Was real zu den Geräten synct, steuern
   die Sync-Rules (B3), nicht die Publication — daher `for all tables`.

### B2. PowerSync-Instanz
1. [powersync.com](https://www.powersync.com) → Account → **Create instance**.
2. **Connect to Supabase**: Connection-String aus Supabase → **Database → Connection**
   (Host, Port 5432, DB `postgres`, User, das Passwort aus A1). PowerSync führt durch die
   Publication-Erstellung.
3. **Instance URL** kopieren → `.env`:
   ```
   EXPO_PUBLIC_POWERSYNC_URL=<PowerSync Instance URL>
   ```

### B3. Sync-Rules deployen
1. In PowerSync: **Sync Rules** öffnen.
2. Inhalt von **`powersync/sync-rules.yaml`** einfügen → **Deploy** → validieren lassen.

### ✅ Checkpoint B (dann meldest du dich)
Wenn A + B stehen und du `EXPO_PUBLIC_SUPABASE_URL/_ANON_KEY/_POWERSYNC_URL` in `.env`
hast: **sag mir Bescheid.** Dann mache ich den restlichen Code:
- Config-Tabellen final sync-modellieren (text-`id`), `coach_dismissal` cross-user fixen,
- `supabase/schema.sql` final anpassen (du führst das kurze Update-SQL aus),
- DB-Client von expo-sqlite auf PowerSync umstellen + `connectSync()` nach Login,
- Daten-Claim für deine bestehenden lokalen Daten,
- auf **Web** verifizieren wir live; für iOS/Android brauchst du einen Dev-Build
  (`npx expo run:ios` / `run:android`).

---

## Was du NICHT brauchst
- Kein `service_role`-Key in der App (nur anon). 
- Keine Secrets committen — `.env` ist in `.gitignore`.
