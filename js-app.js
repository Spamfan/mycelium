/**
 * Mycelium Main Application Router & UI Controller
 * Version: v0.0.3
 */

import { APP_META, LOCKDOWN_ENABLED, STORAGE_KEYS } from './js-config.js?v=0.0.2';
import {
  createRoom,
  getOrCreateHostUid,
  initSync,
  isDemoMode,
  joinRoom,
  leaveRoom,
  sha256Hex,
  subscribePublicRooms,
  subscribeRoom,
  syncNodeRole,
  updateGameState
} from './js-net-sync.js?v=0.0.2';

const LOCAL_MATCH_KEY = 'mycelium_local_koth_v1';

const state = {
  isLocalMode: false,
  roomCode: null,
  room: null,
  role: 'unassigned',
  nodeLabel: localStorage.getItem(STORAGE_KEYS.nodeLabel) || 'Field Node',
  unsubRoom: null,
  unsubPublic: null,
  activeGameModule: null,
  tickInterval: null
};

const $ = (id) => document.getElementById(id);

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
    return;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : APP_META.defaultTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEYS.theme, next);
}

function openModal(modalId, pushHistory = true) {
  const el = $(modalId);
  if (!el) return;
  el.hidden = false;
  if (pushHistory) {
    history.pushState({ modal: modalId }, '', `#${modalId}`);
  }
}

function closeAllModals(fromPopstate = false) {
  let anyOpen = false;
  document.querySelectorAll('.modal-backdrop').forEach((m) => {
    if (m.id === 'modal-lockdown' && isLockdownBlocking()) return;
    if (!m.hidden) {
      m.hidden = true;
      anyOpen = true;
    }
  });
  if (anyOpen && !fromPopstate && location.hash) {
    history.replaceState(null, '', location.pathname + location.search);
  }
}

function isLockdownBlocking() {
  if (!LOCKDOWN_ENABLED) return false;
  return !localStorage.getItem(STORAGE_KEYS.lockdownHash);
}

function setStatusBadge(text, isLive = false) {
  const badge = $('sync-status-badge');
  if (!badge) return;
  badge.textContent = text;
  badge.classList.toggle('is-live', isLive);
}

function showToast(msg) {
  const toast = $('toast-banner');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function renderPublicRooms(rooms) {
  const listEl = $('public-rooms-list');
  if (!listEl) return;
  if (!rooms.length) {
    listEl.innerHTML = '<p class="muted-hint">No public rooms active right now. Create one or enter a private code.</p>';
    return;
  }
  listEl.innerHTML = rooms
    .map((r) => `
      <button type="button" class="room-list-item" data-join-code="${r.code}" data-has-pw="${r.hasPassword ? '1' : '0'}">
        <div>
          <strong>${escapeHtml(r.title || r.code)}</strong>
          <span class="muted-sub">Code: ${escapeHtml(r.code)} • ${escapeHtml((r.gameMode || 'koth').toUpperCase())}</span>
        </div>
        <span class="badge-pill">${r.hasPassword ? 'Locked' : 'Open'}</span>
      </button>
    `)
    .join('');

  listEl.querySelectorAll('[data-join-code]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-join-code');
      $('join-code-input').value = code;
      if (btn.getAttribute('data-has-pw') === '1') {
        $('join-password-input').focus();
        showToast(`Enter password for ${code}`);
      } else {
        $('form-join-room').requestSubmit();
      }
    });
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function enterRoomSession(room) {
  state.roomCode = room.meta.code;
  state.room = room;
  if (state.unsubRoom) state.unsubRoom();

  const isHost = room.meta.hostUid === getOrCreateHostUid();
  const hostOption = $('role-btn-host');
  if (hostOption) hostOption.hidden = !isHost;

  $('view-landing').hidden = true;
  $('view-stage').hidden = false;

  state.unsubRoom = subscribeRoom(state.roomCode, (updatedRoom) => {
    state.room = updatedRoom;
    if (state.activeGameModule) {
      state.activeGameModule.onStateUpdate(updatedRoom);
    }
  });

  closeAllModals();
  openModal('modal-role');
}

async function activateNodeRole(role) {
  state.role = role;
  const labelInput = $('node-label-input');
  if (labelInput && labelInput.value.trim()) {
    state.nodeLabel = labelInput.value.trim();
    localStorage.setItem(STORAGE_KEYS.nodeLabel, state.nodeLabel);
  }

  state.isLocalMode = false;
  await syncNodeRole(state.roomCode, role, state.nodeLabel);
  closeAllModals();

  if (!state.activeGameModule) {
    state.activeGameModule = await import('./js-game-koth.js?v=0.0.3');
  }

  state.activeGameModule.mount($('game-mount'), {
    role: state.role,
    nodeLabel: state.nodeLabel,
    room: state.room,
    onPatchGameState: (patch) => updateGameState(state.roomCode, patch)
  });

  clearInterval(state.tickInterval);
  state.tickInterval = setInterval(() => {
    if (state.activeGameModule) state.activeGameModule.onTick(Date.now());
  }, 250);
}

function hasResumableLocalMatch() {
  try {
    const raw = localStorage.getItem(LOCAL_MATCH_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && (parsed.status === 'active' || parsed.status === 'paused' || parsed.status === 'finished'));
  } catch (_e) {
    return false;
  }
}

async function launchLocalKoth() {
  clearInterval(state.tickInterval);
  if (state.unsubRoom) { state.unsubRoom(); state.unsubRoom = null; }
  state.isLocalMode = true;
  state.roomCode = null;
  state.room = null;
  state.role = 'local';
  closeAllModals();
  $('view-landing').hidden = true;
  $('view-stage').hidden = false;
  if (!state.activeGameModule) {
    state.activeGameModule = await import('./js-game-koth.js?v=0.0.3');
  }
  state.activeGameModule.mount($('game-mount'), { role: 'local', nodeLabel: 'Local KOTH', room: null, onExitLocal: exitToLanding });
  state.tickInterval = setInterval(() => {
    if (state.activeGameModule) state.activeGameModule.onTick(Date.now());
  }, 250);
}

async function exitToLanding() {
  const wasLocal = state.isLocalMode;
  clearInterval(state.tickInterval);
  if (state.activeGameModule) state.activeGameModule.unmount();
  if (state.unsubRoom) { state.unsubRoom(); state.unsubRoom = null; }
  if (wasLocal) {
    localStorage.removeItem(LOCAL_MATCH_KEY);
  } else {
    await leaveRoom(state.roomCode);
  }

  state.isLocalMode = false;
  state.roomCode = null;
  state.room = null;
  state.role = 'unassigned';

  closeAllModals();
  $('view-stage').hidden = true;
  $('view-landing').hidden = false;
}

function bindEvents() {
  $('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  $('btn-open-local')?.addEventListener('click', launchLocalKoth);

  $('btn-open-join')?.addEventListener('click', () => {
    openModal('modal-join');
    if (!state.unsubPublic) {
      state.unsubPublic = subscribePublicRooms(renderPublicRooms);
    }
  });

  $('btn-open-create')?.addEventListener('click', () => openModal('modal-create'));
  $('btn-open-firebase')?.addEventListener('click', () => openModal('modal-firebase'));
  $('btn-node-settings')?.addEventListener('click', () => {
    const isHost = !state.isLocalMode && state.room?.meta?.hostUid === getOrCreateHostUid();
    $('settings-role-btn').hidden = state.isLocalMode;
    $('settings-host-btn').hidden = !isHost;
    $('settings-leave-btn').textContent = state.isLocalMode ? 'End Local Match & Exit' : 'Leave / Switch Room';
    openModal('modal-node-settings');
  });

  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeAllModals());
  });

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) closeAllModals();
    });
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closeAllModals();
  });

  window.addEventListener('popstate', () => {
    closeAllModals(true);
  });

  // Lockdown form
  $('form-lockdown')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const pass = $('lockdown-pass-input').value.trim();
    if (!pass) return;
    const hash = await sha256Hex(pass);
    localStorage.setItem(STORAGE_KEYS.lockdownHash, hash);
    $('modal-lockdown').hidden = true;
    showToast('Access key saved locally');
  });

  // Create room form
  $('form-create-room')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('btn-submit-create');
    btn.disabled = true;
    try {
      const room = await createRoom({
        title: $('create-title-input').value,
        password: $('create-password-input').value,
        isPublic: $('create-public-checkbox').checked,
        gameMode: $('create-mode-select').value,
        rotationIntervalSec: Number($('create-rotation-input').value) || 180,
        nodeLabel: state.nodeLabel
      });
      await enterRoomSession(room);
    } catch (err) {
      showToast(err.message || 'Could not create room');
    } finally {
      btn.disabled = false;
    }
  });

  // Join room form
  $('form-join-room')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('btn-submit-join');
    btn.disabled = true;
    try {
      const room = await joinRoom({
        code: $('join-code-input').value,
        password: $('join-password-input').value,
        nodeLabel: state.nodeLabel
      });
      await enterRoomSession(room);
    } catch (err) {
      showToast(err.message || 'Could not join room');
    } finally {
      btn.disabled = false;
    }
  });

  // Role selection buttons
  document.querySelectorAll('[data-select-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-select-role');
      activateNodeRole(role);
    });
  });

  // Node settings actions
  $('settings-fullscreen-btn')?.addEventListener('click', async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
    closeAllModals();
  });

  $('settings-role-btn')?.addEventListener('click', () => {
    closeAllModals();
    openModal('modal-role');
  });

  $('settings-host-btn')?.addEventListener('click', () => {
    activateNodeRole('host-admin');
  });

  $('settings-leave-btn')?.addEventListener('click', exitToLanding);

  // Optional BYO-Firebase config modal
  $('form-firebase-config')?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = $('firebase-json-input').value.trim();
    if (!raw) {
      localStorage.removeItem(STORAGE_KEYS.customFirebase);
      location.reload();
      return;
    }
    try {
      JSON.parse(raw);
      localStorage.setItem(STORAGE_KEYS.customFirebase, raw);
      location.reload();
    } catch (_e) {
      showToast('Invalid Firebase JSON config');
    }
  });
}

async function boot() {
  initTheme();
  bindEvents();

  const labelInput = $('node-label-input');
  if (labelInput) labelInput.value = state.nodeLabel;

  initSync()
    .then((syncInfo) => {
      if (syncInfo.mode === 'firebase' && !isDemoMode()) {
        setStatusBadge('Firebase Live', true);
      } else {
        setStatusBadge('Local Demo Mode', false);
      }
    })
    .catch(() => setStatusBadge('Offline / Local Ready', false));

  const resumingLocal = hasResumableLocalMatch();
  if (resumingLocal) {
    await launchLocalKoth();
  } else if (isLockdownBlocking()) {
    $('modal-lockdown').hidden = false;
  }
}

boot();
