import { App, getApps, initializeApp } from 'firebase-admin/app';

export function getFirebaseApp(): App {
  if (process.env['NODE_ENV'] !== 'production') {
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= 'localhost:9099';
    process.env['FIRESTORE_EMULATOR_HOST'] ??= 'localhost:8080';
  }
  const existente = getApps()[0];
  if (existente) {
    return existente;
  }
  return initializeApp({
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? 'demo-alcadas',
  });
}
