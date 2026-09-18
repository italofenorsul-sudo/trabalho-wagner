# SCL - Sistema de Licitações (Prefeitura Municipal de Goiana)

Aplicação web para consulta e gestão de licitações públicas, com autenticação
de usuários, controle de acesso por perfil e trilha de auditoria.

## Arquitetura

Aplicação **100% front-end**, em um único arquivo HTML (`index.html`), sem
servidor nem instalação. Todos os dados (usuários, licitações, trilha de
auditoria) ficam salvos no **localStorage do navegador**.

- HTML + CSS + JavaScript puro, sem frameworks e sem dependências
- Senhas com hash SHA-256 (Web Crypto API do navegador) antes de salvar
- Sanitização de HTML para evitar XSS ao exibir dados na tela

## Como rodar

Não precisa instalar nada. Duas formas:

**1. Direto no navegador:** dê duplo clique em `index.html`.

**2. No VS Code, com Live Server** (recomendado, evita restrições de
`file://` do navegador):
1. Instale a extensão **Live Server** (`ritwickdey.liveserver`) — o VS Code
   já sugere ela ao abrir esta pasta.
2. Clique com o botão direito em `index.html` → **"Open with Live Server"**.
3. Abre automaticamente em `http://127.0.0.1:5500`.

## Usuários de demonstração

| Perfil                    | E-mail                       | Senha         |
|----------------------------|-------------------------------|----------------|
| Administrador               | admin@goiana.pe.gov.br         | `Admin@123`    |
| Usuário comum (acesso completo) | completo@exemplo.com        | `Usuario@123`  |
| Usuário comum (acesso restrito) | restrito@exemplo.com        | `Usuario@123`  |

Esses usuários são criados automaticamente na primeira vez que a página é
aberta (dados de demonstração/seed).

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

## Observações

Como é uma aplicação client-only (sem servidor), os dados ficam apenas no
navegador de quem está usando — não são compartilhados entre pessoas ou
dispositivos diferentes, e são perdidos se o usuário limpar os dados do
site no navegador.
