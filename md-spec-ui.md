# MYCELIUM — UI, Navigation & Low-End Performance Spec
### Version: v0.0.2
### Target Files: `index.html`, `styles.css`, `js-app.js`

---

### 1. OVERVIEW & UX ENTRY FLOW

The UI layer provides a fast, minimalist, outdoors-readable shell that routes any device ("node") from entry to an active game role in minimal taps.

#### Step-by-Step UX Flow
1. **Boot, Non-Blocking Sync & Auto-Resume (`js-app.js`):**
   * Applies saved `localStorage` theme (`light` or `dark`), starts `initSync()` non-blockingly so offline devices never stall, and immediately auto-resumes `#view-stage` in `'local'` mode if `mycelium_local_koth_v1` holds an `'active'`, `'paused'`, or `'finished'` match.
   * Otherwise checks `LOCKDOWN_ENABLED` from `js-config.js`; if `true` without a cached SHA-256 pass hash, opens the **Global Lockdown Modal**.
2. **Landing View (`#view-landing`):**
   * Displays Mycelium header, connection status pill (`Firebase Live`, `Local Demo Mode`, or `Offline / Local Ready`), Light/Dark theme toggle, and Firebase config gear.
   * **Primary Action:** `Play Local KOTH (1 Device)` (`#btn-open-local`, `.btn-primary.pill-btn`) — launches single-device KOTH immediately with zero room codes or logins.
   * **Secondary Actions:** `Join Room` and `Create Room` (`.btn-secondary.pill-btn`) for networked room sessions.
3. **Join Room Modal (`#modal-join`):**
   * Renders live public titled rooms inside `#public-rooms-list` using `.skeleton-box` shimmer placeholders while fetching.
   * Provides direct input for a 4-character **Private Room Code** and an optional **Room Password** field.
4. **Create Room Modal (`#modal-create`):**
   * Fields: **Room Title** (e.g., `"Gable Thanksgiving"`), **Optional Password**, **Visibility** (`Public` listed vs `Private` code-only), **Game Mode** (`King of the Hill`), and **Rotation Timer (sec)**.
   * On submit, generates a 4-char room code, persists `hostUid` in `localStorage`, creates the room via `js-net-sync.js`, and transitions to the **Node Role Picker**.
5. **Node Role Picker Modal (`#modal-role`):**
   * Allows the joining/hosting device to pick its role:
     * **Hill Node (`hill`):** Control point where players hold their team key/button for 2 seconds to capture.
     * **Compact Display (`display-compact`):** High-contrast team scores, active hill name, and countdown timer.
     * **Big Map Display (`display-map`):** Field overview showing hill nodes and next rotation target.
     * **Host Admin (`host-admin`):** Shown when local `hostUid` matches the room's host; manages round state and remote node roles.
6. **Active Node Stage (`#view-stage`):**
   * Full-viewport container (`#game-mount`) hosting the active game module's UI for the selected role (or `'local'` single-device KOTH).
   * Includes a subtle, low-opacity floating corner gear button (`#btn-node-settings`) to open **Node Settings** (`#modal-node-settings`) to toggle Fullscreen, change Node Role, open Host Controls, or Leave/Exit (in `'local'` mode, network-only options are hidden and exiting clears `mycelium_local_koth_v1` back to landing).

---

### 2. NAVIGATION & MODAL CONTRACT

* **4-Way Modal Dismissal:** Every modal (`#modal-join`, `#modal-create`, `#modal-role`, `#modal-node-settings`, `#modal-lockdown`, `#modal-firebase`) supports:
  1. Explicit close button (`[data-close-modal]`).
  2. Backdrop click outside `.modal-card`.
  3. `Escape` key press (except `#modal-lockdown` when enforced).
  4. Browser back button/gesture via `history.pushState()` and `window.addEventListener('popstate', ...)`.
* **Material 3 Pill Buttons:** All interactive buttons use `.pill-btn` (`border-radius: 9999px`) with minimum `44px` touch targets for gloved/outdoor mobile use.

---

### 3. GALAXY A03S PERFORMANCE CONSTRAINTS

* **Zero Blur Filters:** `backdrop-filter` is strictly banned; modal overlays use solid semi-transparent `rgba(15, 23, 42, 0.62)`.
* **GPU-Only Progress Bars:** Hold-to-capture bars animate `transform: scaleX(0..1)` with `transform-origin: left center` and `will-change: transform`.
* **Surgical DOM Updates:** Timer ticks update only specific `[data-bind="timer"]` text nodes via `textContent` rather than rebuilding `innerHTML`.
* **Inline SVGs Only:** Zero external icon fonts or image sprites.
