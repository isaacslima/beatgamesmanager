import { apiFetch } from './auth.js';

// Upload de imagens: função na Vercel (o token do Blob é secreto e não pode ficar no navegador).
// Em desenvolvimento (npm run dev) o próprio servidor local responde em /api/upload.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const UPLOAD_URL = IS_LOCAL ? '/api/upload' : 'https://project-6f83i.vercel.app/api/upload';

export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;

async function readError(response, fallback) {
  const data = await response.json().catch(() => null);
  return new Error(data?.message || fallback);
}

export async function uploadImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo enviado precisa ser uma imagem.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('A imagem deve ter no máximo 4 MB.');
  }

  const form = new FormData();
  form.append('image', file);

  const response = await apiFetch(UPLOAD_URL, { method: 'POST', body: form });
  if (!response.ok) {
    throw await readError(response, 'Erro ao enviar a imagem.');
  }

  return (await response.json()).url;
}

// Melhor esforço: se falhar, a imagem só fica órfã no Blob.
export async function deleteImage(url) {
  if (!url) {
    return;
  }

  try {
    const response = await apiFetch(UPLOAD_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      console.error(await readError(response, 'Erro ao remover a imagem.'));
    }
  } catch (error) {
    console.error(error);
  }
}
