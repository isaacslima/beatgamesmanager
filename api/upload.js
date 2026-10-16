// Função serverless na Vercel: único backend do app. Guarda imagens no Vercel Blob,
// cujo token (BLOB_READ_WRITE_TOKEN) não pode ir para o navegador.
//
// POST   multipart com o campo "image"  -> 201 { url }
// DELETE JSON { url }                   -> 204 (só imagens do próprio usuário)
const busboy = require('busboy');
const { put, del } = require('@vercel/blob');
const { getUserId } = require('../server/verify-token');

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // limite de corpo das funções da Vercel é 4,5 MB
const ALLOWED_ORIGINS = ['https://beatgamesmanager.web.app', 'https://beatgamesmanager.firebaseapp.com'];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
// Canais de pré-visualização do Firebase Hosting (firebase hosting:channel:deploy).
const PREVIEW_ORIGIN = /^https:\/\/beatgamesmanager--[a-z0-9-]+\.web\.app$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin) || PREVIEW_ORIGIN.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function send(res, status, body) {
  res.statusCode = status;
  if (body === undefined) {
    res.end();
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readImage(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = busboy({ headers: req.headers, limits: { fileSize: MAX_IMAGE_SIZE, files: 1 } });
    } catch (_error) {
      reject(new HttpError(400, 'Envie a imagem como multipart/form-data.'));
      return;
    }

    let image = null;
    let failure = null;

    parser.on('file', (name, stream, info) => {
      if (name !== 'image') {
        stream.resume();
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        failure = new HttpError(413, 'A imagem deve ter no máximo 4 MB.');
      });
      stream.on('end', () => {
        image = { buffer: Buffer.concat(chunks), mimetype: info.mimeType, filename: info.filename };
      });
    });

    parser.on('error', () => reject(new HttpError(400, 'Envio de formulário inválido.')));
    parser.on('close', () => (failure ? reject(failure) : resolve(image)));
    req.pipe(parser);
  });
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body; // a Vercel pode já ter lido o corpo
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (_error) {
    throw new HttpError(400, 'JSON inválido.');
  }
}

function safeFilename(filename) {
  const cleaned = String(filename || 'imagem')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(-80);
  return cleaned || 'imagem';
}

async function handleUpload(req, res, userId) {
  const image = await readImage(req);

  if (!image || !image.buffer.length) {
    throw new HttpError(400, 'Nenhuma imagem enviada.');
  }

  if (!image.mimetype.startsWith('image/')) {
    throw new HttpError(400, 'O arquivo enviado precisa ser uma imagem.');
  }

  const blob = await put(`platforms/${userId}/${safeFilename(image.filename)}`, image.buffer, {
    access: 'public',
    addRandomSuffix: true,
    contentType: image.mimetype,
  });

  send(res, 201, { url: blob.url });
}

async function handleDelete(req, res, userId) {
  const { url } = await readJson(req);

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    throw new HttpError(400, 'URL inválida.');
  }

  const isBlob = parsed.protocol === 'https:' && parsed.hostname.endsWith('.public.blob.vercel-storage.com');
  if (!isBlob || !parsed.pathname.startsWith(`/platforms/${userId}/`)) {
    throw new HttpError(403, 'Você só pode remover as suas imagens.');
  }

  await del(parsed.toString());
  send(res, 204);
}

module.exports = async function upload(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    send(res, 204);
    return;
  }

  try {
    const userId = await getUserId(req);
    if (!userId) {
      throw new HttpError(401, 'Sessão inválida ou expirada. Faça login novamente.');
    }

    if (req.method === 'POST') {
      await handleUpload(req, res, userId);
    } else if (req.method === 'DELETE') {
      await handleDelete(req, res, userId);
    } else {
      throw new HttpError(405, 'Método não permitido.');
    }
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { message: error.message });
      return;
    }

    console.error(error);
    send(res, 500, { message: 'Erro ao processar a imagem.' });
  }
};
