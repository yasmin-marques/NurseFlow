# Design

## Context

See proposal.md - Why. The current restriction model in `back-end/src/restricoes/` and `front-end/src/pages/Disponibility/` uses a single `observacao` field to encode structured business data, while the solver logic already expects explicit `diaSemana`, `tipo` and related signals. The change is therefore a data-contract correction across API, persistence, migrations and UI.

## Goals / Non-Goals

**Goals:**

- model availability, external links and absences as structured data
- ensure professional identity is stored and requested by `profissionalId`
- preserve compatibility with existing MongoDB documents and historical restrictions
- support weekly recurrence without partial persistence

**Non-Goals:**

- altering the optimizer scheduling algorithm beyond using the corrected restriction contract
- rewriting unrelated escalas or coordination flows
- creating new capability paths outside `gestao-escalas`

## Decisions

- Use a single restriction collection with explicit fields: `tipo`, `inicio`, `fim`, `diaSemana`, `turno`, `motivo`, `observacao`, `profissionalId`.
- Keep `motivo` as a structured field for `ferias`, `ausencia`, `vinculo_externo` and explicit availability categories; reserve `observacao` for free-text notes only.
- Treat `profissionalId` as the canonical association key on both write and read paths, avoiding name-based lookups in the client and API.
- Make recurrence creation atomic at the service layer; validate the full batch before writing any record, then persist once or reject without partial writes.
- Maintain backward compatibility by accepting legacy documents during reads and migration validation, deriving missing structured values where safe.

### Alternatives considered

- Continue storing business meaning inside `observacao`: rejected because it breaks serialization, editing and solver compatibility.
- Use a separate collection for availability rules: rejected as broader schema churn without providing a direct compatibility win.
- Name-based association: rejected because it creates ambiguity across renamed or duplicated professionals.

## Risks / Trade-offs

- [Backward compatibility] → Migrate validator and read paths before enforcing strict new fields in clients.
- [Partial recurrence writes] → Enforce transactional or pre-validation batch handling before inserts.
- [UI reset on legacy records] → Accept legacy payloads but normalize them in the presentation layer without mutating historical data in-place.
- [Behavioral drift across services] → Keep the contract explicit in the OpenSpec delta and validate with e2e tests around `restricoes-configuracoes`.

## Migration Plan

1. Extend MongoDB validator and schema definitions in the migration layer to accept the new structured fields while preserving legacy values.
2. Update the backend DTO/service to validate and normalize the canonical contract.
3. Update the React form and service layer to use professional IDs and structured reasons.
4. Add regression tests for recurrence, compatibility, conflict validation, and ID-based references.
5. Roll out in-place with backward-compatible reads and a guardrail that rejects invalid payloads without partial writes.

## Open Questions

None; the required behavior is sufficiently specified in the proposal and the existing project requirements.
