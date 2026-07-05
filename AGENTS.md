# Weeko — Agent-Kontext

Expo SDK 57 — bei API-Fragen die versionierten Docs lesen:
https://docs.expo.dev/versions/v57.0.0/

## Pflichtlektüre (in dieser Reihenfolge)

1. [REQUIREMENTS.md](REQUIREMENTS.md) — Vision, Stack (entschieden!), Arbeitsregeln, Phase-1-Scope
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Struktur, Datenfluss, Entscheidungen
3. [docs/PROGRESS.md](docs/PROGRESS.md) — was fertig ist, offene TODOs
4. [docs/WEEK_SCHEMA.md](docs/WEEK_SCHEMA.md) — Import-JSON (generiert via `npm run schema:docs`)

## Verbindliche Arbeitsregeln (Kurzfassung)

1. **Kein hartcodierter user-sichtbarer Text** — alles über i18next-Keys, `de.json` UND `en.json`
   immer zusammen pflegen (Locale-Parity-Test schlägt sonst fehl).
2. **Responsive:** 320 px bis Desktop; mobile-first, Desktop nutzt Mehrspalten-Layouts.
3. **Domain-Logik framework-frei** in `src/domain/` (keine React/Expo-Imports) + Vitest-Tests.
4. **TypeScript strict**, kein `any` ohne Begründung.
5. **Doku pflegen:** PROGRESS.md nach jeder Session, ARCHITECTURE.md bei Entscheidungen.

## Wichtige Eigenheiten

- `patches/expo-sqlite+57.0.0.patch` fixt einen Upstream-Bug (Web-Sync-Bridge trunkiert
  Ergebnisse > 255 Bytes). Nicht entfernen. `npm install` wendet ihn via postinstall an.
- DB-Init ist async (`initDb()` im Root-Layout) — nie top-level `openDatabaseSync` auf Web.
- Nach Schema-Änderungen: `npm run db:generate` (Drizzle-Migration) — nie Migrationen editieren.
- Checks: `npm test` · `npm run typecheck` · Web-Dev: `npm run web` (Port 8090, .claude/launch.json)
