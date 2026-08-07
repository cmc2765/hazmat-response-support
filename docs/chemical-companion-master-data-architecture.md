# Chemical Companion master-data architecture

## Governing rule

> Chemical Companion is the master chemical identity dataset for HazMatIQ. Other
> datasets such as CAMEO, ALOHA, ERG, NIOSH, SDS, and Census are linked source
> layers. They must not overwrite the Chemical Companion master record unless a
> reviewed mapping explicitly allows it.

The committed `data/ChemicalCompanionDB.db` `chemicals.ChemicalID` is the master key.
The older application `chemicals` table contains a CAMEO-derived application dataset;
it is a linked source layer and is not an alternate master identity authority.

## Relationship model

```text
Chemical Companion chemicals.ChemicalID
├── chemical_transport_link → transportation_identifier
├── chemical_source_link → CAMEO / ALOHA / ERG / NIOSH / SDS / approved source
└── chemical_source_fact → source-specific, non-destructive facts
```

`transportation_identifier` stores shipping identity independently. A row may exist
without a chemical link. `chemical_transport_link` is the only allowed bridge to a
master chemical and must retain link type, confidence, review status, reviewer, and
review time. Allowed link types are `exact_chemical_match`, `synonym_or_alias`,
`mixture_or_solution`, `generic_transport_class`, `transportation_only`,
`duplicate_or_format_variant`, `deprecated_or_obsolete`, `requires_review`, and
`rejected`.

`chemical_source_link` records why a source record maps to a master. Facts remain in
`chemical_source_fact` with source, version, units, status, and limitations so one
source cannot silently overwrite another.

## Enforcement rules

- Master records rank before transport records in Chemical ID search.
- Shipping-name family similarity is not a chemical link.
- Unreviewed transport records have `guidanceEligible: false` and cannot open a
  chemical profile or populate plume, PPE, decon, or medical guidance.
- A master record may be found through its own Chemical Companion name, CAS, synonym,
  or primary UN/NA field without converting a transport record into a master.
- Missing facts display `No Current Data Exists`.
- Source badges distinguish `Chemical Companion Master`, linked source layers,
  `Transportation Identifier`, and `Requires Review`.

The schema and migration are scaffolding. They do not claim that any relationship has
been reviewed. The generated linkage inventory retains every unique latest-US-book
transport identifier as `unknown/requires-review` until evidence is recorded.

## Threat-zone relationship

Census and mapped-building results attach to a plume-zone estimate, not to the master
chemical identity. Intersecting Census totals are nearby-geography context. They are
never exact impacted population or household counts unless a future reviewed method
demonstrates full coverage or performs an approved spatial allocation.
