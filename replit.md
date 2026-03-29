# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **Real-time**: Socket.io
- **Auth**: bcryptjs + jsonwebtoken (JWT) — uses bcryptjs (pure JS, VM compatible)
- **File uploads**: multer (audio voice messages)

## Application — LitChat

A full-stack real-time chat app inspired by Litmatch.

### Features
- **Authentication**: Register/Login with bcryptjs-hashed passwords, JWT tokens, emoji avatar selection
- **Chat Rooms**: 6 rooms — Global, Room1-5. Real-time messages via Socket.io.
- **Room Persistence**: Active room is saved in localStorage, persists across refreshes
- **Random Match**: "Start Random Match" button finds another online user and opens a private chat
- **Voice Messages**: Record or upload audio, displayed as audio player in chat
- **Discord-like UI**: Left sidebar (rooms + friends tabs), center (messages), right sidebar (online users with DM button)
- **Message Actions** (hover over any message):
  - **React**: Quick emoji reactions (👍❤️😂😮😢🔥👏🎉), toggle per-user
  - **Reply**: Reply to any message with preview indicator
  - **Edit**: Edit your own text messages inline
  - **Delete**: Soft-delete your own messages (shows "Message deleted")
- **Friends System**: Add friends by username, accept/decline requests, see friend list in sidebar
- **Direct Messages (DM)**: Click message icon on any friend/online user to open private DM chat
- **Message Bubbles**: Current user's messages on right, others on left

### Routes
- `GET /` → Login page
- `GET /register` → Register page
- `GET /dashboard` → Main chat dashboard (requires auth)

### API Routes (under `/api`)
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user (Bearer token)
- `GET /api/messages/:room` — Fetch room message history (includes reactions)
- `POST /api/upload/audio` — Upload audio file
- `PATCH /api/users/:username/avatar` — Update avatar
- `GET /api/friends` — List accepted friends (authenticated)
- `GET /api/friends/requests` — List incoming friend requests (authenticated)
- `POST /api/friends/request/:username` — Send friend request (authenticated)
- `POST /api/friends/accept/:requestId` — Accept friend request (authenticated)
- `DELETE /api/friends/:requestId` — Remove friend / decline request (authenticated)

### Socket.io Events
- `join-room` / `leave-room` / `chat-message` (with optional replyToId) — Room-based chat
- `edit-message` / `delete-message` / `react-message` — Message actions
- `message-updated` — Emitted when a message is edited, deleted, or reacted to
- `start-match` / `exit-match` — Random match system
- `match-message` — Private match messaging

## Database Schema (lib/db/src/schema/)
- **users** — id, username, passwordHash, avatar, status, createdAt
- **messages** — id, room, username, avatar, content, audioUrl, messageType, replyToId, editedAt, isDeleted, createdAt
- **match_sessions** — id, matchId, user1, user2, startedAt, endedAt
- **friendships** — id, requester, recipient, status (pending/accepted), createdAt
- **message_reactions** — id, messageId, username, emoji, createdAt

## DM System
- DM rooms use a special room name: `dm:${sortedUsername1}:${sortedUsername2}`
- Messages are stored in the regular messages table with this room key
- Initiated by clicking message icon on any online user or friend

## Workflows
- `Start Backend`: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- `Start application`: `PORT=18228 BASE_PATH=/ pnpm --filter @workspace/chat-app run dev`

## Running
- API server: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- Chat frontend: `PORT=18228 BASE_PATH=/ pnpm --filter @workspace/chat-app run dev`
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
