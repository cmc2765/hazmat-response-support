# Chemical Companion transportation-identifier linkage gaps

## Current status

The current architecture audit reports:

- 1,980 distinct transportation-identifier records in the latest U.S. ERG relationship set
- 0 reviewed links imported into the Chemical Companion master
- 1,980 transportation identifiers awaiting evidence review
- 1,459 source chemical records

Transportation identifiers are intentionally counted separately from the Chemical
Companion master. They are not promoted into master identity fields and are not treated
as linked merely because a UN/NA value or shipping-name string resembles a master row.

No unlinked identifier is assumed to be chemical-linkable. The current aggregate
snapshot and complete 1,980-record review inventory are in
`data/chemical-companion-linkage-coverage.json`. Operational guidance remains blocked
for every record until its link is reviewed and approved.

## Required categories

Every reviewed unlinked identifier must be assigned exactly one category:

1. `chemical-linkable`
2. `mixture/product-name`
3. `synonym/alias`
4. `generic-class`
5. `transportation-only-identifier`
6. `duplicate/format-variant`
7. `deprecated/obsolete`
8. `non-chemical-administrative-entry`
9. `unknown/requires-review`

Uncertain matches must keep the resolution `requires review`. A link requires direct
source evidence; string similarity alone is not sufficient.

## Coverage and import guardrail

`validateLinkageCoverage` reports total, imported, unlinked, categorized,
chemical-linkable target, resolved, unresolved, and percentage coverage. A future import
is enforcement-ready only when:

- every unlinked source row is retained in the review inventory;
- the inventory count matches the audit's unlinked count;
- every resolved row has evidence;
- every linked row has a selected Chemical ID; and
- unknown rows remain `requires review`.

The current snapshot is valid as an honest baseline but is **not enforcement-ready**.

## Next linkage task

The 1,980 unique transportation identifiers are exported with stable source IDs, UN/NA
value, proper shipping names, guidebook/country context, and source relationship IDs.
They deliberately remain `unknown/requires-review`. Run
`npm --prefix server run chemicals:export-unlinked` to reproduce the inventory.

Review and categorize every record with evidence without changing production Chemical
ID lookup. Only reviewed
`chemical-linkable` records should move into a proposed-link file for separate approval.
Inventory completeness alone does not make the linkage enforcement-ready.
