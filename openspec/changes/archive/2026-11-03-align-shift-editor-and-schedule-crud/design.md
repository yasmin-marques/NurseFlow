# Design

## Context

O fluxo de escala combina o modal `ScaleShiftDialog`, seleção de profissionais/setores no front-end e operações da API para validar ou persistir um plantão/lote. A geração automática já recebe quantitativos mínimos dos setores; inclusão, edição e lote recalculam cobertura. A pré-validação do lote agora retorna cobertura e pendências projetadas e requer reconhecimento explícito quando o mínimo não é atingido.

A API mantém inclusão e edição unitária, pré-validação e gravação atômica em lote, além de revisão esperada e auditoria. As regras do setor definem mínimos por turno e função e contam o chefe entre os enfermeiros; plantões de 24 horas contribuem para os turnos diurno e noturno. O documento de requisitos permite confirmar alocações com alertas de disponibilidade/cobertura mediante decisão registrada, enquanto conflitos impeditivos continuam rejeitados.

Na interface inicial da auditoria, a revisão por data/turno não destacava a marcação `lideranca`, e o modal podia promover o primeiro enfermeiro da equipe a chefe quando não havia liderança marcada. Esses fallbacks foram removidos e a revisão passou a identificar o chefe em cada plantão, informando explicitamente sua ausência.

A regeneração hoje permite substituir somente rascunhos e escalas em revisão. Uma escala `validada` ainda não foi publicada, mas é bloqueada junto com os estados oficiais; isso confunde validação com publicação e impede uma nova geração mesmo sem uma versão atual publicada. A substituição deve exigir confirmação, limpar a validação da revisão substituída e manter intactos quaisquer snapshots oficiais já publicados.

## CRUD Audit Baseline

| Fluxo | Implementação e evidência atual | Resultado da comparação |
|---|---|---|
| Criar rascunho / consultar lista e detalhe | API `POST /escalas`, `GET /escalas?ano&mes` e `GET /escalas/:id`; a tela oferece criação manual e abre o formulário somente depois da confirmação da API. O rascunho calcula cobertura vazia com os mínimos dos setores ativos. | Fluxos coerentes; erro de criação é apresentado sem sucesso aparente. Casos ESC-01 e ESC-02. |
| Gerar escala | API de geração consulta setores e profissionais ativos e seus quantitativos; E2E verifica escopo, restrições, carga e pendências. | Compatível com RN003/RN006 e RF005; preservar cobertura de setores/turnos escolhidos. |
| Adicionar/editar plantão individual | API valida elegibilidade, função, descanso, carga e revisão em transação; E2E cobre inclusão, edição, auditoria e rollback. A cobertura é projetada antes da gravação, e a confirmação é registrada. | Inclusão/edição preservam a atomicidade e recalculam pendências dos escopos anterior e novo. Casos ESC-02 a ESC-04. |
| Pré-validar/salvar lote | API pré-valida sem gravar e salva atomicamente com uma revisão e evento de auditoria; a resposta inclui cobertura projetada e pendências; UI separa conflito impeditivo de aviso de cobertura. | A confirmação é necessária quando há vagas mínimas e não permite ignorar conflitos. Casos ESC-02 a ESC-04. |
| Revisar, validar e publicar | Há revisão por data/turno com liderança destacada por plantão, validação, pendências explícitas, snapshot imutável, versão e notificações; E2E cobre transições, revisão da versão publicada e idempotência. | Compatível com DA13/DA14 e RF007/RN012; preserva alertas, bloqueios e versionamento. Casos ESC-05, ESC-07 e ESC-09. |
| Remover rascunho e auditar | Exclusão exige confirmação e revisão atual, só permite rascunho e remove conteúdo em transação; API expõe histórico e E2E verifica autorização/remoção. | Compatível com ciclo de vida e trilha de auditoria existentes. |
| Documentação funcional | O PDF de requisitos entrega 2 define RF006/US09, RF007/US10 e RN003/RN006/RN012/RN016; DA12/DA13/DA14 descrevem criação manual, validação de disponibilidade/cobertura e edição com histórico/versão. A planilha `NurseFlow - Testes Funcionais.xlsx` não contém casos específicos de CRUD de escala. | Casos funcionais complementares foram registrados em `docs/testes-funcionais-escala.md`, vinculando cobertura, liderança, regeneração, concorrência, publicação e remoção à suíte automatizada. |

## Goals / Non-Goals

**Goals:**
- Preservar os contratos de revisão concorrente, transação atômica, autorização, versionamento e auditoria ao ajustar os fluxos de escala.
- Permitir regeneração explícita de uma escala validada ainda não publicada, sem substituir estados publicados/finalizados nem snapshots oficiais.
- Separar conflito bloqueante de pendência de quantitativo mínimo e manter explícita a confirmação da Coordenação quando a cobertura ficar abaixo do configurado.
- Usar a mesma interpretação de turno, função, liderança e mínimos na criação, edição, pré-validação, persistência e visualização.
- Alinhar a apresentação do modal com os dois protótipos e tornar a liderança identificável no contexto de cada plantão.
- Oferecer a entrada para montar manualmente um rascunho vazio quando ainda não existe escala no período, mantendo as ações de cabeçalho previstas no design atual.

**Non-Goals:**
- Cadastrar profissionais a partir do modal; a busca seleciona profissionais já cadastrados e elegíveis.
- Alterar as regras de descanso, disponibilidade, vínculo, carga horária ou autorização de publicação.
- Tornar o quantitativo mínimo um bloqueio absoluto para criação manual; a decisão permitida pelos requisitos deve ser explícita e auditável.
- Introduzir migração de dados ou dependências externas sem necessidade identificada na auditoria.

## Decisions

1. **Manter uma única configuração de turno por plantão.** A escolha 24h/diurno/noturno atualiza o turno e a duração do plantão inteiro e se aplica a todos os membros. Isso corresponde à confirmação do usuário e ao modelo atual, no qual horário e duração pertencem ao plantão, não a cada vínculo profissional. Separar turnos por profissional exigiria um modelo de dados e regras de cobertura distintos e não corresponde ao contrato existente.

2. **Separar profissional em foco e enfermeiro-chefe.** Os controles visuais do protótipo devem ser mapeados a valores distintos no rascunho do modal. A busca de inclusão usa o cadastro de profissionais ativos, evita duplicatas e não cria uma identidade nova. A liderança permanece vinculada ao profissional marcado no plantão; a interface nunca infere liderança apenas por formação ou ordem da lista.

3. **Estender a pré-validação para retornar cobertura, sem converter avisos em erros bloqueantes.** A validação do lote deve calcular as pendências usando o mesmo cálculo e os mesmos dados de setor usados na gravação. A resposta diferencia erros de alocação de vagas por setor/data/turno/função. O front-end apresenta o aviso e exige reconhecimento explícito para aplicar uma alteração com cobertura abaixo do mínimo; a decisão é enviada junto com o lote e gravada na auditoria. Um conflito impeditivo continua impedindo o staged e a persistência.

4. **Recalcular os mínimos afetados no fluxo manual e exibir o resultado.** Considerar a configuração vigente do setor, contabilizar a liderança dentro do mínimo de enfermeiros e contabilizar um plantão de 24 horas em ambos os turnos. Inclusão, edição e lote devem deixar a cobertura e as pendências derivadas consistentes; mudança de setor ou turno deve atualizar os dois escopos afetados, sem deixar cobertura antiga em cache ou estado da interface.

5. **Auditar o CRUD pelos contratos existentes antes de alterá-los.** Conferir criação/geração, listagem/detalhe, inclusão unitária, pré-validação, gravação em lote, edição unitária, revisão, validação, publicação e remoção de rascunho contra os requisitos, diagramas, OpenSpec e testes funcionais. Manter revisão esperada, limites de estado, transações e registro de ator/ação/data; adicionar ou corrigir comportamento e testes somente onde a comparação identificar discrepância.

6. **Priorizar visualização específica por plantão na revisão.** Exibir o chefe junto ao plantão correspondente e manter o estado ausente explícito, sem depender apenas do agrupamento de liderança diária do cartão semanal. Isso evita atribuir a uma pessoa o papel de chefe de todos os plantões do dia quando a liderança pode variar por setor ou turno.

7. **Distinguir validação de publicação na regeneração.** Uma escala em `validada` pode ter o conteúdo de trabalho substituído somente após confirmação explícita, retornando a rascunho e invalidando a validação daquele conteúdo. Estados `publicada` e `finalizada` permanecem bloqueados, e os snapshots oficiais anteriores não são alterados; a API revalida o estado e a revisão dentro da transação antes de remover o conteúdo atual.

## Risks / Trade-offs

- [O preview e a gravação podem usar leituras diferentes dos quantitativos de setor] → Recalcular no servidor para as duas operações, validar a revisão no momento da gravação e preservar a revalidação dentro da transação.
- [A confirmação do alerta pode se perder entre o preview e o lote] → Vincular a aceitação ao item staged/identificador da alteração e registrar a decisão na mesma transação da gravação; nunca tratar a aceitação como dispensa de conflitos impeditivos.
- [Dados antigos podem conter plantões sem liderança marcada] → Exibir a ausência sem inferir um chefe; permitir correção pela edição, evitando migração automática que altere semântica histórica.
- [Alterar turno de um plantão pode criar novas sobreposições e mudar vários mínimos] → Revalidar equipe, descanso, conflitos e cobertura para o turno/duração completo antes de aplicar e novamente ao salvar.
- [A planilha funcional cobre poucas operações de escala diretamente] → Complementar os casos com testes de serviço/UI e cenários E2E focados em cobertura, liderança, atomicidade, revisão concorrente e histórico.

## Migration Plan

Não é prevista migração de banco: os quantitativos, profissionais, marcações de liderança e auditoria já existem. Mudanças compatíveis na resposta de pré-validação devem preservar os campos atuais e adicionar os dados necessários de cobertura/aceitação. Se a auditoria detectar que algum contrato precisa ser incompatível, a mudança deverá ser documentada e testada antes da implementação.
