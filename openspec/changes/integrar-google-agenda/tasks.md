# Tasks

## 1. Backend

- [x] 1.1 Configuração `GOOGLE_*` validada em `configuration.ts` (falha rápida se parcial).
- [x] 1.2 Schemas + migration `20261120000013-google-agenda` (validators e índices, incl. TTL do `state`).
- [x] 1.3 Cifra AES-256-GCM, montagem do evento (fuso, virada de dia) e id determinístico.
- [x] 1.4 Cliente Google (OAuth + eventos) com classificação de erros.
- [x] 1.5 Rotas `GET /integracoes/google-agenda`, `POST conectar|sincronizar|desativar` (Enfermeiro/Técnico) e `GET callback` (público, por `state`).
- [x] 1.6 Sincronização com lock por profissional, fila durável, retentativas e worker.
- [x] 1.7 Enfileirar na transação de `publicarEscala` e `TrocasService.aprovar`.

## 2. Frontend

- [x] 2.1 `services/googleCalendar.ts` e `GoogleCalendarPanel` em *Meus plantões* (estados, ações, resultado, reconexão, retorno do OAuth).
- [x] 2.2 Atalho da Visão geral abre *Meus plantões*; `App` abre essa aba ao voltar do Google.

## 3. Testes e documentação

- [x] 3.1 Unitários: cifra, evento/fuso, cliente HTTP, configuração.
- [x] 3.2 E2E com Google simulado: perfis, OAuth, manual, paralelo, falha parcial/total, publicação, alteração, troca, estado antigo, retentativas, reconexão, desativação.
- [x] 3.3 Testes do painel e da página *Meus plantões*.
- [x] 3.4 `.env.example`, `docker-compose.yml` e README (configuração, roteiro com conta de teste).
- [ ] 3.5 Validação real com conta Google de teste (pendente de credenciais — roteiro no README).
