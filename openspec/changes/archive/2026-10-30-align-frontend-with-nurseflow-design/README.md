# Alinhar a interface de Escala ao NurseFlow Web

Esta change alinha a tela Escala e seus painéis às referências em `design/nurseflow/`.
O foco desta revisão é manter a composição mensal e semanal das capturas, remover
seções extras abaixo do calendário mensal, limitar as ações do cabeçalho às duas
ações ilustradas e reproduzir o carregamento de geração no espaço principal.

## Artefatos

- [Proposal](./proposal.md): objetivo e escopo.
- [Design](./design.md): diferenças observadas, tokens, decisões, ambiguidades e abordagem.
- [Spec](./specs/scale-workflow-interface/spec.md): comportamento observável e cenários.
- [Tasks](./tasks.md): implementação e verificações.

## Referência visual

Use `design/nurseflow/NurseFlow Web - Escala (Mês).png` para a tela mensal,
`design/nurseflow/NurseFlow Web - Escala (Editar).png` para a visão semanal e
`design/nurseflow/NurseFlow Web - Geração de Escala.png` para o estado de geração.
Os dados visíveis nas imagens são exemplos; nomes, datas, equipes e contagens em
produção devem vir dos serviços.

## Estado

Change ativa e em implementação. Não arquivar até que as tarefas e a comparação
visual final estejam concluídas.
