/**
 * Globally-unique row IDs (UUID v4) — sync-readiness (docs/SYNC_CONCEPT.md §3.1).
 *
 * IDs are generated on the client so inserts need no round-trip and never collide
 * across devices (the prerequisite for cloud sync). Uses the platform crypto when
 * available (web + modern Hermes) with an RFC-4122 v4 fallback, so it works on
 * every runtime without pulling in a native module.
 */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
