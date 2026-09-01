'use strict';

const app = require('./app');
const config = require('./config');
const log = require('./lib/log');

const server = app.listen(config.port, () => {
  log.info(`Axxon webhook proxy ouvindo na porta ${config.port} (${config.nodeEnv})`);
  log.info(`Reencaminhando para: ${config.destUrl}`);
  log.info(`Endpoint do webhook: POST /webhook/axxon`);
});

// Nunca derrubar o processo por um erro solto
process.on('unhandledRejection', (reason) => log.error('unhandledRejection:', reason));
process.on('uncaughtException', (err) => log.error('uncaughtException:', err && err.stack));

function shutdown(signal) {
  log.info(`${signal} recebido, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
