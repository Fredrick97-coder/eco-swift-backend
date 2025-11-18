import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { execute, subscribe } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { ApolloServerPluginDrainHttpServer } from 'apollo-server-core';
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

// Middleware
app.use(cors());
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

    // Create HTTP server
    const httpServer = createServer(app);

    // Create Apollo Server with subscription support
    const server = new ApolloServer({
      schema,
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
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
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
    });

    await server.start();

    if (!isVercel) {
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
    if (!isVercel) {
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

