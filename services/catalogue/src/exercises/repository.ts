import type { CatalogueApi } from '@gym/contracts';

import { formatExerciseFromRow } from './parse.js';
import type { ExerciseRow, ListParams } from './parse.js';

/**
 * Read-only data access for the catalogue. Depending on the interface
 * (rather than the D1 implementation) keeps the HTTP handlers unit-testable
 * and lets later stages swap in alternative stores if ever needed.
 */
export interface ExerciseRepository {
  listExercises(params: ListParams): Promise<readonly CatalogueApi.Exercise[]>;
  countExercises(params: ListParams): Promise<number>;
  getExerciseBySlug(slug: string): Promise<CatalogueApi.Exercise | null>;
}

interface CountRow {
  readonly total: number;
}

/**
 * Cloudflare D1-backed `ExerciseRepository`.
 *
 * `muscles` and `equipment` filters use `LIKE '%"<value>"%'` against the
 * JSON-encoded array columns. This matches a value exactly, since each
 * stored item is JSON-encoded with surrounding quotes.
 */
export class D1ExerciseRepository implements ExerciseRepository {
  constructor(private readonly db: D1Database) {}

  async listExercises(params: ListParams): Promise<readonly CatalogueApi.Exercise[]> {
    const { clauses, binds } = buildFilter(params);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT id, slug, name, muscles, equipment, instructions, createdAt
                 FROM exercises
                 ${whereClause}
                 ORDER BY name ASC
                 LIMIT ? OFFSET ?`;
    const stmt = this.db.prepare(sql).bind(...binds, params.limit, params.offset);
    const result = await stmt.all<ExerciseRow>();
    const rows = result.results ?? [];
    return rows.map(formatExerciseFromRow);
  }

  async countExercises(params: ListParams): Promise<number> {
    const { clauses, binds } = buildFilter(params);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) AS total FROM exercises ${whereClause}`;
    const stmt = this.db.prepare(sql).bind(...binds);
    const row = await stmt.first<CountRow>();
    return row?.total ?? 0;
  }

  async getExerciseBySlug(slug: string): Promise<CatalogueApi.Exercise | null> {
    const sql = `SELECT id, slug, name, muscles, equipment, instructions, createdAt
                 FROM exercises
                 WHERE slug = ?
                 LIMIT 1`;
    const stmt = this.db.prepare(sql).bind(slug);
    const row = await stmt.first<ExerciseRow>();
    if (row === null) return null;
    return formatExerciseFromRow(row);
  }
}

interface FilterParts {
  readonly clauses: readonly string[];
  readonly binds: readonly string[];
}

function buildFilter(params: ListParams): FilterParts {
  const clauses: string[] = [];
  const binds: string[] = [];
  if (params.muscle !== null) {
    clauses.push('muscles LIKE ?');
    binds.push(`%"${params.muscle}"%`);
  }
  if (params.equipment !== null) {
    clauses.push('equipment LIKE ?');
    binds.push(`%"${params.equipment}"%`);
  }
  return { clauses, binds };
}
