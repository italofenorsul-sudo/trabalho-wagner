const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');
const registrarLog = require('../logs');
const { exigirLogin, exigirAdmin } = require('../middleware/auth');

const router = express.Router();

function paraApi(l) {
  const assinaturas = db.prepare('SELECT nome, funcao, data FROM assinaturas WHERE licitacao_id = ?').all(l.id);
  return {
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
    assinaturas
  };
}

router.get('/', exigirLogin, (req, res) => {
  const { search = '', modalidade = '', situacao = '' } = req.query;
  const admin = req.usuarioAtual.perfil === 'admin';

  let sql = 'SELECT * FROM licitacoes WHERE 1=1';
  const params = [];

  if (!admin) {
    sql += " AND visivel_comum = 'sim'";
  }
  if (search) {
    sql += ' AND (LOWER(numero) LIKE ? OR LOWER(objeto) LIKE ? OR LOWER(processo) LIKE ?)';
    const termo = `%${String(search).toLowerCase()}%`;
    params.push(termo, termo, termo);
  }
  if (modalidade) {
    sql += ' AND modalidade = ?';
    params.push(modalidade);
  }
  if (situacao) {
    sql += ' AND situacao = ?';
    params.push(situacao);
  }
  sql += ' ORDER BY data_abertura DESC';

  const linhas = db.prepare(sql).all(...params);
  res.json({ licitacoes: linhas.map(paraApi) });
});

router.get('/:id', exigirLogin, (req, res) => {
  const l = db.prepare('SELECT * FROM licitacoes WHERE id = ?').get(req.params.id);
  if (!l) return res.status(404).json({ erro: 'Licitação não encontrada.' });
  if (req.usuarioAtual.perfil !== 'admin' && l.visivel_comum !== 'sim') {
    return res.status(403).json({ erro: 'Licitação não disponível para o seu perfil.' });
  }

  let nivelEfetivo = req.usuarioAtual.nivel_acesso;
  if (req.usuarioAtual.perfil === 'admin') {
    const previewMode = req.query.previewMode;
    nivelEfetivo = previewMode === 'restrito' || previewMode === 'completo' ? previewMode : 'completo';
  }

  const resultado = paraApi(l);
  if (nivelEfetivo === 'completo') {
    resultado.conteudoIntegral = l.conteudo_integral;
    resultado.restrito = false;
  } else {
    resultado.conteudoIntegral = null;
    resultado.restrito = true;
  }

  registrarLog(req.usuarioAtual.email, 'Consulta de Licitação', 'Sucesso', `Visualizou edital ${l.numero}`);
  res.json({ licitacao: resultado });
});

router.post('/', exigirAdmin, (req, res) => {
  const b = req.body || {};
  const camposObrigatorios = ['numero', 'ano', 'processo', 'modalidade', 'objeto', 'orgao', 'dataPublicacao', 'dataAbertura', 'situacao'];
  for (const campo of camposObrigatorios) {
    if (b[campo] === undefined || b[campo] === null || b[campo] === '') {
      return res.status(400).json({ erro: `O campo "${campo}" é obrigatório.` });
    }
  }

  const id = 'lic-' + randomUUID();
  const agora = new Date().toISOString();

  db.prepare(`
    INSERT INTO licitacoes (id, numero, ano, processo, modalidade, objeto, orgao, valor_estimado, data_publicacao, data_abertura, local_sessao, situacao, visivel_comum, conteudo_integral, criado_por, criado_em)
    VALUES (@id, @numero, @ano, @processo, @modalidade, @objeto, @orgao, @valorEstimado, @dataPublicacao, @dataAbertura, @localSessao, @situacao, @visivelComum, @conteudoIntegral, @criadoPor, @agora)
  `).run({
    id,
    numero: b.numero,
    ano: parseInt(b.ano, 10) || new Date().getFullYear(),
    processo: b.processo,
    modalidade: b.modalidade,
    objeto: b.objeto,
    orgao: b.orgao,
    valorEstimado: parseFloat(b.valorEstimado) || 0,
    dataPublicacao: b.dataPublicacao,
    dataAbertura: b.dataAbertura,
    localSessao: b.localSessao || null,
    situacao: b.situacao,
    visivelComum: b.visivelComum === 'nao' ? 'nao' : 'sim',
    conteudoIntegral: b.conteudoIntegral || '',
    criadoPor: req.usuarioAtual.email,
    agora
  });

  db.prepare('INSERT INTO assinaturas (licitacao_id, nome, funcao, data) VALUES (?, ?, ?, ?)').run(
    id,
    req.usuarioAtual.nome,
    'Servidor Autenticado',
    agora.split('T')[0]
  );

  registrarLog(req.usuarioAtual.email, 'Gravou Licitação', 'Sucesso', `Registro ${b.numero}`);
  const criada = db.prepare('SELECT * FROM licitacoes WHERE id = ?').get(id);
  res.status(201).json({ licitacao: paraApi(criada) });
});

router.put('/:id', exigirAdmin, (req, res) => {
  const existente = db.prepare('SELECT * FROM licitacoes WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ erro: 'Licitação não encontrada.' });

  const b = req.body || {};
  db.prepare(`
    UPDATE licitacoes SET
      numero = @numero, ano = @ano, processo = @processo, modalidade = @modalidade,
      objeto = @objeto, orgao = @orgao, valor_estimado = @valorEstimado,
      data_publicacao = @dataPublicacao, data_abertura = @dataAbertura, local_sessao = @localSessao,
      situacao = @situacao, visivel_comum = @visivelComum, conteudo_integral = @conteudoIntegral,
      atualizado_em = @agora
    WHERE id = @id
  `).run({
    id: existente.id,
    numero: b.numero ?? existente.numero,
    ano: b.ano !== undefined ? parseInt(b.ano, 10) : existente.ano,
    processo: b.processo ?? existente.processo,
    modalidade: b.modalidade ?? existente.modalidade,
    objeto: b.objeto ?? existente.objeto,
    orgao: b.orgao ?? existente.orgao,
    valorEstimado: b.valorEstimado !== undefined ? parseFloat(b.valorEstimado) || 0 : existente.valor_estimado,
    dataPublicacao: b.dataPublicacao ?? existente.data_publicacao,
    dataAbertura: b.dataAbertura ?? existente.data_abertura,
    localSessao: b.localSessao ?? existente.local_sessao,
    situacao: b.situacao ?? existente.situacao,
    visivelComum: b.visivelComum === 'nao' ? 'nao' : b.visivelComum === 'sim' ? 'sim' : existente.visivel_comum,
    conteudoIntegral: b.conteudoIntegral ?? existente.conteudo_integral,
    agora: new Date().toISOString()
  });

  registrarLog(req.usuarioAtual.email, 'Atualizou Licitação', 'Sucesso', `Registro ${b.numero ?? existente.numero}`);
  const atualizada = db.prepare('SELECT * FROM licitacoes WHERE id = ?').get(existente.id);
  res.json({ licitacao: paraApi(atualizada) });
});

router.delete('/:id', exigirAdmin, (req, res) => {
  const existente = db.prepare('SELECT * FROM licitacoes WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ erro: 'Licitação não encontrada.' });

  db.prepare('DELETE FROM licitacoes WHERE id = ?').run(existente.id);
  registrarLog(req.usuarioAtual.email, 'Removeu Licitação', 'Sucesso', `ID ${existente.id}`);
  res.json({ ok: true });
});

module.exports = router;
