# NurseFlow — Front-end

Aplicação web em React 19, TypeScript e Vite para gestão de profissionais, setores, disponibilidade, configurações e escalas. A tela de escalas inclui calendário mensal e semanal, revisão, edição, validação, publicação, notificações e exportação.

## Requisitos

- Node.js ≥ 24 e npm ≥ 10 (compatíveis com os requisitos do backend)
- Backend acessível em `http://localhost:3000` para autenticação e dados

## Desenvolvimento local

Na raiz do repositório, prepare os serviços e inicie a aplicação:

```bash
npm run setup
npm run db:up
npm run db:setup
npm run dev
```

O frontend fica em http://localhost:5173. No desenvolvimento, o Vite encaminha `/api` para `http://localhost:3000`; por isso não é necessário configurar um `.env` do frontend no fluxo local padrão. O comando `npm run dev` também inicia o backend e aplica migrations pendentes.

Para iniciar somente o frontend, mantenha a API disponível e use:

```bash
cd front-end
npm ci
npm run dev
```

Se a API estiver em outro endereço, defina `VITE_API_URL` no ambiente antes de iniciar o Vite. Para os passos completos de instalação, banco, dados de demonstração e execução com Docker, consulte o [README principal](../README.md).

## Validação

Execute os comandos dentro de `front-end/`:

```bash
npm test
npm run lint
npm run build
```

`npm test` executa os testes Vitest; `npm run build` também verifica os tipos TypeScript antes de gerar os arquivos de produção em `dist/`.
