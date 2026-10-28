# Data and media sources

Every dataset and image set used in Gym must be listed here with its licence and commercial-reuse status before any file from it is committed or shipped. The owner approves each source before it is used.

## Exercise data

| Source           | URL                                         | Licence                                                                                                                     | Commercial reuse                                                                                        | Status                                                                                                                                                       |
| ---------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| wger             | https://wger.de                             | Per-entry; one of CC-BY-SA 3.0, CC-BY-SA 4.0, CC-BY 4.0, CC0, or ODbL. Entries without a licence are skipped during import. | Yes (all five permit commercial reuse with attribution except CC0 which has no attribution requirement) | **Approved by owner on 2026-10-29.** Imported via `services/catalogue/scripts/importWger.ts`. Attribution stored per-exercise and returned in API responses. |
| Free Exercise DB | https://github.com/yuhonas/free-exercise-db | Unlicense (public domain)                                                                                                   | Yes                                                                                                     | Licence recorded on 2026-10-29. **Not imported.** Reserved for later if additional exercises are needed.                                                     |
| ExerciseDB       | https://exercisedb.p.rapidapi.com           | TODO (owner to confirm; paid tiers exist)                                                                                   | TODO                                                                                                    | Candidate only; must stay on free tier if ever used.                                                                                                         |

### Licence URLs for wger per-entry licences

The wger API returns a licence object per exercise. Our import script skips any exercise without one of these licences:

| Short name | Full licence URL                                       |
| ---------- | ------------------------------------------------------ |
| CC-BY-SA 3 | https://creativecommons.org/licenses/by-sa/3.0/deed.en |
| CC-BY-SA 4 | https://creativecommons.org/licenses/by-sa/4.0/deed.en |
| CC-BY 4    | https://creativecommons.org/licenses/by/4.0/           |
| CC0        | https://creativecommons.org/publicdomain/zero/1.0/     |
| ODbL       | https://opendatacommons.org/licenses/odbl/             |

Authoritative source of the wger licence list: https://github.com/wger-project/wger/blob/master/wger/core/fixtures/licenses.json

### Attribution requirements

Every exercise returned by `services/catalogue` includes the per-entry `licence` and `author` fields. Clients that redistribute catalogue content must preserve these fields and include them in any UI that shows exercise information, in line with the licence terms.

## Image and GIF sources

| Source    | URL | Licence | Commercial reuse | Status                                         |
| --------- | --- | ------- | ---------------- | ---------------------------------------------- |
| (Pending) |     | TODO    | TODO             | Add rows here before uploading any media to R2 |

## Review checklist for a new source

Before adding a row above and importing any file:

1. Confirm the licence allows redistribution with attribution.
2. Confirm commercial reuse is permitted, or acknowledge that commercial use is reserved for later approval.
3. Record the exact licence text URL (not just the licence name) in the row.
4. Record which files were imported and when (git history is sufficient).
5. If attribution is required, make sure it appears in `docs/SOURCES.md` and in the service that serves the data.
