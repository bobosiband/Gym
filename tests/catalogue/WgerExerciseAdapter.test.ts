/* eslint-disable camelcase */
import { describe, expect, it } from 'vitest';

import { WgerExerciseAdapter } from '../../services/catalogue/scripts/WgerExerciseAdapter.js';
import type { WgerExercise } from '../../services/catalogue/scripts/WgerExercise.js';

const NOW = '2026-10-29T12:00:00Z';

// Em and en dash characters built from their code points so this test file
// itself stays free of forbidden punctuation. The adapter is expected to
// normalise these to plain hyphens.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

function baseExercise(overrides: Partial<WgerExercise> = {}): WgerExercise {
  return {
    id: 192,
    translations: [
      {
        language: 2,
        name: 'Bench Press',
        description: '<p>Lie on bench, press bar upward.</p>',
      },
    ],
    muscles: [{ id: 4, name: 'Pectoralis major', name_en: 'Chest' }],
    muscles_secondary: [{ id: 5, name: 'Triceps brachii', name_en: 'Triceps' }],
    equipment: [{ id: 1, name: 'Barbell' }],
    license: {
      id: 2,
      full_name: 'Creative Commons Attribution Share Alike 4',
      short_name: 'CC-BY-SA 4',
      url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    },
    license_author: 'Roger Reyes',
    ...overrides,
  };
}

describe('WgerExerciseAdapter.adapt', () => {
  it('maps the happy path into our Exercise shape', () => {
    const result = WgerExerciseAdapter.adapt(baseExercise(), NOW);

    expect(result.skipReason).toBeNull();
    expect(result.exercise).not.toBeNull();
    const ex = result.exercise!;
    expect(ex.id).toBe('wger-192');
    expect(ex.slug).toBe('bench-press-192');
    expect(ex.name).toBe('Bench Press');
    expect(ex.muscles).toEqual(['chest', 'triceps']);
    expect(ex.equipment).toEqual(['barbell']);
    expect(ex.instructions).toBe('Lie on bench, press bar upward.');
    expect(ex.createdAt).toBe(NOW);
    expect(ex.licence).toBe('CC-BY-SA 4');
    expect(ex.author).toBe('Roger Reyes');
    expect(ex.sourceUrl).toBe('https://wger.de/en/exercise/192/view/');
  });

  it('strips HTML and collapses whitespace in instructions', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        translations: [
          {
            language: 2,
            name: 'Squat',
            description:
              '<ol><li>Stand with feet shoulder-width apart.</li>\n' +
              '<li>Lower hips until thighs parallel.</li></ol>',
          },
        ],
      }),
      NOW
    );
    expect(result.exercise?.instructions).toBe(
      'Stand with feet shoulder-width apart. Lower hips until thighs parallel.'
    );
  });

  it('normalises em dashes and en dashes in text to plain hyphens', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        translations: [
          {
            language: 2,
            name: `Row ${EM_DASH} Barbell`,
            description: `<p>Pull bar toward hips ${EN_DASH} keep back flat.</p>`,
          },
        ],
      }),
      NOW
    );
    expect(result.exercise?.name).toBe('Row - Barbell');
    expect(result.exercise?.instructions).toBe('Pull bar toward hips - keep back flat.');
  });

  it('skips entries with no English translation and no top-level name', () => {
    const result = WgerExerciseAdapter.adapt(baseExercise({ translations: [] }), NOW);
    expect(result.exercise).toBeNull();
    expect(result.skipReason).toBe('no English name');
  });

  it('skips entries whose English translation has an empty name', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        translations: [{ language: 2, name: '   ', description: '<p>x</p>' }],
      }),
      NOW
    );
    expect(result.skipReason).toBe('no English name');
  });

  it('skips entries with no licence object', () => {
    const result = WgerExerciseAdapter.adapt(baseExercise({ license: null }), NOW);
    expect(result.exercise).toBeNull();
    expect(result.skipReason).toBe('no licence');
  });

  it('skips entries whose licence has an empty short name', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        license: { id: 0, short_name: '   ' },
      }),
      NOW
    );
    expect(result.skipReason).toBe('no licence');
  });

  it('falls back to primary muscle name when name_en is missing', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        muscles: [{ id: 7, name: 'Biceps' }],
        muscles_secondary: [],
      }),
      NOW
    );
    expect(result.exercise?.muscles).toEqual(['biceps']);
  });

  it('deduplicates muscle names across primary and secondary groups', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        muscles: [{ id: 4, name: 'x', name_en: 'Chest' }],
        muscles_secondary: [{ id: 4, name: 'x', name_en: 'Chest' }],
      }),
      NOW
    );
    expect(result.exercise?.muscles).toEqual(['chest']);
  });

  it('uses the community fallback when license_author is empty', () => {
    const result = WgerExerciseAdapter.adapt(baseExercise({ license_author: '' }), NOW);
    expect(result.exercise?.author).toBe('wger community');
  });

  it('uses the community fallback when license_author is missing', () => {
    const result = WgerExerciseAdapter.adapt(baseExercise({ license_author: null }), NOW);
    expect(result.exercise?.author).toBe('wger community');
  });

  it('builds a slug of the form <kebab-name>-<wger-id>', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        id: 404,
        translations: [{ language: 2, name: 'Overhead Shoulder Press', description: '<p>...</p>' }],
      }),
      NOW
    );
    expect(result.exercise?.slug).toBe('overhead-shoulder-press-404');
  });

  it('falls back to wger-<id> when the name has no slug-safe characters', () => {
    const result = WgerExerciseAdapter.adapt(
      baseExercise({
        id: 777,
        translations: [{ language: 2, name: '???', description: '<p>...</p>' }],
      }),
      NOW
    );
    expect(result.exercise?.slug).toBe('wger-777');
  });
});
