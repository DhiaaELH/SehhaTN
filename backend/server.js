const app = require('./app');
const pool = require('./db');

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Backend lancé sur le port ${PORT}`);
});

// Arrêt propre (redéploiement Render, Ctrl+C) : on termine les requêtes en cours puis on ferme la base.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} reçu, arrêt en cours…`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
