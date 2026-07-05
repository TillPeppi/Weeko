# Weeko — Architektur (Phase 1)

> Fortlaufend gepflegtes Dokument: Struktur, Datenfluss, Entscheidungen.
> Für den Scope siehe [REQUIREMENTS.md](../REQUIREMENTS.md), für das Import-Format
> [WEEK_SCHEMA.md](./WEEK_SCHEMA.md), für den Stand [PROGRESS.md](./PROGRESS.md).

## Stack (entschieden, siehe Requirements §3)

Expo SDK 57 · React Native 0.86 · TypeScript strict · Expo Router (file-based) ·
expo-sqlite + Drizzle ORM · Zod 4 · Zustand · NativeWind 4 (Tailwind) ·
i18next/react-i18next + expo-localization · expo-notifications (nur lokal) ·
FlashList · date-fns 4 · reanimated · lucide-react-native · Vitest.

## Projektstruktur

```
weeko/
├── REQUIREMENTS.md            ← Produkt-/Phasen-Brief (Quelle der Wahrheit)
├── docs/                      ← ARCHITECTURE / WEEK_SCHEMA (generiert) / PROGRESS
├── scripts/generate-week-schema.ts  ← npm run schema:docs
├── src/
│   ├── app/                   ← Expo-Router-Routen (SDK-57-Konvention: src/app statt app/)
│   │   ├── _layout.tsx        ← Migrations, Bootstrap, i18n/Theme-Hydration, Stack
│   │   ├── (tabs)/            ← Woche · Heute (index) · Training · Ernährung · Aufgaben · Settings
│   │   ├── onboarding/index.tsx
│   │   ├── import.tsx         ← Wochen-Import (Modal)
│   │   ├── training-import.tsx ← Trainings-Import: KI-Prompt + JSON (Modal)
│   │   ├── export.tsx         ← Analyse-Export Woche/Monat (JSON + Prompt)
│   │   ├── food/add.tsx       ← Essen hinzufügen (Modal: Scan/Suche/Eigener Eintrag)
│   │   └── session/[id].tsx   ← Trainings-Session
│   ├── api/openFoodFacts.ts   ← OFF-Client (Barcode-Lookup + Produktsuche)
│   ├── components/            ← ui/ (Button, Card, Field, …), timeline/, editors/, food/
│   ├── constants/blockColors.ts
│   ├── domain/                ← PURE Logik, keine React/Expo-Imports, mit Tests
│   ├── db/                    ← schema.ts, client.ts, seeds.ts, bootstrap.ts, migrations/, repos/
│   ├── schemas/week.ts        ← Zod-Import-Schema (Single Source of Truth)
│   ├── stores/                ← Zustand: settings, week, task, training, food
│   ├── i18n/                  ← index.ts + locales/{de,en}.json
│   └── notifications/scheduler.ts
└── tailwind.config.js / metro.config.js / babel.config.js / drizzle.config.ts
```

## Datenfluss

1. **Start:** `_layout.tsx` → Drizzle-Migrations (`useMigrations`) → `bootstrapDefaults()`
   (idempotente Seeds: Notification-Prefs, Equipment/Übungen, Session-Templates,
   Wochenstruktur) → Stores hydratisieren (Settings aus `profile`, aktive Session).
2. **Onboarding:** zeigt die geseedeten Defaults (§5) als editierbare Vorbelegung,
   persistiert in `profile`/`weekly_structure`. `profile.onboardingDone` steuert
   den Redirect in `(tabs)/_layout.tsx`.
3. **Import:** JSON (Paste/Datei) → `parseWeekImport()` (Zod, strukturierte Fehler
   mit i18n-Keys) → Regel-Engine-Warnungen → editierbare Vorschau → Re-Validierung →
   `applyWeekImport()` (Transaktion: Zielwoche ersetzen) → Notifications neu planen.
4. **Ausführung:** Woche/Heute lesen über `weekStore`; Block-Status-Zyklus
   `planned → done → skipped → planned` per Tap. Training schreibt `set_log`
   sofort (offline-first), Prefill kommt aus der letzten Session derselben Übung.

## Entscheidungen (mit Begründung)

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | **`src/app` statt `app/`** | Expo-SDK-57-Template-Konvention; alles unter `src/`, Expo Router unterstützt beides nativ. |
| 2 | **Web-Persistenz: expo-sqlite wasm (OPFS)** | SDK 57 liefert Web-Support über wa-sqlite. Erfordert `wasm` als Asset-Ext + COEP/COOP-Header (beides in `metro.config.js`). Gleiche Drizzle-API auf allen Plattformen → kein Fallback nötig. **Achtung Produktion:** Beim statischen Hosting müssen die Header (`Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Opener-Policy: same-origin`) vom Host gesetzt werden. |
| 3 | **Zod 4, JSON-Schema nativ** | `z.toJSONSchema()` ersetzt `zod-to-json-schema` (nur Zod 3). `docs/WEEK_SCHEMA.md` wird per `npm run schema:docs` generiert. |
| 4 | **Fehler als i18n-Keys** | Zod-`error`-Messages enthalten Keys (`week.import.errors.*`), `mapImportIssues()` extrahiert Tag/Block/Feld aus dem Pfad. UI übersetzt → lokalisierte Meldungen inkl. Position („Tag 3, Block 2: …“). |
| 5 | **React Compiler deaktiviert** | Template-Default war an; mit NativeWinds eigenem `jsxImportSource` deaktiviert, um Interop-Risiken zu vermeiden. Kann später evaluiert werden. |
| 6 | **Dark Mode: `darkMode: 'class'` + `colorScheme.set()`** | Manueller Toggle (System/Hell/Dunkel) + System-Follow über NativeWind; Persistenz in `profile.theme`. |
| 7 | **Seeds über i18n zur Seed-Zeit** | Übungs-/Equipment-Namen sind editierbare Nutzerdaten. Sie werden einmalig in der aktiven Sprache erzeugt (keine hartcodierten Strings in der Logik). Fixblock-Titel tragen i18n-Keys (`seeds.*`), Nutzereingaben Rohtext — `fixedBlockTitle()` löst auf. |
| 8 | **Notifications: begrenzte Eskalations-Serie** | Lokale Notifications können nicht bedingt loopen. Pro Aufgabe wird 1 Reminder + max. 5 Eskalationen im Kategorie-Intervall geplant; Erledigen/Ändern cancelt (`task-{id}-{n}`). Blockstart: `block-{id}`. |
| 9 | **Trainings-Kontext (Phase-1-Minimal)** | `setNotificationHandler` unterdrückt Task-Notifications, solange eine Session aktiv ist (`workout_session.status = 'active'`). |
| 10 | **Wochen-Templates ohne Datum** | Templates speichern ISO-Wochentag (1–7) statt Datum; Instanziierung mappt auf die Zielwoche (`templateToImport`). |
| 11 | **Regel-Engine „big training“** | `intensity: 'high'` zählt immer, `'low'` nie; ohne Angabe entscheidet Dauer ≥ 60 min. Schwellwert: `BIG_TRAINING_MINUTES` in `src/domain/rules.ts`. |
| 12 | **Locale-Parity als Test** | `src/i18n/localeParity.test.ts` schlägt fehl, wenn de/en-Keys divergieren → Arbeitsregel 1 ist erzwungen, nicht nur dokumentiert. |
| 13 | **Web-Notifications: No-op** | expo-notifications unterstützt kein Web-Scheduling. Alle Scheduler-Funktionen no-open auf Web; Settings zeigen einen Hinweis. |
| 14 | **Raw-Hex-Farben zentral in `constants/uiColors.ts`** | Lucide-Icons u. ä. brauchen Hexwerte statt Klassen. `uiColor(name, dark)` spiegelt die Palette aus `tailwind.config.js` (Kommentar: in sync halten) — keine hartcodierten Icon-Farben mehr in Screens. Tabular-Ziffern zentral als `TABULAR` aus `ui/Text.tsx`. |
| 15 | **Essenstracker: Open Food Facts + Snapshot-Einträge** | Produktdaten kommen von der freien OFF-API (ODbL, kein Key, CORS): Barcode-Lookup gegen die World-Instanz (`/api/v2/product/{ean}`), Textsuche via `cgi/search.pl` mit `countries=germany`-Filter (die `de.`-Subdomain sendet keine CORS-Header). Gescannte Produkte werden in `food_product` gecacht (offline-fähig), `food_entry` snapshottet Name + Nährwerte pro 100 g — Historie bleibt stabil. Rate-Limit der OFF-Suche: 10 req/min. Tagesziele rechnet `domain/nutrition.ts` aus dem Profil (Mifflin-St Jeor × 1.5 + Zielrate); Mikros gegen EU-NRV. |
| 16 | **Barcode-Scan: nativ expo-camera, Web `BarcodeDetector`** | expo-camera scannt auf Web nicht. `components/food/BarcodeScanner.web.tsx` nutzt getUserMedia + die Browser-`BarcodeDetector`-API (Chromium); Firefox/Safari fallen auf manuelle EAN-Eingabe zurück, die immer verfügbar ist. |
| 17 | **Apple Health: Adapter-Split + Quellen-Dedup** | `@kingstinct/react-native-healthkit` (Nitro) nur in `src/health/healthData.ios.ts` importiert; `healthData.ts` ist der Stub für Web/Android → HealthKit landet nie im Web-Bundle. Schlaf-Zusammenfassung (`domain/health.ts`) wählt pro Nacht die Quelle mit den meisten Schlafdaten (Watch vs. Helio-Ring/Zepp schreiben beide) statt Samples zu addieren. HealthKit erfordert einen Dev-Build (`npx expo run:ios`), kein Expo Go. |
| 19 | **Supersätze über `set_log.supersetGroup`** | Statt neuer Tabelle trägt jeder Satz eine nullbare, pro Session eindeutige Gruppen-ID (Migration 0007). Übungen mit gleicher ID bilden einen Supersatz; alle Sätze einer Übung teilen die ID (`setExerciseSupersetGroup`). Pure Logik in `domain/supersets.ts` (`supersetView` → Buchstaben-Label + `isLastInGroup`, `nextSupersetGroup`); Gruppen < 2 Mitglieder gelten als eigenständig. Pause-Timer startet nur nach der **letzten** Übung der Gruppe (kein Ruhen zwischen gepaarten Übungen). Gruppieren ad hoc in der laufenden Session (Link mit nächster Übung / Auflösen). |
| 20 | **LLM-Brücken über Copy/Paste statt API** | Trainings-Import (`training-import.tsx`) und Analyse-Export (`export.tsx`) sprechen mit externen KIs ausschließlich über kopierbare Prompts + eingefügtes JSON — kein API-Key, kein Netzwerk-Call, Daten bleiben lokal. Import-Schema `schemas/trainingImport.ts` (Zod, i18n-Fehlerkeys wie beim Wochen-Import); Export formt `domain/analysisExport.ts` (pur, leere Sektionen weggelassen, Sätze als `[reps, kg]`-Tupel) aus `dataRepo.collectAnalysisRange()`. Clipboard ohne expo-clipboard: Web `navigator.clipboard` + `execCommand`-Fallback, nativ Share-Sheet (`utils/copyText.ts`). |
| 21 | **Text-UUID-PKs statt `integer autoIncrement` (Sync-Vorbereitung)** | Erster Schritt Richtung Cloud-Sync (siehe [SYNC_CONCEPT.md](./SYNC_CONCEPT.md)): global eindeutige IDs sind Voraussetzung, damit zwei Geräte offline anlegen können ohne PK-Kollision. Alle ehemaligen autoIncrement-Tabellen haben jetzt `text`-PKs, client-generiert via `src/db/id.ts` (`newId()` = `crypto.randomUUID()` + v4-Fallback). IDs werden in den Repos beim Insert vergeben (Schema bleibt importfrei → drizzle-kit ok). FK-Spalten auf `text`. Natürliche Schlüssel (profile/weekly_structure/notification_pref/coach_dismissal/food_product) unverändert. `supersetGroup`/`setIndex`/Session-Index bleiben `number`. Migration `0010` (Tabellen-Neuanlage, Daten bleiben erhalten). `updatedAt`/`userId`/RLS folgen im Auth-/Sync-Schritt; **`deletedAt` entfällt** — PowerSync propagiert Deletes über seine Upload-Queue. |
| 18 | **Design-Richtung „Neo Brutal" (löst „Dark Focus" ab)** | Warmes Papier als Primärmodus (Theme-Default `light`, Migration 0004), Ink-Rahmen (`border-2`, Token `border` = Ink/Papier je Modus), harte Offset-Schatten via `neoShadow()` in `constants/uiColors.ts` (RN-0.76+-`boxShadow`, nur Light — Dark bleibt flach mit Papier-Rahmen), Blocktypen als **Vollflächen** (`bg-block-*`, Ink-Text in beiden Modi statt Links-Kante), Gelb-Token `highlight` für Uhr-Chip/Primär-Buttons/aktive Pills, neues `track`-Token für Fortschrittsbalken-Tracks/Stundenlinien (Border ist jetzt Schwarz), Titel/Buttons uppercase-bold. Tabular-Ziffern (`TABULAR`) bleiben überall. |

## Responsive-Strategie

- Mobile-first; Breakpoints in `useResponsive`: Tablet ≥ 768, Desktop ≥ 1024.
- Wochenansicht: Phone = 1 Tag mit Tages-Tabs, Tablet/Desktop = 7-Spalten-Grid.
- `Screen`-Komponente zentriert Inhalte (max-w-3xl bzw. max-w-6xl) → Web wirkt
  wie eine gestaltete Seite, nicht wie eine gestreckte Phone-App.

## Tests

`npm test` → Vitest über `src/**/*.test.ts`: Zeit-Helfer, Regel-Engine,
Import-Schema (Fehlerpfade), Locale-Parity. UI-Tests sind in Phase 1 optional
und nicht enthalten.

## Bekannte Grenzen (Phase 1)

- Kein Drag&Drop-Verschieben von Blöcken (Bearbeiten über Editor-Dialog).
- Recurring Tasks: nächste Instanz entsteht beim Abschließen (kein Vorab-Fächer).
- Export teilt auf iOS/Android den JSON-Text über das Share-Sheet (kein Datei-Save-Dialog).
