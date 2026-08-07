# ADR 0001: Platform data architecture before broader storage

- **Status:** Proposed — decision required
- **Date:** 2026-07-29
- **Blocks:** general apparatus/PPE inventory, ePCR, NERIS, broad agency storage

## Context

HazMatIQ must remain usable by incident command when connectivity is absent, while later
supporting station administration, cross-device persistence, reporting, and potentially
multiple agencies. The existing app uses browser local storage for active workflow data,
local SQLite for server data, and a full-snapshot sync scaffold. That is not yet a
multi-user synchronization design.

## Options

### A. Local SQLite plus synchronization

Advantages:

- field operation continues without WAN connectivity;
- station/device caches can start instantly;
- incident command is not blocked by hosted-service availability; and
- sensitive incident data can remain within agency-controlled deployments.

Costs:

- conflict resolution, revision tracking, identity, permissions, and migrations are
  substantially harder;
- every offline writer needs deterministic merge rules; and
- delayed synchronization complicates audit and retention.

### B. Centralized hosted database

Advantages:

- simpler authoritative ownership, permission, audit, retention, and reporting;
- easier cross-station administration and multi-agency sharing; and
- fewer data reconciliation paths when online.

Costs:

- WAN failure can impair field use without a separately designed offline cache;
- hosted security, availability, compliance, and operating cost become critical; and
- incident command needs an explicit degraded/offline workflow.

## Recommendation

The safer direction for responder use appears to be **local-first incident operation
with a hosted synchronization and administration control plane**. This combines a
transactional local SQLite cache for field continuity with a centralized authority for
identity, policy, administrative inventory, reporting, and durable audit.

This is a recommendation, not an approved implementation decision. No broader storage
schema should be added until the following contract is approved.

## Required domain contract

| Concern | Required decision |
|---|---|
| Organization | Stable agency ID; tenant boundary; legal data owner |
| Station | Organization-scoped station ID and cache policy |
| Apparatus | Organization/station ownership, unit identity, lifecycle |
| User | Identity provider, role, agency membership, offline credentials |
| Device | Stable device ID, enrollment, revocation, last synchronization |
| Revision | Immutable revision ID, author/device, timestamps, parent revision |
| Ownership | Record owner versus operational custodian and sharing scope |
| Permissions | Role and incident-based read/write/export authorization |
| Offline behavior | Which writes are allowed offline and how long credentials/cache remain valid |
| Sync behavior | Pull/push protocol, idempotency, tombstones, retry, partial failure |
| Conflict resolution | Field-specific merge, last-writer restrictions, human review queue |
| Audit trail | Append-only actor/device/action/before/after record |
| Incident ownership | Lead agency, transfers, mutual-aid access, closure |
| Data retention | Per-record retention, legal holds, deletion and export |
| Multi-agency support | Explicit sharing grants; no implicit cross-tenant visibility |
| Export strategy | Versioned open export, attachments, provenance, audit metadata |

## Responder-use constraints

- Incident command must start and continue offline.
- Station caches must be scoped and preloaded before deployment.
- Device-specific field changes must retain device and user provenance.
- Reconnection conflicts affecting safety data must require review, not silent overwrite.
- Hosted administration/reporting may be delayed without blocking local incident work.

## Consequence

General apparatus, PPE, ePCR, NERIS, and broad agency storage remain blocked until this
ADR is accepted or replaced by a different approved decision.
