const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

// Verificar o token de login só precisa do projectId (usa as chaves públicas do Google),
// então não há credencial de serviço aqui.
const app = getApps()[0] || initializeApp({ projectId: 'beatgamesmanager' });

async function getUserId(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) {
    return null;
  }

  try {
    const decoded = await getAuth(app).verifyIdToken(match[1]);
    return decoded.uid;
  } catch (_error) {
    return null;
  }
}

module.exports = { getUserId };
