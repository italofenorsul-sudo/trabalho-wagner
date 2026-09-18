const db = require('../db');

function carregarUsuarioDaSessao(req, res, next) {
  req.usuarioAtual = null;
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.userId);
    if (user && user.status === 'ativo') {
      req.usuarioAtual = user;
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}

function exigirLogin(req, res, next) {
  if (!req.usuarioAtual) {
    return res.status(401).json({ erro: 'Não autenticado. Faça login para continuar.' });
  }
  next();
}

function exigirAdmin(req, res, next) {
  if (!req.usuarioAtual) {
    return res.status(401).json({ erro: 'Não autenticado. Faça login para continuar.' });
  }
  if (req.usuarioAtual.perfil !== 'admin') {
    const registrarLog = require('../logs');
    registrarLog(
      req.usuarioAtual.email,
      'Acesso Não Autorizado Interceptado',
      'Falha',
      'Tentativa de acessar recurso administrativo sem privilégios.'
    );
    return res.status(403).json({ erro: 'Acesso negado: você não possui privilégios de Administrador.' });
  }
  next();
}

module.exports = { carregarUsuarioDaSessao, exigirLogin, exigirAdmin };
