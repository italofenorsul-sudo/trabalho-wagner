const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

const db = require('./src/db');
const { seed } = require('./src/seed');
const { carregarUsuarioDaSessao } = require('./src/middleware/auth');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const SECRET_PATH = path.join(DATA_DIR, '.session-secret');

function obterSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (fs.existsSync(SECRET_PATH)) return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  const novoSegredo = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SECRET_PATH, novoSegredo, { mode: 0o600 });
  return novoSegredo;
}

const totalUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
if (totalUsuarios === 0) {
  seed();
  console.log('Banco de dados vazio: dados iniciais (seed) criados automaticamente.');
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

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

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/licitacoes', require('./src/routes/licitacoes'));
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/logs', require('./src/routes/logs'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/backup', require('./src/routes/backup'));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ erro: 'Rota de API não encontrada.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

app.listen(PORT, () => {
  console.log(`SCL - Sistema de Licitações rodando em http://localhost:${PORT}`);
});
