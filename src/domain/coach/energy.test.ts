import { describe, expect, it } from 'vitest';
import { STRAIN_DRAIN_FACTOR, bodyLevel } from './energy';

describe('bodyLevel', () => {
  it('is null without a recovery score to start from', () => {
    expect(bodyLevel(null, 50)).toBeNull();
  });

  it('equals readiness when there is no strain yet', () => {
    expect(bodyLevel(80, null)).toEqual({ level: 80, band: 'high' });
    expect(bodyLevel(80, 0)).toEqual({ level: 80, band: 'high' });
  });

  it('drains proportionally to strain', () => {
    // 80 − 50 * 0.6 = 50
    expect(bodyLevel(80, 50)).toEqual({ level: 80 - Math.round(50 * STRAIN_DRAIN_FACTOR), band: 'moderate' });
  });

  it('clamps to 0 and never goes negative', () => {
    expect(bodyLevel(30, 100)!.level).toBe(0);
  });

  it('assigns bands at the readiness thresholds', () => {
    expect(bodyLevel(100, 0)!.band).toBe('high');
    expect(bodyLevel(60, 0)!.band).toBe('moderate');
    expect(bodyLevel(20, 0)!.band).toBe('low');
  });
});
