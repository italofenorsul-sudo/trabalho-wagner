const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'scl.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'comum')),
    nivel_acesso TEXT NOT NULL CHECK (nivel_acesso IN ('completo', 'restrito')),
    status TEXT NOT NULL CHECK (status IN ('ativo', 'bloqueado')),
    termo_aceito INTEGER NOT NULL DEFAULT 0,
    termo_data_hora TEXT,
    termo_versao TEXT,
    data_criacao TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS licitacoes (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL,
    ano INTEGER NOT NULL,
    processo TEXT NOT NULL,
    modalidade TEXT NOT NULL,
    objeto TEXT NOT NULL,
    orgao TEXT NOT NULL,
    valor_estimado REAL NOT NULL DEFAULT 0,
    data_publicacao TEXT,
    data_abertura TEXT,
    local_sessao TEXT,
    situacao TEXT NOT NULL DEFAULT 'Aberta',
    visivel_comum TEXT NOT NULL DEFAULT 'sim' CHECK (visivel_comum IN ('sim', 'nao')),
    conteudo_integral TEXT,
    criado_por TEXT,
    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS assinaturas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    licitacao_id TEXT NOT NULL REFERENCES licitacoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    funcao TEXT,
    data TEXT
  );

  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    data_hora TEXT NOT NULL DEFAULT (datetime('now')),
    usuario TEXT NOT NULL,
    acao TEXT NOT NULL,
    alvo TEXT,
    resultado TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_locks (
    email TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_licitacoes_situacao ON licitacoes(situacao);
  CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs(usuario);
`);

module.exports = db;
