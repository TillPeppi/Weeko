/**
 * Enforces working rule #1: both locale files are maintained together.
 * Fails when de.json and en.json diverge in their key sets.
 */
import { describe, expect, it } from 'vitest';
import de from './locales/de.json';
import en from './locales/en.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      return flattenKeys(value as Record<string, unknown>, path);
    }
    return [path];
  });
}

describe('locale parity de/en', () => {
  it('has identical key sets', () => {
    const deKeys = flattenKeys(de).sort();
    const enKeys = flattenKeys(en).sort();
    const missingInEn = deKeys.filter((k) => !enKeys.includes(k));
    const missingInDe = enKeys.filter((k) => !deKeys.includes(k));
    expect(missingInEn, `keys missing in en.json`).toEqual([]);
    expect(missingInDe, `keys missing in de.json`).toEqual([]);
  });

  it('has no empty translations', () => {
    const empty = (obj: Record<string, unknown>): string[] =>
      flattenKeys(obj).filter((k) => {
        const value = k.split('.').reduce<unknown>((acc, part) => {
          return acc !== null && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[part]
            : undefined;
        }, obj);
        return typeof value === 'string' && value.trim() === '';
      });
    expect(empty(de)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });
});
