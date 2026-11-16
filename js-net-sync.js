/**
 * Mycelium Realtime Sync & Auth Adapter
 * Version: v0.0.1
 * Supports Firebase Realtime Database (when configured) and zero-setup
 * Local Demo Mode (localStorage + BroadcastChannel) out of the box.
 */

import { APP_META, FIREBASE_CONFIG, STORAGE_KEYS } from './js-config.js?v=0.0.1';

const DEMO_ROOMS_KEY = 'mycelium_demo_rooms_v1';
const channel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mycelium_sync_bus')
  : null;

let activeFirebase = null;
let demoMode = true;
let activeRoomCode = null;
let roomListeners = new Set();
let publicListeners = new Set();

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.random().toString(36).slice(2, 11) + '-' + Date.now().toString(36);
}

export function generateRoomCode(length = APP_META.roomCodeLength) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function sha256Hex(plainText) {
  if (!plainText) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(plainText);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return plainText;
}

export function getOrCreateHostUid() {
  let uid = localStorage.getItem(STORAGE_KEYS.hostUid);
  if (!uid) {
    uid = generateUuid();
    localStorage.setItem(STORAGE_KEYS.hostUid, uid);
  }
  return uid;
}

export function getOrCreateNodeId() {
  let id = localStorage.getItem(STORAGE_KEYS.nodeId);
  if (!id) {
    id = 'node-' + generateUuid().slice(0, 8);
    localStorage.setItem(STORAGE_KEYS.nodeId, id);
  }
  return id;
}

function getEffectiveFirebaseConfig() {
  try {
    const override = localStorage.getItem(STORAGE_KEYS.customFirebase);
    if (override) {
      const parsed = JSON.parse(override);
      if (parsed && parsed.apiKey && parsed.databaseURL) return parsed;
    }
  } catch (_err) {
    // Ignore malformed override JSON
  }
  return FIREBASE_CONFIG;
}

export function isDemoMode() {
  return demoMode;
}

export async function initSync() {
  const cfg = getEffectiveFirebaseConfig();
  if (!cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY' || !cfg.databaseURL) {
    demoMode = true;
    setupDemoBus();
    return { mode: 'demo' };
  }

  try {
    const [{ initializeApp }, { getAuth, signInAnonymously }, dbMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js')
    ]);
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    await signInAnonymously(auth);
    const db = dbMod.getDatabase(app);
    activeFirebase = { db, dbMod };
    demoMode = false;
    return { mode: 'firebase' };
  } catch (err) {
    console.warn('[Mycelium] Falling back to Local Demo Mode:', err);
    demoMode = true;
    setupDemoBus();
    return { mode: 'demo', error: err };
  }
}

function readDemoStore() {
  try {
    return JSON.parse(localStorage.getItem(DEMO_ROOMS_KEY) || '{}');
  } catch (_e) {
    return {};
  }
}

function writeDemoStore(store) {
  localStorage.setItem(DEMO_ROOMS_KEY, JSON.stringify(store));
  if (channel) channel.postMessage({ type: 'store_updated' });
  notifyLocalSubscribers();
}

function notifyLocalSubscribers() {
  const store = readDemoStore();
  const pubList = Object.values(store)
    .filter((r) => r?.meta?.isPublic)
    .map((r) => ({
      code: r.meta.code,
      title: r.meta.title,
      gameMode: r.meta.gameMode,
      hasPassword: Boolean(r.meta.passwordHash),
      nodeCount: Object.keys(r.nodes || {}).length,
      createdAt: r.meta.createdAt || 0
    }))
    .sort((a, b) => b.createdAt - a.createdAt);

  publicListeners.forEach((cb) => cb(pubList));

  if (activeRoomCode && store[activeRoomCode]) {
    roomListeners.forEach((cb) => cb(store[activeRoomCode]));
  }
}

function setupDemoBus() {
  window.addEventListener('storage', (ev) => {
    if (ev.key === DEMO_ROOMS_KEY) notifyLocalSubscribers();
  });
  if (channel) {
    channel.onmessage = () => notifyLocalSubscribers();
  }
}

export function subscribePublicRooms(callback) {
  publicListeners.add(callback);
  if (demoMode) {
    notifyLocalSubscribers();
    return () => publicListeners.delete(callback);
  }
  const { db, dbMod } = activeFirebase;
  const pubRef = dbMod.ref(db, 'publicRooms');
  const unsub = dbMod.onValue(pubRef, (snap) => {
    const val = snap.val() || {};
    const list = Object.entries(val)
      .map(([code, item]) => ({ code, ...item }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    callback(list);
  });
  return () => {
    publicListeners.delete(callback);
    unsub();
  };
}

export async function createRoom({
  title,
  password = '',
  isPublic = true,
  gameMode = 'koth',
  rotationIntervalSec = 180,
  nodeLabel = 'Host Node'
}) {
  const code = generateRoomCode();
  const hostUid = getOrCreateHostUid();
  const nodeId = getOrCreateNodeId();
  const passwordHash = await sha256Hex(password.trim());
  const now = Date.now();

  const roomData = {
    meta: {
      code,
      title: (title || '').trim() || `Room ${code}`,
      gameMode,
      isPublic: Boolean(isPublic),
      passwordHash,
      hostUid,
      createdAt: now
    },
    nodes: {
      [nodeId]: {
        id: nodeId,
        label: nodeLabel,
        role: 'unassigned',
        online: true,
        lastSeen: now
      }
    },
    gameState: {
      mode: gameMode,
      status: 'lobby',
      rotationIntervalSec: Number(rotationIntervalSec) || 180,
      roundDurationSec: 900,
      activeHillNodeId: '',
      nextHillNodeId: '',
      nextRotationAt: 0,
      scores: { red: 0, blue: 0 }
    }
  };

  if (demoMode) {
    const store = readDemoStore();
    store[code] = roomData;
    activeRoomCode = code;
    writeDemoStore(store);
    return roomData;
  }

  const { db, dbMod } = activeFirebase;
  await dbMod.set(dbMod.ref(db, `rooms/${code}`), roomData);
  if (isPublic) {
    await dbMod.set(dbMod.ref(db, `publicRooms/${code}`), {
      title: roomData.meta.title,
      gameMode,
      hasPassword: Boolean(passwordHash),
      createdAt: now
    });
  }
  activeRoomCode = code;
  return roomData;
}

export async function joinRoom({ code, password = '', nodeLabel = 'Field Node' }) {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) throw new Error('Enter a valid room code.');
  const passwordHash = await sha256Hex(password.trim());
  const nodeId = getOrCreateNodeId();
  const now = Date.now();

  if (demoMode) {
    const store = readDemoStore();
    const room = store[cleanCode];
    if (!room) throw new Error(`Room "${cleanCode}" not found.`);
    if (room.meta.passwordHash && room.meta.passwordHash !== passwordHash) {
      throw new Error('Incorrect room password.');
    }
    room.nodes = room.nodes || {};
    room.nodes[nodeId] = {
      id: nodeId,
      label: nodeLabel,
      role: room.nodes[nodeId]?.role || 'unassigned',
      online: true,
      lastSeen: now
    };
    activeRoomCode = cleanCode;
    writeDemoStore(store);
    return room;
  }

  const { db, dbMod } = activeFirebase;
  const snap = await dbMod.get(dbMod.ref(db, `rooms/${cleanCode}`));
  if (!snap.exists()) throw new Error(`Room "${cleanCode}" not found.`);
  const room = snap.val();
  if (room.meta?.passwordHash && room.meta.passwordHash !== passwordHash) {
    throw new Error('Incorrect room password.');
  }
  const nodePayload = {
    id: nodeId,
    label: nodeLabel,
    role: room.nodes?.[nodeId]?.role || 'unassigned',
    online: true,
    lastSeen: now
  };
  await dbMod.set(dbMod.ref(db, `rooms/${cleanCode}/nodes/${nodeId}`), nodePayload);
  activeRoomCode = cleanCode;
  room.nodes = { ...(room.nodes || {}), [nodeId]: nodePayload };
  return room;
}

export function subscribeRoom(code, callback) {
  roomListeners.add(callback);
  if (demoMode) {
    notifyLocalSubscribers();
    return () => roomListeners.delete(callback);
  }
  const { db, dbMod } = activeFirebase;
  const roomRef = dbMod.ref(db, `rooms/${code}`);
  const unsub = dbMod.onValue(roomRef, (snap) => {
    if (snap.exists()) callback(snap.val());
  });
  return () => {
    roomListeners.delete(callback);
    unsub();
  };
}

export async function syncNodeRole(code, role, label) {
  const nodeId = getOrCreateNodeId();
  const now = Date.now();
  if (demoMode) {
    const store = readDemoStore();
    if (store[code]?.nodes?.[nodeId]) {
      store[code].nodes[nodeId].role = role;
      if (label) store[code].nodes[nodeId].label = label;
      store[code].nodes[nodeId].lastSeen = now;
      writeDemoStore(store);
    }
    return;
  }
  const { db, dbMod } = activeFirebase;
  const patch = { role, lastSeen: now, online: true };
  if (label) patch.label = label;
  await dbMod.update(dbMod.ref(db, `rooms/${code}/nodes/${nodeId}`), patch);
}

export async function updateGameState(code, patch) {
  if (demoMode) {
    const store = readDemoStore();
    if (store[code]) {
      store[code].gameState = { ...(store[code].gameState || {}), ...patch };
      writeDemoStore(store);
    }
    return;
  }
  const { db, dbMod } = activeFirebase;
  await dbMod.update(dbMod.ref(db, `rooms/${code}/gameState`), patch);
}

export async function leaveRoom(code) {
  const nodeId = getOrCreateNodeId();
  activeRoomCode = null;
  if (!code) return;
  if (demoMode) {
    const store = readDemoStore();
    if (store[code]?.nodes?.[nodeId]) {
      delete store[code].nodes[nodeId];
      writeDemoStore(store);
    }
    return;
  }
  const { db, dbMod } = activeFirebase;
  await dbMod.remove(dbMod.ref(db, `rooms/${code}/nodes/${nodeId}`));
}
