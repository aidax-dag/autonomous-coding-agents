/**
 * GraphQL Schema Module
 *
 * Feature: F4.3 - GraphQL API
 *
 * Provides schema loading and type definitions for the GraphQL API.
 *
 * @module api/graphql/schema
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLDateTime, GraphQLJSON } from 'graphql-scalars';
import type { GraphQLSchema } from 'graphql';
import type { Resolvers } from '../interfaces/graphql.interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load GraphQL schema from SDL file
 */
export function loadSchemaSDL(): string {
  const schemaPath = join(__dirname, 'schema.graphql');
  return readFileSync(schemaPath, 'utf-8');
}

/**
 * Custom scalar resolvers
 */
export const scalarResolvers = {
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON,
};

/**
 * Create executable GraphQL schema
 */
export function createSchema(resolvers: Resolvers): GraphQLSchema {
  const typeDefs = loadSchemaSDL();

  return makeExecutableSchema({
    typeDefs,
    resolvers: {
      ...scalarResolvers,
      ...resolvers,
    },
  });
}

/**
 * Schema type definitions as string
 */
export const typeDefs = loadSchemaSDL();

export { loadSchemaSDL as loadSchema };
