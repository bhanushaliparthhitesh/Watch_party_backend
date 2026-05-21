# Watch Party Backend

This is the real-time synchronization server for the Watch Party application. It manages room states, synchronizes video playback across multiple clients, and handles chat and emoji reactions in real-time.

## Tech Stack
- **Runtime:** Node.js (ES6 Modules)
- **Web Framework:** Fastify
- **WebSockets:** Socket.io
- **CORS:** `@fastify/cors` (Configured to accept cross-origin requests from frontends like Vercel)

---

## Features

### 1. In-Memory Room Management
Rooms are created dynamically and managed in server memory using a JavaScript `Map`. Each room tracks:
- **Connected Users:** Array of users (id, username).
- **Video State:** Current video URL (`url`), playing status (`playing`), and current playback time (`time`).
- **Timestamp:** `updatedAt` to track exactly when the state was last modified, allowing for precise drift calculations.
- **Auto-Cleanup:** Rooms are automatically deleted when the last user disconnects to prevent memory leaks.

### 2. Video Playback Synchronization
- **Play/Pause/Seek:** Instantly syncs playback controls across all users in the room.
- **Video Source Change:** When the video URL is changed, the server resets the time to `0`, pauses playback, and commands all clients to load the new video.
- **Drift Correction (`sync-check`):** Clients periodically send their current playback time to the server. The server calculates where the video *should* be based on the last `updatedAt` timestamp. If a client drifts by more than `0.5 seconds`, the server exclusively sends a `sync-correction` back to that client to snap them back into sync.

### 3. Social Features
- **Contextual Chat:** Chat messages are relayed with the room's current `videoTime` attached, enabling messages like *"Look at this! (at 2:45 of video)"*.
- **Live Reactions:** Ephemeral emoji reactions (e.g., floating hearts, laugh faces) are relayed as a fast pass-through to all clients in the room without being permanently stored.

---

## API Reference

### HTTP Endpoints
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check endpoint returning `{ status: 'ok', timestamp: ... }`. Ideal for Railway/Vercel platform health checks. |
| `GET` | `/rooms/:code` | Debugging endpoint that returns the current raw state object of the requested room. Returns `404` if the room does not exist. |

### Socket.io Events (Client to Server)
| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomCode, username }` | Joins the specified room, creates it if necessary, adds the user to the state, and alerts others. |
| `play` | `{ roomCode, time }` | Updates server state to `playing: true` and broadcasts to others. |
| `pause` | `{ roomCode, time }` | Updates server state to `playing: false` and broadcasts to others. |
| `seek` | `{ roomCode, time }` | Updates server's video time and broadcasts to others. |
| `sync-check` | `{ roomCode, time }` | Periodic health check from clients to detect and correct playback drift. |
| `video-source` | `{ roomCode, url }` | Updates the room's video URL, resets time, pauses, and broadcasts to everyone (including sender). |
| `chat-message` | `{ roomCode, username, text, timestamp }` | Broadcasts a chat message with the appended `videoTime` context. |
| `reaction` | `{ roomCode, emoji }` | Relays an ephemeral emoji reaction to the room. |

### Socket.io Events (Server to Client)
| Event | Payload | Description |
|---|---|---|
| `room-state` | `Room Object` | Sent exclusively to a user immediately after they join a room to provide the initial state. |
| `user-joined` | `{ username, users }` | Broadcasted to the room when a new user joins. Includes the updated user list. |
| `user-left` | `{ username, users }` | Broadcasted to the room when a user disconnects or leaves. Includes the updated user list. |
| `sync-correction`| `{ time }` | Sent exclusively to a client if their playback time has drifted out of sync. |
| `play` / `pause` / `seek` | `{ time }` | Instructs clients to mirror the playback action. |
| `video-source` | `{ url }` | Instructs all clients to load the new video URL. |
| `chat-message` | `{ username, text, timestamp, videoTime }` | Receives a chat message sent by a participant. |
| `reaction` | `{ emoji }` | Receives an ephemeral emoji reaction to display. |

---

## Setup & Running Locally

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Development Server (Auto-Reloading)**
   ```bash
   npm run dev
   ```
   The server will start on port `3001` (or your `$PORT` env variable) and watch for file changes.

3. **Production Run**
   ```bash
   npm start
   ```

## Deployment
This backend is fully prepared to be deployed on platforms like Railway. It dynamically binds to `0.0.0.0` to handle external traffic properly and exposes the `/health` endpoint for uptime monitoring. Platforms like Railway will automatically execute `npm install && npm start`.
