# Weeko — Konzept: Accounts & Cloud-Sync (Phase 3)

> Status: **Konzept / noch nicht umgesetzt.** Dieses Dokument beschreibt den Weg von
> „100 % lokal" (heute) zu „ein Account, dieselben Daten auf Handy und Web".
> Entscheidungen sind hier festgehalten; bei der Umsetzung die **versionierten Docs**
> gegenprüfen (Supabase, PowerSync — APIs ändern sich).
>
> **Getroffene Grundentscheidungen:**
> - Offline-first **bleibt** → Sync-Engine statt „direkt gegen Server".
> - **Single-User pro Account** (ein Nutzer, mehrere Geräte) → Konflikte = Last-Write-Wins.
>
> **Fortschritt:** ✅ **Schritt 1 (UUID-Migration) ist umgesetzt** — siehe §3.1 und §8.
> Präzisierung nach Prüfung der PowerSync-Doku: **`deletedAt`-Tombstones sind mit
> PowerSync NICHT nötig** (die Upload-Queue propagiert Deletes als echte Operationen);
> `userId`/`updatedAt` werden im Auth-/Sync-Schritt ergänzt (mit der echten User-ID
> backfillen statt Platzhalter). Der eine wirklich harte, schwer nachrüstbare Schritt
> war die globale ID-Umstellung — der ist erledigt.

---

## 1. Ausgangslage (warum das nötig ist)

Heute ist SQLite die alleinige Quelle der Wahrheit — **lokal pro Gerät**:

- Handy: DB im App-Sandbox.
- Web: expo-sqlite über **wa-sqlite/OPFS** → liegt **pro Browser lokal** (ARCHITECTURE.md
  Entscheidung #2). Es gibt heute **keinen** gemeinsamen Speicher zwischen Handy und Web.

„Dieselben Daten auf Handy und Website" ist also ohne einen server-seitigen Speicher +
Identität grundsätzlich nicht möglich. Es braucht **drei** Bausteine:

| # | Baustein | Zweck | Gewählte Lösung |
|---|---|---|---|
| 1 | **Auth / Accounts** | Identität + Login auf allen Plattformen | Supabase Auth |
| 2 | **Cloud-Datenbank** | server-seitiger Speicher, pro Nutzer isoliert | Supabase (Postgres + RLS) |
| 3 | **Sync-Engine** | lokale SQLite ⇄ Cloud, offline-first, Konfliktauflösung | PowerSync |

---

## 2. Ziel-Architektur

```
┌─────────────── Gerät (Handy / Browser) ───────────────┐
│                                                        │
│  React-Komponenten  →  Drizzle-Queries                 │
│         │                    │                          │
│         │        @powersync/drizzle-driver              │
│         │        (toCompilableQuery, useQuery)          │
│         ▼                    ▼                          │
│  PowerSync-SQLite (lokal, offline-first)               │
│         ▲                                               │
└─────────┼───────────────────────────────────────────────┘
          │  Sync (bidirektional, delta, verschlüsselt)
          │  Auth-Token von Supabase (auth.user_id())
          ▼
┌──────────────── PowerSync Service ─────────────────────┐
│  Sync Rules (YAML): welche Zeilen gehören welchem User │
└─────────┬───────────────────────────────────────────────┘
          │  logische Replikation
          ▼
┌──────────────── Supabase ──────────────────────────────┐
│  Postgres (Master-Kopie aller Daten)                   │
│  Row-Level-Security: user_id = auth.uid()              │
│  Auth (E-Mail / Magic-Link / Social)                   │
└─────────────────────────────────────────────────────────┘
```

**Kernidee:** Die App liest/schreibt weiter **lokal** gegen SQLite (Repos/Stores bleiben
im Prinzip erhalten — nur der DB-Client wechselt). PowerSync spiegelt Postgres → lokale
SQLite und schreibt lokale Änderungen zurück. Offline funktioniert alles voll; bei
Verbindung wird delta-synchronisiert.

**Warum PowerSync und nicht „direkt gegen Supabase queryen":** Letzteres würde Offline-first
zerstören (jede Query braucht Netz) — genau die Eigenschaft, die wir uns mit SQLite aufgebaut
haben. PowerSync erhält sie.

---

## 3. Der harte Teil: Datenmodell-Migration

Das ist die eigentliche Arbeit — **unabhängig** von der Cloud-Wahl. Das aktuelle Schema
ist nicht sync-fähig. Drei Probleme, drei Pflicht-Änderungen an **jeder synchronisierten
Tabelle**:

### 3.1 Primary Keys: `integer autoIncrement` → `text` UUID  ✅ UMGESETZT

**Problem:** Alle Tabellen nutzten `integer('id').primaryKey({ autoIncrement: true })`.
Autoincrement-IDs sind **pro Gerät** vergeben. Legst du offline auf dem Handy `block #5`
an und im Web offline auch `block #5`, kollidieren sie beim Sync.

**Lösung (implementiert):** Client-generierte **UUIDs** als Text-PK. `src/db/id.ts`
(`newId()`) nutzt `crypto.randomUUID()` mit RFC-4122-v4-Fallback (kein Native-Modul,
läuft auf Web + Hermes). IDs werden in den Repos beim Insert vergeben (kein `$defaultFn`
im Schema, damit `schema.ts` importfrei bleibt und drizzle-kit nicht bricht).

Umgestellte Tabellen: `equipment`, `exercise`, `week`, `block`, `task`,
`session_template`, `workout_session`, `set_log`, `week_template`, `food_entry`,
`body_measurement`. FK-Spalten (`block.weekId`, `task.blockId/weekId`,
`setLog.sessionId/exerciseId`, `workoutSession.blockId/templateId`, `exercise.equipmentId`)
sind auf `text` gewandert. `foodEntry.barcode` war schon `text` (referenziert `food_product`).

**Natürliche Schlüssel bleiben** (kein autoIncrement, kein Sammelklassenproblem):
`profile` (id=1), `weekly_structure` (weekday), `notification_pref` (category),
`coach_dismissal` (text id), `food_product` (barcode — wird ohnehin nicht gesynct).

**Nicht-PK-Integer bleiben `number`:** `set_log.supersetGroup` (Gruppen-ID pro Session),
`set_index`, sowie Domain-„Session-Index"-Werte in den Statistiken.

Migration: `src/db/migrations/0010_flowery_leader.sql` (SQLite-Tabellen-Neuanlage:
`__new_*` erstellen → Daten kopieren → droppen → umbenennen). Bestehende Integer-IDs
werden als Text übernommen (Referenzen bleiben intakt); neue Zeilen bekommen UUIDs.

### 3.2 Änderungs-Zeitstempel: `updated_at` überall

**Problem:** Für Konfliktauflösung (Last-Write-Wins) muss man wissen, welche Version
neuer ist. Viele Tabellen haben nur `createdAt`.

**Lösung:** `updatedAt TEXT NOT NULL` (ISO-8601 UTC) auf **jeder** synchronisierten Tabelle,
bei jedem Schreibvorgang gesetzt. `profile` hat es schon.

### 3.3 Löschen: mit PowerSync KEIN Soft-Delete nötig ✋ (Präzisierung)

Ursprünglich als „Tombstones (`deletedAt`)" geplant. Nach Prüfung der PowerSync-Doku
**verworfen für diesen Pfad:** PowerSync erfasst lokale Änderungen — inkl. `DELETE` — als
echte Operationen in einer **Upload-Queue** und repliziert sie zum Backend; von dort
verschwindet die Zeile bei den anderen Geräten über den Sync-Stream. Tombstones braucht
nur handgeschriebener „nach `updated_at` pollen"-Sync ohne Operationslog. Wir behalten also
**harte Deletes** — spart Read-Filter in jedem Repo und den Unique-Index-Konflikt bei
`applyWeekImport` (Wochen-Ersatz). Kann später für Undo/Retention nachgerüstet werden.

### 3.4 Besitzer-Spalte + Server-Isolation

**Lösung:** `userId TEXT NOT NULL` (= Supabase `auth.uid()`) auf allen Nutzer-Daten-Tabellen.
Serverseitig **Row-Level-Security**: `USING (user_id = auth.uid())`. Sync-Rules filtern
zusätzlich `WHERE user_id = auth.user_id()`. Bei Single-User genügt das als vollständige
Mandantentrennung.

### 3.5 Sonderfälle: Singleton-Tabellen

Diese haben heute „unnatürliche" PKs und brauchen eine bewusste Entscheidung:

| Tabelle | heutiger PK | Umstellung |
|---|---|---|
| `profile` | `id = 1` (fix) | PK = `userId` (eine Zeile pro Nutzer) |
| `weeklyStructure` | `weekday` (1–7) | zusätzlich `userId`; PK = (`userId`,`weekday`) |
| `notificationPref` | `category` | zusätzlich `userId`; PK = (`userId`,`category`) |
| `coachDismissal` | `id` (text) | schon text-PK; nur `userId` ergänzen |
| `foodProduct` | `barcode` | **Kandidat: NICHT syncen** (globaler OFF-Cache, kein Nutzerbezug) — oder pro Nutzer duplizieren. Empfehlung: lokal lassen, nicht syncen. |

> **Entscheidung `foodProduct`:** Produktdaten kommen ohnehin aus Open Food Facts und sind
> nicht nutzerspezifisch. Kandidat, um sie vom Sync auszunehmen (bleibt lokaler Cache pro
> Gerät). `foodEntry` (die tatsächlichen Log-Einträge) **wird** gesynct und snapshottet die
> Nährwerte ja bereits selbst (ARCHITECTURE.md #15) → funktioniert auch ohne gesyncten Cache.

### 3.6 Was NICHT gesynct wird

- **`foodProduct`** — globaler OFF-Cache (s. o.).
- **Lokale Notifications** — bleiben gerätespezifisch (expo-notifications plant lokal; Web
  kann es ohnehin nicht, ARCHITECTURE.md #13). Der *Zustand* (Task done/offen) synct, die
  geplanten OS-Notifications nicht.
- **`onboardingDone`, `theme`, `language`** — Grenzfall: entweder pro Nutzer syncen (dann auf
  allen Geräten gleiches Theme) oder gerätelokal halten. **Empfehlung:** Sprache/Theme lokal
  pro Gerät (fühlt sich natürlicher an), Rest des Profils syncen.

---

## 4. Zwei Schemata, sauber getrennt halten

Nach der Umstellung gibt es **zwei** Schema-Definitionen, die konsistent bleiben müssen:

1. **Lokales PowerSync-Schema** (im Client, JS) — was auf dem Gerät in SQLite liegt. Über den
   Drizzle-Treiber aus den Drizzle-Tabellen ableitbar.
2. **Server-Postgres-Schema** (Supabase-Migrations) — die Master-Kopie.

Verbunden werden beide durch die **Sync-Rules**. Wichtige Konsequenzen:
- **Drizzle-Migrations laufen künftig gegen Postgres** (Supabase), nicht mehr gegen die lokale
  DB. Die lokale DB-Struktur verwaltet PowerSync.
- Der `patches/expo-sqlite+57.0.0.patch` (Web-Sync-Bridge-Bug) wird **hinfällig**: PowerSync
  bringt seinen eigenen Web-SQLite-Adapter (wa-sqlite) mit. expo-sqlite als DB-Client entfällt.

---

## 5. Sync-Rules (Beispiel)

PowerSync entscheidet per YAML, welche Zeilen zu welchem Nutzer gehören. Für Single-User:

```yaml
config:
  edition: 3
streams:
  user_data:
    auto_subscribe: true
    queries:
      - SELECT * FROM profile          WHERE user_id = auth.user_id()
      - SELECT * FROM weekly_structure WHERE user_id = auth.user_id()
      - SELECT * FROM week             WHERE user_id = auth.user_id()
      - SELECT * FROM block            WHERE user_id = auth.user_id()
      - SELECT * FROM task             WHERE user_id = auth.user_id()
      - SELECT * FROM workout_session  WHERE user_id = auth.user_id()
      - SELECT * FROM set_log          WHERE user_id = auth.user_id()
      - SELECT * FROM exercise         WHERE user_id = auth.user_id()
      - SELECT * FROM equipment        WHERE user_id = auth.user_id()
      - SELECT * FROM food_entry       WHERE user_id = auth.user_id()
      - SELECT * FROM body_measurement WHERE user_id = auth.user_id()
      - SELECT * FROM session_template WHERE user_id = auth.user_id()
      - SELECT * FROM week_template    WHERE user_id = auth.user_id()
      - SELECT * FROM notification_pref WHERE user_id = auth.user_id()
      - SELECT * FROM coach_dismissal  WHERE user_id = auth.user_id()
```

---

## 6. Auth-Flow

- **Supabase Auth**, Empfehlung **Magic-Link (E-Mail)** oder E-Mail+Passwort — kein eigener
  Auth-Server nötig. Social-Login (Apple/Google) später ergänzbar; **Apple-Login ist Pflicht**,
  falls man Google-Login im iOS-Store anbietet.
- Native + Web teilen den Supabase-Client; `expo-secure-store` (nativ) / localStorage (Web)
  für die Session. **Achtung Expo:** `fetch` des Supabase-Clients auf `expo-fetch` overriden
  (nötig für Background-Sync — bestätigt in PowerSync-Demos).
- Login-Screen als eigener Flow **vor** dem `(tabs)`-Layout; Redirect analog zum heutigen
  `onboardingDone`-Gate.
- **Migration bestehender lokaler Daten:** Beim ersten Login die vorhandene lokale DB dem neuen
  `userId` zuordnen und hochladen (einmaliger „Claim"-Schritt), damit deine bereits erfassten
  Daten nicht verloren gehen.

---

## 7. Konfliktauflösung

Bei **Single-User** trivial: **Last-Write-Wins pro Zeile** über `updatedAt` (PowerSync-Default).
Realistisches Konfliktfenster = du bearbeitest dieselbe Zeile auf zwei Geräten offline
gleichzeitig — selten und unkritisch. Kein CRDT/Merge nötig. (Würde erst bei echtem Mehrnutzer-
Sharing relevant — bewusst außen vor, s. §9.)

---

## 8. Migrationspfad (Reihenfolge)

1. ✅ **ERLEDIGT — Schema sync-fähig machen (rein lokal):** UUID-PKs auf allen ehemaligen
   autoIncrement-Tabellen (`src/db/id.ts` + Migration `0010`). Repos generieren IDs beim
   Insert, alle `number`-IDs in Repos/Stores/Domain/UI auf `string` umgestellt, Route-Param
   `session/[id]` liest jetzt String. Typecheck grün, 193 Tests grün (die eine Ausnahme
   gehört zum laufenden Trainings-Import-Feature, nicht zum Sync), App bootet + migriert
   sauber auf Web verifiziert. **`updatedAt`/`userId` bewusst hierher NICHT gezogen** — sie
   kommen in Schritt 3, mit der echten User-ID backfillbar; `deletedAt` entfällt (§3.3).
2. 🟡 **Supabase-Projekt** — Code-Seite fertig: `supabase/schema.sql` (Postgres-Spiegel +
   RLS, vorbereitet) und [SUPABASE_SETUP.md](./SUPABASE_SETUP.md). **Offen (nur vom Nutzer
   machbar):** Projekt anlegen, E-Mail-Provider aktivieren, URL+anon-key in `.env`, SQL
   ausführen (letzteres erst für Schritt 4 nötig).
3. ✅ **ERLEDIGT — Auth in der App:** `@supabase/supabase-js` + AsyncStorage-Adapter,
   Client (`src/auth/supabase.ts`, **lazy** — SSR-sicher, da `web.output: static` in Node
   rendert), Auth-Store (`authStore`), Login-Screen (`app/login.tsx`, E-Mail+Passwort, i18n
   de+en), Gate im Root-Layout (nur aktiv wenn konfiguriert), Logout in Settings. **Ohne
   Env läuft die App unverändert lokal** (kein Gate). Verifiziert: local-only + konfiguriert
   (Gate → /login) booten fehlerfrei auf Web; Typecheck + 196 Tests grün.
4. 🟡 **PowerSync integrieren — Scaffold fertig, nicht verdrahtet** (siehe
   [POWERSYNC_SETUP.md](./POWERSYNC_SETUP.md)): Deps installiert; `src/db/powersync/`
   (Schema via `DrizzleAppSchema`, `SupabaseConnector`, plattform-Factory native/web,
   `getSyncDb()`/`connectSync()`) + `powersync/sync-rules.yaml` geschrieben & typecheck-grün.
   **Lokale Prep erledigt:** `user_id`/`updated_at` auf allen Sync-Tabellen (Migration `0011`),
   Inserts gestampt (`src/db/audit.ts`). **Offen (braucht dein Backend + Dev-Build):**
   PowerSync-Cloud-Instanz + Sync-Rules deployen, DB-Client von expo-sqlite auf `getSyncDb()`
   umstellen, `migrate()` durch PowerSync-Schema-Management ersetzen, Config-Tabellen
   (profile/weekly_structure/notification_pref) mit text-`id` nachrüsten, Daten-Claim.
5. **Sync-Rules deployen + Konflikt-/Offline-Szenarien testen** (2 Geräte, Flugmodus) — Teil von 4.
6. **Daten-Claim** beim ersten Login (bestehende lokale Daten hochladen). *(~0,5 Session)*
7. ARCHITECTURE.md + PROGRESS.md nachziehen; `patches/expo-sqlite` entfernen.

Grobe Summe: **~6 Sessions**. Schritt 1 und 4 sind das Risiko.

---

## 9. Kosten, Risiken, offene Punkte

**Kosten:** Supabase Free-Tier + PowerSync Free-/Dev-Tier reichen für Single-User locker.
Erst bei vielen Nutzern relevant.

**Risiken:**
- DB-Client-Wechsel (expo-sqlite → PowerSync-SQLite) berührt jeden Repo. Der Drizzle-Treiber
  mildert das (Queries bleiben), aber Init/Migrations/Transaktionen ändern sich.
- Zwei Schemata (lokal + Postgres) konsistent halten — Disziplin nötig.
- COEP/COOP-Header fürs Web bleiben Thema (PowerSync-Web nutzt wie bisher wa-sqlite/OPFS).

**Bewusst NICHT im Scope (später):**
- Mehrnutzer/Sharing (Coach sieht Daten, geteilte Pläne) → bräuchte Berechtigungsmodell +
  echte Konfliktstrategie. Das aktuelle `userId`-Design ist aber kompatibel erweiterbar.
- Ende-zu-Ende-Verschlüsselung.

**Alternativen (verworfen):**
- *Nur Supabase, direkt gegen Postgres* — zerstört Offline-first. Verworfen.
- *Turso/libSQL Embedded Replicas* — sehr SQLite-nah, aber Web-Support für Embedded Replicas
  schwächer und Multi-Tenant = DB-pro-Nutzer. Für später denkbar, aber PowerSync ist der
  reifere RN+Web-Pfad.
