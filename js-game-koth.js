/**
 * Mycelium Game Submodule: King of the Hill (KOTH)
 * Version: v0.0.3
 */

import { APP_META } from './js-config.js?v=0.0.2';

export const GAME_META = Object.freeze({
  id: 'koth',
  name: 'King of the Hill',
  version: '0.0.3'
});

let container = null;
let ctx = null;
let latestRoom = null;
const LOCAL_MATCH_KEY = 'mycelium_local_koth_v1';

let holdStartMs = 0;
let holdTeam = null;
let rafId = null;
let localState = null;

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function defaultLocalState(durationSec = 300) {
  return {
    status: 'setup',
    durationSec,
    scores: { red: 0, blue: 0 },
    hillOwner: null,
    roundEndsAt: 0,
    lastScoredAt: 0,
    pausedRemainingMs: 0,
    updatedAt: 0
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_MATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.scores || typeof parsed.durationSec !== 'number') return null;
    return parsed;
  } catch (_e) { return null; }
}

function saveLocalState() {
  if (!localState) return;
  try { localStorage.setItem(LOCAL_MATCH_KEY, JSON.stringify(localState)); } catch (_e) {}
}

function clearLocalState() {
  try { localStorage.removeItem(LOCAL_MATCH_KEY); } catch (_e) {}
}

function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function reconcileLocalState(nowMs) {
  if (!localState || localState.status !== 'active' || !localState.roundEndsAt) {
    return { changed: false, finishedNow: false };
  }
  let changed = false;
  const effectiveNow = Math.min(nowMs, localState.roundEndsAt);
  const wholeSec = Math.floor(Math.max(0, effectiveNow - localState.lastScoredAt) / 1000);
  if (wholeSec > 0) {
    if (localState.hillOwner === 'red' || localState.hillOwner === 'blue') {
      localState.scores[localState.hillOwner] = (Number(localState.scores[localState.hillOwner]) || 0) + wholeSec;
    }
    localState.lastScoredAt += wholeSec * 1000;
    localState.updatedAt = nowMs;
    changed = true;
  }
  let finishedNow = false;
  if (nowMs >= localState.roundEndsAt) {
    localState.status = 'finished';
    localState.pausedRemainingMs = 0;
    localState.lastScoredAt = localState.roundEndsAt;
    localState.updatedAt = nowMs;
    changed = true;
    finishedNow = true;
  }
  return { changed, finishedNow };
}

function onVisibilityOrHide() {
  if (!ctx || ctx.role !== 'local' || !localState) return;
  const { changed, finishedNow } = reconcileLocalState(Date.now());
  if (changed) saveLocalState();
  if (document.visibilityState === 'visible') {
    if (finishedNow) { cancelHold(); renderLocalRole(); } else { syncLocalDom(); }
  }
}

function applyLocalCapture(team) {
  if (!localState || localState.status !== 'active') return;
  const now = Date.now();
  const { finishedNow } = reconcileLocalState(now);
  if (finishedNow || localState.status !== 'active') {
    saveLocalState();
    renderLocalRole();
    return;
  }
  localState.hillOwner = team;
  localState.lastScoredAt = now;
  localState.updatedAt = now;
  saveLocalState();
  syncLocalDom();
}

function renderLocalSetupHtml(ls) {
  const mins = Math.max(1, Math.round((ls.durationSec || 300) / 60));
  const presets = [3, 5, 10, 15];
  return `
    <section class="stage-card stage-hill">
      <div class="stage-header-row">
        <span class="badge-pill">Local KOTH • 1 Device</span>
        <span class="badge-pill">SETUP</span>
      </div>
      <div class="field-group">
        <label for="local-mins-input">Match Duration (Minutes)</label>
        <div class="local-preset-row">
          ${presets.map((p) => `<button type="button" class="pill-btn btn-secondary btn-sm ${mins === p ? 'is-selected' : ''}" data-local-preset="${p}">${p}m</button>`).join('')}
        </div>
        <input id="local-mins-input" type="number" class="text-input" min="1" max="120" value="${mins}" />
      </div>
      <button type="button" class="pill-btn btn-primary" data-local-action="start" style="width:100%">Start Match</button>
      <p class="muted-hint">Stationary continuous hill. Hold Red (<strong>R</strong>) or Blue (<strong>B</strong>) for 2.0s to capture. Progress survives refresh or power loss.</p>
    </section>`;
}

function renderLocalFinishedHtml(ls) {
  const red = Number(ls.scores?.red) || 0;
  const blue = Number(ls.scores?.blue) || 0;
  const msg = red === blue ? 'TIE GAME!' : red > blue ? 'RED TEAM WINS!' : 'BLUE TEAM WINS!';
  const cls = red === blue ? '' : red > blue ? 'is-red' : 'is-blue';
  return `
    <section class="stage-card stage-hill">
      <div class="stage-header-row"><span class="badge-pill">Local KOTH • 1 Device</span><span class="badge-pill">MATCH OVER</span></div>
      <div class="timer-hero" data-bind="timer">00:00</div>
      <div class="hill-owner-banner ${cls}">${msg}</div>
      <div class="score-grid" style="margin-bottom:16px">
        <div class="team-score-card team-red"><span class="team-name">RED TEAM</span><span class="team-pts" data-bind="score-red">${red}</span></div>
        <div class="team-score-card team-blue"><span class="team-name">BLUE TEAM</span><span class="team-pts" data-bind="score-blue">${blue}</span></div>
      </div>
      <div class="host-controls-row">
        <button type="button" class="pill-btn btn-primary" data-local-action="rematch" style="flex:1">Rematch</button>
        <button type="button" class="pill-btn btn-secondary" data-local-action="reset" style="flex:1">Change Time</button>
      </div>
    </section>`;
}

function renderLocalActiveHtml(ls) {
  const isPaused = ls.status === 'paused';
  const owner = ls.hillOwner;
  const ownerText = owner === 'red' ? 'RED CONTROLLED' : owner === 'blue' ? 'BLUE CONTROLLED' : 'NEUTRAL HILL';
  const ownerCls = owner === 'red' ? 'is-red' : owner === 'blue' ? 'is-blue' : '';
  const remSec = isPaused ? Math.ceil(ls.pausedRemainingMs / 1000) : Math.ceil(Math.max(0, ls.roundEndsAt - Date.now()) / 1000);
  return `
    <section class="stage-card stage-hill">
      <div class="stage-header-row">
        <span class="badge-pill">Local KOTH • ${isPaused ? 'PAUSED' : 'ACTIVE'}</span>
        <div class="local-toolbar">
          <button type="button" class="pill-btn btn-secondary btn-sm" data-local-action="${isPaused ? 'resume' : 'pause'}">${isPaused ? 'Resume' : 'Pause'}</button>
          <button type="button" class="pill-btn btn-secondary btn-sm" data-local-action="reset">Reset</button>
        </div>
      </div>
      <div class="timer-hero" data-bind="timer">${formatClock(remSec)}</div>
      <div class="score-grid" style="margin-bottom:14px">
        <div class="team-score-card team-red"><span class="team-name">RED TEAM</span><span class="team-pts" data-bind="score-red">${Number(ls.scores?.red) || 0}</span></div>
        <div class="team-score-card team-blue"><span class="team-name">BLUE TEAM</span><span class="team-pts" data-bind="score-blue">${Number(ls.scores?.blue) || 0}</span></div>
      </div>
      <div class="hill-owner-banner ${ownerCls}" data-bind="owner">${ownerText}</div>
      <div class="capture-track" aria-hidden="true"><div class="capture-bar-fill" id="koth-capture-fill"></div></div>
      <div class="capture-btn-grid">
        <button type="button" class="capture-btn team-red pill-btn" data-hold-team="red" ${isPaused || owner === 'red' ? 'disabled' : ''}>${owner === 'red' ? 'Red Owns Hill' : 'Hold R • Red'}</button>
        <button type="button" class="capture-btn team-blue pill-btn" data-hold-team="blue" ${isPaused || owner === 'blue' ? 'disabled' : ''}>${owner === 'blue' ? 'Blue Owns Hill' : 'Hold B • Blue'}</button>
      </div>
    </section>`;
}

function syncLocalDom() {
  if (!container || !localState) return;
  const ls = localState;
  const timerEl = container.querySelector('[data-bind="timer"]');
  if (timerEl) {
    const remSec = ls.status === 'paused' ? Math.ceil(ls.pausedRemainingMs / 1000) : ls.status === 'active' ? Math.ceil(Math.max(0, ls.roundEndsAt - Date.now()) / 1000) : 0;
    timerEl.textContent = formatClock(remSec);
  }
  const redEl = container.querySelector('[data-bind="score-red"]');
  if (redEl) redEl.textContent = String(Number(ls.scores?.red) || 0);
  const blueEl = container.querySelector('[data-bind="score-blue"]');
  if (blueEl) blueEl.textContent = String(Number(ls.scores?.blue) || 0);
  const banner = container.querySelector('[data-bind="owner"]');
  if (banner) {
    banner.textContent = ls.hillOwner === 'red' ? 'RED CONTROLLED' : ls.hillOwner === 'blue' ? 'BLUE CONTROLLED' : 'NEUTRAL HILL';
    banner.classList.toggle('is-red', ls.hillOwner === 'red');
    banner.classList.toggle('is-blue', ls.hillOwner === 'blue');
  }
  const redBtn = container.querySelector('[data-hold-team="red"]');
  const blueBtn = container.querySelector('[data-hold-team="blue"]');
  if (redBtn) { redBtn.disabled = ls.status !== 'active' || ls.hillOwner === 'red'; redBtn.textContent = ls.hillOwner === 'red' ? 'Red Owns Hill' : 'Hold R • Red'; }
  if (blueBtn) { blueBtn.disabled = ls.status !== 'active' || ls.hillOwner === 'blue'; blueBtn.textContent = ls.hillOwner === 'blue' ? 'Blue Owns Hill' : 'Hold B • Blue'; }
}

function renderLocalRole() {
  if (!container || !localState) return;
  if (localState.status === 'setup') container.innerHTML = renderLocalSetupHtml(localState);
  else if (localState.status === 'finished') container.innerHTML = renderLocalFinishedHtml(localState);
  else container.innerHTML = renderLocalActiveHtml(localState);
  bindLocalControls();
}

function bindLocalControls() {
  if (!container || !localState) return;
  container.querySelectorAll('[data-local-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localState.durationSec = Number(btn.getAttribute('data-local-preset')) * 60;
      renderLocalRole();
    });
  });
  container.querySelector('[data-local-action="start"]')?.addEventListener('click', () => {
    const mins = Math.min(120, Math.max(1, Number(document.getElementById('local-mins-input')?.value) || 5));
    const now = Date.now();
    localState = { ...defaultLocalState(mins * 60), status: 'active', roundEndsAt: now + mins * 60 * 1000, lastScoredAt: now, updatedAt: now };
    saveLocalState(); renderLocalRole();
  });
  container.querySelector('[data-local-action="pause"]')?.addEventListener('click', () => {
    cancelHold();
    const now = Date.now();
    const { finishedNow } = reconcileLocalState(now);
    if (!finishedNow) { localState.pausedRemainingMs = Math.max(0, localState.roundEndsAt - now); localState.status = 'paused'; localState.roundEndsAt = 0; localState.updatedAt = now; }
    saveLocalState(); renderLocalRole();
  });
  container.querySelector('[data-local-action="resume"]')?.addEventListener('click', () => {
    const now = Date.now();
    localState.roundEndsAt = now + localState.pausedRemainingMs; localState.lastScoredAt = now; localState.pausedRemainingMs = 0; localState.status = 'active'; localState.updatedAt = now;
    saveLocalState(); renderLocalRole();
  });
  container.querySelector('[data-local-action="reset"]')?.addEventListener('click', () => {
    cancelHold(); localState = defaultLocalState(localState.durationSec); clearLocalState(); renderLocalRole();
  });
  container.querySelector('[data-local-action="rematch"]')?.addEventListener('click', () => {
    cancelHold(); const now = Date.now(); const dur = localState.durationSec || 300;
    localState = { ...defaultLocalState(dur), status: 'active', roundEndsAt: now + dur * 1000, lastScoredAt: now, updatedAt: now };
    saveLocalState(); renderLocalRole();
  });
  bindHillInputs();
}

function renderRoleShell() {
  if (!container || !ctx) return;
  const role = ctx.role || 'hill';
  if (role === 'local') { renderLocalRole(); return; }
  const room = latestRoom || {};
  const meta = room.meta || {};
  const gs = room.gameState || {};
  const scores = gs.scores || { red: 0, blue: 0 };
  const nodes = Object.values(room.nodes || {});

  if (role === 'display-compact') {
    container.innerHTML = `
      <section class="stage-card stage-scoreboard">
        <div class="stage-header-row">
          <span class="badge-pill">${esc(meta.title || 'Room')} • ${esc(meta.code || '----')}</span>
          <span class="badge-pill" data-bind="status">${esc(gs.status || 'lobby')}</span>
        </div>
        <div class="timer-hero" data-bind="timer">03:00</div>
        <div class="score-grid">
          <div class="team-score-card team-red">
            <span class="team-name">RED TEAM</span>
            <span class="team-pts" data-bind="score-red">${Number(scores.red) || 0}</span>
          </div>
          <div class="team-score-card team-blue">
            <span class="team-name">BLUE TEAM</span>
            <span class="team-pts" data-bind="score-blue">${Number(scores.blue) || 0}</span>
          </div>
        </div>
        <p class="muted-hint">Compact Display Node • Auto-syncing live</p>
      </section>
    `;
    return;
  }

  if (role === 'display-map') {
    container.innerHTML = `
      <section class="stage-card">
        <div class="stage-header-row">
          <span class="badge-pill">Big Map Display • ${esc(meta.code || '----')}</span>
          <span class="badge-pill" data-bind="timer">03:00</span>
        </div>
        <div class="map-placeholder-grid" id="koth-map-nodes">
          ${nodes.map((n) => `
            <div class="node-tile">
              <strong>${esc(n.label)}</strong>
              <span class="badge-pill">${esc(n.role)}</span>
            </div>
          `).join('')}
        </div>
        <p class="muted-hint">Phase 4 will add custom uploaded field maps &amp; next-hill rotation pins.</p>
      </section>
    `;
    return;
  }

  if (role === 'host-admin') {
    container.innerHTML = `
      <section class="stage-card">
        <div class="stage-header-row">
          <span class="badge-pill">Host Admin • Code: ${esc(meta.code || '----')}</span>
          <span class="badge-pill" data-bind="status">${esc(gs.status || 'lobby')}</span>
        </div>
        <h2>${esc(meta.title || 'Mycelium Room')}</h2>
        <div class="host-controls-row">
          <button type="button" class="btn-primary pill-btn" data-action="start">Start Round</button>
          <button type="button" class="btn-secondary pill-btn" data-action="reset">Reset</button>
        </div>
        <h3 class="subhead">Connected Nodes (${nodes.length})</h3>
        <div class="node-roster" id="koth-node-roster">
          ${nodes.map((n) => `
            <div class="node-row">
              <span>${esc(n.label)}</span>
              <span class="badge-pill">${esc(n.role)}</span>
            </div>
          `).join('')}
        </div>
        <p class="muted-hint">Phase 4 enables remote node role switching directly from this list.</p>
      </section>
    `;
    bindHostButtons();
    return;
  }

  // Default: 'hill' control point node
  container.innerHTML = `
    <section class="stage-card stage-hill">
      <div class="stage-header-row">
        <span class="badge-pill">Hill Node • ${esc(ctx.nodeLabel || 'Control Point')}</span>
        <span class="badge-pill" data-bind="timer">03:00</span>
      </div>
      <div class="hill-owner-banner" data-bind="owner">NEUTRAL HILL</div>
      <div class="capture-track" aria-hidden="true">
        <div class="capture-bar-fill" id="koth-capture-fill"></div>
      </div>
      <p class="muted-hint">Hold team button or press <strong>R</strong> / <strong>B</strong> for 2.0s to capture</p>
      <div class="capture-btn-grid">
        <button type="button" class="capture-btn team-red pill-btn" data-hold-team="red">Hold R • Red</button>
        <button type="button" class="capture-btn team-blue pill-btn" data-hold-team="blue">Hold B • Blue</button>
      </div>
    </section>
  `;
  bindHillInputs();
}

function bindHostButtons() {
  if (!container || !ctx) return;
  container.querySelector('[data-action="start"]')?.addEventListener('click', () => {
    const interval = Number(latestRoom?.gameState?.rotationIntervalSec) || 180;
    ctx.onPatchGameState({
      status: 'active',
      nextRotationAt: Date.now() + interval * 1000
    });
  });
  container.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    ctx.onPatchGameState({
      status: 'lobby',
      nextRotationAt: 0,
      scores: { red: 0, blue: 0 }
    });
  });
}

function startHold(team) {
  if (ctx?.role === 'local' && (!localState || localState.status !== 'active' || localState.hillOwner === team)) return;
  if (holdTeam === team) return;
  holdTeam = team;
  holdStartMs = performance.now();
  animateHold();
}

function cancelHold() {
  holdTeam = null;
  holdStartMs = 0;
  if (rafId) cancelAnimationFrame(rafId);
  const fill = document.getElementById('koth-capture-fill');
  if (fill) fill.style.transform = 'scaleX(0)';
}

function animateHold() {
  if (!holdTeam) return;
  const elapsed = performance.now() - holdStartMs;
  const progress = Math.min(1, elapsed / APP_META.captureHoldMs);
  const fill = document.getElementById('koth-capture-fill');
  if (fill) fill.style.transform = `scaleX(${progress.toFixed(3)})`;

  if (progress >= 1) {
    const capturedBy = holdTeam;
    cancelHold();
    if (ctx?.role === 'local') { applyLocalCapture(capturedBy); return; }
    const banner = container?.querySelector('[data-bind="owner"]');
    if (banner) banner.textContent = `${capturedBy.toUpperCase()} CONTROLLED`;
    return;
  }
  rafId = requestAnimationFrame(animateHold);
}

function onKeyDown(ev) {
  if (ev.repeat || ev.target.tagName === 'INPUT') return;
  const k = ev.key.toLowerCase();
  if (k === 'r') startHold('red');
  if (k === 'b') startHold('blue');
}

function onKeyUp(ev) {
  const k = ev.key.toLowerCase();
  if ((k === 'r' && holdTeam === 'red') || (k === 'b' && holdTeam === 'blue')) {
    cancelHold();
  }
}

function bindHillInputs() {
  if (!container) return;
  container.querySelectorAll('[data-hold-team]').forEach((btn) => {
    const team = btn.getAttribute('data-hold-team');
    btn.addEventListener('pointerdown', () => startHold(team));
    btn.addEventListener('pointerup', cancelHold);
    btn.addEventListener('pointerleave', cancelHold);
    btn.addEventListener('pointercancel', cancelHold);
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

export function mount(targetEl, context) {
  unmount();
  container = targetEl;
  ctx = context;
  latestRoom = context.room || null;
  if (context.role === 'local') {
    localState = loadLocalState() || defaultLocalState();
    const { changed } = reconcileLocalState(Date.now());
    if (changed) saveLocalState();
    document.addEventListener('visibilitychange', onVisibilityOrHide);
    window.addEventListener('pagehide', onVisibilityOrHide);
  }
  renderRoleShell();
}

export function onStateUpdate(roomSnapshot) {
  latestRoom = roomSnapshot;
  if (!container || !ctx) return;

  const gs = roomSnapshot?.gameState || {};
  const statusEl = container.querySelector('[data-bind="status"]');
  if (statusEl && gs.status) statusEl.textContent = gs.status;

  const redEl = container.querySelector('[data-bind="score-red"]');
  if (redEl && gs.scores) redEl.textContent = String(gs.scores.red ?? 0);

  const blueEl = container.querySelector('[data-bind="score-blue"]');
  if (blueEl && gs.scores) blueEl.textContent = String(gs.scores.blue ?? 0);

  if (ctx.role === 'host-admin' || ctx.role === 'display-map') {
    renderRoleShell();
  }
}

function onLocalTick(nowMs) {
  if (!container || !localState || localState.status !== 'active') return;
  const { changed, finishedNow } = reconcileLocalState(nowMs);
  if (changed) saveLocalState();
  if (finishedNow) { cancelHold(); renderLocalRole(); return; }
  syncLocalDom();
}

export function onTick(nowMs) {
  if (ctx?.role === 'local') { onLocalTick(nowMs); return; }
  if (!container || !latestRoom) return;
  const target = latestRoom.gameState?.nextRotationAt || 0;
  const timerEl = container.querySelector('[data-bind="timer"]');
  if (!timerEl) return;

  if (!target || latestRoom.gameState?.status !== 'active') {
    const fallback = Number(latestRoom.gameState?.rotationIntervalSec) || 180;
    const m = String(Math.floor(fallback / 60)).padStart(2, '0');
    const s = String(fallback % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
    return;
  }

  const remSec = Math.max(0, Math.ceil((target - nowMs) / 1000));
  const m = String(Math.floor(remSec / 60)).padStart(2, '0');
  const s = String(remSec % 60).padStart(2, '0');
  timerEl.textContent = `${m}:${s}`;
}

export function unmount() {
  cancelHold();
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('visibilitychange', onVisibilityOrHide);
  window.removeEventListener('pagehide', onVisibilityOrHide);
  if (container) container.innerHTML = '';
  container = null;
  ctx = null;
  localState = null;
}
