/**
 * Mycelium Platform Configuration
 * Version: v0.0.1
 */

export const APP_META = Object.freeze({
  name: 'Mycelium',
  version: '0.0.1',
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
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  databaseURL: 'https://YOUR_PROJECT-default-rtdb.firebaseio.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000'
});

export const STORAGE_KEYS = Object.freeze({
  theme: 'mycelium_theme',
  hostUid: 'mycelium_host_uid',
  nodeId: 'mycelium_node_id',
  nodeLabel: 'mycelium_node_label',
  lockdownHash: 'mycelium_lockdown_hash',
  customFirebase: 'mycelium_custom_firebase'
});
