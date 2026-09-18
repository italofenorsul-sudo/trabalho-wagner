# SCL - Sistema de Licitações (Prefeitura Municipal de Goiana)

Aplicação web para consulta e gestão de licitações públicas, com autenticação
de usuários, controle de acesso por perfil e trilha de auditoria.

## Estrutura do projeto

```
├── src/                  # código-fonte da aplicação
│   ├── index.html          # página principal
│   ├── style.css            # estilos
│   ├── app.js                 # lógica da aplicação
│   └── 404.html              # página de erro customizada
├── config/               # configurações (chaves de armazenamento, parâmetros de segurança)
│   └── config.js
├── data/                 # dados de referência (a aplicação usa localStorage, não lê este arquivo)
│   └── seed-demo.json
├── assets/               # reservado para imagens/ícones (hoje o projeto usa apenas emojis)
├── docs/                 # documentação detalhada
│   └── seguranca-e-ux.md
├── tests/                # roteiro de testes manuais
│   └── checklist-manual.md
├── .vscode/              # configuração do VS Code (extensão recomendada)
├── .gitignore
├── LICENSE
├── package.json          # metadados do projeto (sem dependências externas)
└── README.md
```

## Arquitetura

Aplicação **100% front-end** (HTML/CSS/JS puro, sem frameworks nem
dependências externas), sem servidor nem instalação. Todos os dados
(usuários, licitações, trilha de auditoria) ficam salvos no
**localStorage do navegador**.

- Senhas com hash SHA-256 (Web Crypto API do navegador) antes de salvar
- Sanitização de HTML para evitar XSS ao exibir dados na tela

## Como rodar

Não precisa instalar nada. Duas formas:

**1. Direto no navegador:** dê duplo clique em `src/index.html`.

**2. No VS Code, com Live Server** (recomendado, evita restrições de
`file://` do navegador):
1. Instale a extensão **Live Server** (`ritwickdey.liveserver`) — o VS Code
   já sugere ela ao abrir esta pasta.
2. Clique com o botão direito em `src/index.html` → **"Open with Live Server"**.
3. Abre automaticamente em `http://127.0.0.1:5500/src/index.html`.

## Usuários de demonstração

| Perfil                    | E-mail                       | Senha         |
|----------------------------|-------------------------------|----------------|
| Administrador               | admin@goiana.pe.gov.br         | `Admin@123`    |
| Usuário comum (acesso completo) | completo@exemplo.com        | `Usuario@123`  |
| Usuário comum (acesso restrito) | restrito@exemplo.com        | `Usuario@123`  |

Esses usuários são criados automaticamente na primeira vez que a página é
aberta (dados de demonstração/seed). Uma cópia de referência está em
[`data/seed-demo.json`](data/seed-demo.json).

## Funcionalidades

- Cadastro e login de usuários (senha com hash SHA-256, política de
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

## Recursos de segurança e UX no front-end

Limite de caracteres, campos obrigatórios, máscara de telefone, tipagem de
inputs, feedback de carregamento, página de erro 404 customizada,
tratamento de erros sem expor stack trace, CSP e proteção contra XSS.

Detalhes de cada recurso: [`docs/seguranca-e-ux.md`](docs/seguranca-e-ux.md).
Roteiro pra testar cada um na prática: [`tests/checklist-manual.md`](tests/checklist-manual.md).

## Observações

Como é uma aplicação client-only (sem servidor), os dados ficam apenas no
navegador de quem está usando — não são compartilhados entre pessoas ou
dispositivos diferentes, e são perdidos se o usuário limpar os dados do
site no navegador.
