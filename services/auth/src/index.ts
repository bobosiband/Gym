/**
 * Entry barrel. Lambda entry points live under `./lambdas/`; each one
 * exports its own `handler` function that CDK targets individually.
 * There is no shared default export because Lambdas are deployed as
 * separate functions.
 */
export { AuthService, AuthPolicy } from './service/AuthService.js';
export { AuthServiceError } from './service/AuthServiceErrors.js';
export type { AuthServiceDeps, IssuedTokens } from './service/AuthService.js';
export { AuthServiceFactory, type AuthRuntime } from './service/AuthServiceFactory.js';
