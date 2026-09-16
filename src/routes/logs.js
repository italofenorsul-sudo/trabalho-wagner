const express = require('express');
const db = require('../db');
const registrarLog = require('../logs');
const { exigirLogin, exigirAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', exigirLogin, (req, res) => {
  const linhas =
    req.usuarioAtual.perfil === 'admin'
      ? db.prepare('SELECT * FROM logs ORDER BY data_hora DESC').all()
      : db.prepare('SELECT * FROM logs WHERE usuario = ? ORDER BY data_hora DESC').all(req.usuarioAtual.email);

  res.json({
    logs: linhas.map((l) => ({
      id: l.id,
      dataHora: l.data_hora,
      usuario: l.usuario,
      acao: l.acao,
      alvo: l.alvo,
      resultado: l.resultado
    }))
  });
});

router.delete('/', exigirAdmin, (req, res) => {
  db.prepare('DELETE FROM logs').run();
  registrarLog(req.usuarioAtual.email, 'Purga de Auditoria', 'Sucesso', 'Histórico zerado por administrador.');
  res.json({ ok: true });
});

module.exports = router;
