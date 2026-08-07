# Normalized ERG data staging plan

## Status and compatibility rule

The normalized ERG schema is **staged for ingestion validation only**. The production
`erg_table_1` table, seed process, API routes, and Chemical ID lookup remain unchanged.
There is no normalized-schema feature flag yet; current flat-schema behavior is the
default and only production path.

The SQL scaffold is `server/migrations/0001_normalized_erg_staging.sql`. Its
`erg_norm_*` prefix prevents collisions and makes the staging boundary explicit.

## Staged entities

| Required concept | Staged table | Purpose |
|---|---|---|
| guidebook | `erg_norm_guidebook` | Country, edition, title, current-edition marker |
| material | `erg_norm_material` | Canonical ERG material identity |
| material identifier | `erg_norm_material_identifier` | Material-to-UN/NA/shipping-name relationship |
| UN/NA identifier | `erg_norm_un_na_identifier` | Structured transportation identifier |
| guide | `erg_norm_guide` | Numbered response guide within a guidebook |
| Table 1 | `erg_norm_table_1` | Spill size and day/night isolation/protective distances |
| Table 2 | `erg_norm_table_2` | Water-reactive toxic-gas products |
| Table 3 | `erg_norm_table_3` | Container, wind band, period, and distances |
| container | `erg_norm_container` | Reusable Table 3 container lookup |
| wind band | `erg_norm_wind_band` | Reusable Table 3 wind classification |
| source | `erg_norm_source` | Citation, license/permission, URL, retrieval date |
| revision | `erg_norm_revision` | Edition/import revision and checksum |

## Import validation

`server/src/erg/normalized-erg-validation.ts` validates an import bundle without
writing to either staging or production tables. It reports:

- imported row counts by table;
- rejected references grouped by reason;
- warning and error totals; and
- material/identifier and Table 1/2/3 coverage.

Checks include duplicate UN/NA identifiers, missing material names, missing guide
numbers, invalid table/container/wind references, orphaned guides, orphaned material
identifiers, and source/revision completeness.

## Cutover gates

Do not switch production reads until all of the following are complete:

1. An authorized ERG source and repeatable parser are selected.
2. The normalized import has zero referential/provenance errors.
3. Table 1, Table 2, Table 3, TIH, water-reactive, guide, and shipping-name coverage is measured.
4. Current flat lookups and normalized lookups match for a reviewed regression set.
5. Migration and rollback procedures are tested against a copy of the application DB.
6. Chemical ID, incident snapshots, and ERG API contracts have compatibility tests.
7. A separate approval explicitly enables normalized production reads.

The current curated baseline contains 43 Table 1 records and 22 Table 3 rows covering
six materials; expansion should be measured against those known counts.
