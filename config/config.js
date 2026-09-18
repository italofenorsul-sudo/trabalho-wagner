// Configurações da aplicação SCL (chaves de armazenamento e parâmetros de segurança).
// Centralizado aqui para facilitar ajuste sem precisar mexer na lógica em src/app.js.

const STORAGE_KEY_USERS = 'PMG_SCL_USERS_2026_SEC';
const STORAGE_KEY_BIDS = 'PMG_SCL_BIDS_2026_SEC';
const STORAGE_KEY_LOGS = 'PMG_SCL_LOGS_2026_SEC';
const STORAGE_KEY_SESSION = 'PMG_SCL_SESSION_2026_SEC';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 Minutos de bloqueio por tentativas
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // Sessão expira em 2 horas
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // Logout automático após 15 min de inatividade
