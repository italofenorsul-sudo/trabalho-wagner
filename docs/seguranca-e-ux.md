# Recursos de segurança e UX no front-end

Documentação detalhada de cada recurso implementado e onde encontrá-lo no código.

## 1. Limite de caracteres
`maxlength` em todos os campos de texto, e contador de caracteres visível
nos campos maiores (objeto e conteúdo integral da licitação).
Evita envio de volumes de dados desnecessariamente grandes.
**Onde:** `src/index.html` (atributos `maxlength`), `src/app.js` (função `atualizarContador`).

## 2. Campos obrigatórios
Atributo `required` em todo formulário que precisa de dado para funcionar
— garante que o estado da aplicação fique consistente antes de processar.
**Onde:** `src/index.html`.

## 3. Máscara de entrada
Campo de telefone formata automaticamente como `(00) 00000-0000` enquanto
o usuário digita.
**Onde:** `src/app.js`, função `aplicarMascaraTelefone`.

## 4. Tipagem de inputs
`type="email"`, `type="number"`, `type="tel"`, `type="date"` para o
navegador validar o formato antes mesmo do clique em enviar.
**Onde:** `src/index.html`.

## 5. Feedback de carregamento
Um overlay com spinner aparece durante ações que processam dados (login,
cadastro, salvar licitação/usuário), desabilitando o botão de envio para
evitar cliques repetidos.
**Onde:** `src/app.js`, funções `mostrarCarregando` / `ocultarCarregando`.

## 6. Página de erro customizada
`src/404.html`, para quando a aplicação é publicada em um servidor
estático e alguém acessa um link inválido.

## 7. Tratamento de erros no front-end
Um handler global captura qualquer erro de JavaScript não tratado e
mostra um aviso genérico e amigável (toast). O erro técnico completo
(stack trace) fica só no console do navegador — nunca é exposto na tela
para o usuário.
**Onde:** `src/app.js`, listeners de `error` e `unhandledrejection`.

## 8. CSP (Content Security Policy)
Configurada via `<meta>` no `<head>`, restringindo de onde scripts e
estilos podem ser carregados (`default-src 'self'`).
**Onde:** `src/index.html`.

## 9. Proteção contra XSS
Toda informação vinda do usuário passa por `escapeHTML()` antes de ser
inserida na tela, evitando que um texto malicioso (ex: `<script>`) seja
executado como código.
**Onde:** `src/app.js`, função `escapeHTML`.

Como testar cada ponto na prática: ver [`../tests/checklist-manual.md`](../tests/checklist-manual.md).
