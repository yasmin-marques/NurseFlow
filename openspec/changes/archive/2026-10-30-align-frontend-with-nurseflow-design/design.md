# Design

## Context

See `proposal.md` for motivation and `specs/scale-workflow-interface/spec.md` for observable behavior.

The front-end is React 19, TypeScript, Vite and Tailwind CSS 4. Navigation is controlled by local application state rather than a router. `App.tsx` renders the scale page for Coordenação; the existing shell is in `SideMenu.tsx` and `TopBar.tsx`, the scale surface and dialogs are under `pages/Scale/`, and notifications are currently shown by `NotificationCenter.tsx`.

The current theme in `front-end/src/index.css` uses Inter/system fonts, primary `#2e783d`, page `#f5f6f4`, sidebar `#f0f2ef`, secondary `#dce8d8`, border `#e5e8e3`, a global 20px radius and `0 12px 30px rgba(22, 29, 24, 0.06)` shadow. The shell already contains much of the requested navigation and user context, but its styling and notification indicator differ from the images. The scale page has no matching four-stage flow; its weekly view reuses a seven-column calendar instead of daily team cards. Generation and shift editing use centered dialogs, and notifications use an anchored popover rather than the illustrated side panels.

The follow-up visual review found additional differences that are in scope: the page header has status, manual-edit, publish and direct-download controls absent from the month reference; the month calendar combines its period navigation with the calendar card and adds a "Hoje" action; and the month view renders review-by-date/turn, pending-coverage, conflict/alert and workload panels below the calendar. The PDF action downloads immediately instead of opening the illustrated export drawer. Generation currently uses year/month and two shift choices, and its progress bar is inside the drawer rather than the centered loading surface in the reference.

`openspec/specs/README.md` is a descriptive baseline, not a capability spec; `openspec list --specs` returned no existing capabilities. The separate active change `gerenciar-ciclo-de-vida-de-escalas` is not part of this proposal and must remain unchanged.

## Goals / Non-Goals

**Goals:**

- Match the screen hierarchy, visual states, Portuguese labels and panel interactions in the reference captures.
- Keep sample dates, people, percentages and counts as examples; production values come from the current user and scale data.
- Centralize the visual tokens and share the stepper, badges, chips, overlay and drawer behavior across this screen.
- Preserve existing application navigation and service usage, extending the data contract only where the reference behavior cannot be represented with existing fields.

**Non-Goals:**

- Reworking other NurseFlow pages or changing authentication and authorization.
- Hard-coding sample staff, June 2025, example coverage percentages or counts as production data.
- Silently changing backend APIs, broadly changing domain rules or modifying the existing scale lifecycle change.
- Claiming exact source CSS values for properties that cannot be recovered from raster images.

## Decisions

### Treat the screenshots as visual references and sample content as data

Use the 16 PNGs currently present in `design/nurseflow/` as the visual source of truth. They cover the month, review, validation, week, edit, generation, notification, export and publication states:

- [Container.png](../../../design/nurseflow/Container.png)
- [NurseFlow Web - Configuração de Escala.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Configura%C3%A7%C3%A3o%20de%20Escala.png)
- [NurseFlow Web - Editar Plantão.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Editar%20Plant%C3%A3o.png)
- [NurseFlow Web - Editar Plantão-1.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Editar%20Plant%C3%A3o-1.png)
- [NurseFlow Web - Editar Plantão (Novo Técnico).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Editar%20Plant%C3%A3o%20(Novo%20T%C3%A9cnico).png)
- [NurseFlow Web - Escala (Editar).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Escala%20(Editar).png)
- [NurseFlow Web - Escala (Mês).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Escala%20(M%C3%AAs).png)
- [NurseFlow Web - Escala (Notificação)-1.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Escala%20(Notifica%C3%A7%C3%A3o)-1.png)
- [NurseFlow Web - Escala (Revisão).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Escala%20(Revis%C3%A3o).png)
- [NurseFlow Web - Escala (Validação).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Escala%20(Valida%C3%A7%C3%A3o).png)
- [NurseFlow Web - Escala (Validação)-1.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Escala%20(Valida%C3%A7%C3%A3o)-1.png)
- [NurseFlow Web - Exportação.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Exporta%C3%A7%C3%A3o.png)
- [NurseFlow Web - Exportação-1.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Exporta%C3%A7%C3%A3o-1.png)
- [NurseFlow Web - Geração de Escala.png](../../../design/nurseflow/NurseFlow%20Web%20-%20Gera%C3%A7%C3%A3o%20de%20Escala.png)
- [NurseFlow Web - Publicar Escala (94%).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Publicar%20Escala%20(94%25).png)
- [NurseFlow Web - Publicar Escala (100%).png](../../../design/nurseflow/NurseFlow%20Web%20-%20Publicar%20Escala%20(100%25).png)

The available set contains one notification capture and two export variants. The `Mês`, `Revisão`, `Validação` and `Validação-1` screens share the monthly view but represent different flow states; `Escala (Editar)` is the weekly view, while the shift-edit captures show its editing states.

### Centralize tokens from sampled pixels, and distinguish measurements from estimates

The following hex colors were sampled directly from the reference PNG pixels and can be centralized as visual tokens:

| Token role | CSS token | Sampled value | Reference use |
|---|---|---|---|
| Page background | `--color-page` | `#FAFAF7` | Main canvas |
| Surface | `--color-surface` | `#FFFFFF` | Cards and drawers |
| Neutral surface | `--color-neutral` | `#F5F6F2` | Form fields and neutral areas |
| Soft green surface | `--color-soft-green` | `#F1F5EC` | Subtle green sections |
| Green highlight | `--color-highlight` | `#E3F2DA` | Active, selected and success areas |
| Primary green | `--color-primary` | `#2F7D32` | Primary actions and active indicators |
| Warning surface | `--color-warning` | `#FFF3DF` | Coverage warning |
| Error surface | `--color-error` | `#FDECEA` | Conflict state |
| Border | `--color-border` | `#E4E8E1` | Controls and card outlines |

These are image pixel values, not recovered design-source variables. A PNG does not encode the original CSS, font metadata, shadow parameters or radius tokens. Inter is already used by the app and is the closest supported font match; retain it unless a design source says otherwise. The screenshot suggests rounded controls/cards and soft shadows, but their exact radii and shadow blur/opacity cannot be established from the raster alone. Start with shared radius tokens around 12px for controls and 16px for cards/panels and a diffuse, low-contrast card shadow, then calibrate by screenshot comparison. Do not describe those estimates as exact source values.

Supporting foreground tokens such as `--color-warning-text` and interactive derivatives such as `--color-primary-hover` are readability/interaction estimates, not additional pixel samples.

Screenshot comparison at a 1220 × 1616 viewport calibrated monthly day cells to a 176px minimum height (the reference rows are approximately 178px) and right-side drawers to 29rem/464px (the reference panel is approximately 460px). Drawer headings use 16px and descriptions 12px to match the reference hierarchy. These are rendered-size comparisons, not claims about the source design tokens.

### Preserve the existing shell and replace only the scale-specific presentation

Keep the current application navigation and shell components, adjusting their layout and tokens to the reference: pale canvas, white sidebar/content surfaces, active Escala row, red Trocas count, notification dot, and the authenticated user's avatar/name/role. Render the exact page heading and actions from the reference. Avoid hard-coding the example name "Paloma Ferreira"; show the authenticated profile.

### Derive the flow stepper from persisted operations

Use the existing scale lifecycle and successful service responses as the source for step completion. Saving edits, validating, and publishing must remain separate observable transitions; do not mark a step complete or show "PUBLICADA" when its operation fails. A successful save moves the view to "ALTERAÇÕES SALVAS" with step 3 active, awaiting conflict validation.

### Stage shift edits and persist them atomically

Shift dialogs edit a client-side working copy. "Validar conflitos" previews the full staged set against the current persisted scale without writing data; "Aplicar alteração" adds the validated form to the staged set. "Salvar alterações" sends the complete set through a batch API operation. The server rechecks the expected scale revision and all domain rules, then persists every change in one transaction and increments the scale revision once. If validation or persistence fails, no shift is changed, the revision remains unchanged, and the staged edits stay available for correction or retry. Canceling the current dialog discards only that dialog's un-applied form; previously staged edits remain visible until saved or explicitly discarded.

### Use a shared right-side drawer pattern

Replace centered scale dialogs and the notification popover with a shared drawer shell: right-aligned panel, fixed header/footer, dimmed and blurred background, close/cancel actions, and independently scrollable content. Reuse it for generation, shift editing, inline new technician, notifications, export and publication. Keep the loading state in the generation panel and preserve form choices on recoverable errors.

### Keep visual labels separate from example values

Render dates, team names, counts, percentages, sectors and notification content from the selected scale and services. The June 2025, Paloma Ferreira, Rafael Rocha, 94%/100%, 2 below-minimum coverages and sample team counts are screenshot content, not defaults to persist or present as current data.

### Match the reference composition, not just its individual components

The monthly page consists of the page heading/actions, workflow card, a separate month-navigation card, calendar card and the 12-hour information strip. Do not render the review-by-date/shift section, standalone pending/conflict panels or workload table below it. The page header has only "Exportar PDF" and "Gerar Escala Automaticamente"; the PDF action opens the export drawer rather than downloading immediately. Keep editing and publication actions in the workflow or day cards, not as additional page-header actions.

The weekly page uses the daily team cards shown in `NurseFlow Web - Escala (Editar).png`. Preserve service-derived groups, team members, coverage state and editing actions; do not insert monthly review panels into this view.

During generation, keep the workflow card visible and replace the calendar area with a white loading surface containing a circular spinner, "Gerando a escala...", the exact verification sentence and the three green indicators "Disponibilidade", "Restrições" and "Cobertura por setor". The generation form stays mounted while the surface is visible so a recoverable failure can reopen the drawer with its choices intact. Keep duplicate-submit prevention and server error reporting.

Do not add a visible cancel action to this loading surface: the reference contains only the spinner, message and three indicators. If generation fails, return to the still-mounted form and show the error there.

### Generation dates remain consistent with the monthly API

The current generation API accepts a year and month and creates a monthly scale. Show the start and end date controls from the reference, initialize them to the first and last day of the selected month, and prevent submission unless they describe one complete calendar month. Do not silently imply that a partial date range is supported. Expose the three visual shift chips ("24 horas", "Diurno", "Noturno") and map them to the existing day/night API scope without duplicating shifts.

## Risks / Trade-offs

- [The current service/data model may not expose all visual distinctions, including nurse-chief responsibility, reason-for-coverage labels, complementary 24-hour shifts or the "Baixa"/"Retorna" semantics.] → Verify the existing response fields first; if a distinction cannot be represented, add only the necessary API/data-contract fields and cover them with API and UI tests. Never infer them from names or colors.
- [The stepper/status screenshots show states whose mapping to backend transitions is not explicit.] → Map successful save to "ALTERAÇÕES SALVAS" with step 3 active; keep the persisted lifecycle authoritative and never show success after a failed transition.
- [The screenshots do not reveal exact typography, radii or shadow CSS.] → Use the sampled colors above, retain the current Inter font, label inferred shape tokens as estimates, and include a visual comparison task.
- [A below-minimum coverage state offers "Publicar com pendências" while other conflicts may require blocking.] → Allow explicit publication only when below-minimum coverage is the sole pending issue; block publication for any other validation conflict.

## Migration Plan

No data migration is planned unless the confirmed API gap requires persisted fields. Implement incrementally, keep any contract additions backward-compatible, compare rendered states with the captures, and retain prior scale actions until replacements are verified. Rollback consists of reverting the UI and any additive contract change without deleting existing scale data.

## Confirmed Decisions for Implementation

- API/back-end contract changes are allowed only when required to expose the fields listed in the data-gap risk; first verify the current contract and avoid unrelated domain changes.
- Add a read-only preview and atomic batch operation for staged shift edits; a failed batch must not partially persist changes.
- A successful save advances the displayed flow to "ALTERAÇÕES SALVAS" with step 3 active.
- "Publicar com pendências" is allowed only for below-minimum coverage with no other validation conflict; other conflicts block publication.
- Use exact sampled PNG colors and calibrate typography, radii and shadows through visual comparison; the screenshots do not encode original CSS values.
- The generation screenshot shows a page-level loading surface rather than a drawer overlay; the active generation request and form state must survive that visual transition.
- The monthly reference has no "Hoje" button or supplemental review, pending, conflict or workload panels; retain the monthly informational strip as the only content below the calendar.

## Follow-up visual scope

The latest user instruction is authoritative for the page composition: monthly and weekly states must match their respective reference captures without adding extra header actions or below-calendar review panels. The export and generation header buttons must open their illustrated panels. Generation loading must replace the calendar area with the reference loading surface. The weekly grouping remains data-driven; labels such as "Baixa" and "Retorna" are only shown when the service identifies the corresponding coverage origin.
