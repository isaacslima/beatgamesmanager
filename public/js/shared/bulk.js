import { MAX_TAGS_PER_GAME } from './catalog.js';

// Campos de referência que a edição em lote pode alterar. `undefined` = não alterar; `null` = limpar.
export const BULK_FIELDS = ['status', 'platformId', 'genreId', 'typeId', 'difficultyId'];

function sameList(a, b) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Calcula a edição em lote (nada é gravado aqui).
 *
 * changes: { status?, platformId?, genreId?, typeId?, difficultyId?, isGoty?, addTagIds?, removeTagIds? }
 * context: { types: [{ id, genreId }] }
 * Retorna { updates: [{ id, title, fields }], errors: [mensagem], unchanged: número }.
 */
export function planBulkUpdate(games, changes, { types = [] } = {}) {
  const errors = [];
  const typeById = new Map(types.map((type) => [type.id, type]));

  if (changes.status === null) {
    errors.push('O status não pode ficar vazio.');
  }

  const newType = changes.typeId ? typeById.get(changes.typeId) : null;
  if (changes.typeId && !newType) {
    errors.push('Tipo não encontrado.');
  }

  // Tipo com gênero define o gênero; não pode conflitar com um gênero escolhido explicitamente.
  if (newType?.genreId && changes.genreId !== undefined && changes.genreId !== newType.genreId) {
    errors.push('O tipo escolhido pertence a outro gênero.');
  }

  const addTagIds = [...new Set(changes.addTagIds || [])];
  const removeTagIds = new Set(changes.removeTagIds || []);
  if (addTagIds.some((id) => removeTagIds.has(id))) {
    errors.push('Uma tag não pode ser adicionada e removida ao mesmo tempo.');
  }

  if (errors.length) {
    return { updates: [], errors, unchanged: 0 };
  }

  const updates = [];
  let unchanged = 0;

  games.forEach((game) => {
    const next = {
      status: game.status,
      platformId: game.platformId ?? null,
      genreId: game.genreId ?? null,
      typeId: game.typeId ?? null,
      difficultyId: game.difficultyId ?? null,
    };

    BULK_FIELDS.forEach((field) => {
      if (changes[field] !== undefined) {
        next[field] = changes[field];
      }
    });

    if (newType?.genreId) {
      next.genreId = newType.genreId;
    }

    // Se o gênero mudou e o tipo atual é de outro gênero, o tipo sai.
    const currentType = next.typeId ? typeById.get(next.typeId) : null;
    if (currentType?.genreId && next.genreId && currentType.genreId !== next.genreId) {
      next.typeId = null;
    }

    const currentTags = game.tagIds || [];
    const tagIds = [...currentTags.filter((id) => !removeTagIds.has(id))];
    addTagIds.forEach((id) => {
      if (!tagIds.includes(id)) {
        tagIds.push(id);
      }
    });

    if (tagIds.length > MAX_TAGS_PER_GAME) {
      errors.push(`"${game.title}" ficaria com mais de ${MAX_TAGS_PER_GAME} tags.`);
      return;
    }

    const fields = {};
    Object.entries(next).forEach(([field, value]) => {
      if ((game[field] ?? null) !== value) {
        fields[field] = value;
      }
    });
    if (!sameList(currentTags, tagIds)) {
      fields.tagIds = tagIds;
    }
    if (changes.isGoty !== undefined && Boolean(game.isGoty) !== changes.isGoty) {
      fields.isGoty = changes.isGoty;
    }

    if (Object.keys(fields).length) {
      updates.push({ id: game.id, title: game.title, fields });
    } else {
      unchanged += 1;
    }
  });

  return errors.length ? { updates: [], errors, unchanged: 0 } : { updates, errors, unchanged };
}
