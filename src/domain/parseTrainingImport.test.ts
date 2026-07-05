import { describe, expect, it } from 'vitest';
import { parseTrainingImport, TRAINING_IMPORT_EXAMPLE } from './parseTrainingImport';

const validImport = {
  schemaVersion: 1,
  sessions: [
    {
      date: '2026-07-03',
      start: '18:30',
      durationMinutes: 60,
      title: 'Push Day',
      exercises: [
        { name: 'Dips', sets: [{ reps: 8, weightKg: 10 }, { reps: 6, weightKg: 12.5 }] },
        { name: 'Liegestütze', sets: [{ reps: 15 }] },
      ],
    },
  ],
};

describe('parseTrainingImport', () => {
  it('accepts a valid import', () => {
    const result = parseTrainingImport(JSON.stringify(validImport));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sessions).toHaveLength(1);
      expect(result.data.sessions[0].exercises[0].sets).toHaveLength(2);
    }
  });

  it('accepts the prompt example verbatim', () => {
    const result = parseTrainingImport(TRAINING_IMPORT_EXAMPLE);
    expect(result.ok).toBe(true);
  });

  it('accepts sessions without start/duration and bodyweight sets', () => {
    const minimal = {
      schemaVersion: 1,
      sessions: [
        { date: '2026-07-03', title: 'Core', exercises: [{ name: 'Plank', sets: [{}] }] },
      ],
    };
    const result = parseTrainingImport(JSON.stringify(minimal));
    expect(result.ok).toBe(true);
  });

  it('rejects broken JSON with invalidJson', () => {
    const result = parseTrainingImport('{ nope');
    expect(result).toEqual({
      ok: false,
      errors: [{ key: 'training.import.errors.invalidJson', path: '' }],
    });
  });

  it('rejects a wrong schema version', () => {
    const result = parseTrainingImport(JSON.stringify({ ...validImport, schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].key).toBe('training.import.errors.unsupportedVersion');
    }
  });

  it('rejects an empty sessions array', () => {
    const result = parseTrainingImport(JSON.stringify({ schemaVersion: 1, sessions: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].key).toBe('training.import.errors.noSessions');
    }
  });

  it('maps invalid dates/times with 1-based session position', () => {
    const broken = {
      schemaVersion: 1,
      sessions: [
        { ...validImport.sessions[0] },
        { ...validImport.sessions[0], date: '03.07.2026', start: '25:00' },
      ],
    };
    const result = parseTrainingImport(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const keys = result.errors.map((e) => e.key);
      expect(keys).toContain('training.import.errors.invalidDate');
      expect(keys).toContain('training.import.errors.invalidTime');
      expect(result.errors.every((e) => e.session === 2)).toBe(true);
    }
  });

  it('maps set-level errors with session/exercise/set positions', () => {
    const broken = {
      schemaVersion: 1,
      sessions: [
        {
          date: '2026-07-03',
          title: 'Legs',
          exercises: [
            {
              name: 'Kniebeuge',
              sets: [{ reps: 8, weightKg: 60 }, { reps: -3, weightKg: -1 }],
            },
          ],
        },
      ],
    };
    const result = parseTrainingImport(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const repsIssue = result.errors.find((e) => e.key === 'training.import.errors.invalidReps');
      const weightIssue = result.errors.find(
        (e) => e.key === 'training.import.errors.invalidWeight'
      );
      expect(repsIssue).toMatchObject({ session: 1, exercise: 1, set: 2, field: 'reps' });
      expect(weightIssue).toMatchObject({ session: 1, exercise: 1, set: 2, field: 'weightKg' });
    }
  });

  it('rejects sessions without exercises', () => {
    const broken = {
      schemaVersion: 1,
      sessions: [{ date: '2026-07-03', title: 'A', exercises: [] }],
    };
    const result = parseTrainingImport(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.key)).toContain('training.import.errors.noExercises');
    }
  });

  it('accepts cardio/mobility exercises with empty or omitted sets', () => {
    const cardio = {
      schemaVersion: 1,
      sessions: [
        {
          date: '2026-07-03',
          title: 'Cardio',
          exercises: [{ name: 'Fahrradfahren', sets: [] }, { name: 'Dehnen' }],
        },
      ],
    };
    const result = parseTrainingImport(JSON.stringify(cardio));
    expect(result.ok).toBe(true);
    if (result.ok) {
      // omitted sets default to []
      expect(result.data.sessions[0].exercises[1].sets).toEqual([]);
    }
  });

  it('accepts an equipment attribute on exercises', () => {
    const withEquipment = {
      schemaVersion: 1,
      sessions: [
        {
          date: '2026-07-03',
          title: 'Legs',
          exercises: [{ name: 'Beinbeuger einbeinig', equipment: 'Kabel', sets: [{ reps: 10, weightKg: 10 }] }],
        },
      ],
    };
    const result = parseTrainingImport(JSON.stringify(withEquipment));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sessions[0].exercises[0].equipment).toBe('Kabel');
    }
  });
});
