# Proposal

## Why

O modal atual não representa integralmente os protótipos: a equipe é adicionada por uma seleção simples, a inclusão aberta não oferece busca e escolha de turno, e a revisão por data e turno não identifica visualmente o enfermeiro-chefe. Além disso, embora geração, criação manual e edição já consumam quantitativos mínimos em diferentes pontos do back-end, a validação prévia do modal não comunica a cobertura resultante; uma análise do CRUD deve confirmar que essas etapas e seus estados persistidos são coerentes com os requisitos e testes funcionais. A regeneração também pode tratar uma escala validada, mas ainda não publicada, como imutável, confundindo validação com publicação.

## What Changes

- Alinhar o modal de edição aos estados de `modal_edicao.png` e `modal_edicao_botao_clicado.png`, incluindo seleção de profissional, busca para adicionar técnico, escolha de turno no formulário de inclusão e feedback de validação.
- Disponibilizar o início da montagem manual de um rascunho quando o período ainda não tiver escala, sem alterar as ações do cabeçalho.
- Permitir substituir, mediante confirmação e gravação atômica, uma escala validada cuja versão atual ainda não foi publicada; continuar preservando escalas publicadas ou finalizadas e suas versões oficiais.
- Tratar o enfermeiro-chefe como responsável distinto dos demais membros da equipe, destacando-o na revisão do plantão e preservando-o na edição.
- Revisar e ajustar, conforme necessário, os fluxos de geração, criação manual, validação, edição e persistência de escalas para apresentar pendências de cobertura segundo os quantitativos mínimos configurados por setor, turno e função.
- Auditar as funções e contratos de CRUD de escala no front-end e back-end contra os documentos de requisitos, diagramas, especificações e testes funcionais; corrigir inconsistências encontradas sem enfraquecer validações, autorização, revisão concorrente, atomicidade ou auditoria.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `scale-workflow-interface`: alinhar os estados do modal, a seleção do profissional/equipe e turno, a apresentação do enfermeiro-chefe e a comunicação das pendências de cobertura.
- `gestao-escalas`: explicitar a consistência da criação e edição manual com os mínimos configurados e a revisão das operações CRUD com seus efeitos e validações.

## Impact

- Front-end: `ScaleShiftDialog`, revisão de escala, cartões semanais e serviços/tipos de escala e setor.
- Back-end: rotas e serviços de escalas, validação de plantões/lotes, cobertura calculada a partir dos setores e auditoria/versionamento.
- Testes: testes de interface e serviços, testes unitários de regras de plantão e testes E2E de escalas.
- Referências: protótipos em `design/nurseflow/modal_edicao.png` e `design/nurseflow/modal_edicao_botao_clicado.png`; documentos de requisitos, diagramas de atividade e planilha de testes funcionais em `docs/`.
