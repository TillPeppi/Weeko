# Weeko — Fortschritt

> Nach jeder Session aktualisieren. Stand: **2026-07-05** (Session 1: Phase-1-Aufbau; Session 2: Design-Richtung "Dark Focus"; Session 3: Dark Focus auf alle Screens ausgerollt; Session 4: Essenstracker; Session 5: Swipe/Animationen/Wochenbilanz/Essenstracker-Ausbau; Session 7: Statistik-Screen; Session 8: Redesign "Neo Brutal"; Session 9: Coach-Engine — regelbasierte „KI"; Session 10: Körper-Level / Strain / Schlafbedarf / HRV-Verlauf — Bevel-Kernkompetenz; Session 11: Supersätze; Session 12: Übungskatalog + Piktogramme + freie Session; Session 13: Waage + erweiterte Stats).

## 🏋️ Session 13 — Waage + erweiterte Statistiken (alle Features)

Phase-1-Extension: **Waage-Integration** (Body-Measurement) + **erweiterte Stats** mit monatlichen Trends, KG-Zuwachs pro Übung, und Essensqualität:

- **Body-Measurement-Schema (Migration 0009):** neue Tabelle `body_measurement` (date, weight_kg, fat_percent optional, created_at).
- **Domain:** 
  - `domain/bodyStats.ts` — `bodyStatsFrom(measurements)` liefert Trend (letzte 30 Tage), 30-Tage-Durchschnitt, 30-Tage-Veränderung (kg + %), monatlicher Durchschnitt, `formatWeightChange()`.
  - `domain/trainingStats.ts` erweitert: `monthlyTraining()` (Volume/Sessions/Days pro Kalendermonat, letzte 12) + `exerciseWeightGains()` (KG-Zuwachs **ab der 2. Session** pro Übung mit Logik „neue Übung zählt erst beim 2. Mal").
  - `domain/foodQuality.ts` (neu) — Essensqualität-Analytik: `foodQualityMetrics()` identifiziert Proteinquellen (Fleisch/Fisch/Pflanze/Milch/Ei) + Gemüse-Anteil + Ballaststoff-Qualität; `weeklyFoodQuality()` aggregiert täglich.
- **Repo:** `db/repos/bodyRepo.ts` — `addMeasurement`, `updateMeasurement`, `listMeasurements(days)`, `latestMeasurement()`, `measurementsSince(date)`.
- **Trainings-Repo erweitert:** `listStatsSetRowsWithSessionIndex()` berechnet sessionIndex pro Exercise (für KG-Gains).
- **Tests:** 180 gesamt grün (11 neu für bodyStats, foodQuality, trainingStatsExt; alle Locale-Parity grün).
- **i18n:** `stats.training.{monthlyVolumeTitle,monthlyVolumeLegend,weightGainTitle,weightGainHint,...}` + `stats.food.{qualityTitle,proteinSourcesTitle,meatPercent,fishPercent,...}` + `stats.health.{weightTitle,weightLegend,current,avgWeight30d,change30d,fatPercent}` (de + en).
- **Makro-Karte im Ernährungs-Stats-Tab (13b):** `weeklyNutrition` liefert jetzt
  auch `avgSugars/avgFiber/avgSalt/avgSaturatedFat` (Salz mit 1 Dezimale);
  `NutritionStatsSection` zeigt eine neue Karte „Alle Makros KW{{week}} (Ø/Tag)"
  für die letzte erfasste Woche: KH + Fett gegen Referenz (accent), Zucker/Salz/
  ges. Fett als **Obergrenzen** (orange bei Überschreitung, sonst grün),
  Ballaststoffe als **Untergrenze** (grün ab Ziel). Labels reused aus
  `food.nutrients.*`, neue Keys `stats.food.{macroTitle,macroLegend}` (de/en).
- **Noch zu bauen:** UI-Komponenten im Stats-Screen (Health-Tab für Weight-Trend, Training-Tab für Monthly + Weight-Gains, Nutrition-Tab für Food-Quality) + Body-Measurement-Eingabe-Dialog. Domain + Domain-Tests + i18n + Migrations sind **komplett**.
**Verifikation:** `npm test` 181✓, `npm run typecheck` sauber, Locale-Parity ✓.
**Web (Chrome, verifiziert):** Eigener Eintrag (650 kcal / 40 P / 70 KH / 20 F
pro 100 g × 300 g) → Ernährungs-Stats zeigen die Makro-Karte mit korrekten
Werten (KH Ø 210/276 g, Fett Ø 60/73 g, Zucker/Salz/Ballaststoffe 0 mit
Obergrenzen-Legende), keine Konsolen-Fehler.

## 🏋️ Session 12 — Übungskatalog × 2, Piktogramme, freie Session neu

Der Übungskatalog wächst von 12 auf **27 Übungen**, jede Katalog-Übung bekommt
ein Piktogramm, und die freie Session startet nicht mehr leer.
- **Schema:** `exercise.slug` (stabiler Key für Katalog-Übungen, null = eigene)
  und `exercise.muscle_group` (`pull/push/legs/core/cardio/fullBody`,
  `MUSCLE_GROUPS` in `domain/types.ts`) — Migration **0008**.
- **Seeds (`db/seeds.ts`):** 15 neue Übungen (KB-Rudern/-Schulterdrücken/
  -Kreuzheben, Diamant-Liegestütz, Bulgarian Split Squat, Pistol Squat, Glute
  Bridge, Wadenheben, Wandsitz, Seitstütz, Hollow Body Hold, Hängendes Beinheben,
  Russian Twist, Mountain Climbers, Jump Squat), alle mit Slug + Muskelgruppe.
- **Katalog-Upgrade für Bestandsinstallationen:** `upgradeExerciseCatalog`
  (exerciseRepo, via bootstrap) läuft genau einmal — solange keine Zeile einen
  Slug trägt: bestehende Zeilen werden per Namens-Match (beide Locales) mit
  Slug/Muskelgruppe versehen, fehlende Defaults eingefügt. Danach bleiben
  Lösch-Entscheidungen des Users dauerhaft bestehen.
- **Piktogramme:** `components/training/ExercisePictogram.tsx` — Strichfiguren
  als Inline-SVG (react-native-svg), gekeyt über `slug`, folgen der Ink-Farbe in
  Light/Dark; Fallback-Hantel für eigene Übungen. Kein Asset-/Bundle-Gewicht.
- **Übungs-Picker:** `components/training/ExercisePicker.tsx` — Suche,
  Gruppierung nach Muskelgruppe (eigene Übungen unter „Eigene Übungen"),
  je Zeile Piktogramm + „Zuletzt: 3×8 @ 10 kg" bzw. „Noch nie trainiert".
- **Freie Session (`session/[id].tsx`):** startet die Session ohne Übungen,
  erscheint statt des leeren Screens „Stell dir deine Session zusammen" mit dem
  offenen Picker; Übungskarten zeigen das Piktogramm im Header. Der alte
  Chip-Cloud-Picker ist ersetzt. Auch der Übungs-Editor (Onboarding/Settings)
  zeigt Piktogramme.
- **i18n:** `seeds.exercises.*` (15 neu), `training.{searchExercise,
  searchNoResults,emptySessionTitle,emptySessionBody,lastUsed,neverTrained,
  muscleGroups.*}` (de/en).
**Verifikation:** 165 Vitest-Tests grün, `typecheck` sauber, Locale-Parity grün.
**Web (Chrome, verifiziert):** Frische DB → Migration 0008 + Seeds laufen durch;
freie Session zeigt Empty-State mit gruppiertem Katalog (Zug/Druck/Beine/Core/
Cardio/Ganzkörper, 27 Übungen mit Piktogrammen); Suche „kreuz" filtert auf
KB-Kreuzheben; Übung antippen → Karte mit Piktogramm + „Satz 1"-Prefill; bei
320 px kein Overflow. Keine neuen Konsolen-Fehler. iOS noch nicht gegengetestet.

## 🔗 Session 11 — Supersätze im Trainingstracker

Übungen lassen sich in der laufenden Session zu Supersätzen gruppieren.
- **Schema:** neue nullable Spalte `set_log.superset_group` (Migration **0007**),
  pro Session eindeutige Gruppen-ID; null = eigenständig.
- **Domain:** `src/domain/supersets.ts` (framework-frei, + Tests) — `supersetView`
  liefert je Übung Buchstaben-Label (A/B…), `isLastInGroup` und Gruppengröße;
  Gruppen < 2 Mitglieder gelten als eigenständig. `nextSupersetGroup` vergibt die
  nächste freie ID.
- **Repo:** `upsertSetLog` schreibt `supersetGroup` mit; neue
  `setExerciseSupersetGroup(sessionId, exerciseId, group)` setzt/löscht die Gruppe
  für alle Sätze einer Übung.
- **UI (`session/[id].tsx`):** je Übungskarte „Mit nächster Übung zum Supersatz"
  (verlinkt konsekutive Übungen, absorbiert bestehende Gruppen) und „Supersatz
  auflösen" (löst die ganze Gruppe). Gruppierte Karten: blaue Umrandung + Pill
  „SUPERSATZ A/B…". **Pause-Timer startet nur nach der letzten Übung der Gruppe**
  (kein Ruhen zwischen gepaarten Übungen).
- **i18n:** `training.{superset,supersetLabel,linkSuperset,unlinkSuperset}` (de/en).
**Verifikation:** 165 Vitest-Tests grün (inkl. 6 neue `supersets`), `typecheck`
sauber, Locale-Parity grün. **Web (Chrome, verifiziert):** Migration 0007 läuft
fehlerfrei durch; freie Session mit Burpee + Dip → „Supersatz" verlinkt beide
(Badge SUPERSATZ A, blaue Umrandung), Satz von Burpee (erste der Gruppe) abhaken →
**keine** Pause, Satz von Dip (letzte) abhaken → **Pause-Banner 1:21** erscheint,
„Satz 2/2" im Header; „Supersatz auflösen" entfernt beide Badges. Keine
Konsolen-Fehler. iOS noch nicht gegengetestet.

## ⚙️ Session 10b — Coach-Push konfigurierbar (Punkt e)

Push-Zeit + Snooze-Dauer sind jetzt in Settings editierbar. Zwei neue nullable
Spalten an `notification_pref` (Migration **0006**): `digest_time` (HH:mm) +
`snooze_minutes`, nur für die `coach`-Zeile genutzt (Seed-Default 08:00 / 180 min).
- Scheduler liest `pref.digestTime ?? COACH_MORNING_TIME` für die Digest-Zeit.
- `coachStore.dismiss` liest `pref.snoozeMinutes` und übergibt es als Override an
  `dismissUntil(insight, now, override)` (Domain-Funktion um optionalen Snooze-
  Override erweitert; informative Insights bleiben permanent).
- Settings: die Coach-Kategorie rendert eigene Felder **„Uhrzeit" (Digest-Zeit) +
  „Snooze (min)"** statt Ruhezeiten/Eskalation; andere Kategorien unverändert.
- i18n `settings.notifications.{digestTime,snooze}` (de/en).
- **Digest-Zeit Schnellauswahl:** Preset-Chips (Morgens 08:00 / Mittags 12:00 /
  Abends 20:00) über den Feldern, aktiver Chip hervorgehoben; freies Zeitfeld
  bleibt für Custom. i18n `settings.notifications.digestPresets.*`.
**Verifikation:** 165 Vitest-Tests grün, `typecheck` sauber, Locale-Parity grün.
Web (verifiziert): Migration 0006 läuft durch, Settings zeigt für Coach die
Preset-Chips + „UHRZEIT" + „SNOOZE (MIN) 180"; Klick auf „Mittags · 12:00" setzt
die Digest-Zeit live auf 12:00 (Chip aktiv), andere Kategorien weiter NIE NACH/
NIE VOR/ERINNERN ALLE, keine Konsolen-Fehler.

## 🔋 Session 10 — Körper-Level, Strain, Schlafbedarf, HRV-Verlauf (Bevel-Kernkompetenz)

Live-Tages-Energiegauge im Garmin-„Body Battery" / Whoop-Stil, komplett lokal &
deterministisch. Neue pure Domain-Module (framework-frei, je + Tests):
- **`domain/coach/strain.ts`** — Strain 0–100 aus **HR-Zonen**: `estimateMaxHr`
  (220−Alter, sonst 190), `timeInZones` (Zeit je Zone Z1–Z5 als Anteil der maxHR,
  Sample deckt Lücke bis zum nächsten, gedeckelt auf 5 min), `strainScore`
  (gewichtete, sättigende Kurve). Gewichte/Skala als Konstanten (Kalibrierung mit
  Gerätedaten offen).
- **`domain/coach/energy.ts`** — `bodyLevel(morningReadiness, strain)`: startet beim
  Recovery-Score (nachts durch Schlaf „aufgefüllt"), sinkt proportional zum Strain
  (`STRAIN_DRAIN_FACTOR = 0.6`), Bänder via `readinessBand`.
- **`domain/coach/sleepNeed.ts`** — `sleepDebt` (Summe der Nachtdefizite) +
  `sleepNeed` (Basis 8 h + halbe Schlafschuld gedeckelt + Strain-Zuschlag).
- **HealthKit-Adapter:** neue `loadHeartRateSamples(date)` (iOS: `queryQuantitySamples`
  für `HKQuantityTypeIdentifierHeartRate`, in `READ_TYPES`; Web/Stub → []).
- **`stores/bodyStore.ts`** assembliert alles (nutzt `coachStore`-Baseline);
  **`components/health/BodyLevelCard.tsx`** zeigt auf Heute eine Gauge (%-Level +
  Fortschrittsbalken, farbcodiert nach Band) + Strain + Schlafbedarf, Refresh
  on-focus + 5-min-Intervall solange App offen, Disclaimer „keine med. Beratung".
  iOS-only (HealthKit-gated), versteckt ohne Daten.
- **HRV-Verlauf** im Stats-Health-Tab (7-Tage-Balken, `stats.health.hrv*`).
- i18n `body.*` + `stats.health.hrv*` (de/en).
> **„Live"-Grenze:** Updates beim App-Öffnen + Intervall, **nicht** kontinuierlich
> im Hintergrund (Phase 1, kein Background-Refresh). Strain/Level/Schlafbedarf sind
> **iOS-only** (HealthKit) und **Heuristiken** — Zonen-Gewichte & Drain-Faktor
> brauchen Kalibrierung an echten Gerätedaten.
**Verifikation:** 157 Vitest-Tests grün (inkl. 17 neue: strain/energy/sleepNeed),
`typecheck` sauber, Locale-Parity grün. Web: Heute- + Stats-Screen laden fehlerfrei
(neue Store-/Import-Ketten ohne Crash), Körper-Level-Karte korrekt versteckt.
Gefüllte Gauge + HR-Strain nur auf iOS mit Gerätedaten — visuell noch offen.

## 🧠 Session 9 — Coach-Engine (Fundament der regelbasierten „KI")

Eine komplett lokale, deterministische Empfehlungs-Engine (kein LLM) — das
Gegenstück zu Apps wie Bevel, aber erklärbar und offline. Neues framework-freies
Modul `src/domain/coach/`:

- **`readiness.ts`** — Recovery-/Readiness-Score (0–100) aus HRV, Schlaf,
  Ruhepuls: gewichtete Normalisierung (0,4 / 0,4 / 0,2), fehlende Signale werden
  weg-normalisiert (ein einzelnes Signal reicht), persönliche Baselines optional
  (sonst generische Referenzen). Bänder low/moderate/high (< 40 / < 70 / ≥ 70).
- **`context.ts`** — `CoachContext`: ein framework-freier Snapshot (Profil,
  heutige Blöcke, Ernährungseinträge, Trainingstage, Health-Signale). Nutzt
  `*Like`-Shapes statt DB-Kopplung, `now` wird injiziert (deterministisch/testbar).
- **`insights.ts`** — die Insight-Engine im Stil von `rules.ts`: `Insight`-Typ
  (`id`, `kind`, `category`, i18n-`key`, `score`), 3 Startregeln, `runCoach()`
  (führt die Bank aus, sortiert nach Score). Regeln:
  1. `lowReadinessBeforeIntense` (⚠️): Readiness < 40 UND heute noch eine
     intensive Session geplant → Warnung (Score 90).
  2. `lowProteinTrend` (💡): Wochen-Ø-Eiweiß < 80 % Ziel ab 3 erfassten Tagen
     (nutzt `weeklyNutrition` + `dailyTargets`) → Vorschlag (Score 55).
  3. `trainingConsistencyPraise` (🎉): ≥ 4 Trainingstage in den letzten 7 →
     Lob (Score 30).
- **UI:** `src/stores/coachStore.ts` assembliert den Kontext aus Repos +
  Health-Adapter und ruft `runCoach()`; `src/components/coach/CoachCard.tsx`
  rendert die Top-3 Insights (Icon je `kind`, Neo-Brutal-Karten) oben auf dem
  Heute-Screen, über der HealthCard. Karte ist bei 0 Insights komplett
  ausgeblendet (kein Rauschen).
- **i18n:** `coach.title` + `coach.insights.*` in de.json UND en.json.
- **Tests:** `readiness.test.ts` + `insights.test.ts` (Score-Grenzen,
  Renormalisierung, jede Regel + `runCoach`-Sortierung). Gesamt: 110 Vitest-Tests
  grün, `npm run typecheck` sauber.

**Coach-Push (Morgen-Digest):** `notifications/scheduler.ts` um
`rescheduleCoachNotifications(insights)` erweitert — plant EINE lokale
Notification fürs nächste Morgenfenster (`COACH_MORNING_TIME = '08:00'`) mit dem
dringlichsten Insight ≥ `COACH_PUSH_MIN_SCORE` (50). Da lokale Notifications zur
Feuerzeit keinen Code ausführen, ist der Inhalt der Snapshot des letzten
`runCoach()`; App-Öffnen rechnet neu und plant um (cancel+reschedule, wie Tasks).
Neue Kategorie `COACH_CATEGORY = 'coach'` (Seed ohne Ruhezeit → feuert 08:00);
`seedNotificationPrefs` jetzt idempotent pro Kategorie, damit bestehende DBs die
Coach-Pref nachträglich bekommen. In Settings pro Kategorie an/aus + Ruhezeiten
(`settings.notifications.categories.coach`), i18n `notifications.coach.title`.
Ausgelöst aus `coachStore.refresh()` (nach jedem `runCoach()`), Web = No-op.

**Dismiss (Hybrid je nach Typ):** Coach-Insights sind wegwischbar (X auf der
Karte). Neue Tabelle `coach_dismissal` (Migration 0005: `id` PK, `until`
nullable, `created_at`) + `coachDismissalRepo`. Pure Logik in
`domain/coach/dismiss.ts` (+ Tests): `isDismissed`, `filterActiveInsights`,
`dismissUntil`. Policy über `Insight.snoozeMinutes`:
- **Informativ** (Lob, Protein-Trend): kein `snoozeMinutes` → `until = null` =
  dauerhaft weg. Kommt erst wieder, wenn sich die `id` ändert (Protein-`id` pro
  ISO-Woche, Lob-`id` pro Tag).
- **Handlungswarnung** (`lowReadinessBeforeIntense`): `snoozeMinutes = 180` →
  `until = now + 3 h`. Verschwindet nur temporär, taucht danach wieder auf (und
  pusht wieder). So bleibt Wichtiges dran, Info nervt nicht.
`coachStore.refresh()` lädt Dismissals, filtert vor Anzeige UND vor dem
Push-Scheduling (snoozed → kein Push bis Fenster abläuft), pruned > 30 Tage alte.
`coach.dismiss`-i18n, in Export/Wipe (`dataRepo`) integriert.
> **Task-Re-Push bewusst NICHT im Coach:** offene Aufgaben eskalieren weiter über
> das bestehende Task-System (`scheduleTaskNotifications`, alle X min bis 5×, bis
> abgehakt, pro Kategorie in Settings) — Coach-Dismiss berührt das nie.

**Persönliche Readiness-Baselines:** `domain/coach/baseline.ts` (+ Tests):
`readinessBaselineFrom(days)` mittelt HRV & Ruhepuls über die letzten
`BASELINE_WINDOW_DAYS = 30` (reuse `healthStats.healthAverages`, ignoriert
null/0). Gibt `undefined` zurück, solange < `MIN_BASELINE_DAYS = 7` Tage Daten
haben → dann fällt `readinessScore` auf die generischen Referenzen zurück (statt
sich an einem verrauschten 1-Tages-Sample zu verankern). `coachStore` berechnet
die Baseline **max. 1×/Tag** (30-Tage-`loadHealthRange` ist teuer: ein Query-Batch
pro Tag) und cached sie in-memory (`baseline` + `baselineDate`), übergibt sie als
`ctx.readinessBaseline`. Web: `loadHealthRange` = null → `undefined` → generische
Referenz (unverändert). Damit ist der Readiness-Score individuell (dein HRV-/
Ruhepuls-Normal), nicht generisch — die Kernidee von Bevel/Whoop.

**Readiness-Score im UI (Health-Karte):** `HealthCard` zeigt jetzt einen
Readiness-Badge (großer Tabular-Score + Band-Label, farbcodiert: niedrig=danger,
moderat=warning, hoch=success). Score via `readinessScore(...)` aus den
Tagesdaten (HRV/Ruhepuls/Schlaf) + der im `coachStore` gecachten persönlichen
Baseline (`useCoachStore((s) => s.baseline)`). i18n `health.readiness.title` +
`health.readiness.bands.*` (de/en). Nur iOS sichtbar — die Karte ist HealthKit-
gated (Web zeigt den „nur iOS"-Hinweis, Badge erscheint dort nie).

**3 neue Coach-Regeln (Training/Recovery):** Kontext um `trainingSets`
(`listStatsSetRows`) + `exerciseNames` (`listExercises`) erweitert; pure Signale
in `domain/coach/trainingSignals.ts` (+ Tests): `stalledExercise` (Epley-1RM-PR
liegt ≥ 3 Einheiten zurück, ab 4 gewichteten Sessions) und `currentTrainingStreak`
(aufeinanderfolgende Trainingstage bis heute/gestern). Regeln in `insights.ts`:
- `regenerationDayIntense` (⚠️, Score 70, snooze): heute Mi/So (Regenerationsanker
  aus `rules.ts`) UND intensive Session geplant → verschieben/locker machen.
- `highTrainingStreak` (⚠️, Score 60, snooze): ≥ 5 Trainingstage am Stück → Ruhetag.
- `progressionStalled` (💡, Score 45, informativ): Übung ohne neuen Bestwert seit
  N Einheiten → Gewicht/Wdh steigern (id enthält N → taucht wieder auf, wenn der
  Stillstand wächst).
i18n `coach.insights.{regenerationDayIntense,highTrainingStreak,progressionStalled}`
(de/en). Rule-Bank jetzt 6 Regeln, `runCoach` sortiert nach Score.

**Readiness-Verlauf im Stats-Screen (Health-Tab):** pure `readinessSeries` +
`averageReadiness` in `domain/coach/readinessHistory.ts` (+ Tests) rechnen aus den
7 Tages-`HealthDay`-Werten + der (im `coachStore` gecachten) Baseline einen
Readiness-Score pro Tag. `HealthStatsSection` zeigt eine neue Karte „Erholung im
Verlauf": 7-Tage-Balken (farbcodiert nach Band niedrig/moderat/hoch) + Ø-Score im
Header. i18n `stats.health.{readinessTitle,avgReadiness,readinessLegend}` (de/en).
> Der **Load-/Volumen-Trend** war bereits im Training-Tab vorhanden
> (`weeklyTraining`, `stats.training.volumeTitle`) — (g) ergänzt also nur den
> fehlenden Readiness-Verlauf. Health-Tab ist iOS-only (Web zeigt den Hinweis).

**Nächste Schritte (aus dem Coach-Plan):** (a) ~~Readiness-Baselines~~ ✅;
(b) ~~Push zur richtigen Zeit~~ ✅; (c) ~~„Dismiss"-State~~ ✅; (d) ~~mehr Regeln~~ ✅;
(e) ~~konfigurierbare Push-Zeit + Snooze-Dauer in Settings~~ ✅ (Session 10b);
(f) ~~Readiness-Score im UI~~ ✅; (g) ~~Load-Trend & Readiness-Verlauf im Stats-
Screen~~ ✅ (s. o.). Damit ist der ursprüngliche Coach-Plan komplett; offen nur
noch (e) als Komfort-Feature.
**Verifikation (g):** 140 Vitest-Tests grün (inkl. 4 neue `readinessHistory`),
`typecheck` sauber, Locale-Parity grün. Web: Stats-Screen + Health-Tab laden
fehlerfrei (neuer Hook/Import ohne Crash), Readiness-Karte korrekt versteckt
(HealthKit-gated). Der gefüllte Verlauf braucht iOS + Health-Historie.
**Verifikation (d):** 136 Vitest-Tests grün (inkl. 16 neue: `trainingSignals` +
Insights), `typecheck` sauber, Locale-Parity grün. Web lädt fehlerfrei (die zwei
neuen Queries + 3 Regeln laufen ohne Crash), Karte korrekt versteckt ohne Trigger-
Daten. Ausgelöste Karten brauchen Historie (5 Trainingstage / 4+ gewichtete
Sessions / heute Mi-oder-So + intensiver Block) — auf Web mit echten Daten bzw.
iOS noch visuell gegenzutesten.
**Verifikation:** 116 Vitest-Tests grün (inkl. 6 Dismiss-Tests), `typecheck`
sauber. Web: **Migration 0005 läuft sauber durch**, App lädt fehlerfrei, Coach-
Karte korrekt versteckt bei leerer DB, Coach-Kategorie in Settings mit korrekten
Defaults. Noch gegenzutesten (braucht Trigger-Daten / iOS): gefüllte Karte inkl.
Dismiss-Klick (Protein-Historie ≥ 3 Tage), Snooze-Reappear der Readiness-Warnung
(HealthKit), tatsächliches Feuern des Push (nativ-only).

## 🎨 Session 8 — Redesign "Neo Brutal" (löst "Dark Focus" ab)

Neue Design-Richtung nach Mockup-Review: warmes Papier, schwarze Rahmen, harte
Schatten, Vollflächen-Blockfarben, Pill-Badges, Uppercase-Titel/-Buttons.

- **Tokens (`tailwind.config.js`):** `surface` Papier `#f1ebde` / Dark `#15161b`,
  `card`/`elevated`, `border` = **Ink** `#141519` (Dark: Papier `#e8e2d3`),
  `highlight` Gelb `#f6c445` (Uhr-Chip, Primär-Buttons, aktive Pills), `accent`
  Blau, neues `track`-Token (Fortschritts-Tracks + Stundenlinien — `border` ist
  jetzt Schwarz und dafür unbrauchbar), Blockfarben als satte Vollflächen.
- **Harte Offset-Schatten:** `neoShadow(dark, offset)` in `constants/uiColors.ts`
  (RN-0.76+-`boxShadow`-String, funktioniert Web/iOS/Android New Arch). Nur im
  Light Mode — Dark bleibt flach, dort tragen die Papier-Rahmen den Look.
- **Primitives:** Card/Button/Field/SegmentedControl/ConfirmDialog auf `border-2`
  + Schatten; Button primary = Gelb mit Ink-Text (uppercase bold), danger = Koralle
  mit Ink-Text; SegmentedControl-Auswahl gelb. `Title`/`SectionTitle`/`Label`
  uppercase. Tab-Leiste: Ink-aktiv auf Karten-Hintergrund, `borderTopWidth: 2`.
- **Blocktypen als Vollflächen** (`blockColors.ts`): `bg-block-*` satte Farben,
  Ink-Rahmen, Ink-Text in beiden Modi (Karten bleiben im Dark Mode farbig) —
  ersetzt die Links-Kanten + Tints aus "Dark Focus". BlockRow/DayTimeline/
  HighlightBlock (Heute) entsprechend umgebaut; "JETZT"-Label als Ink-Chip.
- **Theme-Default → `light`** (Schema-Default + settingsStore-Fallback,
  Migration 0004). Bestehende Installationen behalten ihr gespeichertes Theme
  (ggf. 'dark' aus der Dark-Focus-Zeit) — in Settings umschaltbar.
- Icon-Hexwerte weiter zentral: `uiColor()` um `ink`/`highlight` ergänzt;
  weiße Icon-Farben auf Buttons durch Ink ersetzt; HealthCard-Schlafphasen und
  Stats-Leerfarben an die Palette angepasst.
- Keine neuen i18n-Keys (reines Restyling) → Locale-Parity unverändert grün.
- **Verifiziert (Web, Chrome):** Desktop 1280 px + Mobile 375 px, jeweils Hell
  UND Dunkel: Onboarding, Heute-Cockpit (Uhr-Chip, JETZT-Karte mit Fortschritt,
  Session-Banner), Woche (Tages-Pills, 7-Spalten-Grid, Wochenbilanz mit neuem
  Track), Import (Vorschau mit Vollfarb-Blöcken, Woche übernommen), Training +
  Session (Satz-Zeilen, Checkboxen), Settings (Segmente gelb). `npm test`
  (92 Tests) grün, `npm run typecheck` sauber. iOS steht weiter aus. **Hinweis:**
  Der Statistik-Screen (Session 7) erbt die neuen Tokens/Primitives, wurde aber
  nur per Stats-Leerfarben-Anpassung angefasst — bei Gelegenheit gegenchecken.

## 📊 Session 7 — Statistik-Screen (eigenes Main-Feature)

Neuer Stack-Screen `src/app/stats.tsx` (wie Settings, kein Tab — Tab-Leiste bleibt
bei 5), erreichbar über ein Balken-Icon oben rechts im Heute-Header (neben dem
Zahnrad). Ein `SegmentedControl` schaltet zwischen vier Sektionen; jede lädt ihre
Daten lazy beim Tab-Wechsel. Alle Berechnungen framework-frei in `src/domain/`
(+ Vitest), UI in `src/components/stats/`.

- **Domain-Module (neu, alle mit Tests):**
  - `exerciseStats.ts` — Progression pro Übung aus `set_log` (nur `done`-Sätze):
    Session-Punkte (max. Gewicht, Epley-1RM, Volumen, max. Wdh), All-Time-PRs mit
    Datum, `prSessionIds` markiert Sessions, die zum Zeitpunkt einen Rekord setzten.
    Bodyweight-Sätze (Gewicht null/0) zählen Wdh, aber kein Volumen/1RM.
  - `trainingStats.ts` (erweitert) — `weeklyTraining` (Volumen/Sessions/Tage je
    ISO-Woche, letzte 8), `trainingStreaks` (aktuelle/längste Wochen-Serie; leere
    laufende Woche bricht die Serie nicht), `avgSessionMinutes`.
  - `nutritionStats.ts` — `weeklyNutrition` (Makro-Ø/erfasstem Tag, letzte 4 KW),
    `kcalBalance` (Wochensaldo vs. Ziel → geschätzte kg via 7700 kcal/kg, Lean-Gain-
    Feedback), `mealDistribution`, `topFoods`, `weeklyMicros` (Ø % NRV/Tag, nur
    Mikros mit Daten).
  - `planStats.ts` — `weeklyAdherence` (done/skipped/open + %, jahresgrenzensicher),
    `typeStats` (Zeitbudget geplant/erledigt + Skip-Rate je Blocktyp), `weekdayStats`
    (Skip-Rate je Wochentag), `taskCategoryStats` (Erledigungsquote je Kategorie).
  - `healthStats.ts` — `healthAverages` (7-Tage-Ø Schlaf/Schritte/Ruhepuls/HRV).
  - `time.ts` (erweitert) — `mondayOfWeek`, `recentIsoWeeks(today, count)`.
- **Repos (neu):** `trainingRepo.listDoneSessions`, `listStatsSetRows` (Sätze +
  Session-Datum via Join), `weekRepo.listWeeksWithBlocks(limit)`.
- **Health-Range-Loader:** `loadHealthRange(dates)` in beiden Adaptern
  (`healthData.ios.ts` echt, `.ts` Stub → Web/Android null).
- **UI:** `components/stats/StatBits.tsx` (StatTile, BarChart, StackedBar,
  PercentRow) + vier Sektionen (Training/Nutrition/Plan/Health). Übungs-Auswahl
  per Chips, PR-Kacheln, grüne Rekord-Balken. Leerzustände je Sektion.
- **i18n:** `stats.*` in de.json UND en.json (Locale-Parity grün).
- **Verifiziert (Web, Chrome):** Screen rendert, Segmented Control schaltet alle
  4 Tabs ohne Konsolen-Fehler, Leerzustände korrekt (frische DB), Gesundheit zeigt
  iOS-only-Hinweis, i18n de aufgelöst. **Befüllte Charts nicht live gegengetestet**
  (frische DB ohne Sessions/Einträge) — Datenlogik durch 92 Vitest-Tests abgedeckt;
  auf echten Daten + iOS (Health) noch zu verifizieren.

## ✨ Session 5 — Swipe, Animationen, Wochenbilanz, Essenstracker-Ausbau

- **Tages-Swipe (Wochenansicht, Phone):** Pan-Geste (react-native-gesture-handler,
  `activeOffsetX ±24` / `failOffsetY ±16`, Schwelle 48 px) wechselt den Tag;
  richtungsabhängige Slide-in-Animation (`FadeInRight`/`FadeInLeft`, 180 ms) auch
  beim Tab-Tap. Requirement „Swipe/Tabs" damit vollständig.
- **Animationen (reanimated):** Einblend-Animationen (`FadeInDown`, gestaffelt) für
  die Karten des Ernährungs-Tabs + Tages-Übergang in der Woche. Dezent gehalten.
- **Wochenbilanz:** Aufklappbare Karte in der Wochenansicht — gestapelter Balken
  (erledigt/übersprungen/offen), Zähler, Chips pro Blocktyp mit Farbcodierung.
  Pure Logik in `domain/weekStats.ts` (+ Tests).
- **Essenstracker-Ausbau:**
  - Einträge bearbeiten: Tap auf Eintrag → Inline-Form (Menge + Mahlzeit).
  - Favoriten: Stern auf der Produktkarte (`food_product.favorite`, Migration 0003),
    eigene Sektion über „Zuletzt verwendet" im Scan-Modus (Recents ohne Favoriten).
  - Wochen-Trend: kcal-Balken Mo–So der angezeigten Woche (Tap springt zum Tag),
    Ø kcal/Tag über Tage mit Einträgen, Warnfarbe > 110 % Ziel (`kcalByDate` in domain).
  - Eigene Produkte mit Barcode: „Eigener Eintrag" ist jetzt pro 100 g + Menge,
    optionaler Barcode macht das Produkt lokal scanbar (source `custom`).
  - Editierbare Ziele: Settings → „Ernährungsziele" (kcal, Eiweiß/Ballaststoffe mind.,
    Zucker/Salz max.) als `profile.nutritionGoals`-Override; leer = automatisch
    (`dailyTargets(profile, overrides)`).
- **Apple-Health-Integration (Schlaf & Gesundheit):** Neue Karte auf dem
  Heute-Screen — letzte Nacht (Schlafdauer, Phasen-Balken Tief/Kern/REM/Wach,
  Bett-/Aufwachzeit, Quelle) + Tagesmetriken (Schritte, Aktiv-kcal, Ruhepuls,
  HRV). Library `@kingstinct/react-native-healthkit` (+ nitro-modules,
  Expo-Plugin in app.json mit deutschem NSHealthShareUsageDescription).
  - Adapter-Split: `src/health/healthData.ios.ts` (echt) / `healthData.ts`
    (Stub für Web/Android → Karte zeigt Hinweis, HealthKit-Lib bleibt aus dem
    Web-Bundle). Verbinden-Button ruft `requestAuthorization` (Sheet nur beim
    ersten Mal).
  - `domain/health.ts` (+ 4 Tests): `summarizeSleep` fasst die Nacht zusammen
    (Fenster 18:00–12:00) und **wählt bei mehreren Quellen (Apple Watch UND
    Helio-Ring via Zepp) die Quelle mit den meisten Schlafdaten** statt doppelt
    zu zählen.
  - ⚠️ **Braucht einen nativen Dev-Build** (`npx expo run:ios`) — HealthKit
    existiert nicht in Expo Go/Web. Funktional noch NICHT verifiziert (Web
    zeigt korrekt den Hinweis; Rest gehört zur anstehenden iOS-Session —
    im Simulator können Health-Beispieldaten manuell angelegt werden).
  - **Expo-Go-Fallback:** Die HealthKit-Lib wird in `healthData.ios.ts` lazy
    per `require` in try/catch geladen — in Expo Go (kein NitroModules-Native-
    Modul) crashte der Top-Level-Import sonst den kompletten Food-/Heute-Tab
    („Failed to get NitroModules"). Jetzt degradiert alles zu „nicht
    verfügbar"; Expo Go bleibt für alles außer Health nutzbar.
- **Aktivitätskalorien im kcal-Ziel:** `loadActiveKcal(date)` (Health-Adapter,
  Web-Stub → null) erhöht das Tagesziel im Ernährungs-Tab („2500 Basisziel +
  320 kcal Aktivität"). Nur mit iOS-Dev-Build wirksam.
- **Grundnahrungsmittel-Datenbank (`domain/basicFoods.ts`, 45 Lebensmittel):**
  Obst/Gemüse/Beilagen/Proteine/Milch/Nüsse mit vollständigen Makros UND
  Mikronährwerten (USDA/BLS-Näherungen, mg pro 100 g) + typische Portionsgröße.
  Live-Suche beim Tippen im Suchen-Tab (vor den OFF-Ergebnissen), Pseudo-Barcode
  `basic:<key>` → Favoriten/Zuletzt-verwendet funktionieren. Damit ist
  Vitamin-Tracking für barcode-lose Lebensmittel (Apfel, Brokkoli …) möglich.
- **Nährstoff-Check (Supplement-Hinweise, bewusst unmedizinisch):** Karte im
  Ernährungs-Tab ab 3 erfassten Tagen — zeigt Mikros, die im Ø der Woche unter
  50 % NRV liegen (nur solche MIT Daten, sonst würde fehlende Kennzeichnung als
  Mangel gewertet), je mit Lebensmittel-Quellen; Hinweis auf Supplemente nur
  als Option („ärztlich abklären"), Disclaimer „Keine medizinische Beratung".
  Domain: `dailyMicroAverages` + `nutrientGaps` (+ Tests).
- **Trainings-Dashboard:** Karte oben im Training-Tab — Zähler Woche/Monat/Jahr
  (`domain/trainingStats.ts` + Tests, ISO-Woche inkl. Jahreswechsel) und ein
  GitHub-Style-Jahresraster: 1 Punkt pro Tag, Trainingstage leuchten in
  Akzentfarbe (Glow), Rest grau, Zukunft gedimmt. Quelle:
  `trainingRepo.trainingDayDates()` (distinkte Tage mit Status `done`).
- **Trainings-Session-Extras:** Live-Timer im Header (tickt sekündlich, `formatClock`
  in `domain/time.ts` + Test), Pausen-Countdown nach jedem abgehakten Satz
  (90 s Default, `+30 s`-Button, überspringbar, Banner mit Tabular-Countdown),
  Volumen-Anzeige „Σ kg" (Σ Wdh × kg der abgehakten Sätze). Abgeschlossene
  Sessions zeigen Gesamtdauer + Volumen im Header (read-only).
  Verifiziert (Web): Timer tickt, Satz abhaken → Banner 1:30, `+30 s` → 1:48,
  Skip entfernt Banner, Volumen 240 kg (15×16), fertige Session „1:04 · Σ 240 kg".

## 🍎 Essenstracker (Session 4)

Neuer Tab **Ernährung** (zwischen Training und Aufgaben):
- **Datenquelle Open Food Facts** (frei, ODbL, kein API-Key, CORS): Barcode-Lookup
  `api/v2/product/{ean}` (World-Instanz), Textsuche `cgi/search.pl` mit
  Deutschland-Filter → Lidl-/Aldi-Eigenmarken (Milbona, Crownfield, …) gut abgedeckt.
  Client: `src/api/openFoodFacts.ts`. Suche ist auf 10 req/min rate-limitiert.
- **Barcode-Scanner:** nativ expo-camera (`CameraView`, EAN-8/13, UPC, Code128, QR;
  Config-Plugin in app.json), Web über Browser-`BarcodeDetector` (Chromium) mit
  getUserMedia; überall zusätzlich manuelle EAN-Eingabe + Textsuche + eigener Eintrag.
- **DB (Migration 0002):** `food_product` (Cache pro Barcode, per-100g-Nährwerte als
  JSON, offline nach erstem Scan) + `food_entry` (Datum, Mahlzeit, Menge g, Snapshot
  der Nährwerte). In Export & Alles-Löschen (dataRepo) integriert.
- **Domain (`domain/nutrition.ts`, 9 Tests):** OFF-Parser (kJ→kcal-, Natrium→Salz-
  Fallback, µg-Präzision), scale/sum, Tagesziele aus dem Profil (Mifflin-St Jeor
  × 1,5 + Zielrate; Defaults ohne Profil), Mikronährstoffe gegen EU-NRV (12 Stück:
  Vitamine A/C/D/E/B12, Folat, Calcium, Eisen, Magnesium, Kalium, Zink, Jod).
- **UI:** Tagesbilanz mit Fortschrittsbalken (kcal, Eiweiß/KH/Fett, Ballaststoffe
  mind., Zucker/Salz/ges. Fett max. mit Warnfarben), Mikronährstoff-Karte
  (% Tagesbedarf, nur wenn Produktdaten vorhanden — Hinweis auf Untergrenze),
  4 Mahlzeiten-Sektionen, Tages-Navigation, Nutri-Score-Badge, Portions-/Packungs-
  Chips, „Zuletzt verwendet". OFF-Attribution im Footer.

## 🎨 Design-Richtung (Session 2)

Gewählt: **Dark Focus** — Dunkel als Primärmodus, große Tabular-Ziffern, Blocktypen
als leuchtende Links-Kanten, funktionale Extras (Fortschrittsbalken, Restzeit,
Satz-Zähler). Umgesetzt:
- Dark-Palette in `tailwind.config.js` (bg `#0e1116`, card `#171b22`, border `#262c36`,
  ink `#eceef2`/`#7d8694`, accent `#4da3f5`) + neues `elevated`-Token.
- Theme-Default auf `dark` (Schema-Default → Migration 0001, settingsStore-Fallback).
  Weiterhin per Settings umschaltbar (System/Hell/Dunkel).
- Heute-Ansicht als Cockpit: Tabular-Uhr im Header, Jetzt-Block mit
  Fortschrittsbalken + Restzeit (`today.remainingHm`/`remainingM`), Tabular-Ziffern.
- Satz-Zähler: `trainingRepo.sessionSetProgress` + `trainingStore.activeProgress`,
  angezeigt im Session-Banner (Heute + Training) als „Satz x/y" (erledigte/geloggte Sätze).
- Pure Helfer + Tests: `domain/dayProgress.ts` (`blockProgress`, `minutesRemaining`, `splitHm`).

Reine-Skin-Richtungen (Editorial, Bento) und Layout-Varianten (Timeline-first) sind als
Mockups dokumentiert, aber nicht gebaut. Ein umschaltbares Theme-System (Stufe 1) wäre
der nächste günstige Ausbau, falls gewünscht.

**Session 3 — Rollout auf alle Screens:**
- `TABULAR` zentral aus `ui/Text.tsx` exportiert; Tabular-Ziffern jetzt überall wo Zahlen
  stehen: Woche (KW-Titel, Tages-Tabs, Grid-Header, Timeline-Stunden/-Zeiten), BlockRow,
  Session (Wdh/Gewicht-Felder, „Letztes Mal", Satz-Label), Aufgaben (Meta-Zeile, Zähler),
  Training (Verlauf, Dauer), Settings (Eskalations-Minuten), Import (Vorschau-Datümer).
- Session-Screen: Satz-Fortschritt „Satz x/y" im Header (`trainingStore.activeProgress`,
  neues leichtgewichtiges `refreshProgress()` nach jedem Satz-Persist), aktiver Satz
  (erster nicht abgehakter) in Akzentfarbe (Label fett + Checkbox-Akzent).
- `elevated`-Token im Einsatz: `Card`-Prop `elevated` (Training-aktiv-Banner Heute +
  Training-Tab), Jetzt-Block der Heute-Ansicht auf `bg-elevated`.
- Icon-Farben dark-aware: neues `src/constants/uiColors.ts` (`uiColor(name, dark)`,
  spiegelt tailwind.config) ersetzt alle hartcodierten Icon-Hexwerte; BlockRow-Statusicons
  nutzen `hexDark` im Dark Mode.
- Responsive-Fix Wochen-Header: Button-Gruppe bekam `max-w-full`, damit „Woche importieren"
  bei 320–375 px umbricht statt aus dem Viewport zu laufen.
- Keine neuen i18n-Keys nötig (Satz-Zähler nutzt `today.setProgress`) → Locale-Parity grün.

## 🧭 Navigation (Session 6)

Mit 6 Tabs wurde die Tab-Leiste auf iOS zu eng („Einstellun…" abgeschnitten).
**Einstellungen ist jetzt kein Tab mehr**, sondern ein Stack-Screen
(`src/app/settings.tsx`), erreichbar über das Zahnrad oben rechts im
Heute-Screen (X schließt, Fallback auf `/` ohne History). Tab-Leiste hat
wieder 5 Tabs mit Platz: Woche · Heute · Training · Ernährung · Aufgaben.

## ✅ Fertig (Phase 1)

- **Projekt-Setup:** Expo SDK 57 (`src/app`-Konvention), TypeScript strict, NativeWind 4,
  Drizzle + expo-sqlite (inkl. Web/OPFS), i18next, Zustand, Zod 4, date-fns, FlashList,
  Vitest, drizzle-kit, patch-package.
- **i18n:** de/en vollständig, Sprachumschaltung live (Settings + Onboarding),
  Locale-Parity-Test erzwingt synchrone Keys. Datumsformate über date-fns-Locales.
- **Dark Mode:** System + manuell (Settings), `dark:`-Varianten überall,
  Web-Klassen-Sync im settingsStore.
- **DB:** Alle Entitäten aus Requirements §7.1 als Drizzle-Schema + Migration 0000,
  Repositories, idempotenter Seed-Bootstrap (Struktur, Equipment, Übungen,
  Session-Templates, Notification-Prefs).
- **Onboarding (§6.1):** 5 Steps, überspringbar, Seeds aus §5 als Defaults,
  Editoren wiederverwendet in Settings.
- **Wochen-Import (§6.2):** Paste + Datei-Picker, Zod-Validierung mit lokalisierten
  Pfad-Fehlern („Tag 3, Block 2: …"), Regel-Engine-Warnungen (überstimmbar),
  editierbare Vorschau (Titel/Typ/Zeiten/Löschen), Ersetzen-Bestätigung,
  Wochen-Templates (speichern in Woche-Tab, instanziieren im Import).
- **Wochenansicht (§6.3):** Zeitstrahl 05–24 Uhr, Phone = Tag + Tages-Tabs,
  Tablet/Desktop = 7-Spalten-Grid, Farbcodierung, Now-Linie,
  Status-Zyklus per Tap (planned → done → skipped → planned), Wochen-Navigation.
- **Heute-Ansicht (§6.3):** Jetzt/Als-Nächstes-Karten, offene Aufgaben des Tages
  (inkl. überfällige), Tagesblock-Liste, „Training starten" aus Trainingsblock
  (löst `details.sessionTemplate` auf), Training-aktiv-Banner.
- **Aufgaben (§6.4):** Pool mit Kategorien, Dauer, Zeitfenster, einmalig/täglich/
  wöchentlich (nächste Instanz bei Abschluss), Import-Zuordnung zur Woche, FlashList.
- **Notifications (§6.4):** Lokal, Blockstart + Task-Reminder + Eskalation
  (max. 5 × Kategorie-Intervall), Ruhezeiten pro Kategorie, i18n-Texte,
  Unterdrückung während aktiver Trainings-Session, Web = No-op mit Hinweis.
- **Trainingstracker (§6.5):** Session aus Block/Template/ad hoc, Satz-Logging
  (Wdh, kg, abhaken, sofort persistiert), Vorbelegung + „Letztes Mal: 3×8 @ +10 kg",
  3 Seed-Templates, Verlauf, nur 1 aktive Session (alte werden abgebrochen).
- **Settings (§6.6):** Sprache, Theme, Notification-Prefs je Kategorie,
  Profil/Struktur/Übungen-Editoren, JSON-Export (Web: Download, nativ: Share),
  Alles-Löschen mit Bestätigung + Re-Seed, Onboarding erneut ausführbar.
- **Doku:** ARCHITECTURE.md, WEEK_SCHEMA.md (generiert, `npm run schema:docs`),
  REQUIREMENTS.md im Repo.
- **Tests:** 92 Vitest-Tests grün (Zeit-Helfer, Regel-Engine, Import-Schema,
  Locale-Parity, Ernährung, Health, Statistik-Module). `npm run typecheck` sauber.

## 🔎 Verifiziert

- **Web (Chrome, Desktop 1280px + Mobile 375px, Dark + Light):** Onboarding-Flow,
  Import mit Beispielwoche KW 27 (Warnungen + Vorschau + Übernahme), Wochen-Grid,
  Heute-Ansicht (Jetzt/Nächstes korrekt), Trainings-Loop inkl. „Letztes Mal"-Anzeige,
  Sprachumschaltung de↔en live.
- **Session 3 (Web, Chrome):** Alle Tabs + Session + Import erneut durchgetestet,
  Desktop 1280 px UND Mobile 375 px, jeweils Dark UND Light: Wochen-Grid + Tages-Tabs
  + Now-Linie, Heute-Cockpit (elevated Jetzt-Block, Restzeit, Fortschrittsbalken),
  Session (Satz-Zähler im Header live beim Abhaken, aktiver Satz akzentuiert),
  Aufgaben-Liste, Settings, Import-Vorschau mit Regel-Warnungen.
- **Session 4 (Web, Chrome):** Ernährungs-Tab (Defaults ohne Profil: 2200 kcal),
  Barcode-Lookup (Nutella-EAN → Produktkarte mit Nutri-Score E + allen Werten),
  Eintrag 30 g als Snack → Tagesbilanz 162 kcal korrekt, OFF-Suche „Milbona Skyr"
  liefert Lidl-Produkte. Kamera-Scan auf Web fällt ohne Kamera sauber auf manuelle
  Eingabe zurück.
- **Session 5 (Web, Chrome):** Woche importiert (KW 27), Block-Status-Tap →
  Wochenbilanz zählt live (1/6, Typ-Chips), Tages-Wechsel per Tab mit Animation;
  Ernährung: Favorit (Stern) toggeln, Eintrag inline bearbeiten (50→100 g,
  Frühstück→Snacks, Bilanz 270→539 kcal), eigener Eintrag mit Barcode (300 g ×
  120 kcal/100 g = 360 kcal, danach per Barcode lokal auffindbar), Wochen-Trend-
  Balken + Ø, Settings-Ziel 2500 kcal wirkt sofort. **Swipe-Geste konnte im
  Browser nicht per synthetischem Pointer-Event ausgelöst werden — auf iOS/echtem
  Touch verifizieren.**
- **Session 6 (Web, Chrome):** Trainings-Dashboard (Session beendet → 1/1/1 +
  leuchtender Punkt am 4.7.), Grundnahrungsmittel-Suche („brokkoli" → lokale
  Karte, Portion 200 g vorbelegt, Eintrag → Mikros-Karte mit Vitamin C 223 %),
  Nährstoff-Check nach 3 erfassten Tagen (Calcium Ø 4 % … Folat Ø 21 % mit
  Quellen-Tipps; Mikros ohne Daten korrekt NICHT geflaggt). Aktivitäts-Bonus
  auf Web korrekt inaktiv (kein Apple Health) — iOS-Test steht aus.
- **iOS-Simulator: noch NICHT verifiziert** (nächste Session: `npm run ios`).

## ⚠️ Wichtige Hinweise

- **expo-sqlite 57.0.0 Web-Bug gepatcht** (`patches/expo-sqlite+57.0.0.patch`,
  via postinstall): Der synchrone Worker-Bridge schrieb die Ergebnislänge als
  1 Byte statt uint32 → alle Sync-Ergebnisse > 255 Bytes wurden trunkiert
  („Unterminated string in JSON"). Patch nicht löschen, bis ein Upstream-Fix
  released ist (Kandidat für Issue/PR an expo).
- **Web-Produktion:** Host muss `Cross-Origin-Embedder-Policy: credentialless`
  und `Cross-Origin-Opener-Policy: same-origin` setzen (OPFS/SharedArrayBuffer);
  im Dev-Server erledigt das metro.config.js.
- DB-Init ist async (`initDb()` im Root-Layout) — `openDatabaseSync` racet auf
  Web gegen den Worker-Start.

## 📋 Offen / TODOs

- [ ] **Auf iOS verifizieren — Schritt-für-Schritt-Plan: [docs/IOS_TESTPLAN.md](IOS_TESTPLAN.md)**
  (Health, Readiness, Baselines, Körper-Level/Strain, Schlafbedarf, Trends, Coach,
  Notifications, Coach-Settings + Kalibrier-Hinweise). Dev-Build nötig
  (`npx expo run:ios`), Expo Go reicht wegen HealthKit/Nitro nicht. Strain/Körper-
  Level brauchen ein echtes Gerät mit Apple Watch; Rest geht im Simulator mit
  Health-Beispieldaten.
- [ ] Notification-Verhalten auf echtem Gerät testen (Scheduling, Eskalation, Ruhezeiten).
- [x] ~~Tages-Swipe (Geste) in der Wochenansicht~~ (Session 5; Touch-Verhalten auf iOS gegentesten).
- [x] ~~Dezente Animationen (reanimated)~~ (Session 5: Woche + Ernährung; weitere Screens optional).
- [x] ~~Wochenbilanz-Ansicht~~ (Session 5).
- [x] ~~Essenstracker-Ausbau (Bearbeiten, Favoriten, Trend, eigene Produkte, Ziele)~~ (Session 5).
- [ ] Block „verschieben" in der Import-Vorschau ist Bearbeiten der Zeiten — Drag&Drop wäre Phase-1-Polish.
- [ ] `expo-notifications`-Config-Plugin (Android-Icon/Farbe) vor erstem echten Build.
- [ ] Upstream-Issue für den expo-sqlite-Web-Bug aufmachen.

## Nützliche Kommandos

```bash
npm run web           # Expo Web-Dev-Server (Port aus .claude/launch.json: 8090)
npm run ios           # iOS-Simulator
npm test              # Vitest (Domain + Schema + Locale-Parity)
npm run typecheck     # tsc --noEmit
npm run db:generate   # Drizzle-Migration nach Schema-Änderung
npm run schema:docs   # docs/WEEK_SCHEMA.md neu generieren
```
