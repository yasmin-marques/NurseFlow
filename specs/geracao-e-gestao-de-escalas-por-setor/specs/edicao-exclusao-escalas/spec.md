# Spec: edição e exclusão de escalas publicadas

## Objetivo

Permitir à Coordenação corrigir ou remover escalas publicadas com controle de versão, confirmação e rastreabilidade.

## Requisitos

### Requisito: editar escala publicada

O sistema MUST permitir à Coordenação editar plantões de escala publicada por meio de revisão controlada. A edição MUST validar regras de elegibilidade e registrar autoria e instante da alteração, preservando o histórico publicado.

#### Cenário: iniciar edição publicada

- **WHEN** a Coordenação edita uma escala publicada
- **THEN** o sistema cria ou abre uma revisão da versão publicada
- **AND** valida profissionais, horários, setor/subsetor e regras obrigatórias
- **AND** registra quem realizou a alteração e quando
- **AND** a versão anteriormente publicada permanece consultável até a publicação da revisão

#### Cenário: técnico com subsetor

- **WHEN** a Coordenação abre o modal de edição de um plantão com técnicos alocados
- **THEN** o sistema mostra o subsetor associado a cada técnico

#### Cenário: rejeitar edição inválida

- **WHEN** a edição viola uma regra obrigatória
- **THEN** o sistema rejeita a alteração e preserva a versão publicada e a revisão anterior

### Requisito: excluir escala publicada

O sistema MUST permitir à Coordenação excluir escala publicada por ação explícita, solicitar confirmação e manter registro de auditoria.

#### Cenário: confirmar exclusão

- **WHEN** a Coordenação confirma a exclusão de escala publicada
- **THEN** a escala deixa de estar disponível para consulta operacional e exportação
- **AND** o sistema preserva auditoria e informação suficiente para rastrear a exclusão

#### Cenário: cancelar exclusão

- **WHEN** a Coordenação cancela a confirmação
- **THEN** a escala permanece publicada e inalterada

### Requisito: disponibilizar ação de exclusão

A interface MUST oferecer à Coordenação um botão de exclusão para escalas que podem ser excluídas.

#### Cenário: iniciar exclusão

- **WHEN** a Coordenação visualiza uma escala publicada elegível para exclusão
- **THEN** a interface apresenta a ação de exclusão
- **AND** a exclusão somente ocorre após confirmação
