const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Ponto-chave de segurança 1: Prevenção de Injeção (SQL Injection).
// Todo acesso ao banco neste projeto usa Prepared Statements
// (db.prepare(sql).run/get/all(valores)), nunca concatenação de string.
// Os valores enviados pelo usuário (login, filtros, formulários) trafegam
// sempre como parâmetros (`?`) da consulta, então o SQLite os trata
// estritamente como dado — nunca como parte do comando SQL.

// Usa o módulo nativo node:sqlite (embutido no Node.js >=22, sem
// dependência externa) em vez de um pacote com binário compilado
// separadamente — evita qualquer necessidade de compilador C++/Visual
// Studio na instalação, em qualquer sistema operacional.

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'scl.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Com balanceamento de carga (vários processos, cada um com sua própria
// conexão ao mesmo arquivo de banco), é normal dois processos tentarem
// escrever quase ao mesmo tempo. Sem isso, o SQLite recusaria a segunda
// tentativa na hora (erro "database is busy"). Com isso, ele espera até
// 5 segundos tentando de novo antes de desistir — na prática, nunca chega
// a falhar por causa disso.
db.exec('PRAGMA busy_timeout = 5000');

// Shim compatível com a API de transação do better-sqlite3, usado em
// src/seed.js e src/routes/backup.js: db.transaction(fn)() executa fn
// dentro de BEGIN/COMMIT, com ROLLBACK automático em caso de erro.
db.transaction = function transaction(fn) {
  return function (...args) {
    db.exec('BEGIN');
    try {
      const resultado = fn(...args);
      db.exec('COMMIT');
      return resultado;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch (_) {
        // ignora falha ao desfazer, o erro original já será propagado
      }
      throw err;
    }
  };
};

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

  -- Ponto-chave de disponibilidade: com balanceamento de carga (vários
  -- processos atendendo a mesma porta), a sessão de login NÃO pode viver
  -- só na memória de um processo — cada requisição pode cair em um
  -- worker diferente. Guardar a sessão aqui, no mesmo banco compartilhado
  -- por todos os workers, é o que permite ter vários processos sem que o
  -- usuário seja "deslogado" ao acaso.
  CREATE TABLE IF NOT EXISTS sessoes (
    sid TEXT PRIMARY KEY,
    dados TEXT NOT NULL,
    expira_em INTEGER NOT NULL
  );
`);

module.exports = db;
