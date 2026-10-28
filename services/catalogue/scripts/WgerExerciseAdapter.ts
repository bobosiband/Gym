import type { CatalogueApi } from '@gym/contracts';

import type { WgerExercise, WgerTranslation } from './WgerExercise.js';

/**
 * The language id wger uses for English in `translations[].language`.
 */
const ENGLISH_LANGUAGE_ID = 2;

/**
 * Fallback author when the upstream `license_author` is empty.
 *
 * wger allows anonymous contributions; the import should still carry a
 * non-empty attribution string so the DB NOT NULL constraint holds and
 * the API response has something to display.
 */
const UNKNOWN_AUTHOR = 'wger community';

/**
 * Max slug length before the wger id suffix is appended.
 */
const SLUG_BASE_MAX_LENGTH = 50;

export type SkipReason = 'no English name' | 'no licence';

/**
 * Result of adapting one upstream exercise.
 *
 * Exactly one of `exercise` or `skipReason` is non-null. Callers tally the
 * skipReason strings to produce the import summary.
 */
export interface AdaptResult {
  readonly exercise: CatalogueApi.Exercise | null;
  readonly skipReason: SkipReason | null;
}

/**
 * Converts raw wger exercises into our `CatalogueApi.Exercise` shape.
 *
 * Stateless; use via static methods. Instances are not needed.
 */
export class WgerExerciseAdapter {
  private constructor() {
    // utility class; never instantiated
  }

  /**
   * Adapt one upstream exercise. Returns `{ exercise, skipReason: null }`
   * on success, or `{ exercise: null, skipReason }` when a required field
   * is missing. The caller logs the counts for each skipReason.
   *
   * @param raw - the upstream exercise, as returned by exerciseinfo.
   * @param now - the ISO timestamp recorded as `createdAt`. Injected for
   *   deterministic tests; the importer passes `new Date().toISOString()`.
   */
  public static adapt(raw: WgerExercise, now: string): AdaptResult {
    const name = WgerExerciseAdapter.englishName(raw);
    if (name === null) {
      return { exercise: null, skipReason: 'no English name' };
    }

    const licence = raw.license;
    if (licence == null || !licence.short_name || licence.short_name.trim().length === 0) {
      return { exercise: null, skipReason: 'no licence' };
    }

    const descriptionHtml = WgerExerciseAdapter.englishDescription(raw);
    const instructions = WgerExerciseAdapter.normaliseText(
      WgerExerciseAdapter.stripHtml(descriptionHtml)
    );

    const exercise: CatalogueApi.Exercise = {
      id: `wger-${raw.id}`,
      slug: WgerExerciseAdapter.buildSlug(name, raw.id),
      name: WgerExerciseAdapter.normaliseText(name),
      muscles: WgerExerciseAdapter.collectMuscleNames(raw),
      equipment: WgerExerciseAdapter.collectEquipmentNames(raw),
      instructions,
      createdAt: now,
      licence: licence.short_name.trim(),
      author: WgerExerciseAdapter.pickAuthor(raw.license_author),
      sourceUrl: `https://wger.de/en/exercise/${raw.id}/view/`,
    };
    return { exercise, skipReason: null };
  }

  private static englishName(raw: WgerExercise): string | null {
    const translation = WgerExerciseAdapter.findEnglishTranslation(raw);
    const candidates = [translation?.name, raw.name];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  }

  private static englishDescription(raw: WgerExercise): string {
    const translation = WgerExerciseAdapter.findEnglishTranslation(raw);
    return translation?.description ?? raw.description ?? '';
  }

  private static findEnglishTranslation(raw: WgerExercise): WgerTranslation | undefined {
    return raw.translations?.find((t) => t.language === ENGLISH_LANGUAGE_ID);
  }

  private static pickAuthor(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return UNKNOWN_AUTHOR;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? WgerExerciseAdapter.normaliseText(trimmed) : UNKNOWN_AUTHOR;
  }

  private static collectMuscleNames(raw: WgerExercise): readonly string[] {
    const primary = raw.muscles.map((m) => (m.name_en ?? m.name).toLowerCase().trim());
    const secondary = (raw.muscles_secondary ?? []).map((m) =>
      (m.name_en ?? m.name).toLowerCase().trim()
    );
    const combined = [...primary, ...secondary].filter((v) => v.length > 0);
    return Array.from(new Set(combined));
  }

  private static collectEquipmentNames(raw: WgerExercise): readonly string[] {
    const names = raw.equipment.map((e) => e.name.toLowerCase().trim()).filter((v) => v.length > 0);
    return Array.from(new Set(names));
  }

  private static buildSlug(name: string, wgerId: number): string {
    const base = WgerExerciseAdapter.slugify(name);
    if (base.length === 0) return `wger-${wgerId}`;
    return `${base}-${wgerId}`;
  }

  private static slugify(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, SLUG_BASE_MAX_LENGTH)
      .replace(/-+$/g, '');
  }

  private static stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static normaliseText(text: string): string {
    return text
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
