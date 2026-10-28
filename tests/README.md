# tests/

All tests live here, in folders that mirror `apps/`, `services/`, and `packages/`. Each service's tests go in `tests/<service-name>/`; cross-service flows go in `tests/e2e/`; contract and schema tests go in `tests/contracts/`.

- One test runner per language, invoked by the service's own `test` script.
- `pnpm -r --if-present run test` from the repo root runs every test suite that has one.
- Integration tests must hit a real local database (DynamoDB Local, D1 local, etc.) rather than mocks, so mock-prod drift cannot hide a broken migration.
