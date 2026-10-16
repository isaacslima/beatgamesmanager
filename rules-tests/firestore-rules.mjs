// Testes das regras do Firestore. Rode com: npm run test:rules (sobe o emulador do Firestore).
// Fica fora de test/ para não rodar no npm test, que não usa o emulador.
import test, { after, before, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

let env;
const now = '2026-10-16T00:00:00.000Z';
const stamps = { createdAt: now, updatedAt: now };

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-beatgames-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(() => env.clearFirestore());
after(() => env.cleanup());

const alice = () => env.authenticatedContext('alice').firestore();
const bob = () => env.authenticatedContext('bob').firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

const game = (overrides = {}) => ({
  title: 'Super Mario 64',
  status: 'completed',
  platformId: null,
  genreId: null,
  typeId: null,
  startDate: '2024-01-05',
  endDate: '2024-02-01',
  playTimeSeconds: 66600,
  score: 11,
  difficultyId: 'b',
  completionCondition: 'Conquiste as 70 estrelas',
  isGoty: true,
  notes: '',
  ...stamps,
  ...overrides,
});

test('cada usuário só acessa os próprios dados', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/games/g1'), game()));
  await assertSucceeds(getDoc(doc(alice(), 'users/alice/games/g1')));
  await assertSucceeds(getDocs(collection(alice(), 'users/alice/games')));

  await assertFails(getDoc(doc(bob(), 'users/alice/games/g1')));
  await assertFails(getDocs(collection(bob(), 'users/alice/games')));
  await assertFails(setDoc(doc(bob(), 'users/alice/games/g2'), game()));
  await assertFails(deleteDoc(doc(bob(), 'users/alice/games/g1')));
  await assertFails(getDoc(doc(anonymous(), 'users/alice/games/g1')));
});

test('coleções fora de users/{uid} são bloqueadas', async () => {
  await assertFails(setDoc(doc(alice(), 'outra/x'), { a: 1 }));
  await assertFails(setDoc(doc(alice(), 'users/alice/qualquer/x'), { a: 1 }));
});

test('jogo: aceita o mínimo (lista de desejo sem datas)', async () => {
  await assertSucceeds(setDoc(doc(alice(), 'users/alice/games/g1'), { title: 'Silksong', status: 'wishlist', ...stamps }));
});

test('jogo: rejeita formato inválido', async () => {
  const db = alice();
  const ref = doc(db, 'users/alice/games/g1');
  await assertFails(setDoc(ref, game({ title: '' })));
  await assertFails(setDoc(ref, game({ status: '' })));
  await assertFails(setDoc(ref, game({ score: 12 })));
  await assertFails(setDoc(ref, game({ score: 7.5 })));
  await assertFails(setDoc(ref, game({ startDate: '05/01/2024' })));
  await assertFails(setDoc(ref, game({ startDate: '2024-03-01', endDate: '2024-02-01' })));
  await assertFails(setDoc(ref, game({ playTimeSeconds: -1 })));
  await assertFails(setDoc(ref, game({ isGoty: 'sim' })));
  await assertFails(setDoc(ref, game({ notes: 'x'.repeat(2001) })));
  await assertFails(setDoc(ref, game({ campoExtra: 1 })));
  const { createdAt: _createdAt, ...withoutCreatedAt } = game();
  await assertFails(setDoc(ref, withoutCreatedAt));
});

test('status: valida cor e ordem; padrões do dashboard não podem ser excluídos', async () => {
  const db = alice();
  const status = { name: 'Jogando', color: 'amber', order: 5, description: '', ...stamps };
  await assertSucceeds(setDoc(doc(db, 'users/alice/statuses/playing'), status));
  await assertFails(setDoc(doc(db, 'users/alice/statuses/x'), { ...status, color: 'neon' }));
  await assertFails(setDoc(doc(db, 'users/alice/statuses/x'), { ...status, order: -1 }));

  await assertSucceeds(setDoc(doc(db, 'users/alice/statuses/completed'), { ...status, name: 'Zerado', color: 'emerald' }));
  await assertSucceeds(updateDoc(doc(db, 'users/alice/statuses/completed'), { name: 'Finalizado', updatedAt: now }));
  await assertFails(deleteDoc(doc(db, 'users/alice/statuses/completed')));
  await assertFails(deleteDoc(doc(db, 'users/alice/statuses/wishlist')));
  await assertSucceeds(deleteDoc(doc(db, 'users/alice/statuses/playing')));
});

test('nota: id deve ser o próprio valor (valor imutável)', async () => {
  const db = alice();
  const score = { value: 11, label: 'Jogo da vida', description: '', ...stamps };
  await assertSucceeds(setDoc(doc(db, 'users/alice/scores/11'), score));
  await assertFails(setDoc(doc(db, 'users/alice/scores/10'), score));
  await assertFails(updateDoc(doc(db, 'users/alice/scores/11'), { value: 10 }));
  await assertFails(setDoc(doc(db, 'users/alice/scores/12'), { ...score, value: 12 }));
});

test('plataforma: imagem só https; demais cadastros validam campos', async () => {
  const db = alice();
  await assertSucceeds(setDoc(doc(db, 'users/alice/platforms/p1'), { name: 'Switch', imageUrl: 'https://x.public.blob.vercel-storage.com/a.png', ...stamps }));
  await assertSucceeds(setDoc(doc(db, 'users/alice/platforms/p2'), { name: 'PC', imageUrl: null, ...stamps }));
  await assertFails(setDoc(doc(db, 'users/alice/platforms/p3'), { name: 'X', imageUrl: 'javascript:alert(1)', ...stamps }));
  await assertFails(setDoc(doc(db, 'users/alice/platforms/p4'), { name: '', imageUrl: null, ...stamps }));

  await assertSucceeds(setDoc(doc(db, 'users/alice/genres/g1'), { name: 'RPG', description: '', ...stamps }));
  await assertSucceeds(setDoc(doc(db, 'users/alice/types/t1'), { name: 'Ação RPG', genreId: 'g1', description: '', ...stamps }));
  await assertSucceeds(setDoc(doc(db, 'users/alice/difficulties/aa'), { key: 'AA', label: 'Difícil', order: 4, description: '', ...stamps }));
  await assertFails(setDoc(doc(db, 'users/alice/difficulties/x'), { key: 'X', label: 'X', order: 1.5, description: '', ...stamps }));
});

test('documento do usuário só aceita a versão dos padrões', async () => {
  const db = alice();
  await assertSucceeds(setDoc(doc(db, 'users/alice'), { defaultsVersion: 2, defaultsSeededAt: now }));
  await assertFails(setDoc(doc(db, 'users/alice'), { defaultsVersion: 2, admin: true }));
});

test('importação em lote de muitos jogos passa pelas regras', async () => {
  const db = alice();
  const batch = writeBatch(db);
  for (let index = 0; index < 450; index += 1) {
    batch.set(doc(db, `users/alice/games/import-${index}`), game({ title: `Jogo ${index}` }));
  }
  batch.set(doc(db, 'users/alice/platforms/nova'), { name: 'Nova', imageUrl: null, ...stamps });
  await assertSucceeds(batch.commit());
});
