# Weeko — Logo-Marken

Minimalistische Icon-Marken für Weeko. Monochrom + ein Akzent (`#3d7fd6`).

## Light/Dark

Die Tinte ist als `currentColor` gesetzt — die Marke erbt die Textfarbe des
Eltern-Elements und passt sich damit automatisch an Light/Dark an. Der blaue
Akzentpunkt bleibt in beiden Modi fix.

```tsx
// React Native (react-native-svg via SVGR) oder Web
<View style={{ color: isDark ? '#f1ecdf' : '#141519' }}>
  <MonolineW />
</View>
```

Für feste Assets (z. B. App-Icon-PNG-Export) `currentColor` durch den Hex-Wert
ersetzen: Light = `#141519`, Dark = `#f1ecdf`.

## Marken

| Datei | Idee |
|---|---|
| **`outline-icon.svg`** | **Primäre Marke** — Monoline-W (Akzent) im Outline-Rahmen |
| `monoline-w.svg` | W in einer Linie, Endpunkt = heute (Akzent) |
| `timeline.svg` | Zeitstrahl mit aktivem Block |
| `focus.svg` | Fokus / Fixpunkt (Arbeit & Handball unverrückbar) |
| `sunrise.svg` | Sonntag → neue Woche |
| `calendar.svg` | Kalenderblatt mit aktivem Tag |
| `seven-days.svg` | Sieben Tage, heute hervorgehoben |
| `loop.svg` | wiederkehrender Wochen-Rhythmus |
| `agenda.svg` | Plan / Aufgabenliste |
| `progress.svg` | Aufwärts / Fortschritt |
| `wordmark.svg` | Horizontales Lockup „weeko" (Icon + Schriftzug) |

## Vorschau

`preview.html` im Browser öffnen — zeigt alle Marken in Light und Dark
nebeneinander.
