# Weeko — iOS-Testplan (HealthKit, Coach, Notifications)

> Alles hier ist bisher **nur auf Web/Vitest verifiziert**. Web ist für die
> HealthKit-abhängigen Features bewusst nur ein Fallback (zeigt Hinweise / blendet
> Karten aus). Dieser Plan deckt ab, was **nur am Gerät** prüfbar ist.
> Stand: nach Session 10b. Abhaken beim Durchgehen.

## 0. Voraussetzungen & Setup

- **Dev-Build nötig, kein Expo Go:** HealthKit läuft über
  `@kingstinct/react-native-healthkit` (NitroModules) — in Expo Go crasht der
  Import, dort degradiert alles zu „nicht verfügbar".
  ```bash
  npx expo run:ios            # Simulator-Dev-Build
  # echtes Gerät: npx expo run:ios --device
  ```
- **Simulator vs. echtes Gerät:**
  - Schlaf, HRV (SDNN), Ruhepuls, Schritte, Aktiv-kcal lassen sich im **Simulator**
    in der Health-App manuell anlegen (Health → Durchsuchen → Kategorie → „Daten
    hinzufügen"). Damit sind Readiness, Baselines, Trends, Schlafbedarf testbar.
  - **Herzfrequenz-Einzelsamples über den Tag** (für Strain/Körper-Level) sind im
    Simulator kaum realistisch erzeugbar → **Strain/Körper-Level am echten Gerät
    mit Apple Watch** testen (oder eine Handvoll HR-Samples manuell anlegen, um nur
    den Rechenweg zu prüfen).
- **Berechtigungen:** Beim ersten „Mit Apple Health verbinden" erscheint das
  iOS-Sheet. Lesezugriff für ALLE angefragten Typen erlauben: Schlaf, Schritte,
  Aktiv-Energie, Ruhepuls, HRV (SDNN), **Herzfrequenz** (neu). Prüfbar unter
  Health → Profil → Apps → Weeko.

## 1. Health-Grunddaten (Heute-Screen „Schlaf & Gesundheit")

| # | Schritt | Erwartet |
|---|---------|----------|
| 1.1 | Health-Beispieldaten für letzte Nacht anlegen (Schlafphasen), dann App öffnen → „Verbinden" | Sheet erscheint einmalig; nach Erlauben lädt die Karte |
| 1.2 | Schlaf letzte Nacht vorhanden | Schlafdauer im Header, Phasen-Balken (Tief/Kern/REM/Wach), Bett-/Aufwachzeit, Quelle |
| 1.3 | Zwei Quellen (Watch + Ring/Zepp) für dieselbe Nacht | **Nicht** doppelt gezählt — Quelle mit meisten Schlafdaten gewinnt (`summarizeSleep`) |
| 1.4 | Schritte / Aktiv-kcal / Ruhepuls / HRV vorhanden | Als Metrik-Chips unter dem Schlaf sichtbar |
| 1.5 | Keine Health-Daten heute | Hinweis „Keine Health-Daten … Lesezugriff prüfen" |

## 2. Readiness-Score (Health-Karte-Badge)

| # | Schritt | Erwartet |
|---|---------|----------|
| 2.1 | Nacht mit gutem Schlaf + normaler HRV/Ruhepuls | Badge „Erholung" mit Score 0–100, Band **hoch** (grün) ab 70 |
| 2.2 | Schlecht: kurzer Schlaf (~4 h) | Score niedrig, Band **niedrig** (rot) < 40 |
| 2.3 | Nur ein Signal vorhanden (nur Schlaf) | Score trotzdem berechnet (Renormalisierung), Badge sichtbar |
| 2.4 | Gar keine der 3 Größen | Kein Badge (readiness = null) |

## 3. Persönliche Baseline (30-Tage-Ø)

| # | Schritt | Erwartet |
|---|---------|----------|
| 3.1 | < 7 Tage HRV/Ruhepuls-Historie | Generische Referenz (55 ms / 60 bpm) — Score „neutral", kein Bias |
| 3.2 | ≥ 7 Tage Historie mit hoher Eigen-HRV (z. B. Ø 80 ms) | Ein mittelmäßiger Tag (40 ms) ergibt **niedrigeren** Score als mit generischer Baseline (relativ zu *dir*) |
| 3.3 | Baseline wird 1×/Tag neu berechnet | Bei mehrfachem Öffnen am selben Tag keine erneute 30-Tage-Ladung (in-memory Cache; ggf. per Logging prüfen) |

## 4. Trends im Stats-Screen (Tab „Gesundheit")

| # | Schritt | Erwartet |
|---|---------|----------|
| 4.1 | Health-Tab öffnen, 7 Tage Daten | Ø-Kacheln (Schlaf/Schritte/Ruhepuls/HRV) + Schlaf-Balken pro Nacht |
| 4.2 | Readiness-Verlauf | Karte „Erholung im Verlauf": 7-Tage-Balken **farbcodiert** nach Band + Ø-Score im Header |
| 4.3 | HRV-Verlauf | Karte „HRV-Verlauf": Balken je Tag (ms) |
| 4.4 | Tage ohne Daten | Bleibalken/leer statt Absturz; nur Tage mit Daten zählen in den Ø |

## 5. Körper-Level / Strain / Schlafbedarf (Heute-Screen) — **echtes Gerät**

| # | Schritt | Erwartet |
|---|---------|----------|
| 5.1 | Morgens nach dem Aufwachen (Schlaf erfasst, noch keine Aktivität) | Karte „Körper-Level" ~= Readiness-Score, hoher %-Wert, Strain niedrig |
| 5.2 | Nach einem intensiven Workout (Watch trackt HR) → App öffnen | Körper-Level **gesunken**, Strain-Wert **gestiegen** |
| 5.3 | App über den Tag mehrfach öffnen | Level sinkt weiter mit zunehmender Aktivität (Refresh on-focus + 5-min-Intervall) |
| 5.4 | Schlafbedarf | „Schlafbedarf X:XX h" = 8 h + halbe Schlafschuld (letzte 3 Nächte) + Strain-Zuschlag |
| 5.5 | Keine HR-Daten (Simulator) | Level = Readiness (kein Drain), Strain-Chip fehlt, Karte trotzdem sinnvoll |
| 5.6 | **Plausibilitätscheck Strain** | Ein harter Tag sollte spürbar höher liegen als ein Ruhetag — sonst Konstanten kalibrieren (s. §8) |

## 6. Coach-Insights (Heute-Karte „Coach")

Ohne HealthKit testbar (nutzen SQLite-Daten):

| # | Schritt | Erwartet |
|---|---------|----------|
| 6.1 | Woche importieren mit intensivem Trainingsblock **heute = Mi/So** | Warnung „Regenerationstag …" |
| 6.2 | 5 Trainingstage in Folge loggen (Sessions abschließen) | Warnung „… Trainingstage am Stück, Ruhetag" |
| 6.3 | Übung 4+ Sessions ohne neuen Bestwert | Vorschlag „… kein neuer Bestwert seit N Einheiten" |
| 6.4 | 3 Tage eiweißarm essen (< 80 % Ziel) | Vorschlag „Eiweiß im Schnitt …" |
| 6.5 | 4 Trainingstage in 7 | Lob „… Trainingstage. Weiter so!" |

Mit HealthKit:

| # | Schritt | Erwartet |
|---|---------|----------|
| 6.6 | Niedrige Readiness (schlechter Schlaf) + intensiver Block heute | Warnung „Erholung niedrig … wirklich heute?" (Score 90, oberste Karte) |

## 7. Coach-Dismiss (Hybrid)

| # | Schritt | Erwartet |
|---|---------|----------|
| 7.1 | Informativen Tipp (Lob/Protein) wegwischen (X) | Verschwindet, kommt am selben Tag **nicht** wieder |
| 7.2 | Warnung (z. B. Regenerationstag) wegwischen | Verschwindet, taucht nach **Snooze-Dauer** (Default 3 h) wieder auf |
| 7.3 | Snooze in Settings auf z. B. 30 min ändern, Warnung wegwischen | Kommt nach ~30 min zurück (nicht 3 h) |

## 8. Notifications — **echtes Gerät empfohlen**

| # | Schritt | Erwartet |
|---|---------|----------|
| 8.1 | Erststart | Berechtigungs-Prompt; nach Erlauben aktiv |
| 8.2 | Block mit Startzeit in naher Zukunft | Lokale Notification zum Blockstart |
| 8.3 | Aufgabe mit Zeitfenster, nicht abhaken | Erinnerung + Eskalation alle X min (Kategorie-Intervall), max 5×, stoppt bei „erledigt" |
| 8.4 | Ruhezeiten (z. B. nie vor 08:00) | Keine Notification im Ruhefenster |
| 8.5 | Während aktiver Trainings-Session | Task-Notifications **unterdrückt**, Blockstart nicht |
| 8.6 | **Coach-Digest:** Digest-Zeit in Settings auf +2 min stellen, App schließen | Morgen-Push mit oberstem Insight zur eingestellten Zeit |
| 8.7 | Coach-Kategorie in Settings deaktivieren | Kein Coach-Push |
| 8.8 | Digest-Inhalt | = oberstes Insight vom letzten App-Öffnen (Snapshot; recompute beim Öffnen) — bekannte Grenze |

## 9. Coach-Settings (§ Benachrichtigungen → „Coach (Morgen-Tipp)")

| # | Schritt | Erwartet |
|---|---------|----------|
| 9.1 | Coach-Zeile | Zeigt **Uhrzeit** (Digest) + **Snooze (min)** statt Ruhezeiten/Eskalation |
| 9.2 | Uhrzeit ändern → App neu öffnen → Settings | Wert persistiert, Digest wird auf neue Zeit geplant (§8.6) |
| 9.3 | Snooze ändern | Wirkt auf §7.3 |

## Kalibrierung (wichtig, nach echten Gerätedaten)

Die Strain/Körper-Level-Heuristiken sind **geschätzt** und stehen als Konstanten
zum Nachjustieren:

- `src/domain/coach/strain.ts` — `HR_ZONE_WEIGHTS`, `STRAIN_SCALE`,
  `HR_ZONE_LOWER_FRACTIONS`, `MAX_SAMPLE_GAP_MIN`.
- `src/domain/coach/energy.ts` — `STRAIN_DRAIN_FACTOR`.
- `src/domain/coach/sleepNeed.ts` — `BASELINE_SLEEP_NEED_MIN`,
  `MAX_STRAIN_BONUS_MIN`, `DEBT_RECOVERY_SHARE`.
- `src/domain/coach/readiness.ts` — Gewichte HRV/Schlaf/Ruhepuls, Band-Grenzen.

Vorgehen: einen bekannten harten Tag und einen Ruhetag durchspielen, Strain/Level
notieren, Gewichte so anpassen, dass die Werte dem subjektiven Empfinden
entsprechen. Danach die Vitest-Erwartungen (falls betroffen) mitziehen.

## Bekannte Grenzen (kein Bug)

- **Kein Hintergrund-Update:** Körper-Level/Strain aktualisieren beim App-Öffnen +
  5-min-Intervall, nicht kontinuierlich (Phase 1, kein Background-Refresh).
- **Digest-Inhalt ist der letzte Snapshot**, nicht zur Feuerzeit berechnet
  (lokale Notification kann keinen Code ausführen).
- **Web:** alle HealthKit-Teile ausgeblendet/Hinweis; Notifications No-op.
- **Nicht medizinisch:** Scores/Empfehlungen sind Heuristiken (Disclaimer im UI).
