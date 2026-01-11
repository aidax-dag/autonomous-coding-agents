/**
 * GraphQL Resolvers Module
 *
 * Feature: F4.3 - GraphQL API
 *
 * Combines all resolvers into a single export.
 *
 * @module api/graphql/resolvers
 */

import { QueryResolvers } from './query.resolver.js';
import { MutationResolvers } from './mutation.resolver.js';
import { SubscriptionResolvers } from './subscription.resolver.js';
import type { Resolvers } from '../interfaces/graphql.interface.js';

/**
 * Combined resolvers for GraphQL schema
 */
export const resolvers: Resolvers = {
  Query: QueryResolvers,
  Mutation: MutationResolvers,
  // Cast SubscriptionResolvers to match the expected type
  Subscription: SubscriptionResolvers as unknown as Resolvers['Subscription'],
};

// Re-export individual resolvers
export { QueryResolvers } from './query.resolver.js';
export { MutationResolvers, agentStore, workflowStore, taskStore, hookStore } from './mutation.resolver.js';
export {
  SubscriptionResolvers,
  publishers,
  pubsub,
  SUBSCRIPTION_EVENTS,
} from './subscription.resolver.js';

// Re-export subscription payload types
export type {
  AgentStatusChangePayload,
  WorkflowProgressPayload,
  TaskProgressPayload,
  ToolExecutionPayload,
  HookExecutionPayload,
} from './subscription.resolver.js';
