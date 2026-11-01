import type { AuthApiClient } from '../api/AuthApiClient.js';
import type { CatalogueApiClient } from '../api/CatalogueApiClient.js';
import type { LoggingApiClient } from '../api/LoggingApiClient.js';
import type { AuthorizedRequest } from '../auth/AuthorizedRequest.js';
import type { SessionManager } from '../auth/SessionManager.js';
import type { Navigator as AppNavigator } from '../routing/Navigator.js';

/**
 * Dependency bundle passed down through React context so that
 * screens receive their collaborators by injection rather than by
 * importing singletons. Tests build this record directly with
 * in-memory fakes.
 */
export interface AppDependencies {
  readonly authApi: AuthApiClient;
  readonly loggingApi: LoggingApiClient;
  readonly catalogueApi: CatalogueApiClient;
  readonly session: SessionManager;
  readonly authorized: AuthorizedRequest;
  readonly navigator: AppNavigator;
  readonly newIdempotencyKey: () => string;
}
