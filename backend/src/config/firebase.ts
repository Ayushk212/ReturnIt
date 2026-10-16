import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { env } from './env.js';

let app: App | null = null;

export const getFirebaseAdmin = (): App => {
  if (app) return app;

  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    app = existing[0];
    return app;
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  } else if (env.FIREBASE_PROJECT_ID) {
    app = initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
    });
  } else if (env.NODE_ENV !== 'production') {
    app = initializeApp({
      projectId: 'returnit-dev',
    });
  } else {
    throw new Error('Firebase credentials are required in production.');
  }

  return app;
};

export const getFirebaseAuth = (): Auth => {
  return getAuth(getFirebaseAdmin());
};
