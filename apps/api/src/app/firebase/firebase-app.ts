import { App, getApps, initializeApp } from 'firebase-admin/app';

export function getFirebaseApp(): App {
  const existente = getApps()[0];
  if (existente) {
    return existente;
  }
  return initializeApp({
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? 'demo-alcadas',
  });
}