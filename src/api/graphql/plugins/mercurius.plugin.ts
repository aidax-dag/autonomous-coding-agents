/**
 * Mercurius GraphQL Plugin for Fastify
 *
 * Feature: F4.3 - GraphQL API
 *
 * Provides a Fastify plugin that integrates Mercurius GraphQL server
 * with schema, resolvers, and subscriptions support.
 *
 * @module api/graphql/plugins/mercurius
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import mercurius, { MercuriusOptions } from 'mercurius';
import { GraphQLError } from 'graphql';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../../core/services/logger.js';
import { loadSchemaSDL, scalarResolvers } from '../schema/index.js';
import { resolvers } from '../resolvers/index.js';
import type {
  GraphQLConfig,
  GraphQLContext,
} from '../interfaces/graphql.interface.js';
import {
  DEFAULT_GRAPHQL_CONFIG,
  GRAPHQL_ERROR_CODES,
} from '../interfaces/graphql.interface.js';
import type { AuthContext } from '../../interfaces/api.interface.js';

const logger = createLogger('GraphQL:MercuriusPlugin');

/**
 * Mercurius plugin options
 */
export interface MercuriusPluginOptions {
  /** GraphQL configuration */
  config?: Partial<GraphQLConfig>;
  /** Custom context builder */
  context?: (request: FastifyRequest, reply: FastifyReply) => Promise<Partial<GraphQLContext>>;
  /** Custom error formatter */
  errorFormatter?: (
    error: GraphQLError,
    context: GraphQLContext
  ) => { statusCode: number; response: unknown };
}

/**
 * Default context builder
 */
async function defaultContextBuilder(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<Partial<GraphQLContext>> {
  // Extract auth context from request (set by auth middleware)
  const auth = (request as unknown as { auth?: AuthContext }).auth;

  return {
    auth,
    requestId: (request.headers['x-request-id'] as string) || uuidv4(),
    timestamp: new Date(),
  };
}

/**
 * Default error formatter for custom error handling
 * Can be passed to MercuriusPluginOptions.errorFormatter
 */
export function formatGraphQLError(
  error: GraphQLError,
  context: GraphQLContext
): { statusCode: number; response: unknown } {
  const extensions = error.extensions as Record<string, unknown> | undefined;
  const code = (extensions?.code as string) || GRAPHQL_ERROR_CODES.INTERNAL_ERROR;

  // Map error codes to HTTP status codes
  let statusCode = 500;
  switch (code) {
    case GRAPHQL_ERROR_CODES.UNAUTHENTICATED:
      statusCode = 401;
      break;
    case GRAPHQL_ERROR_CODES.UNAUTHORIZED:
      statusCode = 403;
      break;
    case GRAPHQL_ERROR_CODES.NOT_FOUND:
      statusCode = 404;
      break;
    case GRAPHQL_ERROR_CODES.BAD_USER_INPUT:
    case GRAPHQL_ERROR_CODES.VALIDATION_FAILED:
      statusCode = 400;
      break;
    case GRAPHQL_ERROR_CODES.CONFLICT:
    case GRAPHQL_ERROR_CODES.ALREADY_EXISTS:
      statusCode = 409;
      break;
    case GRAPHQL_ERROR_CODES.RATE_LIMITED:
      statusCode = 429;
      break;
    case GRAPHQL_ERROR_CODES.SERVICE_UNAVAILABLE:
      statusCode = 503;
      break;
  }

  logger.error('GraphQL error', {
    code,
    message: error.message,
    path: error.path,
    requestId: context.requestId,
  });

  return {
    statusCode,
    response: {
      errors: [
        {
          message: error.message,
          locations: error.locations,
          path: error.path,
          extensions: {
            code,
            timestamp: new Date().toISOString(),
            requestId: context.requestId,
          },
        },
      ],
    },
  };
}

/**
 * Mercurius GraphQL plugin
 */
async function mercuriusPlugin(
  fastify: FastifyInstance,
  options: MercuriusPluginOptions
): Promise<void> {
  const config: GraphQLConfig = {
    ...DEFAULT_GRAPHQL_CONFIG,
    ...options.config,
  };

  if (!config.enabled) {
    logger.info('GraphQL is disabled');
    return;
  }

  logger.info('Registering Mercurius GraphQL plugin', {
    path: config.path,
    subscriptions: config.subscriptions,
    introspection: config.introspection,
  });

  // Load schema
  const schema = loadSchemaSDL();

  // Combine scalar resolvers with application resolvers
  const combinedResolvers = {
    ...scalarResolvers,
    ...resolvers,
  };

  // Build mercurius options
  const mercuriusOptions: MercuriusOptions = {
    schema,
    resolvers: combinedResolvers as MercuriusOptions['resolvers'],
    path: config.path,
    graphiql: config.ideEnabled,
    ide: config.ideEnabled,
    jit: 1, // Enable JIT compilation after 1 execution

    // Subscriptions configuration
    subscription: config.subscriptions
      ? {
          emitter: fastify,
          verifyClient: (_info: unknown, next: (result: boolean) => void) => {
            // Allow all connections for now
            // In production, verify authentication here
            next(true);
          },
        }
      : false,

    // Context builder
    context: async (request: FastifyRequest, reply: FastifyReply) => {
      const customContext = options.context
        ? await options.context(request, reply)
        : await defaultContextBuilder(request, reply);

      return {
        request,
        reply,
        ...customContext,
      };
    },

    // Query depth limiting
    queryDepth: config.queryDepthLimit,

    // Allow batched queries
    allowBatchedQueries: config.batching,
  };

  // Register Mercurius
  await fastify.register(mercurius, mercuriusOptions);

  // Health check endpoint for GraphQL
  fastify.get(`${config.path}/health`, async (_request, reply) => {
    return reply.send({
      status: 'healthy',
      service: 'graphql',
      timestamp: new Date().toISOString(),
    });
  });

  // Decorate fastify with GraphQL config
  fastify.decorate('graphqlConfig', config);

  logger.info('Mercurius GraphQL plugin registered successfully', {
    path: config.path,
    graphiql: config.ideEnabled ? config.idePath : false,
    subscriptions: config.subscriptions ? config.subscriptionPath : false,
  });
}

/**
 * Create Fastify Mercurius plugin
 */
export const fastifyMercurius = fp(mercuriusPlugin, {
  name: 'graphql-mercurius',
  fastify: '4.x',
  dependencies: [],
});

/**
 * Fastify type augmentation
 */
declare module 'fastify' {
  interface FastifyInstance {
    graphqlConfig: GraphQLConfig;
  }
}
