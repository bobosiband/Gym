/**
 * Lambda runtime environment contract.
 *
 * The CDK stack sets these on every Lambda; the factory reads them
 * at cold start and never again. See `infra/progress/lib/
 * ProgressStack.ts` for the authoritative list.
 */
export interface Env {
  readonly AWS_REGION: string;
  readonly STATE_TABLE_NAME: string;
  readonly PROCESSED_EVENT_TABLE_NAME: string;
  readonly EVENT_BUS_NAME: string;
  readonly SSM_PARAM_PREFIX: string;
}

export class EnvReader {
  private constructor() {
    // utility class; never instantiated
  }

  public static readFromProcess(): Env {
    const region = EnvReader.required('AWS_REGION');
    return {
      AWS_REGION: region,
      STATE_TABLE_NAME: EnvReader.required('STATE_TABLE_NAME'),
      PROCESSED_EVENT_TABLE_NAME: EnvReader.required('PROCESSED_EVENT_TABLE_NAME'),
      EVENT_BUS_NAME: EnvReader.required('EVENT_BUS_NAME'),
      SSM_PARAM_PREFIX: EnvReader.required('SSM_PARAM_PREFIX'),
    };
  }

  private static required(name: string): string {
    const value = process.env[name];
    if (value === undefined || value.length === 0) {
      throw new Error(`Env: missing required variable ${name}`);
    }
    return value;
  }
}
