# Weeko — Supabase Setup (Accounts / Auth)

> Umsetzung von **Schritt 2 + 3** aus [SYNC_CONCEPT.md](./SYNC_CONCEPT.md): Login per
> E-Mail + Passwort. **Wichtig:** Login heißt hier noch NICHT Sync — deine Daten liegen
> weiter lokal pro Gerät. Cross-Device-Sync kommt in Schritt 4 (PowerSync). Login ist
> die Voraussetzung dafür.

## Was der Code schon mitbringt

- Supabase-Client (`src/auth/supabase.ts`) — liest URL + anon-key aus der Env.
- Auth-Store (`src/stores/authStore.ts`) — Session, `signIn`/`signUp`/`signOut`.
- Login-Screen (`src/app/login.tsx`), Auth-Gate im Root-Layout, Logout in den Settings.
- **Ohne konfigurierte Env läuft die App wie bisher lokal weiter** (kein Login-Gate).
  Der Login aktiviert sich automatisch, sobald die zwei Env-Variablen gesetzt sind.

## Schritt-für-Schritt

### 1. Supabase-Projekt anlegen
1. Auf [supabase.com](https://supabase.com) einloggen → **New project**.
2. Name (z. B. „weeko"), DB-Passwort, **Region** (EU/Frankfurt für Datenschutz) wählen.
3. Warten, bis das Projekt bereitsteht.

### 2. Zugangsdaten holen
**Project Settings → API**:
- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **client-sicherer Key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`: in neueren Projekten
  **„Publishable key"** (`sb_publishable_…`), in älteren **„anon public"**. Öffentlich —
  RLS schützt die Daten. Der **„Secret key"** (`sb_secret_…` / `service_role`) gehört
  **niemals** in eine `EXPO_PUBLIC_`-Variable.

### 3. Env eintragen
```bash
cp .env.example .env
```
Dann in `.env` die zwei Werte eintragen. Danach den Dev-Server neu starten
(`EXPO_PUBLIC_*` wird beim Bundeln eingelesen).

### 4. E-Mail-Auth aktivieren
**Authentication → Providers → Email** aktivieren.
- Zum schnellen Testen: **„Confirm email" ausschalten** → Registrieren meldet sofort an.
- Mit „Confirm email" an: nach der Registrierung erst den Link in der Mail bestätigen,
  dann anmelden (der Login-Screen weist darauf hin).

### 5. (Erst für Schritt 4 nötig) Datenbank-Schema + RLS
`supabase/schema.sql` im **SQL Editor** ausführen. Das legt den Postgres-Spiegel + RLS an.
**Für den reinen Login nicht erforderlich** — erst wenn PowerSync die Daten synchronisiert.
Vorher ggf. an die dann ergänzten Spalten (`updated_at`) angleichen.

## Testen
- **Ohne Env:** App startet direkt in die App/Onboarding (lokal, kein Login) — unverändert.
- **Mit Env:** App startet auf dem Login-Screen. Registrieren → (ggf. Mail bestätigen) →
  anmelden → App. Abmelden über **Settings → Konto → Abmelden** führt zurück zum Login.

## Nächster Schritt
[SYNC_CONCEPT.md](./SYNC_CONCEPT.md) §8 Schritt 4: PowerSync integrieren
(`userId`/`updatedAt` lokal ergänzen, Sync-Rules, Queries auf `useQuery`), damit die
Daten tatsächlich zwischen Handy und Web fließen.
