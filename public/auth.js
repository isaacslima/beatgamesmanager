import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAlYqunIzCKOVKDETefW5qbV7QllEiIa44',
  authDomain: 'beatgamesmanager.firebaseapp.com',
  projectId: 'beatgamesmanager',
  storageBucket: 'beatgamesmanager.firebasestorage.app',
  messagingSenderId: '592049010752',
  appId: '1:592049010752:web:5a36320930a06df49947a5',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'pt';

const ERROR_MESSAGES = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/user-disabled': 'Usuário desativado.',
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
  'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
  'auth/popup-closed-by-user': 'Login cancelado.',
  'auth/operation-not-allowed': 'Este método de login não está habilitado no Firebase.',
};

export function authErrorMessage(error) {
  return ERROR_MESSAGES[error?.code] || 'Não foi possível autenticar. Tente novamente.';
}

export function onUserChanged(callback) {
  return onAuthStateChanged(auth, callback);
}

export function loginWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function registerWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return signOut(auth);
}

export async function apiFetch(url, options = {}) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Usuário não autenticado.');
  }

  const token = await user.getIdToken();
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    await signOut(auth);
  }

  return response;
}
