/**
 * Result of running the smoke test battery.
 */
export interface SmokeTestResult {
  readonly passed: number;
  readonly failed: number;
  readonly failures: readonly SmokeTestFailure[];
}

/**
 * A single check failure, with the label and the message that explains it.
 */
export interface SmokeTestFailure {
  readonly label: string;
  readonly message: string;
}

interface Check {
  readonly label: string;
  run(baseUrl: string): Promise<void>;
}

/**
 * Hits a deployed catalogue instance over HTTP and asserts the three
 * must-work paths: `/health`, `/exercises`, and one `/exercises/:slug`.
 *
 * This is a smoke test, not an exhaustive integration test. Use it after
 * `wrangler deploy` to confirm the deploy worked end to end.
 */
export class SmokeTest {
  private readonly checks: readonly Check[];

  public constructor(private readonly baseUrl: string) {
    this.checks = SmokeTest.buildChecks();
  }

  public async run(): Promise<SmokeTestResult> {
    const failures: SmokeTestFailure[] = [];
    let passed = 0;
    for (const check of this.checks) {
      try {
        await check.run(this.baseUrl);
        passed += 1;
      } catch (err) {
        failures.push({
          label: check.label,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { passed, failed: failures.length, failures };
  }

  private static buildChecks(): readonly Check[] {
    return [
      {
        label: 'GET /health -> 200 {status: "ok"}',
        async run(baseUrl: string): Promise<void> {
          const response = await fetch(`${baseUrl}/health`);
          if (response.status !== 200) {
            throw new Error(`expected 200, got ${response.status}`);
          }
          const body = (await response.json()) as { status?: string };
          if (body.status !== 'ok') {
            throw new Error(`expected status=ok, got ${JSON.stringify(body)}`);
          }
        },
      },
      {
        label: 'GET /exercises -> 200 with cache-control and non-empty list',
        async run(baseUrl: string): Promise<void> {
          const response = await fetch(`${baseUrl}/exercises?limit=1`);
          if (response.status !== 200) {
            throw new Error(`expected 200, got ${response.status}`);
          }
          const cc = response.headers.get('cache-control');
          if (cc === null || !cc.includes('max-age')) {
            throw new Error(`cache-control missing or malformed: ${cc}`);
          }
          const body = (await response.json()) as {
            exercises?: unknown[];
            total?: number;
          };
          if (!Array.isArray(body.exercises) || body.exercises.length === 0) {
            throw new Error('body.exercises is empty or missing');
          }
          if (typeof body.total !== 'number') {
            throw new Error('body.total is not a number');
          }
        },
      },
      {
        label: 'GET /exercises/:slug of first result -> 200 with attribution',
        async run(baseUrl: string): Promise<void> {
          const listRes = await fetch(`${baseUrl}/exercises?limit=1`);
          const list = (await listRes.json()) as {
            exercises?: Array<{ slug?: string }>;
          };
          const slug = list.exercises?.[0]?.slug;
          if (typeof slug !== 'string' || slug.length === 0) {
            throw new Error('no slug available in list response to probe detail');
          }
          const detailRes = await fetch(`${baseUrl}/exercises/${slug}`);
          if (detailRes.status !== 200) {
            throw new Error(`detail ${slug}: expected 200, got ${detailRes.status}`);
          }
          const detail = (await detailRes.json()) as {
            exercise?: { licence?: string; author?: string; sourceUrl?: string };
          };
          const exercise = detail.exercise;
          if (
            exercise === undefined ||
            typeof exercise.licence !== 'string' ||
            typeof exercise.author !== 'string' ||
            typeof exercise.sourceUrl !== 'string'
          ) {
            throw new Error(`detail ${slug}: missing attribution fields`);
          }
        },
      },
    ];
  }
}
