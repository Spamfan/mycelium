/**
 * Mycelium Platform Configuration
 * Version: v0.0.2
 */

export const APP_META = Object.freeze({
  name: 'Mycelium',
  version: '0.0.2',
  defaultTheme: 'light',
  roomCodeLength: 4,
  captureHoldMs: 2000
});

/**
 * Developer-toggleable global lockdown gate.
 * Keep false by default for zero-friction public/family play.
 * Set to true to require a global passphrase before joining or creating rooms.
 */
export const LOCKDOWN_ENABLED = false;

/**
 * Public Firebase Web App configuration (safe to host on GitHub Pages;
 * enforce writes via Firebase Realtime Database Security Rules).
 * Leave apiKey as 'YOUR_API_KEY' to run in local multi-tab Demo Mode.
 */
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyCURwXyCjatjk4cV_LG7SbVuQYVr4FOyFo',
  authDomain: 'mycelium-4b17e.firebaseapp.com',
  databaseURL: 'https://mycelium-4b17e-default-rtdb.firebaseio.com',
  projectId: 'mycelium-4b17e',
  storageBucket: 'mycelium-4b17e.firebasestorage.app',
  messagingSenderId: '2706846313',
  appId: '1:2706846313:web:3f70f7b806e21da47428f8'
});

export const STORAGE_KEYS = Object.freeze({
  theme: 'mycelium_theme',
  hostUid: 'mycelium_host_uid',
  nodeId: 'mycelium_node_id',
  nodeLabel: 'mycelium_node_label',
  lockdownHash: 'mycelium_lockdown_hash',
  customFirebase: 'mycelium_custom_firebase'
});
