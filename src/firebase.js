const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID || 'beatgamesmanager';

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (_error) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT inválida: use o conteúdo do JSON gerado em "Gerar nova chave privada", em uma linha.'
      );
    }
    return cert(serviceAccount);
  }

  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }

  return applicationDefault();
}

const app = getApps()[0] || initializeApp({ credential: loadCredential(), projectId });

const firestore = getFirestore(app);
firestore.settings({ preferRest: true, ignoreUndefinedProperties: true });

const auth = getAuth(app);

module.exports = { firestore, auth };
