# Weeko

Persönliche Wochenplanungs- & Life-OS-App — **eine Codebase für iOS, Android und Web**
(Expo + React Native + TypeScript).

Kernidee: Am Sonntag plant eine externe KI die Woche und liefert sie als JSON.
Weeko importiert, validiert (Zod + Regel-Engine), zeigt die Woche als Zeitstrahl
und führt durch den Alltag: Aufgaben abhaken, Training tracken, erinnern.
Phase 1 ist 100 % lokal — kein Backend, keine Cloud, kein Account.

## Loslegen

```bash
npm install        # wendet auch patches/ an (postinstall)
npm run web        # Web-Dev-Server
npm run ios        # iOS-Simulator
npm test           # Domain-/Schema-Tests (Vitest)
npm run typecheck  # TypeScript strict
```

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [REQUIREMENTS.md](REQUIREMENTS.md) | Produkt-Brief: Vision, Stack, Arbeitsregeln, Phase-1-Scope |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Struktur, Datenfluss, Architektur-Entscheidungen |
| [docs/WEEK_SCHEMA.md](docs/WEEK_SCHEMA.md) | JSON-Import-Schema für die Planungs-KI (generiert) |
| [docs/PROGRESS.md](docs/PROGRESS.md) | Stand, Verifikation, offene TODOs |

## Stack

Expo SDK 57 · Expo Router · expo-sqlite + Drizzle ORM (SQLite = Single Source of Truth,
auf Web via wa-sqlite/OPFS) · Zod 4 · Zustand · NativeWind 4 · i18next (de/en) ·
expo-notifications (nur lokal) · date-fns · FlashList · Vitest
