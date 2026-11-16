/**
 * Mycelium Game Submodule: King of the Hill (KOTH)
 * Version: v0.0.1 (Barebone Scaffold ready for Phase 3 engine expansion)
 */

import { APP_META } from './js-config.js?v=0.0.1';

export const GAME_META = Object.freeze({
  id: 'koth',
  name: 'King of the Hill',
  version: '0.0.1'
});

let container = null;
let ctx = null;
let latestRoom = null;
let holdStartMs = 0;
let holdTeam = null;
let rafId = null;

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRoleShell() {
  if (!container || !ctx) return;
  const role = ctx.role || 'hill';
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
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

export function mount(targetEl, context) {
  unmount();
  container = targetEl;
  ctx = context;
  latestRoom = context.room || null;
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

export function onTick(nowMs) {
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
  if (container) container.innerHTML = '';
  container = null;
  ctx = null;
}
