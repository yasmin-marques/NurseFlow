# Proposal

## Why

Hoje só a Coordenação tem telas funcionais de escala. Enfermeiros e técnicos autenticados enxergam apenas "Visão geral" e Perfil; ao abrir "Escala" caem no placeholder "Esta área ainda está sendo preparada". O profissional não consegue consultar no sistema **quando trabalha** nem **quem está de plantão**, o que contraria o objetivo de substituir escalas distribuídas por papel e links externos.

Os protótipos em `design/nurseflow/` definem a experiência do profissional: **Meus plantões** (abas Próximos/Anteriores), **Escala geral** (semana a semana, com detalhe do dia) e uma navegação própria no topo.

## What Changes

- **Layout do profissional** (Enfermeiro/Técnico): barra superior com marca, abas "Início", "Meus plantões", "Escala geral" e "Trocas", sino de notificações e identificação do usuário (nome/perfil), conforme os protótipos. Substitui o menu lateral apenas para esses perfis; a Coordenação mantém o layout atual.
- **Meus plantões** (`Escada Própria (Próxima|Anterior)`): lista cronológica dos plantões do próprio profissional na escala oficial, com abas **Próximos** (selo "TRABALHANDO") e **Anteriores** (selo "TRABALHADO"). Cada cartão mostra dia/dia da semana, duração e horário (ex.: "24 horas · 07h—07h"), setor, enfermeiro chefe e as equipes do plantão ("Enfermeiros" e "Outros técnicos", só nomes).
- **Escala geral** (`Escala Geral` e `Escala Geral (Detalhes)`): visão da equipe, sem dados pessoais, com seletor de mês, navegação "Semana anterior / Próxima semana" e um cartão por dia (turno diurno/noturno e horário, nome do responsável/chefe, setor/área). Ao selecionar um dia abre um modal rolável com a cobertura diária: enfermeiro chefe (liderança geral), lista de enfermeiros e de técnicos com setor e regime de cada um (ex.: 24 h, diurno com restrição, noturno de cobertura).
- **API somente leitura** para os dois fluxos, acessível a usuários com vínculo de profissional: os próprios plantões e a visão geral da escala publicada. A identidade vem do JWT; nunca de parâmetro do cliente.
- Somente a **versão oficial publicada** é exposta; rascunhos e revisões em andamento nunca aparecem. Nenhum CPF, COREN, e-mail, telefone ou restrição é serializado.
- Roteamento em `App.tsx` por perfil: a Coordenação continua nas telas atuais; Enfermeiro/Técnico usam o novo layout e as novas páginas.

## Capabilities

### New Capabilities

- `escala-individual`: "Meus plantões" — consulta somente leitura dos próprios plantões publicados (próximos e anteriores) com equipe.
- `escala-geral`: consulta somente leitura da escala publicada da equipe, por mês/semana, com detalhe diário sem dados pessoais.

### Modified Capabilities

- `scale-workflow-interface`: navegação e layout dos perfis Enfermeiro/Técnico (barra superior) e roteamento por perfil, sem alterar a experiência da Coordenação.

## Scope Boundaries

**Incluído:** API de leitura (própria e geral); layout com navegação superior para profissionais; telas Meus plantões e Escala geral (com modal de detalhes); ajustes em `App.tsx`; testes de API e interface.

**Fora do escopo:** a sincronização com **Google Agenda** (capacidade separada; nesta mudança o botão do protótipo é exibido **desabilitado**, sem ação); a aba **Trocas** do profissional (RF015/RF016) e seu contador; a aba "Início" além de manter a Visão geral existente; edição, exportação PDF, notificações novas, disponibilidade/extras e qualquer mudança de schema ou migração.

## Impact

- **API NestJS:** novo controller de leitura sem `@Perfis` (o `EscalasController` é restrito à Coordenação por classe) e métodos novos em `EscalasService` sobre o snapshot da última `VersaoEscala`. Sem schemas, índices ou migrações novos.
- **Front-end React:** novo layout de topo, duas páginas, serviços tipados e ajuste de `App.tsx`. `NotificationCenter` existente deve ser reaproveitado.
- **Testes:** e2e (isolamento, publicada, privacidade) e de interface/acessibilidade.

## References and Dependencies

**Protótipos (novos, ainda não versionados):** `NurseFlow Web - Escada Própria (Próxima).png`, `NurseFlow Web - Escada Própria (Anterior).png` (grafia "Escada" é a do arquivo), `NurseFlow Web - Escala Geral.png`, `NurseFlow Web - Escala Geral (Detalhes).png`. `Frame 4.png` é só um marcador "SCROLL HERE": indica que o modal de detalhes rola internamente.

**Confirmado no checkout:** `App.tsx` só renderiza `ScalePage` para `coordenacao`; `SideMenu` é o único layout; `UsuarioAutenticado.profissionalId` existe; `EscalasService` lê snapshots imutáveis de `VersaoEscala` e já resolve nomes e setores; `Profissional.sincronizaAgenda` existe, mas não há integração com Google Agenda.

**Decisões confirmadas:** "Escala geral" mostra os plantões publicados do mês a qualquer profissional com vínculo (sem dados pessoais); o "enfermeiro chefe" é o integrante com `lideranca = true`; o botão Google Agenda aparece desabilitado; a aba Trocas do profissional será implementada posteriormente (por ora, estado "em preparação"). **Premissa:** os selos TRABALHANDO/TRABALHADO derivam do horário de término do plantão.
