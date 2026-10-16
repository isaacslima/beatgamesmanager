const busboy = require('busboy');
const { HttpError } = require('./http');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Middleware multipart/form-data: campos em req.body e um arquivo opcional em req.file
 * ({ buffer, mimetype, originalname }).
 *
 * No Cloud Functions o corpo já chega lido em req.rawBody (o stream fica vazio),
 * então usamos o buffer; localmente lemos o stream normalmente.
 */
function singleFileUpload(fieldName) {
  return (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      return next();
    }

    let parser;
    try {
      parser = busboy({ headers: req.headers, limits: { fileSize: MAX_FILE_SIZE, files: 1 } });
    } catch (_error) {
      return res.status(400).json({ message: 'Envio de formulário inválido.' });
    }

    const body = {};
    let file = null;
    let failure = null;

    parser.on('field', (name, value) => {
      body[name] = value;
    });

    parser.on('file', (name, stream, info) => {
      if (name !== fieldName) {
        stream.resume();
        return;
      }

      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('limit', () => {
        failure = new HttpError(400, 'A imagem deve ter no máximo 5 MB.');
      });
      stream.on('end', () => {
        if (!failure && chunks.length) {
          file = { buffer: Buffer.concat(chunks), mimetype: info.mimeType, originalname: info.filename };
        }
      });
    });

    parser.on('error', () => {
      failure = failure || new HttpError(400, 'Envio de formulário inválido.');
    });

    parser.on('close', () => {
      if (failure) {
        return res.status(failure.status).json({ message: failure.message });
      }

      req.body = body;
      req.file = file;
      return next();
    });

    if (req.rawBody) {
      parser.end(req.rawBody);
    } else {
      req.pipe(parser);
    }
  };
}

module.exports = { singleFileUpload };
