const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');
const registrarLog = require('../logs');
const { exigirAdmin } = require('../middleware/auth');
const { restaurarPadrao } = require('../seed');

const router = express.Router();

router.get('/exportar', exigirAdmin, (req, res) => {
  const usuarios = db
    .prepare('SELECT id, nome, email, perfil, nivel_acesso, status, data_criacao FROM usuarios')
    .all()
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      perfil: u.perfil,
      nivelAcesso: u.nivel_acesso,
      status: u.status,
      dataCriacao: u.data_criacao
    }));

  const licitacoes = db.prepare('SELECT * FROM licitacoes').all().map((l) => ({
    id: l.id,
    numero: l.numero,
    ano: l.ano,
    processo: l.processo,
    modalidade: l.modalidade,
    objeto: l.objeto,
    orgao: l.orgao,
    valorEstimado: l.valor_estimado,
    dataPublicacao: l.data_publicacao,
    dataAbertura: l.data_abertura,
    localSessao: l.local_sessao,
    situacao: l.situacao,
    visivelComum: l.visivel_comum,
    conteudoIntegral: l.conteudo_integral,
    assinaturas: db.prepare('SELECT nome, funcao, data FROM assinaturas WHERE licitacao_id = ?').all(l.id)
  }));

  const logs = db.prepare('SELECT * FROM logs').all().map((l) => ({
    id: l.id,
    dataHora: l.data_hora,
    usuario: l.usuario,
    acao: l.acao,
    alvo: l.alvo,
    resultado: l.resultado
  }));

  registrarLog(req.usuarioAtual.email, 'Exportou Backup', 'Sucesso', 'Arquivo JSON sanitizado gerado.');

  res.json({
    usuarios,
    licitacoes,
    logs,
    exportDate: new Date().toISOString(),
    exportedBy: req.usuarioAtual.email
  });
});

router.post('/importar', exigirAdmin, (req, res) => {
  const dados = req.body || {};
  if (!Array.isArray(dados.licitacoes)) {
    return res.status(400).json({ erro: 'Formato inválido: propriedade "licitacoes" ausente ou não é uma lista.' });
  }

  const transacao = db.transaction(() => {
    db.exec('DELETE FROM assinaturas; DELETE FROM licitacoes;');
    const inserirLic = db.prepare(`
      INSERT INTO licitacoes (id, numero, ano, processo, modalidade, objeto, orgao, valor_estimado, data_publicacao, data_abertura, local_sessao, situacao, visivel_comum, conteudo_integral, criado_por, criado_em)
      VALUES (@id, @numero, @ano, @processo, @modalidade, @objeto, @orgao, @valorEstimado, @dataPublicacao, @dataAbertura, @localSessao, @situacao, @visivelComum, @conteudoIntegral, @criadoPor, @agora)
    `);
    const inserirAssinatura = db.prepare('INSERT INTO assinaturas (licitacao_id, nome, funcao, data) VALUES (?, ?, ?, ?)');

    const agora = new Date().toISOString();
    for (const l of dados.licitacoes) {
      const id = l.id || 'lic-' + randomUUID();
      inserirLic.run({
        id,
        numero: l.numero || '',
        ano: parseInt(l.ano, 10) || new Date().getFullYear(),
        processo: l.processo || '',
        modalidade: l.modalidade || 'Pregão Eletrônico',
        objeto: l.objeto || '',
        orgao: l.orgao || '',
        valorEstimado: parseFloat(l.valorEstimado) || 0,
        dataPublicacao: l.dataPublicacao || null,
        dataAbertura: l.dataAbertura || null,
        localSessao: l.localSessao || null,
        situacao: l.situacao || 'Aberta',
        visivelComum: l.visivelComum === 'nao' ? 'nao' : 'sim',
        conteudoIntegral: l.conteudoIntegral || '',
        criadoPor: req.usuarioAtual.email,
        agora
      });
      for (const a of l.assinaturas || []) {
        inserirAssinatura.run(id, a.nome || '', a.funcao || '', a.data || null);
      }
    }

    if (Array.isArray(dados.logs)) {
      db.exec('DELETE FROM logs;');
      const inserirLog = db.prepare(
        'INSERT INTO logs (id, data_hora, usuario, acao, resultado, alvo) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const l of dados.logs) {
        inserirLog.run(l.id || randomUUID(), l.dataHora || agora, l.usuario || 'SISTEMA', l.acao || 'Importação', l.resultado || 'Sucesso', l.alvo || '');
      }
    }
  });

  transacao();

  registrarLog(req.usuarioAtual.email, 'Importou Backup', 'Sucesso', 'Restauração concluída a partir de arquivo JSON.');
  res.json({ ok: true });
});

router.post('/restaurar-padrao', exigirAdmin, (req, res) => {
  restaurarPadrao();
  registrarLog(req.usuarioAtual.email, 'Restauração de Dados Padrão', 'Sucesso', 'Base reinicializada com dados de demonstração.');
  req.session.destroy(() => {
    res.json({ ok: true, mensagem: 'Dados restaurados. Faça login novamente.' });
  });
});

module.exports = router;
