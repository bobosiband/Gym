# @gym/contracts

Shared event and API contracts.

## Layout

```
src/
  events/   one file per event, named <event>.v<n>.ts
  api/      one folder per service, each with request and response types
  index.ts  top-level entry (empty in Stage 1)
```

## Versioning

Any change to an existing event or API schema is a **breaking change** and requires owner approval before merging. Breaking changes bump the version in the filename and in the event or route name (for example, `workout.logged.v1.ts` to `workout.logged.v2.ts`). The old version coexists with the new one until every consumer has migrated. The old version is removed only after the owner confirms.

See `docs/events.md` for the catalogue of events and the full versioning rule.
