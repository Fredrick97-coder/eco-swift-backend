// Vercel serverless function entry point
import { app, startServer } from '../public/index.js';

let serverReadyPromise: Promise<void> | null = null;

async function ensureServerReady() {
  if (!serverReadyPromise) {
    serverReadyPromise = startServer().catch((error: any) => {
      console.error('Failed to start server:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error details:', {
        message: error?.message,
        name: error?.name,
        code: error?.code,
      });
      serverReadyPromise = null; // Reset on error so we can retry
      throw error;
    });
  }
  await serverReadyPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await ensureServerReady();
    return app(req, res);
  } catch (error: any) {
    console.error('Handler error:', error);
    console.error('Error stack:', error?.stack);
    console.error('Request details:', {
      method: req?.method,
      url: req?.url,
      headers: req?.headers,
    });
    
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: error?.message || 'Server initialization failed',
        ...(process.env.NODE_ENV === 'development' && { stack: error?.stack }),
      });
    }
  }
}

