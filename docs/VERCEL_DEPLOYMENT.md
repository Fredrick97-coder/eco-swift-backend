# Eco Swift Backend – Vercel Deployment Guide

This guide mirrors the deployment workflow used in the `sanctum/backend` project and explains how to run the Eco Swift GraphQL API on Vercel.

## 1. Files Added for Vercel

| File | Purpose |
|------|---------|
| `vercel.json` | Configures the build command and routes every request to the serverless function. |
| `api/index.ts` | Vercel serverless entry point – lazy‑initialises the Express/Apollo app and forwards requests. |
| `docs/VERCEL_DEPLOYMENT.md` | This guide. |

## 2. Build Configuration (`vercel.json`)

- **Build Command**: `npm install && npm run build`
- **Functions**: bundles everything in `public/**` with the serverless function
- **Rewrites**: `/(.*)` → `/api` so GraphQL & REST endpoints share the same base URL

## 3. Server Initialisation Changes

- `src/index.ts` now:
  - Exports the Express `app` and `startServer()` so Vercel can bootstrap on demand
  - Detects `process.env.VERCEL` to skip calling `httpServer.listen`
  - Skips WebSocket setup on Vercel (subscriptions are only available when running the traditional server)
  - Reuses a single initialisation promise to avoid duplicate connections

## 4. Environment Variables

Set these in **Vercel → Project → Settings → Environment Variables** (preview & production):

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `FRONTEND_URL` | Allowed origin for CORS (https://eco-swift.example.com) |
| `NODE_ENV` | `production` |
| `PORT` | Optional (Vercel ignores, but keeps code paths consistent) |

> Add any other variables you use locally (e.g. notification keys, email providers).

## 5. Deploy Steps

1. Commit changes and push to GitHub.
2. In Vercel: **New Project → Import repo**.
3. Root Directory: `backend`.
4. Build Command: `npm install && npm run build`.
5. Output directory: leave empty.
6. Add env vars (see above).
7. Deploy.

Vercel exposes the API at `https://<project>.vercel.app`. The SPA should point `VITE_GRAPHQL_URI` (see `client/src/apollo/index.ts`) to this URL.

## 6. Local Testing with Vercel CLI (optional)

```bash
npm i -g vercel
vercel login
vercel link
vercel dev   # runs the api/index.ts lambda locally
```

## 7. Notes

- WebSocket subscriptions are disabled on Vercel because Serverless functions do not support long‑lived connections. Local/VM deployments continue to support them.
- Database migrations should still be run manually (Atlas/Scripts) before deploying new schemas.
- Monitor cold starts: first request after idle may take a second while the server initialises.

