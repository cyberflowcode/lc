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
- **Auth**: bcrypt + jsonwebtoken (JWT)
- **File uploads**: multer (audio voice messages)

## Application — LitChat

A full-stack real-time chat app inspired by Litmatch.

### Features
- **Authentication**: Register/Login with bcrypt-hashed passwords, JWT tokens, emoji avatar selection
- **Chat Rooms**: 6 rooms — Global, Room1-5. Real-time messages via Socket.io.
- **Random Match**: "Start Random Match" button finds another online user and opens a private chat
- **Voice Messages**: Record or upload audio, displayed as audio player in chat
- **Discord-like UI**: Left sidebar (rooms), center (messages), right sidebar (online users)
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
- `GET /api/messages/:room` — Fetch room message history
- `POST /api/upload/audio` — Upload audio file
- `PATCH /api/users/:username/avatar` — Update avatar

### Socket.io Events
- `join-room` / `leave-room` / `chat-message` — Room-based chat
- `start-match` / `exit-match` — Random match system
- `match-message` — Private match messaging

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express + Socket.io backend
│   │   ├── src/lib/auth.ts            # JWT helpers
│   │   ├── src/lib/socketHandler.ts   # Socket.io logic
│   │   ├── src/middlewares/authenticate.ts
│   │   └── src/routes/ (auth, messages, users, upload)
│   ├── chat-app/           # React + Vite frontend (LitChat)
│   └── mockup-sandbox/
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           ├── users.ts    # Users table
│           └── messages.ts # Messages table
```

## Running

- API server: `pnpm --filter @workspace/api-server run dev`
- Chat frontend: `pnpm --filter @workspace/chat-app run dev`
- DB push: `pnpm --filter @workspace/db run push`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`
