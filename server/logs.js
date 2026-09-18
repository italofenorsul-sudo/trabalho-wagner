const { randomUUID } = require('crypto');
const db = require('./db');

function registrarLog(usuario, acao, resultado, alvo) {
  db.prepare(`
    INSERT INTO logs (id, data_hora, usuario, acao, resultado, alvo)
    VALUES (?, datetime('now'), ?, ?, ?, ?)
  `).run(randomUUID(), usuario || 'SISTEMA_ANONIMO', acao, resultado, alvo || '');
}

module.exports = registrarLog;
