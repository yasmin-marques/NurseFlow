# Design

## Context

See `proposal.md` for motivation and the two capability boundaries. Today, `POST /escalas/gerar` creates or replaces a draft and `GET /escalas/:id` reads it. `Escala` has only `rascunho`, `publicada` and `finalizada`; `escalas` has a unique `(ano, mes)` index, while shifts and their professional assignments are stored in separate collections. The React navigation already exposes an Escala item, but `App.tsx` renders a placeholder for it. The generator already validates availability, rest, workload and staffing minimums and returns uncovered positions, conflicts, warnings and workload totals.

The local MongoDB Compose service currently runs as a standalone server. Multi-document transactions therefore require an explicit single-node replica-set configuration and matching integration-test setup.

## Goals / Non-Goals

**Goals:**

- Reuse existing domain rules and optimizer results while adding complete API/UI flows around them.
- Keep the published version stable while allowing a later revision to be prepared and reviewed.
- Keep writes, status transitions, audit/version records and notifications consistent under retries and concurrent requests.
- Make scale operations usable from the monthly/weekly calendar and grouped review screens represented in `imagens_exemplo/`.

**Non-Goals:**

- Implement staff-to-staff shift exchanges or unrelated notification categories.
- Import, OCR, parse or display the source documents and prototype images as user-uploaded content.
- Change professional, sector, restriction or configuration CRUD beyond the fields/operations needed to select eligible data for a scale.

## Decisions

### Keep one scale aggregate per month and add immutable publication snapshots

Retain the unique `(ano, mes)` `Escala` record as the working aggregate, with its `plantoes` and professional links. Extend it with an explicit workflow state, revision counter, validation result and current published-version number. Add an immutable publication-version record containing the period, version number, author/time and a complete snapshot of the published scale and its coverage results.

Publishing appends a snapshot. Starting a revision from a published scale copies the latest published snapshot into the working aggregate; subsequent edits affect only the draft. Staff reads and exports resolve the latest published snapshot, never the mutable draft. This preserves the current one-record-per-month model and index while supporting auditable published revisions. A separate `Escala` document per version was considered, but it conflicts with the existing unique period index and complicates selecting the current working copy.

### Make transitions explicit and use conditional writes

Use the flow `RASCUNHO → EM_REVISAO → VALIDADA → PUBLICADA → FINALIZADA`. Any change to a reviewed/validated draft returns it to `EM_REVISAO` and invalidates prior validation. Published content is changed only by starting a new revision. Validate each transition in the API and use a revision counter in conditional updates so stale clients receive a conflict instead of overwriting newer edits. Keep the existing generation route as a compatible entry point; add focused routes for listing/creating drafts, edits, validation, publication, revision and deletion.

### Validate edits against the generation snapshot and current hard rules

Keep the generation-time configuration snapshot already stored in `Escala.geracao` as the basis for workload and limits, so later settings changes do not silently rewrite an existing draft. Reuse shared validation rules for manual edits and optimizer output: professional status and function, absence/restriction, overlapping assignments, mandatory rest, allowed 12-hour combinations, workload/extra limits and sector/shift minimums. A shortage is a visible coverage finding, not a false success; a blocking rule violation prevents saving or publication.

For the percentage shown in the prototypes, calculate coverage as `floor(100 × filled required positions / total required positions)`, capped at 100; display conflicts and other validation results separately. An empty requirement set has no percentage and must be shown as unavailable, not 100%.

### Persist version, audit and notifications transactionally

Use MongoDB sessions for operations that change the working aggregate, plantões, professional links, immutable publication snapshots, audit records or notifications. Configure the local MongoDB as a single-node replica set and use a replica-set-backed in-memory MongoDB for integration tests; deployments must provide a replica set. Add an idempotency key or unique event key to publication notifications so retries cannot duplicate delivery records. Notification reads are scoped to the authenticated user.

Alternatives considered were best-effort writes with compensating deletes and a standalone Mongo deployment. They leave partially published or partially edited schedules possible, so they are not suitable for these cross-collection state changes.

### Keep API responsibilities in NestJS and the UI in the existing React app

Extend the Escalas module for draft operations, validation, transitions and access policy; add focused services for immutable versions, audit, notifications and PDF output rather than putting the lifecycle into the optimizer. The optimizer remains an internal solver and may accept sector/turn scope as required by the generation dialog. Add a front-end `Escala` page and domain service, using the existing authenticated API helper, reusable modal/layout patterns and existing visual tokens.

Render PDFs server-side from an explicit print template. Generate one complete document or one document per selected sector, including readable labels, signatures and pending coverage. A client-side print dialog was considered, but output varies by browser and cannot reliably provide the requested per-sector documents.

### Cancel generation through the server and optimizer

Each generation carries a UUID operation identifier. NestJS tracks whether the operation is optimizing, canceling or entering persistence; `DELETE /escalas/gerar/:operacaoId` requests cancellation from the optimizer and aborts the pending optimizer request. The Python service accepts cancellation independently of the solve request and calls OR-Tools `StopSearch` for an active solver. It retains a short-lived cancellation marker so a cancel request that races ahead of solver registration still prevents the solve from starting.

NestJS must reject a canceled operation before opening the persistence transaction, so cancellation never reports success after the scale has been saved. Once the operation enters the atomic save phase, cancellation returns a conflict and the generation result remains authoritative. Aborting only the browser request is not a cancellation mechanism.

## Risks / Trade-offs

- [Replica-set requirement changes local and deployment database setup] → Add a documented single-node local configuration, fail-fast startup validation, and replica-set-backed integration tests; call out the production deployment prerequisite.
- [Draft and immutable snapshot can diverge if a write is partial] → Commit lifecycle changes in MongoDB transactions and test rollback at every multi-collection boundary.
- [Optimizer timeouts can leave the user waiting] → Preserve explicit timeout/errors, show progress and retry guidance in the UI, and never present a failed generation as a saved scale.
- [A permitted publication with uncovered positions may be mistaken for a fully covered schedule] → Require explicit confirmation, persist the accepted findings in the published snapshot, and print/export them as text as well as color.
- [New PDF dependency increases maintenance and rendering risk] → Keep generation behind a small service, test representative month/sector fixtures and verify monochrome readability.

## Migration Plan

1. Add backward-compatible schema fields and collections; migrate existing scales to revision 1 and map existing states to the corresponding workflow state.
2. Replace/extend validators and indexes without dropping existing scale or shift data; validate that existing period uniqueness remains enforced.
3. Configure local MongoDB and integration tests as replica sets before enabling transactional lifecycle routes.
4. Deploy the API and front-end lifecycle behind the existing authenticated app. Keep `POST /escalas/gerar` and `GET /escalas/:id` compatible while the new UI adopts the expanded contract.
5. Rollback by disabling new lifecycle routes/UI and keeping additive fields/snapshots in place. Do not remove published snapshots or downgrade data destructively; roll forward with a corrective migration if the new API has written versions.
