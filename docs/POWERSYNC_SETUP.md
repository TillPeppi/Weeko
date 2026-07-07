# Weeko — PowerSync: Engine-Swap ist verdrahtet, nativ verifizieren

> Status: **Der DB-Engine-Swap ist im Code fertig** (typecheck + 196 Tests grün).
> PowerSync ist jetzt die lokale DB. **Verifiziert wird nativ** (Dev-Build) — Web
> braucht noch Worker/WASM-Setup (unten). Fällt was um, `git checkout main` bringt
> den funktionierenden Vor-Swap-Stand zurück (Checkpoint-Commit auf `feat/accounts-sync`).

## Was der Swap geändert hat
- `src/db/client.ts`: `db` ist jetzt Drizzle über **PowerSync** (lazy Proxy), kein
  expo-sqlite mehr. `initDb()` = `PowerSync.init()`. Kein `migrate()` mehr — PowerSync
  legt die lokalen Tabellen aus `src/db/powersync/schema.ts` an.
- `src/db/powersync/`: Schema (alle Tabellen; `food_product` + `coach_dismissal` =
  **local-only**), Connector, Factory (native/web), `connectSync()`/`disconnectSync()`.
- Config-Tabellen (`profile`/`weekly_structure`/`notification_pref`) haben text-`id`,
  `food_product` hat `id` (barcode bleibt Spalte). Repos angepasst.
- `_layout.tsx`: PowerSync-Init statt migrate; `connectSync()` sobald eingeloggt.
- `metro.config.js`: inline-requires-Fix für `@powersync/react-native`.
- Die alten Drizzle-Migrations (0000–0011) laufen lokal **nicht mehr** (PowerSync
  verwaltet das Schema); sie bleiben nur als Historie / für die Postgres-Seite.

## Bevor du startest (Backend nachziehen — hat sich geändert!)
1. **`.env`** hat alle drei Werte (URL, anon/publishable key, PowerSync-URL). ✓
2. **`supabase/schema.sql` NEU ausführen** — es wurde überarbeitet (id-PKs auf den
   Config-Tabellen, `updated_at`/`user_id` überall, Typen an SQLite angeglichen).
   Falls du die alte Version schon ausgeführt hast: alte Tabellen zuerst droppen
   (im SQL-Editor: `drop schema public cascade; create schema public;` — nur wenn
   noch keine echten Daten drin sind), dann `schema.sql` ausführen.
3. **`powersync/sync-rules.yaml` NEU deployen** — jetzt inkl. profile/weekly_structure/
   notification_pref, ohne coach_dismissal.
4. Publication `powersync` existiert (`create publication powersync for all tables;`). ✓

## Web (funktioniert — verifiziert)
`@powersync/web` läuft unter Expo/Metro über die vorgebauten UMD-Worker + WASM, die
`powersync-web copy-assets` nach `public/@powersync/` legt (Expo serviert `public/`).
Das ist automatisiert: `postinstall` **und** `npm run web` rufen copy-assets auf; die
Worker-Pfade stehen in `src/db/powersync/factory.web.ts`. **Verifiziert:** die Web-App
bootet mit PowerSync als DB (Worker/WASM laden, Seeds + Transaktionen laufen, keine
Konsolenfehler). `npm run web` → Port 8090.

## Nativ bauen & starten
`@powersync/react-native` ist ein Native-Modul → **Dev-Build nötig, kein Expo Go**:
```bash
npx expo prebuild        # einmalig, erzeugt ios/ + android/
npx expo run:ios         # oder: npx expo run:android
```

## Verifizieren (Sync-Round-Trip — dein Login nötig)
> Den Sync-Test bis zum Hochladen kann ich headless nicht abschließen (braucht eine
> echte, bestätigte Session — kein Test-Postfach hier; `example.com` lehnt Supabase als
> ungültig ab). Registriere dich mit einer **echten E-Mail** (oder schalte in Supabase
> Auth **„Confirm email" aus**, dann geht Anmeldung sofort).
1. App startet → Login-Screen → **registrieren + anmelden**.
2. Ein paar Daten anlegen (Aufgabe, Gewicht, Trainings-Session).
3. **Supabase → Table Editor**: die Zeilen tauchen in `task` / `body_measurement` /
   `workout_session` mit deiner `user_id` auf.
4. **PowerSync-Dashboard**: Instanz zeigt „connected" + Upload/Download-Aktivität.
5. Zweites Gerät (oder App neu installieren) mit demselben Login → Daten sind da.

## Wenn etwas hakt — schick mir bitte
- Die **rote Fehlermeldung** (Full Stack) aus dem Dev-Build.
- Relevante **Metro-Logs** / `npx expo run:ios`-Ausgabe.
- Ob's beim **Start** (Init), beim **Schreiben** oder beim **Sync** (Upload) knallt.

### Bekannte Risikostellen (dafür testen wir nativ)
- **Transaktionen:** einige Repos nutzen `db.transaction()` (Wochen-Import, Seeds,
  Trainings-Import, „alles löschen"). Sollte der PowerSync-Drizzle-Treiber das anders
  handhaben, fixe ich die betroffenen Stellen anhand deiner Logs.
- **Init/Factory** nativ (quick-sqlite) — falls „Super expression…" o. ä.: Metro-Cache
  leeren (`npx expo start -c`).
- **Typ-Roundtrip** (Boolean als 0/1, JSON als Text) Richtung Postgres — falls Upload-
  Fehler „column … type", melde die genaue Meldung.

## Bewusst noch offen (Follow-ups)
- **Daten-Claim:** deine **bisherigen lokalen Daten** (alte expo-sqlite-DB) werden NICHT
  automatisch übernommen — die PowerSync-DB startet leer und füllt sich aus der Cloud.
  Bestehende Daten ggf. per Analyse-Export/-Import wieder einspielen. Echten Claim
  (alte DB lesen → mit user_id hochladen) bauen wir separat, wenn du ihn brauchst.
- **Web:** `@powersync/web` braucht `npx powersync-web copy-assets` + Worker/WASM-Serving
  unter Metro — nicht eingerichtet (Metro ≠ Vite/webpack). Erstmal nativ; PWA später.
- **Logout:** aktuell `disconnect()` (lokale Daten bleiben). Für Mehrnutzer-pro-Gerät
  wäre `disconnectAndClear()` sauberer.
