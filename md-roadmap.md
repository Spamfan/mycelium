# MYCELIUM — Project Roadmap & Handoff Guide
### Version: v0.0.2

---

### 1. PROJECT VISION & CORE CONCEPT

**Mycelium** is a zero-cost, open-source web platform hosted statically on GitHub Pages (`spamfan.github.io/mycelium`) designed to power real-world (IRL) physical games using everyday devices—phones, tablets, laptops, and desktop PCs—acting as networked **nodes**.

#### Primary Use Cases
* **IRL King of the Hill (KOTH):** Teams playing with Nerf blasters, laser tag, touch-tag, or physical flags run to active control point devices ("Hill Nodes") placed around an indoor/outdoor field. A player captures the hill by pressing and holding their team's assigned key/button for **2 seconds**. Automated timers track team score and rotate active hills across participating devices on a fixed schedule.
* **IRL Dominion (Halo 4-Inspired — Future Mode):** Multiple simultaneous capture points placed across a play area with capture timers, fortification/shield mechanics, and live territory scoring.
* **Persistent "Set Once, Play Infinite Rounds" Workflow:** Devices join a room once using a 4-character room code (or public titled room list) and pick their node role. Once placed in the field, devices stay connected across infinite rounds while the **Host** controls game creation, timers, and round resets from their device.

---

### 2. CURRENT BASELINE STATE (`v0.0.2` — Local Single-Device KOTH + Network Scaffold)

In addition to the modular UI shell and Firebase RTDB/demo scaffold, the platform now includes a playable **Single-Device Local KOTH** quick-launch mode (`#btn-open-local`, `role: 'local'`) with zero-login offline boot and `localStorage` wall-clock ghost continuity (`mycelium_local_koth_v1`). The rest of the networked baseline establishes:
* **Alphabetical Format-Prefixed File Tree:** All files use format prefixes (`js-*.js`, `md-*.md`, except `index.html` and `styles.css`) for tidy repository organization.
* **Complete Entry UX Flow:**
  1. **Optional Global Lockdown Gate:** Appears only when `LOCKDOWN_ENABLED` is set to `true` in `js-config.js` (default `false`).
  2. **Landing Screen:** Primary **Join Room** CTA and secondary **Create Room** CTA, plus Light/Dark theme toggle and optional custom Firebase config modal.
  3. **Join Room Modal:** Live public room browser (with `.skeleton-box` loading placeholders) plus direct 4-character private room code and optional room password inputs.
  4. **Create Room Modal:** Room title (e.g., `"Gable Thanksgiving"`), optional room password, public/private visibility toggle, game mode selector, and initial match parameters.
  5. **Node Role Picker:** Immediately after creating or joining a room, the device selects its initial role:
     * `hill` — Active capture control point node.
     * `display-compact` — Compact scoreboard showing team totals, active hill, and countdown timer.
     * `display-map` — Large field map display showing hill locations and upcoming rotation targets.
     * `host-admin` — Host control console (available to the room creator holding matching `hostUid`).
  6. **Active Node Stage + Subtle Settings Gear:** Clean, full-viewport role stage with an unobtrusive corner Mycelium gear button (`#btn-node-settings`) allowing any node to toggle fullscreen, switch its own role, access host controls, leave the room, or host/join another room.
* **Resilient Sync Layer (`js-net-sync.js`):** Ready for Firebase Realtime Database (RTDB) + Anonymous Auth, and includes an automatic local loopback/offline demo mode when placeholder Firebase credentials are present so UI flows can be tested immediately.
* **Isolated KOTH Plugin (`js-game-koth.js`):** Barebone lifecycle hooks (`mount`, `unmount`, `onStateUpdate`, `onTick`) ready for full capture and rotation mechanics.

---

### 3. LOCKED ARCHITECTURAL DECISIONS (DO NOT UNDO)

1. **Public Internet via GitHub Pages + Firebase RTDB (NOT GitHub REST API):**
   * GitHub REST API has strict unauthenticated rate limits (60 req/hr/IP) and requires exposing a Personal Access Token for writes.
   * **Firebase Realtime Database (Spark free tier)** + **Firebase Anonymous Authentication** delivers sub-second WebSocket sync over cellular data and Wi-Fi at $0 cost, with zero account sign-up or API key entry required from players.
2. **Zero-Secret Repository Security Model:**
   * Firebase web `apiKey`s are public identifiers and safe to commit when locked down with Firebase Security Rules and HTTP referrer domain restrictions (`spamfan.github.io`).
   * **Host Lock (`hostUid`):** Auto-generated UUID saved in `localStorage` on room creation; verified by Security Rules so only the host can mutate room metadata or game state.
   * **Optional Room Password:** Hashed client-side via Web Crypto SHA-256 before writing/verifying.
   * **Developer-Toggleable Global Lockdown (`LOCKDOWN_ENABLED`):** Off (`false`) by default so friends/family have zero friction. When flipped to `true` by the developer in `js-config.js`, users enter a secret passphrase once; the browser hashes it with SHA-256, caches the hash locally, and Firebase Security Rules compare it against a hash stored strictly inside the rules (never in public GitHub source).
3. **Low-End Device Performance Mandate (Samsung Galaxy A03s Target):**
   * Field nodes will include budget smartphones like the **Samsung Galaxy A03s** and older low-end laptops.
   * **Strict CSS/DOM Rules:** Never use `backdrop-filter: blur()`, heavy multi-layer shadows, or full-screen DOM re-renders on timer ticks. Update timer text via targeted `textContent` mutations and animate 2-second hold bars exclusively with GPU-composited `transform: scaleX()`.
4. **Outdoor-First Auto Light/Dark Theme:**
   * Detects `window.matchMedia('(prefers-color-scheme: dark)')`, defaulting to **Light Mode** when unspecified so screens remain readable in outdoor daylight, with a persistent manual toggle.
5. **Remote Host Control Readiness:**
   * Although joiners currently pick their own role at setup, every node record in RTDB (`rooms/{code}/nodes/{nodeId}`) explicitly stores `role`, `label`, `joinedAt`, and `lastSeen` so Phase 4 can let the Host remotely flip any node's role from one device.

---

### 4. PHASED DEVELOPMENT ROADMAP

* **Phase 1 — `v0.0.1` (Initial Baseline):**
  * Modular file architecture, Living Design Document (`md-project-mycelium.md`), subsystem specs (`md-spec-*.md`), roadmap (`md-roadmap.md`), responsive Light/Dark UI shell, Join/Create/Lockdown UX flows, Node Role Picker, and barebone sync/KOTH stubs.
* **Phase 1.5 — `v0.0.2–v0.0.3` (Current — Single-Device Local KOTH Fast-Track):**
  * Playable 1-device stationary KOTH mode (`#btn-open-local`) with match timer, 2.0s hold-to-capture, Pause/Resume/Reset/Rematch, non-blocking `initSync()`, and `localStorage` ghost continuity across refreshes/power loss.
* **Phase 2 — `v0.1.x` (Live Firebase RTDB Wiring & Security Rules):**
  * Configure live Firebase web app credentials in `js-config.js` (plus optional BYO-Firebase settings modal).
  * Deploy Firebase RTDB Security Rules (`rooms/$roomCode`, `publicRooms/$roomCode`, `hostUid` write enforcement, optional room password hash check, optional global lockdown hash check).
  * Verify multi-device live room creation, public room discovery, private room joining, and node presence/heartbeat.
* **Phase 3 — `v0.2.x` (Full King of the Hill Engine — `js-game-koth.js`):**
  * Team configuration (2–4 teams, custom colors, single-letter keyboard shortcuts + large touch pads).
  * 2-second hold-to-capture mechanic (`keydown` + `pointerdown` hold timer using `transform: scaleX()` progress bar; resets cleanly on early release or interruption).
  * Fixed-timer automatic hill rotation across active `hill` nodes, live points per second calculation, round countdown, and round-over scoreboard/reset loop.
* **Phase 4 — `v0.3.x` (Remote Host Orchestration & Big Map Display):**
  * Host Admin controls to remotely reassign any node's `role` (e.g., flipping Nodes 1, 3, and 5 to `display-compact` or `hill` mid-session), pause/resume timers, adjust scores, and kick disconnected nodes.
  * Implement `display-map` view supporting a field layout/image with live node pins, active hill pulse, and next-hill rotation preview.
* **Phase 5 — `v0.4.x` (Dominion Game Mode — `js-game-dominion.js`):**
  * Add Halo 4-style Dominion plugin supporting multiple simultaneous capture points, base fortification timers, and territory scoring without modifying core UI or sync modules.
