const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const db = require('./db');
const { seed } = require('./seed');
const { carregarUsuarioDaSessao } = require('./middleware/auth');
const SQLiteSessionStore = require('./sessionStore');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SECRET_PATH = path.join(DATA_DIR, '.session-secret');

// Ponto-chave de confidencialidade: o segredo da sessão nunca fica
// hard-coded no código-fonte nem é devolvido em nenhuma resposta da API.
// Se existir a variável de ambiente SESSION_SECRET, ela tem prioridade
// (é assim que se configura um segredo em produção, fora do repositório
// de código); senão, um segredo aleatório é gerado uma única vez e salvo
// em disco (fora do controle de versão — ver .gitignore).
function obterSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  const novoSegredo = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRET_PATH, novoSegredo, { mode: 0o600 });
  return novoSegredo;
}

function criarApp() {
  const totalUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  if (totalUsuarios === 0) {
    seed();
    console.log(`[worker ${process.pid}] Banco de dados vazio: dados iniciais (seed) criados automaticamente.`);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  // Ponto-chave de disponibilidade: nenhuma requisição pode ficar presa
  // indefinidamente segurando o processo. Se o processamento de uma
  // requisição não terminar em 10s, ela é encerrada com 503 — assim uma
  // requisição pesada/travada não consome o worker pra sempre.
  app.use((req, res, next) => {
    res.setTimeout(10_000, () => {
      if (!res.headersSent) {
        res.status(503).json({ erro: 'O servidor demorou demais para responder. Tente novamente.' });
      }
    });
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';"
    );
    next();
  });

  app.use(
    session({
      name: 'scl.sid',
      store: new SQLiteSessionStore(),
      secret: obterSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY_SSL === 'true',
        maxAge: 30 * 60 * 1000
      }
    })
  );

  app.use(carregarUsuarioDaSessao);

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/licitacoes', require('./routes/licitacoes'));
  app.use('/api/usuarios', require('./routes/usuarios'));
  app.use('/api/logs', require('./routes/logs'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/backup', require('./routes/backup'));

  app.use(express.static(path.join(__dirname, '..', 'src')));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ erro: 'Rota de API não encontrada.' });
    }
    res.sendFile(path.join(__dirname, '..', 'src', 'index.html'));
  });

  // Ponto-chave de confidencialidade + gestão de erros: o log detalhado
  // (stack trace, rota, método) fica só no console do servidor, nunca na
  // resposta. Isso vale também pra evitar vazar chaves/segredos: mesmo
  // que um erro aconteça dentro de um trecho que manipula credenciais, a
  // resposta ao cliente é sempre a mesma mensagem genérica.
  app.use((err, req, res, next) => {
    console.error(
      `[worker ${process.pid}] [${new Date().toISOString()}] Erro não tratado em ${req.method} ${req.originalUrl}:`,
      err
    );

    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ erro: 'Requisição inválida.' });
    }

    res.status(500).json({ erro: 'Erro interno do servidor. Tente novamente mais tarde.' });
  });

  return app;
}

module.exports = { criarApp };
