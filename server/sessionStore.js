const session = require('express-session');
const db = require('./db');

// Session store compartilhado entre todos os workers do cluster (ver
// server.js e o comentário sobre disponibilidade em server/db.js).
// Implementa a interface mínima que o express-session espera de um Store:
// get, set, destroy (touch é opcional, mas evita expirar sessão em uso).
class SQLiteSessionStore extends session.Store {
  constructor() {
    super();
    this._stmtGet = db.prepare('SELECT dados, expira_em FROM sessoes WHERE sid = ?');
    this._stmtSet = db.prepare(
      'INSERT INTO sessoes (sid, dados, expira_em) VALUES (@sid, @dados, @expira_em) ' +
      'ON CONFLICT(sid) DO UPDATE SET dados = excluded.dados, expira_em = excluded.expira_em'
    );
    this._stmtDestroy = db.prepare('DELETE FROM sessoes WHERE sid = ?');
    this._stmtLimpezaExpiradas = db.prepare('DELETE FROM sessoes WHERE expira_em < ?');

    // Limpeza periódica de sessões expiradas, pra tabela não crescer sem limite.
    setInterval(() => {
      try {
        this._stmtLimpezaExpiradas.run(Date.now());
      } catch (_) {
        // não é crítico — tenta de novo no próximo ciclo
      }
    }, 15 * 60 * 1000).unref();
  }

  get(sid, callback) {
    try {
      const linha = this._stmtGet.get(sid);
      if (!linha) return callback();
      if (linha.expira_em < Date.now()) {
        this._stmtDestroy.run(sid);
        return callback();
      }
      callback(null, JSON.parse(linha.dados));
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sessao, callback) {
    try {
      const maxAgeMs = (sessao.cookie && sessao.cookie.maxAge) || 30 * 60 * 1000;
      this._stmtSet.run({ sid, dados: JSON.stringify(sessao), expira_em: Date.now() + maxAgeMs });
      callback && callback();
    } catch (err) {
      callback && callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this._stmtDestroy.run(sid);
      callback && callback();
    } catch (err) {
      callback && callback(err);
    }
  }

  touch(sid, sessao, callback) {
    this.set(sid, sessao, callback);
  }
}

module.exports = SQLiteSessionStore;
