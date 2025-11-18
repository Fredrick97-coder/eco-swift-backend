import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { execute, subscribe } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServerPluginDrainHttpServer, ApolloServerPluginLandingPageLocalDefault, ApolloServerPluginLandingPageProductionDefault } from 'apollo-server-core';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { connectDatabase } from './database';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import logger from './utils/logger';

dotenv.config({});

const isVercel = Boolean(process.env.VERCEL);
export const app = express();
app.set('trust proxy', true);
let serverInitialized = false;
type ServerCleanup = {
  dispose: () => void | Promise<void>;
};

let serverCleanup: ServerCleanup | null = null;

// CORS configuration
const NODE_ENV = process.env.NODE_ENV || 'development';
const corsOptions: cors.CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl requests, or same-origin requests)
    if (!origin) {
      return callback(null, true);
    }

    // Always allow Apollo Studio origins
    const apolloStudioOrigins = [
      'https://studio.apollographql.com',
      'https://explorer.apollographql.com',
    ];

    if (apolloStudioOrigins.some(allowed => origin.startsWith(allowed))) {
      logger.debug('CORS: Allowing Apollo Studio origin', { origin });
      return callback(null, true);
    }

    // Always allow localhost origins (for local development)
    const localhostOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173', // Vite default
      'http://127.0.0.1:5173',
    ];

    if (localhostOrigins.includes(origin)) {
      logger.debug('CORS: Allowing localhost origin', { origin });
      return callback(null, true);
    }

    // In development, allow all origins (localhost, 127.0.0.1, etc.)
    if (NODE_ENV === 'development') {
      logger.debug('CORS: Allowing origin in development', { origin });
      return callback(null, true);
    }

    // In production, check against allowed origins
    const allowedOrigins: string[] = [];
    
    // Add FRONTEND_URL if set
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    // On Vercel, allow all vercel.app subdomains (deployment URLs, production URLs, etc.)
    if (process.env.VERCEL) {
      // Allow any *.vercel.app origin (covers all deployment and production URLs)
      if (origin.endsWith('.vercel.app')) {
        logger.debug('CORS: Allowing Vercel origin', { origin });
        return callback(null, true);
      }
      
      // Also add specific VERCEL_URL if available
      if (process.env.VERCEL_URL) {
        allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
      }
    }

    // If no FRONTEND_URL is set in production and not on Vercel, log a warning but allow the request
    // (This is less secure but prevents blocking when env vars aren't configured)
    if (allowedOrigins.length === 0 && !process.env.VERCEL) {
      logger.warn('CORS: FRONTEND_URL not set, allowing all origins (not recommended for production)', { origin });
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origin not allowed', { origin, allowedOrigins, isVercel: !!process.env.VERCEL });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'apollographql-client-name',
    'apollographql-client-version',
  ],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Health check endpoint (before CORS to allow easy debugging)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    vercel: isVercel,
  });
});

// Middleware
app.use(cors(corsOptions));
// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'eco-swift-secret-key-2024';

// Log JWT_SECRET status (without exposing the full secret)
logger.info('JWT_SECRET configuration', {
  hasEnvVar: !!process.env.JWT_SECRET,
  secretLength: JWT_SECRET.length,
  secretPrefix: JWT_SECRET.substring(0, 10) + '...',
});

// Helper function to get user from token
function getUserFromToken(token: string | undefined) {
  if (!token) {
    logger.debug('getUserFromToken: No token provided');
    return null;
  }

  try {
    // Remove 'Bearer ' prefix if present
    const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    logger.debug('getUserFromToken: Attempting to verify token', {
      hasToken: !!actualToken,
      tokenLength: actualToken.length,
      tokenPrefix: actualToken.substring(0, 20),
      jwtSecretLength: JWT_SECRET.length,
      jwtSecretPrefix: JWT_SECRET.substring(0, 10) + '...',
    });
    
    const decoded = jwt.verify(actualToken, JWT_SECRET) as { userId: string };
    logger.info('getUserFromToken: Token verified successfully', {
      userId: decoded.userId,
    });
    return { userId: decoded.userId };
  } catch (error: any) {
    logger.warn('getUserFromToken: Token verification failed', {
      error: error.message,
      errorName: error.name,
    });
    return null;
  }
}

export const startServer = async () => {
  if (serverInitialized) {
    return;
  }

  try {
    serverInitialized = true;
    // Connect to MongoDB
    await connectDatabase();

    // Build GraphQL schema explicitly for WebSocket server
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    // Create HTTP server (only needed for WebSocket subscriptions, not for Vercel)
    const httpServer: ReturnType<typeof createServer> | null = isVercel ? null : createServer(app);

    // Create Apollo Server with subscription support
    const server = new ApolloServer({
      schema,
      introspection: true, // Enable GraphQL introspection (required for Apollo Studio)
      plugins: [
        // Only use drain plugin when not on Vercel (Vercel doesn't use httpServer.listen)
        ...(isVercel || !httpServer ? [] : [ApolloServerPluginDrainHttpServer({ httpServer })]),
        // Enable Apollo Studio landing page
        // On Vercel, use local default but subscriptions won't work (WebSockets not supported in serverless)
        // The landing page will show but subscription attempts will fail gracefully
        ApolloServerPluginLandingPageLocalDefault({ 
          embed: true,
          // Don't include subscription endpoint on Vercel
          ...(isVercel ? { 
            // Note: Subscriptions are disabled on Vercel due to serverless limitations
            // Users can still use queries and mutations
          } : {})
        }),
        {
          async serverWillStart() {
            return {
              async drainServer() {
                if (serverCleanup) {
                  await serverCleanup.dispose();
                }
              },
            };
          },
        },
      ],
      context: ({ req }: any) => {
        // For HTTP requests
        if (req) {
          // Express lowercases headers, so use lowercase
          const token = req.headers.authorization;
          
          // Log request details for debugging
          logger.info('GraphQL request received', {
            path: req.path || '/graphql',
            method: req.method,
            hasAuthHeader: !!token,
            authHeaderValue: token || 'empty',
            authHeaderPrefix: token ? token.substring(0, 30) : 'none',
            authHeaderLength: token?.length || 0,
            allHeaders: Object.keys(req.headers),
          });
          
          if (!token || token.trim() === '') {
            logger.warn('No authorization token in request headers', {
              path: req.path || '/graphql',
              method: req.method,
              tokenValue: token || 'undefined',
              tokenLength: token?.length || 0,
              headers: Object.keys(req.headers),
            });
          }
          
          const user = getUserFromToken(token);
          
          if (!user && token) {
            logger.warn('Token provided but user extraction failed', {
              hasToken: !!token,
              tokenPrefix: token?.substring(0, 30),
            });
          }
          
          logger.info('Context user status', {
            hasUser: !!user,
            userId: user?.userId || 'none',
          });
          
          return {
            req,
            user,
          };
        }
        return {};
      },
      formatError: (err) => {
        // Log the error
        logger.error('GraphQL Error', {
          message: err.message,
          path: err.path,
          extensions: err.extensions,
        });
        // Return a formatted error
        return {
          message: err.message,
          extensions: {
            code: err.extensions?.code || 'INTERNAL_SERVER_ERROR',
          },
        };
      },
    });

    await server.start();

    if (!isVercel && httpServer) {
      // WebSocket server cleanup
      const wsServer = new WebSocketServer({
        server: httpServer,
        path: '/graphql',
      });

      serverCleanup = useServer(
        {
          schema,
          execute,
          subscribe,
          onConnect: async (ctx) => {
            const token = ctx.connectionParams?.authorization as string | undefined;
            const user = getUserFromToken(token);
            return { user };
          },
          context: async (ctx) => {
            const token = ctx.connectionParams?.authorization as string | undefined;
            const user = getUserFromToken(token);
            return { user };
          },
        },
        wsServer
      );
    }
    server.applyMiddleware({ app, path: '/graphql' });

    const PORT = process.env.PORT || 4000;
    if (!isVercel && httpServer) {
      httpServer.listen(PORT, () => {
        logger.info(`Server ready at http://localhost:${PORT}${server.graphqlPath}`);
        logger.info(`Subscriptions ready at ws://localhost:${PORT}${server.graphqlPath}`);
      });
    } else {
      logger.info('Server initialized for Vercel runtime');
    }
  } catch (error) {
    serverInitialized = false;
    logger.error('Failed to start server', { error });
    if (!isVercel) {
      process.exit(1);
    } else {
      throw error;
    }
  }
};

if (!isVercel) {
  startServer();
}

