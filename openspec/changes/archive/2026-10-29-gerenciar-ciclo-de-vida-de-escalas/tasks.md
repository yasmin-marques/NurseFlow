# Tasks

## 1. Persistência e consistência do ciclo de vida

- [x] 1.1 Criar migrations e schemas para estados de revisão/validação, revisão concorrente, snapshots publicados, auditoria e notificações; migrar escalas existentes como versão 1 sem perder dados e validar com testes de migration.
- [x] 1.2 Configurar MongoDB local e MongoDB de integração como replica sets de nó único; verificar inicialização, healthcheck, transação confirmada e rollback em teste e2e.
- [x] 1.3 Criar uma abstração reutilizável de transação MongoDB e aplicá-la à gravação/regravação da geração; validar commit, rollback e geração sem gravações parciais em testes.

## 2. API de geração, CRUD e validação

- [x] 2.1 Implementar consulta de escalas por período, criação manual de rascunho e remoção confirmada de rascunho; documentar contratos no Swagger e testar ausência, duplicidade, autorização e remoção consistente.
- [x] 2.2 Implementar inclusão e edição de plantões com seleção de profissionais elegíveis, verificação de função, disponibilidade, descanso, sobreposição, carga e cobertura; testar sucesso e cada rejeição sem persistir alterações parciais.
- [x] 2.3 Ampliar a geração para receber setores/turnos escolhidos e manter compatibilidade com `POST /escalas/gerar`; testar com o otimizador regras de cobertura, indisponibilidade, descanso e carga.
- [x] 2.4 Implementar validação explícita e transições condicionais de estado, incluindo invalidação após edição, cálculo percentual de cobertura e erros de conflito para clientes desatualizados; cobrir transições válidas e inválidas em testes e2e.
- [x] 2.5 Implementar início de revisão a partir da última versão publicada, leitura da versão oficial e leitura de auditoria; testar que alterações no rascunho não modificam snapshots já publicados.

## 3. Interface de criação, revisão e calendário

- [x] 3.1 Criar serviço front-end tipado para listar, consultar, criar, editar, validar e remover escalas pela API; testar serialização, respostas de erro e estados de carregamento.
- [x] 3.2 Substituir o placeholder da área Escala por calendário mensal/semanal com navegação, legenda acessível, estados, cobertura, conflitos, extras e cargas; testar alternância de visualização, períodos vazios e indicadores.
- [x] 3.3 Implementar diálogo de geração com período, setores e turnos, progresso, cancelamento e apresentação de resultado/erros; testar validações do formulário, falhas do otimizador e abertura do rascunho.
- [x] 3.4 Implementar revisão agrupada por data/turno, detalhes e edição de plantão/equipe, incluindo pesquisa de técnicos cadastrados; testar edição válida, conflitos, 12h diurno/noturno e revalidação obrigatória.
- [x] 3.5 Implementar fluxo manual de inclusão de plantões e confirmação para remoção de rascunho; testar que a interface reflete o resultado persistido e que não permite excluir escala publicada.

## 4. Publicação, notificações e exportação

- [x] 4.1 Implementar publicação validada com confirmação explícita de pendências, snapshot imutável, versão e auditoria; testar bloqueio de conflitos, repetição idempotente e preservação da versão publicada.
- [x] 4.2 Implementar listagem e marcação de notificações de publicação/alteração por usuário, além do painel acessível na interface; testar isolamento por usuário, persistência de leitura e ausência de duplicidade.
- [x] 4.3 Implementar geração PDF geral e por setor com assinaturas, pendências explícitas e estilo legível em preto e branco; testar conteúdo, cabeçalhos, segregação por setor e respostas para escala não publicada.
- [x] 4.4 Integrar os fluxos de publicação, notificações e exportação à interface da escala; testar confirmação com/sem pendências, acesso ao documento e atualização visual do estado publicado.
- [x] 4.5 Aplicar transações e idempotência a todas as operações de edição, transição, snapshot e notificação; verificar rollback, repetição da publicação e concorrência em testes de serviço.

## 5. Integração e documentação

- [x] 5.1 Atualizar documentação do back-end e instruções de ambiente para as rotas do ciclo de vida, configuração MongoDB replica set e exportação; verificar que comandos e contratos documentados correspondem ao Swagger e ao Compose.
- [x] 5.2 Executar os testes focados de back-end, integração, otimizador e front-end e corrigir regressões relacionadas à escala; verificar todos os fluxos principais em uma escala de teste do início à exportação.
