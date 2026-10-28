/**
 * Raw wger API shapes, mirroring the fields on `GET /api/v2/exerciseinfo/`.
 *
 * These interfaces intentionally use the snake_case field names from the
 * upstream JSON so the mapping is one-to-one and the import script does
 * not need an extra renaming layer.
 */

export interface WgerLicence {
  readonly id: number;
  readonly full_name?: string;
  readonly short_name: string;
  readonly url?: string;
}

export interface WgerMuscle {
  readonly id: number;
  readonly name: string;
  readonly name_en?: string;
}

export interface WgerEquipment {
  readonly id: number;
  readonly name: string;
}

export interface WgerTranslation {
  readonly language: number;
  readonly name: string;
  readonly description: string;
}

export interface WgerExercise {
  readonly id: number;
  readonly uuid?: string;
  readonly name?: string;
  readonly description?: string;
  readonly translations?: readonly WgerTranslation[];
  readonly muscles: readonly WgerMuscle[];
  readonly muscles_secondary?: readonly WgerMuscle[];
  readonly equipment: readonly WgerEquipment[];
  readonly license?: WgerLicence | null;
  readonly license_author?: string | null;
}

export interface WgerPage {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly WgerExercise[];
}
