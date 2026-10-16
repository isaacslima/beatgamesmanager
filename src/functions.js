// Entrada do Cloud Functions: o Firebase Hosting encaminha /api/** para esta função.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const blobToken = defineSecret('BLOB_READ_WRITE_TOKEN');

exports.api = onRequest(
  {
    region: 'us-central1', // mesma região do Firestore (nam5)
    secrets: [blobToken],
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 5,
  },
  (req, res) => {
    // Carrega o app só na primeira requisição (deploy mais rápido e sem credenciais na análise).
    const app = require('./app');
    return app(req, res);
  }
);
