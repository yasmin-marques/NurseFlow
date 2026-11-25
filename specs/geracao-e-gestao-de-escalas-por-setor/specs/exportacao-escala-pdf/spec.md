# Spec: exportação PDF da escala

## Objetivo

Exportar somente escalas oficiais publicadas, identificando o chefe geral e reservando espaço apropriado para assinaturas.

## Requisitos

### Requisito: exportar somente escala publicada

O sistema MUST permitir exportação PDF somente quando existir versão publicada vigente da escala. A interface MUST mostrar o botão de exportação apenas para escalas publicadas; o servidor também deve validar o estado antes de gerar o arquivo.

#### Cenário: exportar escala publicada

- **WHEN** a Coordenação solicita o PDF de escala publicada
- **THEN** o PDF representa a versão publicada vigente e inclui os setores/dados oficiais solicitados

#### Cenário: escala não publicada ou excluída

- **WHEN** a Coordenação consulta uma escala sem publicação vigente ou excluída
- **THEN** a interface não apresenta o botão de exportar
- **AND** uma solicitação direta ao servidor não gera arquivo e informa que não há escala oficial disponível

### Requisito: identificar chefe geral e reservar assinaturas

O PDF MUST identificar como chefe geral o enfermeiro escalado no Internamento, inclusive quando o documento for de outro setor, e MUST reservar espaços ampliados para assinaturas da Coordenação e da Diretoria.

#### Cenário: exportar Emergência

- **WHEN** a Coordenação exporta o PDF da Emergência e há enfermeiro escalado no Internamento
- **THEN** o documento identifica o enfermeiro do Internamento como chefe geral

#### Cenário: assinar documento

- **WHEN** o PDF é apresentado para assinatura
- **THEN** os campos da Coordenação e da Diretoria oferecem mais espaço para assinatura manual que o layout atual
