const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('../db');
const registrarLog = require('../logs');
const { exigirAdmin } = require('../middleware/auth');
const { validarEmail, validarComplexidadeSenha } = require('../validators');

const router = express.Router();

function paraApi(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    nivelAcesso: u.nivel_acesso,
    status: u.status,
    dataCriacao: u.data_criacao
  };
}

router.get('/', exigirAdmin, (req, res) => {
  const linhas = db.prepare('SELECT * FROM usuarios ORDER BY data_criacao ASC').all();
  res.json({ usuarios: linhas.map(paraApi) });
});

router.post('/', exigirAdmin, async (req, res) => {
  const b = req.body || {};
  const email = String(b.email || '').trim().toLowerCase();
  const nome = String(b.nome || '').trim();

  if (!nome || !validarEmail(email)) {
    return res.status(400).json({ erro: 'Informe nome e e-mail válidos.' });
  }
  if (!b.senha) {
    return res.status(400).json({ erro: 'Para novos cadastros de usuários, a senha é obrigatória.' });
  }
  if (!validarComplexidadeSenha(b.senha)) {
    return res.status(400).json({ erro: 'A senha não atende aos critérios de complexidade configurados.' });
  }
  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existente) {
    return res.status(409).json({ erro: 'Este endereço de e-mail já está cadastrado.' });
  }

  const id = 'usr-' + randomUUID();
  const agora = new Date().toISOString();
  db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, perfil, nivel_acesso, status, termo_aceito, termo_data_hora, termo_versao, data_criacao)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, '1.0-2026', ?)
  `).run(
    id,
    nome,
    email,
    bcrypt.hashSync(b.senha, 10),
    b.perfil === 'admin' ? 'admin' : 'comum',
    b.nivelAcesso === 'completo' ? 'completo' : 'restrito',
    b.status === 'bloqueado' ? 'bloqueado' : 'ativo',
    agora,
    agora
  );

  registrarLog(req.usuarioAtual.email, 'Criação de Usuário', 'Sucesso', `Usuário ${email}`);
  const criado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  res.status(201).json({ usuario: paraApi(criado) });
});

router.put('/:id', exigirAdmin, (req, res) => {
  const existente = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  const b = req.body || {};
  const email = b.email !== undefined ? String(b.email).trim().toLowerCase() : existente.email;
  if (!validarEmail(email)) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  if (email !== existente.email) {
    const conflito = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(email, existente.id);
    if (conflito) return res.status(409).json({ erro: 'Este endereço de e-mail já está cadastrado.' });
  }

  let senhaHash = existente.senha_hash;
  if (b.senha) {
    if (!validarComplexidadeSenha(b.senha)) {
      return res.status(400).json({ erro: 'A nova senha não atende aos critérios de complexidade configurados.' });
    }
    senhaHash = bcrypt.hashSync(b.senha, 10);
  }

  db.prepare(`
    UPDATE usuarios SET nome = ?, email = ?, perfil = ?, nivel_acesso = ?, status = ?, senha_hash = ?
    WHERE id = ?
  `).run(
    b.nome !== undefined ? String(b.nome).trim() : existente.nome,
    email,
    b.perfil === 'admin' ? 'admin' : b.perfil === 'comum' ? 'comum' : existente.perfil,
    b.nivelAcesso === 'completo' ? 'completo' : b.nivelAcesso === 'restrito' ? 'restrito' : existente.nivel_acesso,
    b.status === 'bloqueado' ? 'bloqueado' : b.status === 'ativo' ? 'ativo' : existente.status,
    senhaHash,
    existente.id
  );

  registrarLog(req.usuarioAtual.email, 'Alteração de Usuário', 'Sucesso', `Usuário ${email}`);
  const atualizado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(existente.id);
  res.json({ usuario: paraApi(atualizado) });
});

router.delete('/:id', exigirAdmin, (req, res) => {
  if (req.params.id === req.usuarioAtual.id) {
    return res.status(400).json({ erro: 'Não é permitido excluir o usuário da própria sessão ativa.' });
  }
  const existente = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!existente) return res.status(404).json({ erro: 'Usuário não encontrado.' });

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(existente.id);
  registrarLog(req.usuarioAtual.email, 'Exclusão de Usuário', 'Sucesso', `ID ${existente.id}`);
  res.json({ ok: true });
});

module.exports = router;
