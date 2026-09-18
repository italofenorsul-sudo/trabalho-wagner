const cluster = require('cluster');
const os = require('os');

const PORT = process.env.PORT || 3000;

// Ponto-chave de disponibilidade (Tríade CID): balanceamento de carga.
// Em vez de um único processo Node atendendo todas as requisições, o
// processo principal (primary) sobe uma cópia do servidor por núcleo de
// CPU disponível (até 4, pra não sobrecarregar máquinas pequenas). Todas
// as cópias (workers) escutam a MESMA porta — o próprio sistema
// operacional distribui as conexões que chegam entre elas. Se uma
// requisição pesada travar um worker, os outros continuam respondendo
// normalmente, e o worker que caiu é reiniciado automaticamente.
const QUANTIDADE_WORKERS = Math.max(1, Math.min(os.cpus().length, 4));

if (cluster.isPrimary && process.env.SCL_SEM_CLUSTER !== 'true') {
  // O banco é preparado UMA VEZ aqui, pelo processo primary, ANTES de
  // subir qualquer worker. Isso evita uma condição de corrida: se cada
  // worker checasse "o banco está vazio?" por conta própria ao subir ao
  // mesmo tempo, mais de um tentaria inserir os mesmos dados iniciais
  // simultaneamente e um deles falharia (e-mail duplicado).
  const db = require('./server/db');
  const { seed } = require('./server/seed');
  const totalUsuarios = db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  if (totalUsuarios === 0) {
    seed();
    console.log(`[primary ${process.pid}] Banco de dados vazio: dados iniciais (seed) criados automaticamente.`);
  }
  db.close();

  console.log(`[primary ${process.pid}] Subindo ${QUANTIDADE_WORKERS} worker(s) para balanceamento de carga...`);

  for (let i = 0; i < QUANTIDADE_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`[primary] Worker ${worker.process.pid} encerrou (código ${code}, sinal ${signal}). Reiniciando...`);
    cluster.fork();
  });
} else {
  // Cada worker (ou o processo único, se SCL_SEM_CLUSTER=true — útil em
  // ambientes serverless/de teste que não suportam múltiplos processos)
  // monta e sobe sua própria cópia da aplicação Express.
  const { criarApp } = require('./server/app');
  const app = criarApp();

  app.listen(PORT, () => {
    console.log(`[worker ${process.pid}] SCL - Sistema de Licitações rodando em http://localhost:${PORT}`);
  });
}
