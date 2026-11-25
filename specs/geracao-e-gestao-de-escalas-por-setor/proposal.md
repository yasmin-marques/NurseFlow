# Proposal

## Why

A geração e a manutenção das escalas precisam refletir a hierarquia atual de setores e subsetores, cobrir os quantitativos mínimos com plantões de 24 horas e permitir que a Coordenação atualize um setor sem alterar as alocações dos demais. Escalas publicadas precisam de edição e exclusão controladas e exportação oficial coerente com o chefe geral de plantão.

## What Changes

- Gerar plantões de 24 horas com foco apenas nos quantitativos mínimos configurados por setor e subsetor.
- Manter regras obrigatórias de disponibilidade, vínculo, qualificação e descanso, sem penalizar profissionais por não atingirem uma carga horária esperada.
- Aplicar mínimo de enfermeiros no setor. Com subsetores, aplicar o mínimo de técnicos em cada subsetor; sem subsetores, aplicar os mínimos de enfermeiros e técnicos no próprio setor.
- Permitir gerar ou regenerar um setor individualmente, preservando os plantões dos demais setores no período.
- Considerar o enfermeiro escalado no Internamento como chefe geral de plantão para todos os setores.
- Permitir editar e excluir escalas publicadas, com confirmação e rastreabilidade.
- Exibir no modal de edição de plantão o subsetor de cada técnico alocado.
- Permitir exportação PDF somente para escalas publicadas e mostrar o botão de exportação apenas nesse estado. Identificar o chefe geral e ampliar os espaços de assinatura da Coordenação e da Diretoria.
- Remover o botão de geração automática do topo, mantendo o botão de geração abaixo dos ciclos.
- Verificar a navegação mensal e a posição do seletor de ano, já reportadas como concluídas, e corrigir o padding direito do seletor.
- Integrar e conferir as alterações de setores e subsetores realizadas por Yasmin, garantindo que a geração respeite vínculos e quantitativos.

## Capabilities

### New Capabilities

- `geracao-minima-por-setor`: geração seletiva de escalas de 24 horas que atende mínimos na estrutura de setores e subsetores.
- `edicao-exclusao-escalas-publicadas`: edição e exclusão auditáveis de escalas publicadas.
- `exportacao-oficial-escala`: exportação PDF condicionada à publicação, com identificação da chefia geral e assinaturas.
- `navegacao-e-edicao-de-escala`: ações e navegação da tela, incluindo contexto de subsetor no modal.

## Scope Boundaries

**Incluído:** quantitativos mínimos; geração por setor; preservação de outros setores; chefia geral; manutenção de escalas publicadas; exportação PDF; navegação e modal de edição; integração ao modelo atual de setores/subsetores.

**Fora do escopo:** otimizar equidade ou carga horária individual; penalizar profissionais por carga inferior à esperada; preencher vagas acima dos mínimos; ignorar regras obrigatórias de elegibilidade para completar mínimos.

## Impact

- **Back-end e otimizador:** geração, contratos e persistência de escalas em `back-end/src/escalas/` e `optimizer/`, integrados ao modelo de `back-end/src/setores/`.
- **Front-end:** tela de escala, geração e modal de edição em `front-end/src/pages/Scale/` e `front-end/src/pages/GeneralSchedule/`.
- **PDF e ciclo de vida:** validação do estado publicado, edição, exclusão, auditoria e serviço de exportação.
