// Verifica o token de login do Firebase (ID token) com as chaves públicas do Google,
// seguindo https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
// Usa o `jose` direto (e não o firebase-admin), que é só ESM e por isso carregado com import().
const PROJECT_ID = 'beatgamesmanager';
const CLOCK_TOLERANCE_SECONDS = 60; // relógios de servidores divergem alguns segundos
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let verifierPromise = null;

function getVerifier() {
  if (!verifierPromise) {
    verifierPromise = import('jose').then(({ createRemoteJWKSet, jwtVerify }) => {
      const keys = createRemoteJWKSet(new URL(JWKS_URL));
      return (token) =>
        jwtVerify(token, keys, {
          issuer: `https://securetoken.google.com/${PROJECT_ID}`,
          audience: PROJECT_ID,
          algorithms: ['RS256'],
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
        });
    });
  }
  return verifierPromise;
}

async function getUserId(req) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) {
    return null;
  }

  try {
    const verify = await getVerifier();
    const { payload } = await verify(match[1]);
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
      return null;
    }
    if (typeof payload.auth_time !== 'number' || payload.auth_time > nowInSeconds + CLOCK_TOLERANCE_SECONDS) {
      return null;
    }

    return payload.sub;
  } catch (_error) {
    return null;
  }
}

module.exports = { getUserId };
