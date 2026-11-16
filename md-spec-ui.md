# MYCELIUM — UI, Navigation & Low-End Performance Spec
### Version: v0.0.1
### Target Files: `index.html`, `styles.css`, `js-app.js`

---

### 1. OVERVIEW & UX ENTRY FLOW

The UI layer provides a fast, minimalist, outdoors-readable shell that routes any device ("node") from entry to an active game role in minimal taps.

#### Step-by-Step UX Flow
1. **Boot & Lockdown Check (`js-app.js`):**
   * Applies saved `localStorage` theme (`light` or `dark`) or falls back to device preference (`light` default for outdoor readability).
   * Checks `LOCKDOWN_ENABLED` from `js-config.js`. If `true` and no cached SHA-256 pass hash exists in `localStorage`, opens the **Global Lockdown Modal** before allowing room access.
2. **Landing View (`#view-landing`):**
   * Displays Mycelium header, connection status pill (`Live` vs `Local Demo`), Light/Dark theme toggle button, and Firebase config gear button.
   * **Primary Action:** `Join Room` (`.btn-primary.pill-btn`) — large, high-contrast button optimized for rapid setup on field devices.
   * **Secondary Action:** `Create Room` (`.btn-secondary.pill-btn`) — opens room creation form for the game host.
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
   * Full-viewport container (`#game-mount`) hosting the active game module's UI for the selected role.
   * Includes a subtle, low-opacity floating corner gear button (`#btn-node-settings`) that opens **Node Settings** (`#modal-node-settings`) to toggle Fullscreen, change Node Role, open Host Controls, or Leave/Host/Join another room.

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
