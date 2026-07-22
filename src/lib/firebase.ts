import { initializeApp, getApp, getApps, FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';

// Values are read from a local file rather than env vars because AI Studio
// generates this config. Firebase web keys are public identifiers by design;
// access is enforced by firestore.rules, not by hiding these values.
import rawConfig from '../../firebase-applet-config.json';

// Fail loudly at startup rather than with a cryptic error on the first query.
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const;
const missingKeys = REQUIRED_KEYS.filter((key) => !rawConfig[key]);
if (missingKeys.length > 0) {
  throw new Error(
    `firebase-applet-config.json is missing required field(s): ${missingKeys.join(', ')}. ` +
      'Copy the config from Firebase Console → Project settings → Your apps.',
  );
}

const firebaseConfig: FirebaseOptions = {
  apiKey: rawConfig.apiKey,
  authDomain: rawConfig.authDomain,
  projectId: rawConfig.projectId,
  storageBucket: rawConfig.storageBucket,
  messagingSenderId: rawConfig.messagingSenderId,
  appId: rawConfig.appId,
  // An empty measurementId breaks Analytics init, so only include a real one.
  ...(rawConfig.measurementId ? { measurementId: rawConfig.measurementId } : {}),
};

// Reuse the existing app across Vite HMR reloads instead of re-initializing.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * This project stores data in a NAMED Firestore database, not "(default)".
 * The name must match the database in the Firebase Console, and firestore.rules
 * has to be deployed against that same name (see firebase.json).
 */
const databaseId = rawConfig.firestoreDatabaseId || undefined;

function connectFirestore(): Firestore {
  const settings = {
    // Campus/hostel networks and proxies often block Firestore's streaming
    // transport, which makes queries hang forever instead of failing. This
    // detects that and falls back to long polling.
    experimentalAutoDetectLongPolling: true,
    // Never crash a write because an optional field happened to be undefined.
    ignoreUndefinedProperties: true,
  };

  try {
    return databaseId
      ? initializeFirestore(app, settings, databaseId)
      : initializeFirestore(app, settings);
  } catch {
    // Already initialized (HMR), so return the existing instance.
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

const db = connectFirestore();

const auth = getAuth(app);

// Keep users signed in across reloads and browser restarts.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Could not set auth persistence:', err);
});

const googleProvider = new GoogleAuthProvider();
// Students often have both a personal and an institute Google account, and only
// one of them is whitelisted, so always let them choose.
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_ID = rawConfig.projectId;
export const FIRESTORE_DATABASE_ID = databaseId ?? '(default)';

export {
  app,
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
  arrayUnion,
  writeBatch,
};
export type { User };
