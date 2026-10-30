# Exportação de profissionais e expansão do Demo Seed

Esta mudança documenta a exportação da lista de profissionais para Excel (`.xlsx`) e a ampliação dos dados do seed de demonstração. A implementação existe na branch `feat/exportacao-profissionais-demo`; os artefatos foram escritos a partir do código, dos testes e do README.

## Artefatos

- [Proposal](./proposal.md): motivo, objetivos, escopo e impacto.
- [Spec de exportação](./specs/exportacao-profissionais/spec.md): requisitos e cenários da planilha, filtros e situação.
- [Spec do Demo Seed](./specs/demo-seed/spec.md): requisitos e cenários dos dados de demonstração.
- [Design](./design.md): decisões técnicas, riscos e observações.
- [Tasks](./tasks.md): checklist com o estado verificado de cada etapa.

## Fontes de verdade

- `front-end/src/services/professionalsExport.ts` e `professionalsExport.test.ts`
- `front-end/src/pages/Professionals/filters.ts` e `Professionals.tsx`
- `back-end/scripts/seed-demo.js` e `back-end/test/seed-demo.e2e-spec.ts`
- `README.md` (seções do Demo Seed e "Exportação de profissionais (Excel)")
