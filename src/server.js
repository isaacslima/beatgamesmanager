const app = require('./app');
const { initDatabase } = require('./db');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);
    });
  } catch (_error) {
    console.error('Falha ao inicializar banco de dados.');
    process.exit(1);
  }
}

startServer();
