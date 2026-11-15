# Design — Gerenciamento de Extras Programados

## Context

Esta change segue `proposal.md` e os deltas de `specs/gerenciamento-extras-programados/spec.md` e `specs/gestao-escalas/spec.md`. O objetivo deste documento é definir **como** entregar esses contratos; a motivação e os cenários observáveis permanecem na proposta e nas especificações.

O NurseFlow utiliza frontend React/TypeScript, backend NestJS/Mongoose/MongoDB e um otimizador Python/OR-Tools para escalas mensais. Na base de código do projeto:

- `Escala` possui ciclo de vida `rascunho`, `em_revisao`, `validada`, `publicada`, `finalizada`, número de revisão e snapshots oficiais (`VersaoEscala`).
- `Plantao` possui `tipo: regular | extra`, mas o tipo está associado ao **plantão**, não individualmente a cada profissional. `PlantaoProfissional` guarda as alocações; há transações e auditoria para alterações de escala.
- O backend já oferece validação de plantões, geração/regeneração, consulta de cobertura e limites mensais (`maxExtras`, `maxExtrasClt`, `maxExtrasConcursado`, `limitePlantoes`). O modelo atual do solver infere extras pela carga mensal; **não recebe programação fixa com identidade própria**.
- `Profissional` já suporta vínculo RPA, e o módulo `Profissionais` oferece cadastro e listagem sob autorização de Coordenação.
- O menu inclui `Extras` em `/extras` e existe um componente reutilizável de drawer. As quatro imagens em `design/` orientam a apresentação, não definem o contrato de persistência.

## Goals / Non-Goals

**Goals:**

- Registrar extras com identidade e histórico próprios **antes ou depois** de existir escala mensal, sem tratar programação como alocação confirmada inexistente.
- Manter uma única fonte de verdade para a programação do extra e um vínculo rastreável, idempotente e transacional com a alocação da escala.
- Aplicar validação no servidor, incluindo autorização, formação, status profissional, restrições, descanso, limites e concorrência.
- Fazer o otimizador respeitar extras programados elegíveis como compromissos fixos, preservando identidade e contabilização de cobertura/carga.
- Construir página própria de Extras com indicadores, filtros, cadastro, edição, cancelamento e inclusão de RPA pelo cadastro existente.
- Preservar o fluxo de revisão/publicação e os snapshots oficiais das escalas.

**Non-Goals:**

- Redesenhar o motor geral de disponibilidade ou corrigir, nesta change, os casos adiados da homologação da Change 02 para plantões regulares.
- Redefinir limites e cargas da página Configurações (Change 03), redesenhar outras telas (Change 04) ou criar cadastro paralelo de RPA.
- Processar pagamento, valor monetário, comparecimento, folha, troca de plantões ou execução efetiva de extras.
- Transformar plantões extras históricos já existentes em programações com motivo inventado.

## Decisions

### 1. Entidade persistente própria para o extra programado

**Decisão:** criar módulo `extras` no backend, com coleção MongoDB `extrasProgramados`, DTOs, controller, service, índices e auditoria de eventos `auditoriaExtras`. **Não** adicionar um array `extrasProgramados` a `Profissional`.

Representação:

| Campo | Semântica |
| --- | --- |
| `_id` | Identidade estável do extra |
| `data`, `opcao` | Dia civil `YYYY-MM-DD` e opção `12d`, `12n` ou `24h`; derivam início/fim da jornada |
| `setorId`, `funcao` | Setor e função exigida (`enfermeiro`/`tecnico`) |
| `substitutoId` | Profissional escalado para o extra, identificado por ID |
| `cobertoId?`, `restricaoId?` | Profissional substituído e, se informada, origem do afastamento; ausentes em reforço |
| `motivo`, `observacao?` | Motivo explícito (`ferias`, `ausencia`, `atestado`, `reforco`, `outro`) e detalhe opcional; independente do vínculo empregatício |
| `situacao` | `programado` ou `cancelado`; vínculo com escala **não** altera essa situação |
| `escalaId?`, `plantaoId?`, `plantaoProfissionalId?` | Referências de conciliação; nulas antes de existir alocação correspondente |
| `revisao` | Inteiro monotônico para controle otimista de edição |
| `criadoPor`, `atualizadoPor`, `canceladoPor?`, `canceladoEm?`, `justificativaCancelamento?` | Autoria, cancelamento e rastreabilidade |
| `createdAt`, `updatedAt` | Timestamps técnicos |

O indicador de vínculo é **derivado** (`sem_escala`, `vinculado`, `pendente_conciliacao`) e não confundido com `situacao`. Nunca informar "cobertura confirmada" quando ainda não existe alocação em escala. O extra cancelado permanece no banco e no histórico, mas deixa de gerar reserva/cobertura ativa.

**Índices:** por `data`/`situacao`, por `substitutoId`/`data`, por `setorId`/`data` e índice único parcial sobre a referência não nula `plantaoProfissionalId`. Duplicatas exatas de extras ativos são impedidas por chave/índice específico; **sobreposições entre opções diferentes** são validadas de forma transacional no serviço.

### 2. Datas civis e opções de jornada como intervalos completos

**Decisão:** a API recebe `data` como dia civil (sem conversão de fuso no cliente) e `opcao` conforme o contrato já usado em plantões: `12d` = 07h–19h, `12n` = 19h–07h do dia seguinte e `24h` = 07h–07h do dia seguinte. O backend deriva o **intervalo completo** `[inicio, fim)` para detectar conflitos e aplica a mesma convenção de calendário do módulo de escalas.

### 3. API REST completa de Extras

**Decisão:** expor API REST completa protegida por autenticação JWT e `@Perfis(Perfil.COORDENACAO)` para mutações:
- `GET /extras`: listagem paginada com filtros (`ano`, `mes`, `setorId`, `motivo`, `situacao`, `busca`, `profissionalId`).
- `GET /extras/resumo`: indicadores mensais consolidados (`totalExtrasAtivos`, `totalHoras`, `totalRpaAtivos`).
- `GET /extras/:id`: detalhamento do extra com histórico de auditoria (`auditoriaExtras`).
- `POST /extras`: criação com validação integral e auditoria.
- `PATCH /extras/:id`: edição com `revisaoEsperada`, revalidação e auditoria.
- `POST /extras/:id/cancelar`: cancelamento lógico com justificativa obrigatória e `revisaoEsperada`.

### 4. Validação central de conflitos, limites e concorrência

**Decisão:** centralizar regras no `ExtrasService`, compartilhando regras com `escalas` e `restricoes`. A operação de extra considera **o conjunto de reservas ativas e alocações reais**, eliminando do cálculo a própria alocação vinculada ao mesmo extra para evitar falsa duplicidade.

Validação inclui:
1. Autorização de Coordenação; existência, status e formação do substituto; setor válido e compatibilidade com o motivo/coberto.
2. Indisponibilidades, férias/ausências, turnos permitidos e vínculos externos relevantes a **todo o intervalo** do extra (inclusive a madrugada e fronteiras de mês).
3. Alocações sobrepostas, reservas de outros extras ativos, descanso mínimo e limites do mês, considerando os meses adjacentes quando houver impacto. Preservar as regras vigentes para a exceção de `12d`+`12n` contíguos.
4. Limites mensais e por vínculo existentes, com extras explicitamente programados contados uma vez e **sem converter extras em carga regular**.
5. Estado e revisão da escala associada; impedir mutação direta de `validada`, `publicada` e `finalizada`.

### 5. Conciliar com plantões sem confundir `tipo`, `motivo` e `vínculo`

**Decisão:** um extra pode existir sem escala. Quando há escala editável, sua efetivação cria ou associa uma **atribuição identificável** no conjunto de plantões, sem modificar uma alocação regular como se fosse extra.

- Representar a alocação efetiva em `PlantaoProfissional`, acrescentando uma referência opcional e única `extraProgramadoId`. O registro de extra armazena os IDs de escala, plantão e atribuição correspondentes para consulta, conciliados na mesma transação.
- Preservar `Plantao.tipo = extra` para a composição de extras, agrupando por setor/data/opção quando apropriado.
- `origemCobertura` é metadado de origem, não o motivo de negócio. Vínculo RPA/CLT/concursado permanece no cadastro do profissional; `motivo` permanece em `ExtraProgramado`.
- Se um extra cancelado era a única atribuição de um plantão extra, remover ou desativar o plantão vazio. Se havia outras atribuições, retirar somente a relação afetada. Recalcular pendências/cobertura e invalidar validação prévia da escala editável.
- Se uma programação válida for registrada sem escala, exibir `sem_escala`.

### 6. Geração e regeneração com alocações fixas no solver

**Decisão:** estender explicitamente o contrato de entrada NestJS → Python com `alocacoes_fixas` de extras programados ativos no escopo, contendo pelo menos `extra_id`, `profissional_id`, `setor_id`, `dia`, `opcao`, `tipo=extra`. O solver deverá **fixar** essas atribuições no modelo (não tratá-las como meras preferências) e impedir novas atribuições incompatíveis; não poderá alterar substituto, setor ou jornada de uma programação confirmada.

1. Ler configuração, setores/turnos, profissionais, restrições e extras ativos relevantes; validar previamente elegibilidade e conflitos.
2. Enviar `alocacoes_fixas` ao solver. Criar restrições `x == 1` correspondentes no CP-SAT e proibir dupla atribuição.
3. Separar no solver as **atribuições explicitamente extras** das regulares e dos extras sugeridos por excesso de carga.
4. Devolver resultados identificáveis. Na persistência, associar cada `extra_id` à sua atribuição, atualizar revisões e substituir atomicamente os vínculos da escala editável, mantendo os mesmos IDs de `ExtraProgramado` na regeneração.
5. Proteger a geração assíncrona com revisão/fingerprint das programações e rechecagem antes do commit.

### 7. Interface própria, com dados reais e cadastro RPA reutilizado

**Decisão:** criar `front-end/src/pages/Extras/` com `ExtrasPage`, componentes de indicadores/listagem/filtros e drawers `RegistrarExtra`, `EditarExtra`, `CancelarExtra` e `CadastrarRpa`. Criar `front-end/src/services/extras.ts` com tipos DTO e chamadas à API.
- Navegação por mês/ano, busca e filtros (setor, motivo e situação); cards exibem substituto, profissional coberto quando houver, função, setor, turno, motivo, situação e vínculo com escala.
- Indicadores: extras ativos e horas do período a partir de programações persistidas; RPAs ativos a partir de `Profissionais`; posições descobertas do cálculo real de cobertura de escala.
- Novo/editar: selecionar motivo, exigir coberto para substituição, data, opção, setor, função e substituto elegível.
- Cancelar: confirmação com justificativa, atualização de situação/histórico.
- Cadastrar RPA: **reutilizar** `POST /profissionais` com `tipoVinculo = rpa`.

### 8. Segurança, auditoria e observabilidade

**Decisão:** todos os endpoints de mutação exigem autenticação e `Perfil.COORDENACAO`, com auditoria imutável por evento (`CRIADO`, `EDITADO`, `CANCELADO`, `VINCULADO`, `DESVINCULADO`).

## Risks / Trade-offs

| Risco / compromisso | Mitigação |
| --- | --- |
| Inconsistência sob edição concorrente de extras ou geração demorada | Transação, controle de revisão por extra/profissional/período e rechecagem da versão do conjunto antes do commit de geração |
| Solver antigo ignora extras fixos, ou extras fixos tornam a solução inviável | Evoluir e testar contrato NestJS–Python de forma coordenada; falhar explicitamente sem salvar escala parcial |
| Confusão entre tipo de plantão, origem de cobertura, motivo e vínculo RPA | Campos distintos e testes de serialização/carga; vínculo da programação até `PlantaoProfissional`, não só até `Plantao` |
| Dupla contagem em indicadores, carga e vagas descobertas | Identidade única do extra, associação 1:1 com atribuição, contagem por posições/setor/turno/função e testes de regeneração/cancelamento |
| Férias ou vínculo externo atravessam meia-noite | Validar intervalo integral no fluxo de extra e criar testes de fronteira |
| Escalas publicadas ou validadas sofrem alterações indiretas | Bloquear mutação direta no fluxo de Extras; preservar snapshots e exigir revisão autorizada |

## Migration Plan

1. Aplicar coleções e índices (`extrasProgramados`, `auditoriaExtras`).
2. Adicionar referência opcional `extraProgramadoId` a `PlantaoProfissional`.
3. Estender rotas REST `/extras` no backend.
4. Implementar conciliação e atualizar contrato do solver Python.
5. Construir interface React, drawers e serviços frontend.
6. Testes integrados e homologação.

## Open Questions

- Nenhuma incerteza crítica bloqueia esta proposta; as decisões arquiteturais estabelecem as fontes de verdade para programação de extras, vínculo com escalas e alocações fixas no solver.
