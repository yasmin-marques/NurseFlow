# Proposal

## Why

Os cartões da visualização semanal não distinguem com clareza a apresentação esperada para dias com e sem conflito. As referências em `design/nurseflow/dia-com-conflito.png` e `design/nurseflow/dia-sem-conflito.png` mostram uma hierarquia visual mais clara para identificar o dia, revisar a cobertura e localizar a liderança.

## What Changes

- Reorganizar os cartões diários da visualização semanal para corresponder às referências de design fornecidas.
- Destacar conflitos com aviso visual vermelho e manter a apresentação sem aviso nos dias regulares.
- Preservar dados da equipe, indicadores de cobertura e ação de edição existentes, adaptando sua hierarquia e apresentação ao cartão de referência.

## Capabilities

### New Capabilities

### Modified Capabilities
- `scale-workflow-interface`: definir o tratamento visual dos cartões semanais com e sem conflito.

## Impact

- Interface da escala semanal em `front-end/src/pages/Scale/ScalePage.tsx` e componentes visuais relacionados.
- Testes de apresentação da escala semanal e especificação vigente `openspec/specs/scale-workflow-interface/spec.md`.
- Referências visuais existentes em `design/nurseflow/dia-com-conflito.png` e `design/nurseflow/dia-sem-conflito.png`.
- Nenhuma alteração de API ou de comportamento de geração de escalas.
