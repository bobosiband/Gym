/**
 * Shared event and API contracts for Gym services.
 *
 * Event schemas live under `./events/`; HTTP API schemas live under `./api/`.
 * Both folders are populated as each service is built.
 *
 * Any change to an existing schema is a breaking change and requires explicit
 * owner approval before merging. See `docs/events.md` for the versioning rule.
 */

export * as CatalogueApi from './api/catalogue.js';
export * as AuthApi from './api/auth.js';
export * as UserRegisteredV1Event from './events/userRegistered.v1.js';
