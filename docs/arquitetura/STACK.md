# Stack do Projeto — Sistema de Escalas de Plantão

Este documento identifica as tecnologias e ferramentas usadas no projeto e como elas se encaixam na arquitetura.

## 1. Visão geral

| Camada | Tecnologia |
|---|---|
| Front-end | React + TypeScript + Tailwind CSS |
| Back-end | NestJS (sobre Express) |
| API | REST |
| Banco de dados | MongoDB |
| Infraestrutura | Docker |
| Ferramentas de IA | Claude Code, ChatGPT, GitHub Copilot |

## 2. Arquitetura

```
┌──────────────────────────┐
│  Front-end               │
│  React + TS + Tailwind   │
└────────────┬─────────────┘
             │ HTTP / JSON (API REST)
┌────────────▼─────────────┐
│  Back-end                │
│  NestJS (Express)        │
└────────────┬─────────────┘
             │
┌────────────▼─────────────┐
│  MongoDB                 │
└──────────────────────────┘

Todos os serviços empacotados em containers Docker
```

## 3. Front-end

### React
Biblioteca para construção da interface em componentes. Adequada para as telas do sistema, como calendário da escala, lista de plantões, pedidos de troca e notificações.

### TypeScript
Tipagem estática no front-end. Os tipos das entidades do diagrama de classes (`Escala`, `Plantao`, `ProfissionalSaude`, `TrocaPlantao`, entre outras) e os enums (`StatusEscala`, `StatusTroca`, `TipoPlantao`) podem ser espelhados como interfaces e tipos.

### Tailwind CSS
Framework de estilos utilitário, que acelera a construção de interfaces consistentes e responsivas (importante para uso em celular por profissionais em plantão).

## 4. Back-end

### NestJS
Framework Node.js com TypeScript, organizado em módulos, controllers e services. Combina bem com o domínio do projeto. Uma divisão natural de módulos:

| Módulo | Responsabilidade |
|---|---|
| `auth` / `usuarios` | Autenticação, `Administrador` e `ProfissionalSaude` |
| `escalas` | Escalas e seus plantões |
| `plantoes` | Alocação de profissionais |
| `setores` | Cadastro de setores e quantidades mínimas |
| `trocas` | Fluxo de troca de plantão |
| `restricoes` / `ferias` | Disponibilidade dos profissionais |
| `configuracoes` | Limites do sistema |
| `notificacoes` | Envio e leitura de notificações |

### Express
Servidor HTTP que o NestJS usa por padrão (`@nestjs/platform-express`). Não é preciso instalá-lo separadamente nem escrever um servidor Express à parte; ele já faz parte do NestJS. Pode ser acessado diretamente quando necessário (por exemplo, para middlewares específicos).

### API REST
A comunicação entre front-end e back-end é feita por endpoints REST em JSON. Exemplos de recursos:

| Recurso | Exemplos de rotas |
|---|---|
| Escalas | `GET /escalas`, `POST /escalas`, `PATCH /escalas/:id/publicar` |
| Plantões | `GET /escalas/:id/plantoes`, `PATCH /plantoes/:id/alocar` |
| Trocas | `POST /trocas`, `PATCH /trocas/:id/aceitar`, `PATCH /trocas/:id/aprovar` |
| Notificações | `GET /notificacoes`, `PATCH /notificacoes/:id/lida` |

## 5. Banco de dados

### MongoDB
Banco de dados NoSQL orientado a documentos. Como o modelo original (DER) é relacional, vale decidir como mapear as relações:

| Entidade | Sugestão de mapeamento |
|---|---|
| `Ferias`, `Restricao` | Embutidas no documento do profissional (ou coleção própria, se crescerem muito) |
| `Plantao` | Coleção própria, referenciando escala, setor e profissional |
| `TrocaPlantao` | Coleção própria, referenciando solicitante, destinatário e plantão |
| `Notificacao` | Coleção própria, referenciando o profissional |
| `Escala`, `Setor`, `Configuracao` | Coleções próprias |

Para integrar com o NestJS, as opções mais comuns são **Mongoose** (`@nestjs/mongoose`) ou **Typeorm/MikroORM** com suporte a Mongo.

## 6. Infraestrutura

### Docker
Empacota cada parte do sistema em containers, garantindo o mesmo ambiente em desenvolvimento e produção. Uma composição típica com Docker Compose:

| Serviço | Descrição |
|---|---|
| `frontend` | Aplicação React (build servida por Nginx ou similar) |
| `backend` | API NestJS |
| `mongo` | MongoDB com volume para persistência |

## 7. Ferramentas de IA no desenvolvimento

| Ferramenta | Uso sugerido |
|---|---|
| **Claude Code** | Trabalho agentic no repositório: criar módulos, refatorar, escrever testes, ajustar várias partes do código de uma vez |
| **ChatGPT** | Consultas pontuais, brainstorming de arquitetura e revisão de ideias |
| **GitHub Copilot** | Autocompletar dentro do editor durante a escrita do código |

Boa prática: manter um arquivo de contexto do projeto (por exemplo, `CLAUDE.md`) com a stack, a estrutura de pastas e as convenções, para que as ferramentas gerem código alinhado ao projeto.

## 8. Pontos de atenção

- **Modelo relacional em banco NoSQL:** o DER tem muitas relações (escala → plantão → profissional → troca). Definir cedo o que é embutido e o que é referenciado evita retrabalho.
- **Integridade das regras de negócio:** limites de plantões, trocas e quantidades mínimas por setor devem ser validados no back-end (services do NestJS), não só no front.
- **Transações:** operações como aprovar uma troca alteram mais de um documento. O MongoDB suporta transações, mas só em replica set, e isso precisa estar configurado no container.
- **Segurança:** o sistema guarda CPF e senha. Use hash de senha (por exemplo, bcrypt), autenticação com JWT e controle de acesso por perfil (administrador x profissional).
- **Validação e tipos compartilhados:** usar DTOs com `class-validator` no NestJS e, se possível, compartilhar os tipos entre front e back.