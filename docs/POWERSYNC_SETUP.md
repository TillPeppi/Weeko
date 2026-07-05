# Weeko — PowerSync Aktivierung (Sync-Schritt 4)

> Status: **Scaffold vorhanden, noch NICHT verdrahtet.** Der Code unter
> `src/db/powersync/` + `powersync/sync-rules.yaml` ist fertig und typecheckt, wird
> aber von der laufenden App nicht importiert — die App läuft weiter auf expo-sqlite
> (local-only). Diese Anleitung „flippt" den Schalter. Voraussetzung: Supabase-Login
> steht ([SUPABASE_SETUP.md](./SUPABASE_SETUP.md)).
>
> **Verifikation dieses Schritts nur teilweise möglich:** ohne PowerSync-Cloud-Instanz
> + nativen Dev-Build kann der echte Sync nicht getestet werden. Scaffold ist
> typecheck-grün; die App bootet unverändert local-only.

## Was schon fertig ist

- **Lokales Schema sync-fertig:** `user_id` + `updated_at` auf allen Sync-Tabellen
  (Migration `0011`); Inserts stampen sie via `src/db/audit.ts` (`auditInsert()`).
- **`src/db/powersync/schema.ts`** — leitet die PowerSync-Schema via `DrizzleAppSchema`
  aus den bestehenden Drizzle-Tabellen ab (eine Quelle der Wahrheit).
- **`src/db/powersync/connector.ts`** — `SupabaseConnector` (`fetchCredentials` +
  `uploadData` über die CRUD-Queue).
- **`src/db/powersync/factory.ts` / `.web.ts`** — plattform-spezifische DB-Erzeugung
  (RN-Native bzw. wa-sqlite/OPFS auf Web).
- **`src/db/powersync/system.ts`** — `getSyncDb()` (Drizzle über PowerSync),
  `connectSync()` / `disconnectSync()`.
- **`powersync/sync-rules.yaml`** — pro-Nutzer-Buckets.
- **`supabase/schema.sql`** — Postgres-Spiegel + RLS.

## Aktivierung (Schritt für Schritt)

### 1. Supabase-DB-Schema anlegen
`supabase/schema.sql` im Supabase SQL-Editor ausführen (legt Tabellen + RLS an).

### 2. PowerSync-Cloud-Instanz
1. Auf [powersync.com](https://www.powersync.com) Instanz anlegen, mit deiner
   Supabase-Postgres verbinden (Connection-String + `powersync`-Publication anlegen —
   die PowerSync-Doku führt durch die Postgres-Freischaltung).
2. **Sync-Rules** aus `powersync/sync-rules.yaml` deployen.
3. Instanz-URL kopieren → `.env`: `EXPO_PUBLIC_POWERSYNC_URL=...`.

### 3. Config-Tabellen sync-fähig machen (Rest-Arbeit)
`profile`, `weekly_structure`, `notification_pref` haben keinen text-`id`-PK und sind
im Scaffold ausgeklammert. Zum Mitsyncen: je eine text-`id`-Spalte ergänzen (oder pro
Nutzer modellieren), dann in `schema.ts` (`drizzleSyncSchema`) + `sync-rules.yaml`
aufnehmen. Alternativ bleiben sie gerätelokal (Profil/Struktur/Prefs pro Gerät).

### 4. DB-Client umstellen
Der Kern des Swaps — die Repos sollen gegen PowerSync statt expo-sqlite laufen:
1. In `src/db/client.ts` das exportierte `db` auf `getSyncDb()` aus
   `src/db/powersync/system.ts` umstellen (oder die Repos direkt darauf zeigen lassen).
2. In `src/app/_layout.tsx` den Start-`migrate(db, migrations)`-Aufruf entfernen —
   PowerSync verwaltet das lokale Schema selbst (die Drizzle-Migrations bleiben nur für
   die Postgres-Seite relevant).
3. Nach dem Login `connectSync()` aufrufen (z. B. wenn `authStore.session` gesetzt ist),
   bei Logout `disconnectSync()`.
4. `patches/expo-sqlite+57.0.0.patch` wird dann obsolet (PowerSync bringt eigenen
   Web-Adapter).

### 5. Daten-Claim (bestehende lokale Daten)
Beim ersten Login vorhandene lokale Zeilen dem `user_id` zuweisen und hochladen, damit
deine bereits erfassten Daten nicht verloren gehen (einmaliger Migrationslauf: lokale
expo-sqlite-DB lesen → in die PowerSync-DB mit `user_id` schreiben).

### 6. Native
`@powersync/react-native` braucht einen Dev-Build (`npx expo run:ios` / `run:android`),
kein Expo Go. Web braucht die COEP/COOP-Header (schon in `metro.config.js`).

## Reihenfolge zum Testen
Zwei Geräte (bzw. Web + Handy) mit demselben Account, Flugmodus an/aus → prüfen, dass
Änderungen offline erfasst und bei Verbindung in beide Richtungen synchronisiert werden.
Konflikt = Last-Write-Wins (Single-User, unkritisch).
