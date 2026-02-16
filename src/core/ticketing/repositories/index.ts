/**
 * Ticket/Feature Repositories
 *
 * Pluggable storage backends for the ticket/feature lifecycle.
 *
 * @module core/ticketing/repositories
 */

export type { JsonTicketFeatureRepositoryOptions } from './json-repository';
export { JsonTicketFeatureRepository, createJsonTicketFeatureRepository } from './json-repository';

export type { SqliteTicketFeatureRepositoryOptions } from './sqlite-repository';
export { SqliteTicketFeatureRepository, createSqliteTicketFeatureRepository } from './sqlite-repository';
