# Proposal

## Why

O Documento de Especificação de Requisitos v3 prevê que o profissional envie os próprios plantões para o calendário pessoal (RU015, RU022, RF013, US17, RNF008; diagrama **DA27**). Hoje o botão *Google Agenda* de **Meus plantões** e o atalho da Visão geral aparecem desabilitados ("Em breve") e `Profissional.sincronizaAgenda` existe, mas nada o usa.

## What Changes

- Conexão por **OAuth 2.0 no backend** para Enfermeiro e Técnico (consentimento explícito, `state` de uso único vinculado ao profissional, acesso offline, escopo único `calendar.events`). Refresh token cifrado em repouso.
- Painel **Google Agenda** em *Meus plantões* com estado e ações *Conectar Google Agenda*, *Sincronizar agora*, *Desativar sincronização* e *Reconectar*; o atalho da Visão geral passa a abrir essa aba.
- **Sincronização unidirecional** NurseFlow → Google: manual (DA27) e automática (US17) após publicação/republicação e troca aprovada, sem duplicatas e sem depender do Google para concluir o fluxo principal.
- Remoção do evento correspondente quando o profissional perde um plantão (decisão de implementação, ver `design.md`).
- Persistência: coleções `integracoesGoogleAgenda`, `eventosGoogleAgenda`, `tarefasGoogleAgenda`, `estadosOauthGoogle` (migration `20261120000013`). Reaproveita `sincronizaAgenda`.
- Configuração (`.env.example`, README) e testes com a API do Google simulada.

## Capabilities

### New Capabilities

- `google-agenda`: conexão, sincronização manual/automática, fila durável e ciclo de vida (desativar/reconectar) da integração de profissionais com o Google Agenda.

### Modified Capabilities

Nenhuma spec vigente é alterada. `publicacao-escalas` e `trocas` ganham apenas um efeito colateral assíncrono (enfileirar tarefas na mesma transação) que não muda seus contratos HTTP nem suas regras.

## Scope Boundaries

**Incluído:** integração do Enfermeiro/Técnico com o calendário principal do Google; bloqueio da Coordenação e de dados de outros profissionais; testes automatizados com mocks.

**Fora do escopo:** importar compromissos do Google; alterar escala a partir do Google; outros provedores (Outlook, iCloud); notificar pelo Google; login com Google; sincronizar rascunhos, revisões abertas ou trocas pendentes; teste real com conta Google (depende de credenciais — ver README).
