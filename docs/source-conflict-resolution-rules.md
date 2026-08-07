# Source conflict resolution rules

## Core policy

Preserve every source assertion. Never silently overwrite the Chemical Companion
master value. Every conflict is `resolved`, `source-displayed`, `needs review`, or
`blocked`; unresolved conflicts cannot support confident operational guidance.

## Source-purpose ranking

1. **Chemical Companion** — master identity and tactical chemical record.
2. **ERG** — transport guide, isolation/protective actions, and transport response.
3. **CAMEO Chemicals** — datasheets, hazards, reactivity, and response facts.
4. **ALOHA** — model compatibility, inputs, and modeled outputs.
5. **NIOSH** — exposure, IDLH, health, and PPE references.
6. **SDS/manufacturer** — verified product-specific and material/suit compatibility.
7. **Census** — population/housing estimates or geography totals, never field counts.

This ordering is by purpose, not blanket quality. A source controls only the field
domain for which it is authoritative and current.

## Conflict rules

| Conflict | Handling |
|---|---|
| Chemical name | Retain Chemical Companion name; display linked source name as an alias only after review. |
| CAS | Do not replace the master CAS. Block the mapping until substance/form/salt differences are reviewed. |
| UN/NA | Keep the transport record separate. Link only through `chemical_transport_link`. |
| ERG guide | Display the ERG value with edition and transport context; do not rewrite master identity. |
| Physical property | Preserve both values, units, conditions, versions, and sources. |
| PPE/suit | Require chemical/form and product-specific evidence; conflicts block a recommendation. |
| Protective action | Keep ERG initial actions distinct from model planning estimates. |
| Plume value | Preserve model/version/input provenance; incompatible models are not averaged. |
| Household estimate | Separate footprint structures, impacted-household estimate, and nearby Census geography total. |

Resolution requires an attributable reviewer, date, evidence locator, decision, and
scope. String similarity by itself is never evidence for a chemical-specific link.
