const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = require('../db');
const registrarLog = require('../logs');
const { validarEmail, validarComplexidadeSenha } = require('../validators');

const router = express.Router();

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000;
const SESSION_TTL_LEMBRAR_MS = 2 * 60 * 60 * 1000;
const SESSION_TTL_PADRAO_MS = 30 * 60 * 1000;

function usuarioPublico(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    nivelAcesso: user.nivel_acesso,
    status: user.status,
    dataCriacao: user.data_criacao
  };
}

function verificarBloqueio(email) {
  const lock = db.prepare('SELECT * FROM login_locks WHERE email = ?').get(email);
  if (lock && lock.locked_until && Date.now() < Number(lock.locked_until)) {
    const minutosRestantes = Math.ceil((Number(lock.locked_until) - Date.now()) / 60000);
    return `Conta temporariamente bloqueada por repetidas falhas de autenticação. Tente novamente em ${minutosRestantes} minuto(s).`;
  }
  return null;
}

function registrarTentativaFalhada(email) {
  const lock = db.prepare('SELECT * FROM login_locks WHERE email = ?').get(email);
  const attempts = (lock ? lock.attempts : 0) + 1;
  const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOCKOUT_TIME_MS : (lock ? lock.locked_until : null);
  db.prepare(`
    INSERT INTO login_locks (email, attempts, locked_until) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until
  `).run(email, attempts, lockedUntil);
}

function limparTentativasFalhadas(email) {
  db.prepare('DELETE FROM login_locks WHERE email = ?').run(email);
}

router.post('/registrar', (req, res) => {
  const { nome, email: emailBruto, senha, senhaConf, termoAceito } = req.body || {};
  const email = String(emailBruto || '').trim().toLowerCase();
  const nomeLimpo = String(nome || '').trim();

  if (!nomeLimpo || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  }
  if (!validarEmail(email)) {
    return res.status(400).json({ erro: 'Informe um endereço de e-mail válido.' });
  }
  if (!validarComplexidadeSenha(senha)) {
    return res.status(400).json({
      erro:
        'A senha informada não atende aos requisitos mínimos de segurança: mínimo de 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 caractere especial (@$!%*?&#._-).'
    });
  }
  if (senhaConf !== undefined && senha !== senhaConf) {
    return res.status(400).json({ erro: 'A confirmação da senha não confere com a senha digitada.' });
  }
  if (!termoAceito) {
    return res.status(400).json({ erro: 'É obrigatório aceitar os Termos de Uso e Política de Privacidade.' });
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existente) {
    return res.status(409).json({ erro: 'Este endereço de e-mail já está cadastrado.' });
  }

  const id = 'usr-' + randomUUID();
  const senhaHash = bcrypt.hashSync(senha, 10);
  const agora = new Date().toISOString();

  db.prepare(`
    INSERT INTO usuarios (id, nome, email, senha_hash, perfil, nivel_acesso, status, termo_aceito, termo_data_hora, termo_versao, data_criacao)
    VALUES (?, ?, ?, ?, 'comum', 'restrito', 'ativo', 1, ?, '1.0-2026', ?)
  `).run(id, nomeLimpo, email, senhaHash, agora, agora);

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);

  req.session.userId = user.id;
  req.session.cookie.maxAge = SESSION_TTL_LEMBRAR_MS;

  registrarLog(email, 'Novo Cadastro de Usuário', 'Sucesso', 'Conta criada com aceite dos Termos v1.0');

  res.status(201).json({ usuario: usuarioPublico(user) });
});

router.post('/login', (req, res) => {
  const { email: emailBruto, senha, lembrar } = req.body || {};
  const email = String(emailBruto || '').trim().toLowerCase();

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Preencha os campos de usuário e senha.' });
  }

  const mensagemBloqueio = verificarBloqueio(email);
  if (mensagemBloqueio) {
    registrarLog(email, 'Tentativa em Conta Bloqueada', 'Falha', 'Bloqueio temporário por brute-force.');
    return res.status(423).json({ erro: mensagemBloqueio });
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  const senhaConfere = user ? bcrypt.compareSync(senha, user.senha_hash) : false;

  if (!user || !senhaConfere) {
    registrarTentativaFalhada(email);
    registrarLog(email, 'Tentativa de Login Falhada', 'Falha', 'Senha incorreta ou usuário inexistente.');
    return res.status(401).json({ erro: 'Credenciais incorretas. Verifique e tente novamente.' });
  }

  if (user.status === 'bloqueado') {
    registrarLog(email, 'Tentativa de Login Usuário Bloqueado', 'Falha', 'Acesso negado por status inativo/bloqueado.');
    return res.status(403).json({ erro: 'Esta conta de usuário encontra-se bloqueada. Entre em contato com a administração.' });
  }

  limparTentativasFalhadas(email);

  req.session.userId = user.id;
  req.session.cookie.maxAge = lembrar ? SESSION_TTL_LEMBRAR_MS : SESSION_TTL_PADRAO_MS;

  registrarLog(user.email, 'Login Efetuado', 'Sucesso', 'Sessão iniciada com validação de credenciais no servidor.');

  res.json({ usuario: usuarioPublico(user) });
});

router.post('/logout', (req, res) => {
  if (req.usuarioAtual) {
    registrarLog(req.usuarioAtual.email, 'Logout', 'Sucesso', 'Sessão encerrada voluntariamente.');
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.usuarioAtual) {
    return res.status(401).json({ erro: 'Sem sessão ativa.' });
  }
  res.json({ usuario: usuarioPublico(req.usuarioAtual) });
});

router.post('/esqueci-senha', (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!validarEmail(email)) {
    return res.status(400).json({ erro: 'Informe um endereço de e-mail válido.' });
  }
  registrarLog(email, 'Solicitação de Redefinição de Senha', 'Sucesso', 'Token enviado para homologação administrativa');
  res.json({
    ok: true,
    mensagem: `Solicitação registrada para o e-mail: ${email}. Por razões de segurança, entre em contato com o Administrador para autorizar e redefinir sua chave.`
  });
});

module.exports = router;
