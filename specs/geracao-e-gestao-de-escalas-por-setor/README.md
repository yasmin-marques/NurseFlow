# Geração e gestão de escalas por setor

Esta change planeja ajustar geração, manutenção, exportação e interface de escalas segundo a estrutura atual de setores e subsetores, usando plantões de 24 horas e cobertura dos quantitativos mínimos.

## Artefatos

- [Proposal](./proposal.md): motivo, escopo e impacto.
- [Spec de geração por setor](./specs/geracao-por-setor/spec.md): mínimos por setor/subsetor, plantões de 24 horas, geração seletiva e chefia geral.
- [Spec de edição e exclusão](./specs/edicao-exclusao-escalas/spec.md): manutenção de escalas publicadas e auditoria.
- [Spec de exportação](./specs/exportacao-escala-pdf/spec.md): exportação condicionada à publicação, chefe geral e assinaturas.
- [Spec de navegação](./specs/navegacao-escala/spec.md): ações, mês/ano e contexto de subsetor no modal.
- [Design](./design.md): decisões técnicas, integração e riscos.
- [Tasks](./tasks.md): plano de implementação e verificação.

## Dependência

A geração deve usar a estrutura de setores/subsetores das alterações realizadas por Yasmin. Antes da implementação, conferir no código os campos de mínimos, IDs e vínculos profissionais atualmente integrados.

## Como prosseguir

Usar esta change como plano de trabalho. A navegação mensal e a posição do seletor de ano foram reportadas como concluídas; conferir no componente e ajustar somente se necessário. O botão de geração abaixo dos ciclos deve permanecer.
