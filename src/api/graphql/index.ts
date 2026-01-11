/**
 * GraphQL API Module
 *
 * Feature: F4.3 - GraphQL API
 *
 * Provides a complete GraphQL API for the autonomous coding agents system
 * with support for queries, mutations, and subscriptions.
 *
 * @module api/graphql
 */

// Interfaces
export * from './interfaces/index.js';

// Schema
export { createSchema, loadSchemaSDL, typeDefs, scalarResolvers } from './schema/index.js';

// Resolvers
export {
  resolvers,
  QueryResolvers,
  MutationResolvers,
  SubscriptionResolvers,
  publishers,
  pubsub,
  SUBSCRIPTION_EVENTS,
} from './resolvers/index.js';

// Plugins
export { fastifyMercurius } from './plugins/index.js';
export type { MercuriusPluginOptions } from './plugins/index.js';
