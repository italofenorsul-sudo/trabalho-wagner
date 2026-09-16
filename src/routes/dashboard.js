const express = require('express');
const db = require('../db');
const { exigirLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', exigirLogin, (req, res) => {
  const admin = req.usuarioAtual.perfil === 'admin';
  const visivelSql = admin ? '' : " AND visivel_comum = 'sim'";
  const totalLicitacoes = db.prepare(`SELECT COUNT(*) AS n FROM licitacoes WHERE 1=1${visivelSql}`).get().n;
  const totalUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;

  const temAcessoCompleto = req.usuarioAtual.nivel_acesso === 'completo' || admin;

  const recentes = db
    .prepare('SELECT * FROM logs WHERE usuario = ? ORDER BY data_hora DESC LIMIT 5')
    .all(req.usuarioAtual.email)
    .map((l) => ({ id: l.id, dataHora: l.data_hora, usuario: l.usuario, acao: l.acao, alvo: l.alvo, resultado: l.resultado }));

  res.json({
    licitacoesVisiveis: totalLicitacoes,
    docsCompletos: temAcessoCompleto ? totalLicitacoes : 0,
    docsRestritos: temAcessoCompleto ? 0 : totalLicitacoes,
    totalUsuarios,
    acoesRecentes: recentes
  });
});

module.exports = router;
