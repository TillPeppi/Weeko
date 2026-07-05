# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-07-03 — Weeko Phase 1 Build

### Observation 1: JSON-parse errors at position < 256 point to length-byte truncation in binary bridges

**Status:** OPEN
**Date:** 2026-07-03
**Session context:** Weeko Phase-1 greenfield build; expo-sqlite web (wa-sqlite/OPFS) returned "Unterminated string in JSON at position 66/211" during app init.
**Skill:** New skill candidate: debugging-heuristics (or fold into an existing debugging skill)
**Type:** open-source
**Phase/Area:** Root-cause analysis of platform-bridge failures

**Issue:** A JSON.parse failure with a break position that is always < 256 (and varies per payload) was caused by an upstream bug writing a uint32 length as a single uint8 (`Uint8Array.set(new Uint32Array([length]))` coerces element-wise), truncating every sync result > 255 bytes. First hypotheses (corrupt persisted data, SharedArrayBuffer size limits) were wrong; reading the bridge source found it in minutes.

**Suggested improvement:** Capture the heuristic: when JSON.parse fails at a position suspiciously below a power-of-two boundary (255/65535), suspect a length-field encoding bug in the serialization layer and read the bridge/serializer source before blaming data. Fix via patch-package + postinstall for reproducibility.

**Principle:** Error positions carry structural information — a parse failure at `payload % 256` is a length-byte smell, not a data smell. Read the transport layer's source before assuming corrupt state.

### Observation 2: Enforce documented working rules as tests, not prose

**Status:** OPEN
**Date:** 2026-07-03
**Session context:** Weeko requires "both locale files maintained together on every feature" (working rule 1).
**Skill:** All skills
**Type:** open-source
**Phase/Area:** Built-in enforcement (pre-flight principle)

**Issue:** Rules like "always keep de.json/en.json in sync" are exactly the kind that silently rot. A 30-line vitest test (flatten both key trees, diff, also reject empty strings) turns the rule into a failing build instead of a review comment.

**Suggested improvement:** When a project brief contains standing rules over artifacts (locale parity, schema-doc freshness, no hardcoded strings), add a cheap automated check in the same session the rule is introduced — the generated-docs variant is a script (`npm run schema:docs`) plus a regeneration note in the doc header.

**Principle:** The pre-flight principle generalizes beyond skills: any documented invariant that a machine can check should be checked by a machine from day one.

### Observation 3: DOM-driven verification of stacked navigators hits invisible screens

**Status:** OPEN
**Date:** 2026-07-03
**Session context:** Browser-eval testing of the Weeko training flow; a synthetic input targeting "the first +kg field" landed on a background screen still mounted in the react-navigation stack, corrupting the test narrative.
**Skill:** New skill candidate: rn-web-verification (or fold into a verify/preview skill)
**Type:** open-source
**Phase/Area:** In-browser verification of React-Native-Web apps

**Issue:** Stack navigators keep previous screens mounted in the DOM. `document.querySelectorAll('input')[0]` selected a field on a hidden screen; the resulting confusion cost several verification rounds before realizing the app logic was correct all along.

**Suggested improvement:** When driving RN-web apps via DOM eval: scope queries to the last/visible screen container, prefer resetting the nav stack via direct URL navigation between steps, and treat "unexpected screen content" as a stacked-screen artifact before suspecting app bugs.

**Principle:** In RN-web, the DOM contains the whole navigation stack, not just what's visible — selectors must be scoped or the stack reset before each assertion.

### Observation 4: Full-fidelity mockup boards de-risk design-direction choices before implementation

**Status:** OPEN
**Date:** 2026-07-03
**Session context:** Weeko Session 2 — user asked for UI/layout examples, then narrowed to one direction ("Dark Focus") which was implemented in the real app.
**Skill:** New skill candidate: design-direction-exploration (or fold into a frontend/mockup skill)
**Type:** open-source
**Phase/Area:** Choosing a visual direction before writing UI code

**Issue:** The productive loop was: (1) present several distinct directions as compact inline mockups, (2) on request, expand the chosen/compared few into full "boards" showing multiple real screens + a component/token strip (not just one hero screen), (3) explicitly separate skin-level differences (colors/type/radius — cheap) from layout-level ones (different component trees — expensive) so the user's choice is informed by cost, (4) only then implement. The full board (multiple screens at equal fidelity) is what let the user compare fairly; a single-screen mockup would have hidden how the style carries across the app.

**Suggested improvement:** When exploring visual directions, use real app content (same data across every variant), always include a component/token strip alongside the screens, and label each direction with its implementation cost tier (skin vs layout) and any requirement it would bend. Keep mockups token-driven so the winning one maps directly to real theme tokens.

**Principle:** A design mockup's job is to make a decision cheap and correct. Equal-fidelity, multi-screen, cost-annotated boots beat one polished hero screen — the expensive mistakes hide in the screens you didn't mock and the cost you didn't name.

### Observation 5: Screenshot-Verifikation nach Full-Page-Load liefert stale Paints

**Status:** OPEN
**Date:** 2026-07-03
**Session context:** Dark-Focus-Design über alle Weeko-Screens ausrollen; Web-Verifikation über preview_*-Tools
**Skill:** New skill candidate / verify-Workflow (harness-Skill "verify")
**Type:** open-source
**Phase/Area:** Browser-Verifikation

**Issue:** Nach einer Full-Page-Navigation (window.location.href) kombiniert mit einem vorherigen Viewport-Resize zeigte preview_screenshot wiederholt einen nur teilweise gerenderten Frame (Inhalt in einer 720×448-Ecke, Rest schwarz), obwohl getBoundingClientRect für alle Wrapper korrekte 1280×800 meldete. Ein erneuter minimaler Resize (1280→1200 o. ä.) erzwang einen Repaint und der Screenshot war korrekt. Fast wäre daraus fälschlich ein Layout-Bug im App-Code diagnostiziert worden.

**Suggested improvement:** In Verifikations-Workflows festhalten: Bei verdächtigen Screenshots zuerst DOM-Maße (getBoundingClientRect/preview_inspect) als Ground Truth prüfen; weicht der Screenshot ab, Repaint erzwingen (kleiner Resize) und erneut capturen, statt den App-Code zu verdächtigen.

**Principle:** Screenshots sind gerenderte Frames, keine Zustandsabfragen — bei Diskrepanz zwischen Screenshot und DOM-Inspektion gewinnt die DOM-Inspektion, und der Screenshot braucht einen erzwungenen Repaint.

### Observation 6: Data-viz features on a fresh DB only exercise empty states — unit tests are the real guarantee

**Status:** OPEN
**Date:** 2026-07-04
**Session context:** Weeko — building a statistics screen (training progression/PRs, nutrition weekly stats, plan adherence, health trends) across four sections, each fed by pure domain functions + repo queries.
**Skill:** verify (harness verify-workflow) / All skills
**Type:** open-source
**Phase/Area:** Browser verification of chart/aggregation features

**Issue:** The stats screen renders four data-viz sections, but the local SQLite DB was freshly seeded (no sessions, food entries, or weeks), so every section showed its empty state. Live browser verification could only confirm: routing, i18n resolution, segmented-control switching, no console errors, and correct empty-state/iOS-only messaging. It could NOT exercise a single populated chart. Driving the app to produce data (import a week, log a session, add food entries) was multi-step and fragile — worsened by a parallel session doing an unrelated design refactor that kept touching the same files and triggering HMR. The correctness of the actual aggregation logic (Epley 1RM, streaks that survive an empty current week, kcal balance → kg, year-boundary ISO weeks) rested entirely on the domain unit tests, not the browser.

**Suggested improvement:** For features whose output is a computed view (charts, trends, records, dashboards), treat comprehensive domain unit tests as the primary correctness guarantee and browser verification as a rendering/wiring smoke test. Deliberately structure the feature so every transform is a pure, unit-tested function independent of seeded DB state (Weeko's `src/domain/*Stats.ts` pattern). When reporting, state plainly which layer was verified where: "empty states + wiring verified in-browser; data logic verified by N unit tests; populated charts not pixel-verified due to empty DB." Do not imply the charts were seen working when only the empty state was.

**Principle:** You can only browser-verify what the current data lets the UI render. On an empty datastore that's the empty state — so the burden of proving the data path shifts to unit tests, and the honest report names the boundary between what was seen and what was only tested.

### Observation 7: RN-Web-Preview-Interaktion — CSS-Uppercase und innere Scroll-Container

**Status:** OPEN

**Date:** 2026-07-05
**Session context:** Weeko Trainings-Feature (Übungskatalog + Piktogramme + freie Session), Browser-Verifikation via preview_eval
**Skill:** verify (built-in) / New skill candidate: rn-web-preview-testing
**Type:** open-source
**Phase/Area:** Browser-Verifikation von React-Native-Web-Apps

**Issue:** Beim Klicken von Buttons per `preview_eval` schlug die Textsuche fehl, weil Button-Beschriftungen im Screenshot GROSSGESCHRIEBEN erscheinen (CSS `text-transform: uppercase`), `textContent` aber den Original-Text enthält ("Übung hinzufügen" statt "ÜBUNG HINZUFÜGEN"). Der Fehlklick blieb zunächst unbemerkt, weil das Eval-Snippet unconditional einen Erfolgswert zurückgab (`b?.click(); return 'opened'`). Außerdem scrollt `window.scrollTo` in RN-Web-Apps nicht — der ScrollView rendert einen inneren Container mit eigenem Overflow; scrollen muss man das per `scrollHeight > clientHeight` gefundene div.

**Suggested improvement:** In einer RN-Web-Verifikations-Checkliste (verify-Skill-Ergänzung oder eigene Notiz): (1) Textmatching gegen `textContent` immer mit Quelltext-Schreibweise, nie mit der gerenderten (CSS-transformierten) Schreibweise; (2) Eval-Snippets so bauen, dass der Rückgabewert den tatsächlichen Erfolg reflektiert (`return b ? 'clicked' : 'not found'`); (3) Scrollen über den inneren ScrollView-Container, nicht über window.

**Principle:** Bei DOM-Automatisierung gegen gerenderte UIs unterscheiden sich Darstellung und DOM-Inhalt (CSS-Transforms, Pseudo-Elemente); Assertions müssen gegen den DOM-Inhalt gehen, und jedes automatisierte Interaktions-Snippet muss seinen Erfolg im Rückgabewert beweisen statt ihn zu behaupten.
