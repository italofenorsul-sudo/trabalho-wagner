# Checklist de testes manuais

Este projeto não usa um framework de testes automatizados (é uma aplicação
100% front-end, sem processo de build). Este documento é o roteiro de
testes manuais, cobrindo os recursos de segurança e UX documentados em
[`../docs/seguranca-e-ux.md`](../docs/seguranca-e-ux.md).

Abra `src/index.html` (ou use Live Server) antes de começar.

- [ ] **Limite de caracteres** — Login como admin → "Licitações" → "+ Cadastrar
      Licitação" → no campo "Objeto Resumido", digite mais de 500 caracteres.
      Esperado: o campo para de aceitar e o contador mostra `500/500`.

- [ ] **Campos obrigatórios** — No mesmo formulário, deixe "Número da
      Licitação" vazio e clique em "Salvar".
      Esperado: o navegador bloqueia o envio com um aviso.

- [ ] **Máscara de telefone** — Na tela de login, clique em "Criar Conta" →
      no campo "Telefone", digite `81987654321`.
      Esperado: o valor vira `(81) 98765-4321` automaticamente.

- [ ] **Tipagem de inputs** — No formulário de licitação, clique no campo
      "Ano" e tente digitar uma letra.
      Esperado: o navegador não aceita (campo é `type="number"`).

- [ ] **Feedback de carregamento** — Preencha o formulário de licitação
      corretamente e clique em "Salvar".
      Esperado: aparece rapidamente um overlay escuro com spinner
      ("Salvando licitação...") antes de fechar o modal.

- [ ] **Página de erro 404** — Abra `src/404.html` diretamente no navegador.
      Esperado: página customizada "404 - Página não encontrada", com botão
      para voltar ao início.

- [ ] **Tratamento de erros** — Abra o DevTools (F12) → aba Console → cole
      `throw new Error("teste")` e aperte Enter.
      Esperado: aparece um toast de aviso amigável no canto da tela; o erro
      técnico completo fica só no console, não é exposto na interface.

- [ ] **CSP (Content Security Policy)** — DevTools (F12) → aba Elements →
      procure a tag `<head>`.
      Esperado: existe uma `<meta http-equiv="Content-Security-Policy" ...>`.

- [ ] **Proteção contra XSS** — Crie uma conta nova, no campo "Nome
      Completo" digite `<script>alert('hack')</script>`.
      Esperado: o texto aparece na tela literalmente (como texto), o script
      não é executado.
