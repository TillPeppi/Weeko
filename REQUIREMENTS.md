# Weeko — Requirements & Projekt-Briefing (Phase 1)

> **Für Claude / neuen Chat:** Dies ist das einzige Kontextdokument. Es enthält
> Vision, festgelegten Tech-Stack, verbindliche Arbeitsregeln und den kompletten
> Phase-1-Scope. Beginne mit „Erste Schritte" (Abschnitt 10). Stelle Rückfragen
> nur bei echten Widersprüchen — sonst umsetzen.

---

## 1. Was ist Weeko?

Weeko ist eine persönliche Wochenplanungs- & Life-OS-App (Web + iOS + Android,
eine Codebase). Kernidee: Am Sonntag plant eine externe KI die Woche und liefert
sie als JSON → Weeko importiert, validiert, zeigt die Woche als Zeitstrahl und
führt durch den Alltag (Aufgaben abhaken, Training tracken, erinnern).

**Leitprinzipien:**

- Fixpunkte zuerst: Arbeit & Handball sind unverrückbar, alles andere wird drumherum geplant.
- KI plant (extern, Sonntag), Weeko führt aus (die ganze Woche).
- Lebensqualität > Perfektion: Wochenbilanz statt Tagesdiktat.
- Regeneration wird geschützt (Regel-Engine, s. 7.3).
- Datenhoheit: Phase 1 ist 100 % lokal — kein Backend, keine Cloud, kein Account.

**Spätere Phasen (NICHT jetzt bauen, aber Architektur nicht verbauen):**

- Phase 2: Ernährungstracker/-planer (Open Food Facts, Barcode), Gewichts- &
  Körperkompositions-Tracking, NEAT-Tracking, Trainingsplan-Generator.
- Phase 3: HealthKit/Health Connect, Geofencing-Kontext-Notifications,
  Supplement-Modul, Wochenrückblick-Export als Feedback an die Planungs-KI,
  optionaler Cloud-Sync (Supabase/PowerSync).

---

## 2. Verbindliche Arbeitsregeln (gelten für JEDE Aufgabe)

1. **i18n von der ersten Zeile an.** Es gibt KEINEN hartcodierten user-sichtbaren
   Text — keine Labels, Buttons, Fehlermeldungen, Platzhalter, Datumsformate,
   Notification-Texte. Alles über i18next-Keys.
   - Default-Sprache: **Deutsch (de)**, zweite Sprache: **Englisch (en)**.
   - Beide Locale-Dateien werden bei jedem Feature SOFORT mitgepflegt (nicht „später übersetzen").
   - Nested Keys (`week.import.errors.invalidTime`), keine flachen Punkt-Strings.
   - Sprachumschaltung in den Settings; initial aus Gerätesprache.
2. **Immer responsive.** Jede Screen/Komponente funktioniert von 320 px (Phone)
   über Tablet bis Desktop-Web. Mobile-first bauen, auf großen Screens
   Mehrspalten-Layouts nutzen (z. B. Wochenansicht: Phone = 1 Tag swipebar,
   Desktop = 7-Tage-Grid). Nie Desktop als nachträglichen Sonderfall behandeln.
3. **Web muss modern wirken.** Die Web-Version ist eine vollwertige, moderne
   PWA-artige Website: sauberes Spacing, klare Typo-Hierarchie, Dark Mode von
   Anfang an (System + manueller Toggle), dezente Animationen
   (react-native-reanimated), keine „RN-App im Browser"-Anmutung.
4. **Dokumentation in MD-Dateien.** Alle Architektur-Entscheidungen, Schemas und
   Anleitungen werden in Markdown-Dateien im Repo festgehalten, damit jeder neue
   Chat ohne Vorwissen weiterarbeiten kann:
   - `docs/ARCHITECTURE.md` — Struktur, Datenfluss, Entscheidungen (fortlaufend pflegen)
   - `docs/WEEK_SCHEMA.md` — das JSON-Import-Schema inkl. Beispiel (aus Zod generiert)
   - `docs/PROGRESS.md` — was ist fertig, was ist offen, bekannte TODOs (nach jeder Session aktualisieren)
5. **Domain-Logik framework-frei.** Alle Berechnungen und Regeln liegen als pure
   TypeScript-Funktionen in `src/domain/` — ohne React/Expo-Imports, mit Tests.
6. **TypeScript strict**, keine `any` ohne Begründung.

---

## 3. Tech-Stack (entschieden — nicht neu diskutieren)

| Bereich | Wahl |
|---|---|
| Framework | Expo (aktuelles SDK) + React Native + TypeScript, **eine Codebase für iOS/Android/Web** |
| Navigation | Expo Router (file-based, funktioniert nativ + Web) |
| Lokale DB | expo-sqlite + **Drizzle ORM** (Migrations, typisierte Queries) — SQLite ist die Single Source of Truth |
| Web-Persistenz | expo-sqlite Web-Support (wa-sqlite/OPFS); fällt das durch, Drizzle-kompatibler Fallback — Entscheidung in ARCHITECTURE.md dokumentieren |
| Validierung | **Zod** — ein Schema für: Import-Validierung, TS-Typen, generiertes JSON-Schema für die Planungs-KI |
| UI-State | Zustand |
| Styling | **NativeWind** (Tailwind für RN + Web), Dark Mode via `dark:`-Varianten |
| i18n | **i18next + react-i18next** + expo-localization; Locales als JSON unter `src/i18n/locales/{de,en}.json` |
| Notifications | expo-notifications, **nur lokal geplant** (kein Push-Server) |
| Listen | FlashList |
| Datum/Zeit | date-fns (+ date-fns/locale für de/en-Formate) |
| Animationen | react-native-reanimated |
| Icons | lucide-react-native (o. ä. konsistentes Set) |
| Tests | Vitest (oder Jest) für `src/domain/` — UI-Tests sind Phase 1 optional |
| Builds | Lokal Expo Dev Client; EAS Build erst wenn echtes Gerät nötig |

**Kein Backend in Phase 1.** Keine Auth, kein Server, keine externen APIs.

---

## 4. Projektstruktur (Ziel)

```
weeko/
├── REQUIREMENTS.md          ← dieses Dokument
├── docs/
│   ├── ARCHITECTURE.md
│   ├── WEEK_SCHEMA.md
│   └── PROGRESS.md
├── src/
│   ├── app/                 ← Expo Router Routen (SDK-57-Konvention)
│   │   ├── (tabs)/          ← Woche · Heute · Training · Aufgaben · Settings
│   │   └── onboarding/
│   ├── components/          ← wiederverwendbare UI (responsive)
│   ├── domain/              ← pure Logik: Regel-Engine, Slot-Verteilung, Berechnungen
│   ├── db/                  ← Drizzle-Schema, Migrations, Repositories
│   ├── schemas/             ← Zod: Wochen-Import-Schema u. a.
│   ├── stores/              ← Zustand
│   ├── i18n/                ← Setup + locales/de.json + locales/en.json
│   └── notifications/       ← Scheduling-Logik
└── ...
```

---

## 5. Nutzerkontext & Onboarding-Defaults

Diese Werte sind die **Seed-/Default-Daten** fürs Onboarding (alles editierbar,
nichts hartcodiert in der Logik — sie sind nur Vorbelegung):

- **Arbeitszeiten:** Mo–Fr 7:30–17:00; Arbeitsort Mo–Mi Office, Do–Fr Homeoffice.
- **Handball (fix):** Mo bis 20:30, Di bis 22:00, Do bis 22:00.
- **„Tag meist fertig um"** pro Wochentag (Handball-Tage spät, freie Tage früher).
- **Hund (fix):** Do/Fr 13:00–13:45 (Mittagspause), täglich ~20:45–21:00.
- **Hobby-Blöcke:** Trading-Abend Mi, Gitarre, Freizeit.
- **Körperprofil:** Größe, Alter, Geschlecht, Gewicht (aktuell 73 kg), Ziel:
  Lean Gain (~0,25–0,5 kg/Woche Zunahme). Phase 1 speichert das nur —
  Kalorienrechnung kommt in Phase 2.
- **Equipment:** Klimmzugstange, Dip-Barren, 1× schwere Kettlebell (>16 kg),
  Laufband. NICHT vorhanden: SkiErg, Airbike, Sled, zweite KB.
- **Trainingspräferenz:** weighted Calisthenics + 1× Hyrox-artige Session/Woche.

---

## 6. Phase-1-Scope (das wird gebaut)

### 6.1 Onboarding

Mehrstufiger, überspringbarer Flow, der die Werte aus Abschnitt 5 als Defaults
anbietet: Wochenstruktur (Arbeit/Arbeitsort/fixe Blöcke) → Körperprofil →
Equipment & Übungsliste (aus Equipment abgeleitet, editierbar) → Sprache & Theme.
Alles später in den Settings änderbar. Persistiert in SQLite (`profile`).

### 6.2 Wochen-Import (Herzstück)

- **Input:** JSON per Datei-Picker ODER Paste in ein Textfeld (Web & Mobile).
- **Zod-Validierung** mit verständlichen, lokalisierten Fehlermeldungen inkl.
  Pfad („Tag 3, Block 2: endTime liegt vor startTime").
- **Regel-Engine-Prüfung** (Warnungen, kein Hard-Fail — s. 7.3).
- **Vorschau vor Übernahme:** Woche als Zeitstrahl anzeigen, Blöcke manuell
  bearbeiten/verschieben/löschen, dann „Übernehmen".
- Import ersetzt die Zielwoche oder legt sie neu an (mit Bestätigungsdialog).
- **Wochen-Template:** aktuelle Woche als Template speichern; neue Woche aus
  Template erzeugen.

### 6.3 Wochenansicht & Heute-Ansicht

- **Wochenansicht:** vertikaler Zeitstrahl pro Tag; Phone: ein Tag mit
  Tages-Swipe/Tabs; Desktop/Tablet: 7-Spalten-Grid. Blocktypen farbcodiert
  (Arbeit/Training/Handball/Hund/Essen/Hobby/Aufgabe/Frei).
- **Heute-Ansicht (Home-Tab):** aktueller + nächster Block, offene Aufgaben des
  Tages, Schnellaktionen (Aufgabe abhaken, Training starten).
- Block-Status: `planned | active | done | skipped` — antippen zum Abhaken.

### 6.4 Aufgaben & zeitbasierte Notifications

- Aufgaben-Pool: einmalige & wiederkehrende Aufgaben (z. B. Meal-Prep, Einkauf,
  Gitarre) mit Kategorie, Dauer-Schätzung, optionalem Zeitfenster.
- Aufgaben können der Woche zugeordnet sein (aus Import) oder frei sein.
- **Notifications (Phase 1 = rein zeitbasiert):** lokale Notification zum
  geplanten Blockstart; Eskalation: unerledigte Aufgabe erinnert erneut
  (konfigurierbares Intervall), bis erledigt oder verschoben.
- Pro Kategorie konfigurierbar: an/aus, Zeitfenster (z. B. nie vor 8:00 / nach 22:00).
- Notification-Texte ebenfalls über i18n.
- Kontext-Regeln (Standort etc.) kommen erst in Phase 3 — aber das Datenmodell
  hat jetzt schon ein `context`-Feld pro Task (s. Schema), das Phase 1 ignoriert.

### 6.5 Basis-Trainingstracker

- Session aus geplantem Trainingsblock starten (oder ad hoc).
- Übungen aus der Übungsliste; pro Übung Sätze loggen: Wdh, Gewicht/Zusatzgewicht,
  abhaken. Satz-Vorbelegung mit den Werten der letzten Session derselben Übung
  (**Progression sichtbar**: „letztes Mal 3×8 @ +10 kg").
- Session-Vorlagen: Hyrox-Art, weighted Calisthenics, Oberkörper-Kurzeinheit
  (20–30 min, für Mo nach Handball).
- „Training aktiv"-Status wird gespeichert (unterdrückt in Phase 1 bereits
  Aufgaben-Notifications während der Session — einfachste Form von Kontext).
- Muss **offline** vollständig funktionieren (ist durch lokale SQLite gegeben).

### 6.6 Settings

Sprache (de/en), Theme (System/Hell/Dunkel), Notification-Einstellungen pro
Kategorie, Wochenstruktur & Profil bearbeiten, Daten exportieren (JSON-Dump)
und komplett löschen.

---

## 7. Datenmodell & Schemas

### 7.1 SQLite-Entitäten (Drizzle, Phase 1)

- `profile` — Körperdaten, Ziel, Sprache, Theme
- `weekly_structure` — Arbeitszeiten, Arbeitsort, Fixblöcke, „fertig um" pro Wochentag
- `equipment` / `exercise` — Übungskatalog (aus Equipment abgeleitet, editierbar)
- `week` (isoWeek, year, status, source: imported/template/manual)
- `block` (weekId, date, type, start, end, title, details JSON, status)
- `task` (Kategorie, Wiederholung, Zeitfenster, `context` JSON — Phase 1 ungenutzt, status, blockId optional)
- `workout_session` / `set_log` (sessionId, exerciseId, reps, weightKg, done)
- `session_template` / `week_template`
- `notification_pref` (pro Kategorie)

### 7.2 Wochen-Import-Schema

Definiert in `src/schemas/week.ts` (Zod). Generierte Dokumentation inkl.
JSON-Schema und Beispielwoche: [docs/WEEK_SCHEMA.md](docs/WEEK_SCHEMA.md)
(`npm run schema:docs`).

### 7.3 Regel-Engine (src/domain/rules.ts — pure Functions + Tests)

Beim Import prüfen, als **Warnungen** anzeigen (überstimmbar):

1. Kein großes Eigentraining (Hyrox/Kraft) am Tag vor einem Handball-Tag.
2. Mittwoch & Sonntag sind Regenerationsanker → dort kein intensives Training.
3. Große Sessions nur an Tagen ohne nachfolgendes Handball (praktisch: Fr/Sa).
4. Überlappende Blöcke am selben Tag.
5. Blöcke außerhalb 05:00–24:00 oder mit end ≤ start (das ist ein Hard-Fail der Validierung).

---

## 8. Nicht-funktionale Anforderungen (Phase 1)

- **Offline-first:** App funktioniert komplett ohne Netz (lokale DB, lokale Notifications).
- **Performance:** Import < 1 s; Wochenansicht flüssig (FlashList/memoisierte Blöcke).
- **Responsive & Dark Mode:** s. Arbeitsregeln 2–3.
- **i18n:** s. Arbeitsregel 1.
- **Datenschutz:** keine Daten verlassen das Gerät; Export nur auf explizite Nutzeraktion.

---

## 9. Explizit NICHT in Phase 1

Ernährungs-/Kalorien-Tracking, Gewichts-Charts, NEAT, Trainingsplan-Generator,
Barcode, Wearables/HealthKit, Geofencing/Standort, Supplements, Cloud-Sync,
Accounts, Kalender-Sync, KI-Integration in der App (Import bleibt reines JSON).

---

## 10. Erste Schritte für den neuen Chat

1. Expo-Projekt scaffolden (TypeScript, Expo Router), NativeWind, Drizzle +
   expo-sqlite, i18next, Zustand, Zod, date-fns, FlashList, reanimated,
   expo-notifications, expo-localization einrichten. ✅
2. `docs/ARCHITECTURE.md` anlegen (Struktur + Entscheidungen festhalten). ✅
3. i18n-Grundgerüst mit `de.json`/`en.json` + Sprachumschaltung. ✅
4. Drizzle-Schema + Migrations für die Entitäten aus 7.1. ✅
5. Zod-Wochen-Schema + `docs/WEEK_SCHEMA.md` (generiertes JSON-Schema + Beispielwoche). ✅
6. Dann Features in dieser Reihenfolge: Onboarding → Import + Vorschau +
   Regel-Engine → Wochen-/Heute-Ansicht → Aufgaben + Notifications →
   Trainingstracker → Settings. ✅
7. Nach jedem größeren Schritt: `docs/PROGRESS.md` aktualisieren und auf Web
   (Desktop + mobile Viewport) UND iOS-Simulator verifizieren.
