# MYCELIUM — King of the Hill (KOTH) Engine Spec
### Version: v0.0.1
### Target Files: `js-game-koth.js`

---

### 1. SUBMODULE LIFECYCLE CONTRACT

Every Mycelium game plugin exports a standardized interface consumed by `js-app.js`:
* `GAME_META`: `{ id: 'koth', name: 'King of the Hill', version: '0.0.1' }`
* `mount(containerEl, context)`: Renders initial role-specific DOM once into `containerEl` and binds input listeners (`keydown`, `keyup`, `pointerdown`, `pointerup`).
* `onStateUpdate(roomSnapshot)`: Applies incoming RTDB state diffs surgically without rebuilding the DOM.
* `onTick(nowMs)`: Runs lightweight 100ms/250ms client countdown updates using `textContent` and `transform: scaleX()`.
* `unmount()`: Cleans up event listeners and timers cleanly when switching roles, games, or leaving a room.

---

### 2. ROLE-SPECIFIC VIEWS (`v0.0.1` BAREBONE -> `v0.2.x` FULL)

* **`hill` (Active Control Point):**
  * Displays Hill label, current controlling team badge, time until next hill rotation, and team capture buttons/keybinds (e.g., `R` for Red, `B` for Blue).
  * **2-Second Hold Mechanic:** Holding a team key or pressing/holding its touch button animates `.capture-bar-fill` via `transform: scaleX(0 -> 1)` over `2000ms`. Releasing early cancels capture and snaps `scaleX(0)`. Completing `2000ms` dispatches a capture event to `gameState`.
* **`display-compact` (Scoreboard Node):**
  * High-contrast large team score readouts, remaining round clock, and active hill indicator designed for distance readability outdoors.
* **`display-map` (Big Map Display):**
  * Displays registered nodes and active/next hill highlights (expandable to custom uploaded field maps in Phase 4).
* **`host-admin` (Host Control Console):**
  * Displays room code, connected node roster (with each node's current `role` ready for Phase 4 remote role overrides), and Start / Pause / Reset Round controls.
