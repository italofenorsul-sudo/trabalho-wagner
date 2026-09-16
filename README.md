# SCL - Sistema de Licitações (Prefeitura Municipal de Goiana)

Aplicação web para consulta e gestão de licitações públicas, com autenticação
de usuários, controle de acesso por perfil e trilha de auditoria.

Este projeto foi migrado de um protótipo que guardava tudo no `localStorage`
do navegador para uma aplicação completa com **backend em Node.js/Express** e
**banco de dados SQLite**.

## Arquitetura

- **Backend:** Node.js + Express (API REST em `/api/*`)
- **Banco de dados:** SQLite (arquivo único, via `better-sqlite3`)
- **Autenticação:** sessão em cookie `httpOnly` + senhas com hash `bcrypt`
- **Front-end:** HTML/CSS/JS puro (pasta `public/`), consumindo a API via `fetch`

```
├── server.js              # ponto de entrada do servidor Express
├── src/
│   ├── db.js               # conexão SQLite + criação das tabelas
│   ├── seed.js              # dados iniciais de demonstração
│   ├── logs.js               # registro de auditoria
│   ├── validators.js          # validação de e-mail/senha
│   ├── middleware/auth.js       # sessão, exigirLogin, exigirAdmin
│   └── routes/                 # rotas da API (auth, licitacoes, usuarios, logs, dashboard, backup)
├── public/
│   ├── index.html           # interface
│   ├── style.css              # estilos
│   └── app.js                   # lógica do front-end (fetch para a API)
└── data/                    # banco SQLite (criado automaticamente, não versionado)
```

## Como rodar

Pré-requisitos: [Node.js](https://nodejs.org) 18 ou superior.

```bash
npm install
npm start
```

Acesse **http://localhost:3000**.

Na primeira execução, o banco de dados é criado automaticamente em
`data/scl.db` e populado com os dados de demonstração (usuários e
licitações). Para popular manualmente / resetar via linha de comando:

```bash
npm run seed
```

## Usuários de demonstração

| Perfil                    | E-mail                       | Senha         |
|----------------------------|-------------------------------|----------------|
| Administrador               | admin@goiana.pe.gov.br         | `Admin@123`    |
| Usuário comum (acesso completo) | completo@exemplo.com        | `Usuario@123`  |
| Usuário comum (acesso restrito) | restrito@exemplo.com        | `Usuario@123`  |

## Funcionalidades

- Cadastro e login de usuários (senha com hash `bcrypt`, política de
  complexidade mínima e aceite obrigatório dos Termos de Uso)
- Bloqueio temporário após 5 tentativas de login inválidas (15 minutos)
- Logout automático por inatividade (15 minutos)
- Controle de acesso por perfil (`admin` / `comum`) e nível (`completo` /
  `restrito`) — usuários restritos veem apenas os metadados das licitações,
  não o conteúdo integral do edital
- CRUD de licitações e de usuários (restrito a administradores)
- Trilha de auditoria de todas as ações relevantes (login, consultas,
  alterações, exclusões)
- Exportação/importação de backup em JSON e restauração dos dados padrão

## Banco de dados

Tabelas: `usuarios`, `licitacoes`, `assinaturas`, `logs`, `login_locks`.
O schema completo está em `src/db.js`.

## Variáveis de ambiente (opcionais)

| Variável         | Descrição                                             | Padrão |
|------------------|---------------------------------------------------------|--------|
| `PORT`             | Porta HTTP do servidor                                    | `3000` |
| `SESSION_SECRET`    | Segredo usado para assinar o cookie de sessão                | gerado automaticamente e salvo em `data/.session-secret` |

## Observações de segurança

Este é um projeto acadêmico. Para um ambiente de produção real, recomenda-se
adicionalmente: HTTPS obrigatório, proteção CSRF, um *rate limiter* dedicado,
e um *store* de sessão persistente (Redis, etc.) em vez do armazenamento em
memória padrão do `express-session`.
