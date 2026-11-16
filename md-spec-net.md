# MYCELIUM — Realtime Sync, Auth & Security Spec
### Version: v0.0.1
### Target Files: `js-net-sync.js`, `js-config.js`

---

### 1. OVERVIEW & ARCHITECTURE

`js-net-sync.js` isolates all network persistence, authentication, cryptographic hashing, and presence tracking behind a clean ES module API so `js-app.js` and game plugins remain decoupled from Firebase internals.

#### Exported API (`js-net-sync.js`)
* `initSync()` — Initializes Firebase app + Anonymous Auth if valid `FIREBASE_CONFIG` is present; otherwise activates seamless local loopback mode (`isDemoMode() === true`) using `localStorage` + `BroadcastChannel` for multi-tab local testing.
* `sha256Hex(plainText)` — Uses native Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`) to hash optional room passwords and optional global lockdown passphrases client-side.
* `getOrCreateHostUid()` / `getOrCreateNodeId()` — Retrieves or generates persistent device UUIDs in `localStorage`.
* `createRoom(options)` — Creates `rooms/{code}` and optional `publicRooms/{code}` index entry; binds local `hostUid`.
* `joinRoom(code, passwordPlain, nodeLabel)` — Validates room existence and optional `passwordHash`, registers `rooms/{code}/nodes/{nodeId}`, and attaches real-time listeners.
* `listPublicRooms(onUpdate)` — Subscribes to `publicRooms` for the Join Room browser.
* `syncNodeRole(code, nodeId, role)` — Updates the node's active `role` (`hill`, `display-compact`, `display-map`, `host-admin`) in real time.
* `updateGameState(code, patch)` — Host-authorized partial update to `rooms/{code}/gameState`.
* `leaveRoom()` — Detaches listeners and removes node presence cleanly.

---

### 2. FIREBASE REALTIME DATABASE SCHEMA

```json
{
  "publicRooms": {
    "ABCD": {
      "title": "Gable Thanksgiving",
      "gameMode": "koth",
      "hasPassword": false,
      "createdAt": 1700000000000
    }
  },
  "rooms": {
    "ABCD": {
      "meta": {
        "code": "ABCD",
        "title": "Gable Thanksgiving",
        "gameMode": "koth",
        "isPublic": true,
        "passwordHash": "",
        "hostUid": "uuid-host-device",
        "createdAt": 1700000000000
      },
      "nodes": {
        "node-uuid-1": {
          "id": "node-uuid-1",
          "label": "Node 1",
          "role": "hill",
          "online": true,
          "lastSeen": 1700000005000
        }
      },
      "gameState": {
        "mode": "koth",
        "status": "lobby",
        "rotationIntervalSec": 180,
        "roundDurationSec": 900,
        "activeHillNodeId": "",
        "nextHillNodeId": "",
        "scores": { "red": 0, "blue": 0 }
      }
    }
  }
}
```

---

### 3. SECURITY & DEVELOPER LOCKDOWN TOGGLE

* **Developer Toggle (`js-config.js`):**
  * `LOCKDOWN_ENABLED` defaults to `false` so players join with zero global friction.
  * When set to `true` by the developer, `js-app.js` prompts for the global passphrase once, hashes it via `sha256Hex()`, stores it in `localStorage.mycelium_lockdown_hash`, and sends it with room operations.
* **Recommended Firebase RTDB Security Rules (Paste into Firebase Console):**
  * Enforces `auth != null` (Anonymous Auth).
  * Restricts `rooms/$code/meta` and `rooms/$code/gameState` writes to matching `hostUid` (or initial creation).
  * Optionally enforces `data.child('lockdownHash').val() === '<YOUR_SHA256_HASH>'` when global lockdown is active on the backend—keeping the plaintext passphrase 100% out of GitHub.
