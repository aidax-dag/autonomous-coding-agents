/**
 * API Module
 *
 * Feature: F4.1 - REST API Interface
 * Feature: F4.2 - WebSocket API
 * Feature: F4.3 - GraphQL API
 * Feature: F4.4 - API Authentication
 * Feature: F4.5 - Rate Limiting
 *
 * Provides Fastify-based REST, GraphQL, and WebSocket APIs
 * for the autonomous coding agents system.
 *
 * @module api
 */

// Server
export { ApiServer, createApiServer, WsServer, createWsServer } from './server/index.js';

// Interfaces
export * from './interfaces/index.js';

// Middleware
export * from './middleware/index.js';

// Routes
export * from './routes/index.js';

// Auth
export * from './auth/index.js';

// Rate Limiting (exported under namespace to avoid conflicts)
export * as ratelimit from './ratelimit/index.js';

// GraphQL
export * as graphql from './graphql/index.js';
