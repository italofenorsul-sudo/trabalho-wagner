const rateLimit = require('express-rate-limit');

// Ponto-chave de segurança 3: Rate Limiting (Limite de Requisições).
// Evita ataques de força bruta feitos por robôs/scripts: se o MESMO IP
// tentar logar (ou se cadastrar) mais de 10 vezes em 1 minuto, o back-end
// bloqueia temporariamente aquele IP com HTTP 429, independente de qual
// e-mail está sendo testado. Isso é complementar ao bloqueio por conta
// (login_locks), que trava um e-mail específico após 5 falhas.
const limitadorLogin = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 10, // no máximo 10 requisições por IP nesse período
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas em pouco tempo a partir deste endereço. Aguarde um minuto e tente novamente.' }
});

module.exports = { limitadorLogin };
