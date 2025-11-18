import { app, startServer } from '../dist/index.js';

let serverReadyPromise: Promise<void> | null = null;

async function ensureServerReady() {
  if (!serverReadyPromise) {
    serverReadyPromise = startServer();
  }
  await serverReadyPromise;
}

export default async function handler(req: any, res: any) {
  await ensureServerReady();
  return app(req, res);
}

