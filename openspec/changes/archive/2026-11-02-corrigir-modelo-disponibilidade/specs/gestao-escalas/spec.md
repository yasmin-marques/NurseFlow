# Spec Delta

## MODIFIED Requirements

### Requirement: Disponibilidade por turno e recorrência semanal

O sistema MUST persistir disponibilidade por turno (diurno/noturno/flexível) e recorrência semanal em registros explícitos, sem empilhar a regra em observação textual.

#### Scenario: Registrar indisponibilidade por dia fixo

- **WHEN** a Coordenação envia `POST /profissionais/:profissionalId/restricoes` com `tipo = "indisponivel"`, `inicio`, `fim`, `diaSemana` e `motivo`
- **THEN** o sistema grava `profissionalId`, `tipo`, `inicio`, `fim`, `diaSemana`, `motivo`, `observacao` e, quando aplicável, `turno`, e responde `201` com os mesmos campos e `_id`

#### Scenario: Registrar disponibilidade por turno permitido

- **WHEN** a Coordenação envia `tipo = "disponivel"` com `turno = "diurno"` ou `"noturno"`
- **THEN** o sistema aceita somente os turnos válidos, valida a vigência e usa esse dado na geração automática de escalas, sem depender de texto livre em `observacao`

#### Scenario: Rejeitar recorrência parcial

- **WHEN** a criação de uma regra recorrente falha para qualquer dia do conjunto
- **THEN** o sistema não persiste nenhum registro daquele lote e retorna erro de validação ou conflito, preservando o estado anterior

### Requirement: Vinculo externo com horário e dias de compromisso

O sistema MUST separar vínculo externo de observação, armazenando instituição, tipo de vínculo, dias da semana, turno/horário e vigência como dados estruturados.

#### Scenario: Cadastrar vínculo externo com agenda semanal

- **WHEN** a Coordenação registra um compromisso externo com `tipo = "vinculo_externo"`, `instituicao`, `tipoVinculo`, `diasSemana`, `turno` e `vigencia`
- **THEN** o sistema salva esses campos explicitamente e, ao montar a escala, considera o compromisso no cálculo de indisponibilidade e conflitos

#### Scenario: Rejeitar horário não representável

- **WHEN** o payload informa turno/horário fora do conjunto suportado
- **THEN** o sistema rejeita a requisição com `400` e não cria um registro parcial

### Requirement: Motivo separado da observação

O sistema MUST distinguir `motivo` de `observacao` para férias, ausências e outros eventos, preservando observação apenas como texto complementar.

#### Scenario: Registrar ausência com motivo explícito

- **WHEN** a Coordenação envia `tipo = "ausencia"` ou `"ferias"` com `motivo = "licenca_medica" | "ferias" | "atestado" | "outro"`
- **THEN** o sistema persiste o motivo em campo próprio e mantém `observacao` opcional para contexto adicional, sem concatenar ambos em uma única string

#### Scenario: Exibir ausência sem confundir com folga comum

- **WHEN** o sistema lista registros de disponibilidade
- **THEN** as ausências e férias aparecem com motivo explícito e não como uma regra genérica de indisponibilidade

### Requirement: Edição real das restrições

O sistema MUST permitir atualização completa e segura de registros de restrições, em vez de aceitar somente criação e exclusão.

#### Scenario: Atualizar restrição existente

- **WHEN** a Coordenação envia `PATCH /profissionais/:profissionalId/restricoes/:restricaoId` com campos alterados
- **THEN** o sistema valida a nova vigência e o conjunto de dias/turno, persiste a alteração e retorna o documento atualizado

#### Scenario: Rejeitar atualização que gera conflito

- **WHEN** uma atualização produz sobreposição com outra regra do mesmo profissional
- **THEN** o sistema mantém o documento anterior e responde `409` ou `400` com explicação do conflito

### Requirement: Recorrências semanais sem persistência parcial

O sistema MUST criar ou atualizar todas as recorrências semanais em uma operação atômica, sem persistir apenas algumas repetições quando o lote falha.

#### Scenario: Persistir lote semanal inteiro

- **WHEN** a Coordenação salva uma recorrência semanal para um intervalo contendo múltiplos dias da semana
- **THEN** o sistema grava todas as ocorrências válidas ou a operação inteira falha, sem registros parciais em banco

#### Scenario: Consultar recorrências por profissional

- **WHEN** a Coordenação consulta a lista de restrições de um profissional
- **THEN** o retorno mostra apenas registros persistidos válidos, com `diaSemana` e `motivo` estruturados e sem duplicatas por concatenação textual

### Requirement: Compatibilidade com registros existentes

O sistema MUST aceitar registros legados sem quebrar leitura, listagem e conflito de escalas, migrando o contrato antigo para campos explícitos sem perda de histórico.

#### Scenario: Ler dados históricos sem `motivo`

- **WHEN** o banco contém registros antigos com `observacao` e sem `motivo`
- **THEN** a API continua lendo esses registros, retorna `motivo = null` ou um valor derivado para compatibilidade e mantém a operação de listagem funcional

#### Scenario: Reconciliar schema em banco existente

- **WHEN** a migração aplicada encontra documentos anteriores da coleção `restricoes`
- **THEN** o validador e os endpoints continuam aceitando os campos existentes e os campos novos, sem expulsar o histórico

### Requirement: Referência de profissionais por ID

O sistema MUST referenciar profissionais por `profissionalId` e não por nome em todas as regras de disponibilidade e ausência, preservando integridade entre front-end e back-end.

#### Scenario: Criar regra com profissional válido por ID

- **WHEN** a Coordenação seleciona um profissional na tela de disponibilidade
- **THEN** a API usa o `id` do profissional na requisição e não o nome, evitando ambiguidade e registros inconsistente ao reordenar nomes ou editar dados cadastrais

#### Scenario: Rejeitar profissional inexistente ou inválido

- **WHEN** o payload usa `.id` inexistente ou formato inválido
- **THEN** o sistema responde `404` ou `400` e não cria uma restrição associada a um registro inexistente

### Requirement: Contrato explícito da API de restrições

O sistema MUST publicar e obedecer a um contrato de entrada/saída para restrições, com campos obrigatórios e opcionais explícitos, como `tipo`, `inicio`, `fim`, `diaSemana`, `turno`, `motivo`, `observacao`, `profissionalId` e `_id`.

#### Scenario: Contrato de resposta

- **WHEN** a API retorna uma restrição
- **THEN** o payload inclui `tipo`, `inicio`, `fim`, `diaSemana`, `motivo`, `observacao`, `profissionalId`, `createdAt`, `updatedAt` e `_id`, sem campos concatenados em `observacao` para representar estrutura de negócio

#### Scenario: Contrato de validação

- **WHEN** o cliente envia dados fora do enum, datas inválidas, dia da semana fora de 0..6 ou texto excedendo 300 caracteres
- **THEN** o sistema responde `400` e não grava nada
