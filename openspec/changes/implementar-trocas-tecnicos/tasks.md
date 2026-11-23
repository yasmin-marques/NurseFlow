# Tasks

> **Estado:** planejamento da change de Técnico. Todas as tarefas permanecem abertas até haver código e evidência de execução no checkout real.
>
> **Fronteira:** o backend profissional, seus DTOs, idempotência e histórico são compartilhados com `implementar-trocas-enfermeiro`. A Coordenação continua responsável pela decisão e efetivação. Não recriar módulo/serviços/coleções, não alterar `scale-workflow-interface` e não copiar checkboxes da Coordenação como prova de implementação do Técnico.
>
> **Protótipos:** utilizar `design/nurseflow/`, na raiz do projeto, inclusive os três diálogos `Container (sim, aceitar).png`, `Container (sim, recusar).png` e `Container (sim, cancelar).png`.

## 1. Preparação, contrato e dependências

- [ ] 1.1 Ler `proposal.md`, `design.md`, `specs/trocas/spec.md` e verificar o contrato v1 em `../implementar-trocas-enfermeiro/design.md`. **Verificar:** levantar rotas, DTOs, estados e componentes já implementados antes de iniciar trabalho do Técnico.
- [ ] 1.2 Confirmar no checkout a autenticação do perfil `tecnico`, o caminho de `ProfessionalLayout`, as entradas de navegação e o helper HTTP autenticado. **Verificar:** não depender do estado da área administrativa nem alterar a `main` sem intenção.
- [ ] 1.3 Abrir e comparar as 11 imagens de `design/nurseflow/` listadas em `design.md`, separando identidade ilustrativa e dados reais. **Verificar:** registrar os elementos de Recebidas, Enviadas, envio cancelado, passos 1–3, aceite, recusa e modais.
- [x] 1.4 Conferir que a API profissional compartilhada aceita `Perfil.TECNICO` nas rotas de `/trocas/minhas` e notificações. **Verificar:** se faltar rota/validação, corrigir o serviço compartilhado sem criar API exclusiva nem duplicar implementações administrativas.

## 2. Entrada do Técnico e isolamento de sessão

- [x] 2.1 Montar a entrada da página **Minhas trocas** no ramo autenticado do perfil Técnico e integrar menu **Trocas** no layout profissional. **Verificar:** usuário Técnico acessa sua página; não abre placeholder nem interface de Coordenação.
- [ ] 2.2 Integrar o botão **Nova solicitação**, o retorno a Minhas trocas e atalhos da visão geral a partir do contexto Técnico. **Verificar:** início no passo 1, volta sem escrita, contexto de perfil preservado.
- [ ] 2.3 Renderizar identidade, nome e rótulo de função a partir da sessão/cadastro. **Verificar:** nomes e avatares fictícios não permanecem no fluxo de produção.
- [ ] 2.4 Isolar estado, cache, listagem, badge, assistente e notificações na troca de conta/perfil ou logout. **Verificar:** entrar como Técnico B após Técnico A ou Enfermeiro A não exibe dados ou seleção da sessão anterior.

## 3. Listas, cartões, detalhes e contagem

- [x] 3.1 Implementar/parametrizar abas **Recebidas**, **Enviadas** e **Histórico** para Técnico usando o serviço comum. **Verificar:** direção, filtros de participante e atualização de dados reais, com estados vazio/carregamento/erro.
- [ ] 3.2 Construir os cartões da aba Recebidas conforme o protótipo, exibindo os **dois vínculos** e a ação correta para destinatário. **Verificar:** **Você assume** aponta para o plantão do solicitante; nenhum botão de resposta aparece em pedido já respondido.
- [ ] 3.3 Construir os cartões da aba Enviadas e o estado **Enviada e Cancelada** conforme o protótipo. **Verificar:** **Seu plantão** e **Plantão desejado** não são invertidos; cancelada deixa a lista ativa e permanece no Histórico.
- [ ] 3.4 Implementar detalhes e histórico legíveis, com datas, turnos, setores, funções, decisão, autoria/instante disponíveis e motivo de recusa administrativa. **Verificar:** o resumo original persiste após edição oficial posterior, sem inventar dados históricos ausentes.
- [ ] 3.5 Integrar `GET /trocas/minhas/contagem` ao badge do Técnico. **Verificar:** contar apenas recebidas em `aguardando_resposta`; zero não usa fallback fictício, erro não finge zero confirmado e leitura de notificação não altera a contagem.

## 4. Solicitar troca — três etapas

- [ ] 4.1 Implementar o passo **Selecionar meu plantão** com os próprios vínculos futuros da última versão oficial. **Verificar:** data, turno/horário, setor, função, status e identificação de extra quando aplicável; sem plantões de terceiros ou rascunhos.
- [ ] 4.2 Implementar o passo **Selecionar colega e plantão**, consultando pares elegíveis para o vínculo escolhido. **Verificar:** pares distintos do mesmo colega aparecem separadamente; formação/função técnica, disponibilidade, descanso e mesma competência respeitados pela API.
- [ ] 4.3 Implementar o passo **Revisar dados** com os dois plantões, colega e botões Voltar/Enviar solicitação. **Verificar:** não enviar ao avançar ou voltar; mudança do vínculo inicial invalida o par; resultado de consulta atrasada não sobrescreve nova seleção.
- [ ] 4.4 Enviar pelo contrato profissional (`vinculoSolicitanteId`, `vinculoSolicitadoId`, `versaoOficialEsperada`, `operacaoId`) e tratar rejeições do servidor. **Verificar:** pedido confirmado nasce em `aguardando_resposta`, notifica colega, não altera escala nem limite; limite configurável atingido ou versão obsoleta bloqueiam com mensagem.
- [ ] 4.5 Cobrir falha de rede, reenvio e idempotência na solicitação. **Verificar:** repetir a mesma operação não gera dois pedidos; interface mostra sucesso só após estado confirmado pelo servidor.

## 5. Aceite, recusa, cancelamento e modais

- [ ] 5.1 Integrar o modal de **Aceitar troca** do Técnico. **Verificar:** Não/fechar/Escape não enviam, confirmar chama aceite apenas para destinatário pendente, mostra processamento e termina em **Aguardando Coordenação**, sem atualizar Meus plantões.
- [ ] 5.2 Integrar o modal de **Recusar** recebido, separado da recusa administrativa. **Verificar:** só o destinatário em `aguardando_resposta` pode confirmar; grava `recusada_pelo_profissional`, notifica remetente e preserva escala.
- [ ] 5.3 Integrar o modal de **Cancelar solicitação** enviada. **Verificar:** só remetente em `aguardando_resposta` ou `aguardando_coordenacao` pode cancelar; histórico recebe `cancelada`, colega é notificado e fila/contador da Coordenação são atualizados quando aplicável.
- [ ] 5.4 Bloquear visualmente ações não cabíveis, sem substituir a autorização da API. **Verificar:** pedido concluído não aceita nova resposta nem cancelamento; manipulação direta de endpoint retorna erro adequado sem efeitos.
- [ ] 5.5 Implementar acessibilidade e recuperação nos três modais. **Verificar:** foco inicial/retorno, tecla Escape, botões diferenciáveis, mensagem textual, ação única durante processamento e conflito 409 exibido corretamente.

## 6. Notificações e decisão final da Coordenação

- [ ] 6.1 Integrar avisos de troca ao sino já existente no layout profissional, preservando notificações de escala. **Verificar:** destinatário correto para criação, aceite, recusa, cancelamento e decisão; leitura não responde ao pedido e ID de outro usuário é protegido.
- [ ] 6.2 Abrir a solicitação correspondente a partir de uma notificação própria. **Verificar:** direção e detalhes corretos; pedido inexistente ou sem acesso é tratado sem revelar dados.
- [ ] 6.3 Exibir em abas/histórico a etapa **Aguardando Coordenação** e a decisão final. **Verificar:** recusa administrativa mostra motivo, aceite não é chamado de aprovação e solicitação cancelada não pode ser aprovada depois.
- [ ] 6.4 Atualizar **Meus plantões** e **Escala geral** somente a partir de nova versão oficial publicada. **Verificar:** escala idêntica antes/depois do aceite, recusa e cancelamento; aprovação traz as duas alocações reais, sem permuta otimista.

## 7. Segurança, elegibilidade e concorrência

- [ ] 7.1 Testar autorização de Técnico na API e no front-end. **Verificar:** sessão ausente/expirada, papel errado, perfil sem cadastro ativo, pedido de terceiro e acesso direto a ações da Coordenação retornam 401/403/404 conforme padrão sem dados vazados.
- [x] 7.2 Testar permutas entre dois Técnicos e tentativas de alocar Técnico como Enfermeiro ou Enfermeiro-chefe. **Verificar:** formação e função vêm do vínculo oficial; sem regra inventada de compatibilidade por setor.
- [x] 7.3 Testar mesma competência e mesma escala, início do plantão, indisponibilidade, férias/ausência, vínculo externo, sobreposição, descanso, carga/extras e cobertura sem agravamento. **Verificar:** seleção, envio e aceite refletem validação compartilhada, com revalidação após mudança dos dados.
- [ ] 7.4 Testar limite vigente com valores abaixo/no/acima do configurado, inclusive zero e configuração ausente. **Verificar:** solicitante no limite não abre pedido; limite do destinatário ou alcançado após abertura não autoriza troca sozinho, exigindo análise de exceção pela Coordenação.
- [ ] 7.5 Testar reenvio com mesma `operacaoId`, alterações concorrentes de escala, aceite versus recusa e cancelamento versus decisão administrativa. **Verificar:** nenhuma dupla transição, notificação duplicada, contagem indevida ou versão parcial.

## 8. Homologação real, regressões e entrega

- [ ] 8.1 Criar cenário de integração com **Técnico A (remetente), Técnico B (destinatário), Enfermeiro C (função incompatível), Técnico D (terceiro sem participação) e Coordenação E** em escala publicada real/fixture integrada. **Verificar:** dados da API são isolados e os dois vínculos são identificados corretamente.
- [x] 8.2 Executar cenário **Técnico A solicita → Técnico B aceita → Coordenação aprova**. **Verificar:** antes do aceite, fila administrativa sem pedido; depois, pendência única e escala intacta; após aprovação, snapshot oficial novo, dois vínculos permutados, histórico e notificações corretos.
- [ ] 8.3 Executar cenário **Técnico A solicita → Técnico B aceita → Coordenação recusa com motivo**. **Verificar:** motivo visível aos dois Técnicos, nenhuma alteração na escala, limite não consumido.
- [ ] 8.4 Executar **recusa pelo Técnico destinatário** e **cancelamento pelo remetente antes e depois do aceite**. **Verificar:** estados finais e destinatários corretos, fila administrativa esvaziada em cancelamento após aceite e nenhuma escala modificada.
- [ ] 8.5 Comparar a UI com os **11 protótipos** em `design/nurseflow/`, incluindo responsividade, foco/teclado, feedback e ausência de dados fictícios. **Verificar:** os dois plantões permanecem identificáveis em largura estreita e as telas do Técnico são acessíveis.
- [x] 8.6 Executar testes e builds relevantes de frontend e backend, incluindo regressões de publicações, notificações e decisões administrativas. **Verificar:** registrar comandos e resultados reais, distinguir suíte não executada de suíte aprovada.

  Evidências desta execução:
  - `npm --prefix back-end test -- trocas-candidatos.spec.ts`: 3 testes aprovados; comparador antigo/in-memory sem divergências.
  - `npm --prefix back-end run test:e2e -- trocas.e2e-spec.ts`: 14 testes aprovados.
  - `npm --prefix front-end test`: 40 arquivos e 184 testes aprovados.
  - Fluxo administrativo de recusa inválida: 2 testes aprovados no E2E específico.
  - Interação administrativa de recusa: 10 testes aprovados no front-end.
  - Builds de frontend e backend: aprovados anteriormente nesta change.
- [x] 8.7 Documentar rotas e integração usadas, divergências justificadas dos protótipos, evidências dos testes e bloqueios. **Verificar:** checklist só recebe 
`[x]` após implementação **e verificação**; não arquivar, commitar, enviar ou mesclar automaticamente.
