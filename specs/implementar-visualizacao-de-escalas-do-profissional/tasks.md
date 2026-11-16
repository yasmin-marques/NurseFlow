# Tasks

## 1. API de leitura (profissional)

- [x] 1.1 Criar `EscalaProfissionalController` (sem `@Perfis`) registrado no `EscalasModule`, com guard de vínculo (403 sem `profissionalId`) e DTOs de query validados (`situacao`, `pagina`, `limite`, `ano`, `mes`, `data`). **Verificar:** 401 sem token, 403 sem vínculo, 400 para parâmetros inválidos, sem colisão com `/escalas/:id`.
- [x] 1.2 Implementar `meus-plantoes` no `EscalasService`: última `VersaoEscala` por mês, filtro pelo profissional da sessão, equipe (chefe, enfermeiros, outros técnicos), `status` por `data + horarioFim`, ordenação e paginação. **Verificar:** Próximos crescente e Anteriores cronológico; plantão noturno só vira "anterior" após o término; nenhum parâmetro de profissional é aceito.
- [x] 1.3 Implementar `geral` (mês) e `geral/dia` (detalhe): turno, chefe, setor, enfermeiros/técnicos com cargo, setor e `regime` derivado de `origemCobertura`, contagens. **Verificar:** funciona com snapshots sem `visualizacao`; mês sem versão retorna `publicada:false`.
- [x] 1.4 Reaproveitar/extrair o resolvedor de nomes e setores existente e serializar somente campos permitidos. **Verificar:** asserção de ausência de CPF, COREN, e-mail, telefone e restrições nas respostas.

## 2. Front-end: serviços e layout

- [x] 2.1 Criar `services/professionalSchedule.ts` com tipos e funções (`getMyShifts`, `getGeneralMonth`, `getGeneralDay`) via `api`. **Verificar:** testes de URL/serialização e erro.
- [x] 2.2 Criar `ProfessionalLayout` com barra superior (marca, abas Início/Meus plantões/Escala geral/Trocas, `NotificationCenter`, nome e perfil) e comportamento responsivo. **Verificar:** aba ativa destacada, teclado e `aria-current`.
- [x] 2.3 Ajustar `App.tsx`: Enfermeiro/Técnico usam `ProfessionalLayout` e as novas páginas; Início mantém `OverviewPage`; Trocas mostra estado "em preparação" sem contador; Coordenação inalterada. **Verificar:** nenhum perfil não administrativo vê o placeholder em Meus plantões/Escala geral nem itens de gestão.

## 3. Tela Meus plantões

- [x] 3.1 Criar `MyShiftsPage` com cabeçalho "Minha escala / Meus plantões", abas Próximos/Anteriores (semântica de tabs) e cartões conforme protótipo (dia, duração/horário, setor, chefe, "Enfermeiros", "Outros técnicos", selo TRABALHANDO/TRABALHADO). **Verificar:** corresponde aos dois protótipos; selos são texto.
- [x] 3.2 Implementar estados carregando, vazio e erro com "Tentar novamente", "carregar mais" nas Anteriores e descarte de respostas obsoletas ao trocar de aba. **Verificar:** estados distintos e anunciados.
- [x] 3.3 Exibir o botão "Google Agenda" desabilitado (`disabled`, `aria-disabled`, dica "Em breve"), sem chamada de rede; documentar a sincronização como follow-up. **Verificar:** botão não é acionável por clique nem teclado e não dispara requisição.

## 4. Tela Escala geral

- [x] 4.1 Criar `GeneralSchedulePage` com título, mensagem de privacidade, seletor de mês, navegação de semana com intervalo e grade de cartões diários (turno/horário, responsável, setor/área; dia sem plantão indicado). **Verificar:** semana cruzando meses atualiza o mês exibido; datas em UTC.
- [x] 4.2 Criar modal de detalhes do dia (cabeçalho com data/"Cobertura diária"/mês-ano, chefe, listas de enfermeiros e técnicos com setor e regime) com rolagem interna e cabeçalho fixo. **Verificar:** lista longa rola sem rolar o fundo; Esc/botão/clique fora fecham; foco retorna ao cartão.
- [x] 4.3 Estados de carregamento, "escala não publicada" e erro com nova tentativa. **Verificar:** textuais e acessíveis (axe sem violações).

## 5. Testes e validação

- [x] 5.1 e2e da API: isolamento entre dois profissionais, só versão publicada (rascunho e revisão não vazam), mês sem escala, Próximos/Anteriores na virada de dia, 401/403/400 e ausência de dados pessoais. **Verificar:** suíte com MongoDB replica set passa.
- [x] 5.2 Testes de componente: layout/abas, Meus plantões (abas, vazio, erro), Escala geral (semana/mês, modal, teclado/foco, rolagem) e roteamento por perfil no `App`. **Verificar:** suíte do front-end passa sem regressão de `ScalePage`/`SideMenu`.
- [ ] 5.3 Executar `npm test` e `npm run build` no back-end e no front-end; validar manualmente com usuários seed (Enfermeiro e Técnico) após publicar uma escala, inclusive uma troca aprovada. **Verificar:** telas correspondem aos protótipos e à escala oficial.
- [x] 5.4 Atualizar Swagger/README com as rotas `escala-profissional`. **Verificar:** documentação corresponde à implementação.
