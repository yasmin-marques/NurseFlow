# Design

## Context

A visualização semanal já calcula o estado de cobertura por dia e apresenta a equipe em um único cartão em `front-end/src/pages/Scale/ScalePage.tsx`. Os cartões e seus indicadores compartilham componentes e estilos com outras áreas; o redesenho deve manter seus estados e dados existentes. As referências são `design/nurseflow/dia-com-conflito.png` e `design/nurseflow/dia-sem-conflito.png`.

## Goals / Non-Goals

**Goals:**
- Alinhar a hierarquia do cartão semanal aos dois designs: identificação do dia, estado de cobertura, alerta condicional e composição da equipe.
- Fazer o estado conflitante ser reconhecido imediatamente sem ocultar liderança ou equipes.
- Preservar os dados e a ação de edição existentes em telas estreitas e largas.

**Non-Goals:**
- Alterar as regras que determinam conflitos, cobertura mínima ou disponibilidade.
- Mudar a visualização mensal, a navegação semanal, os dados da API ou as ações de edição.

## Decisions

- Manter o cartão semanal no fluxo atual da página e reorganizar sua composição localmente. Isso limita o impacto, em vez de alterar estilos compartilhados que também afetam calendário e publicação.
- Organizar o cabeçalho com o número do dia em bloco verde-claro, dia da semana, mês/ano, etiqueta de cobertura e ação "Editar". Em conflito, usar também um indicador de revisão vermelho.
- Renderizar uma faixa de alerta vermelha somente quando o estado diário indicar conflito ou cobertura irregular, contendo o motivo já calculado para aquele dia. Dias regulares não exibem faixa vazia nem aviso.
- Destacar a linha da liderança com fundo verde suave em ambos os estados; no estado conflitante, mantê-la após a faixa de alerta. Preservar as seções de enfermeiros e técnicos, nomes, setores, turnos e identificadores acessíveis.
- Considerar as imagens de design como referência de composição e cores, usando os dados dinâmicos da escala em vez dos nomes e quantitativos fictícios nelas.

## Risks / Trade-offs

- [O alerta pode depender apenas de uma parte dos estados atuais de cobertura] → Reutilizar o estado calculado e o texto de pendências/conflitos já exibidos, sem criar um segundo critério de classificação.
- [A composição horizontal pode comprimir ações em telas estreitas] → Permitir quebra/refluxo do cabeçalho e testar a apresentação em larguras menores.
- [A cor isolada pode não comunicar o estado a todos os usuários] → Manter o rótulo textual do estado e a descrição do motivo junto ao tratamento visual.
