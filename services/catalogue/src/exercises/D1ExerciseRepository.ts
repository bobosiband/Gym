import type { CatalogueApi } from '@gym/contracts';

import { ExerciseFormatter } from './ExerciseFormatter.js';
import type { ExerciseRepository } from './ExerciseRepository.js';
import type { ExerciseRow } from './ExerciseRow.js';
import type { ListParams } from './ListParams.js';

interface CountRow {
  readonly total: number;
}

interface FilterParts {
  readonly clauses: readonly string[];
  readonly binds: readonly string[];
}

/**
 * Cloudflare D1-backed `ExerciseRepository`.
 *
 * `muscles` and `equipment` filters use `LIKE '%"<value>"%'` against the
 * JSON-encoded array columns. Each stored item is JSON-encoded with
 * surrounding quotes, so the pattern matches a value exactly.
 */
export class D1ExerciseRepository implements ExerciseRepository {
  public constructor(private readonly db: D1Database) {}

  public async listExercises(params: ListParams): Promise<readonly CatalogueApi.Exercise[]> {
    const { clauses, binds } = this.buildFilter(params);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT id, slug, name, muscles, equipment, instructions, createdAt
                 FROM exercises
                 ${whereClause}
                 ORDER BY name ASC
                 LIMIT ? OFFSET ?`;
    const stmt = this.db.prepare(sql).bind(...binds, params.limit, params.offset);
    const result = await stmt.all<ExerciseRow>();
    const rows = result.results ?? [];
    return rows.map((row) => ExerciseFormatter.fromRow(row));
  }

  public async countExercises(params: ListParams): Promise<number> {
    const { clauses, binds } = this.buildFilter(params);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `SELECT COUNT(*) AS total FROM exercises ${whereClause}`;
    const stmt = this.db.prepare(sql).bind(...binds);
    const row = await stmt.first<CountRow>();
    return row?.total ?? 0;
  }

  public async getExerciseBySlug(slug: string): Promise<CatalogueApi.Exercise | null> {
    const sql = `SELECT id, slug, name, muscles, equipment, instructions, createdAt
                 FROM exercises
                 WHERE slug = ?
                 LIMIT 1`;
    const stmt = this.db.prepare(sql).bind(slug);
    const row = await stmt.first<ExerciseRow>();
    if (row === null) return null;
    return ExerciseFormatter.fromRow(row);
  }

  private buildFilter(params: ListParams): FilterParts {
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
}
