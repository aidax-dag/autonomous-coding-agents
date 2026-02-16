export {
  TicketFeatureService,
  createTicketFeatureService,
  type TicketStatus,
  type TicketCreateInput,
  type TicketArtifact,
  type TicketIssue,
  type TicketReview,
  type FeatureCreateInput,
  type FeatureReview,
  type TicketRecord,
  type FeatureRecord,
  type FeatureVersionRecord,
  type TicketFeatureServiceOptions,
  type TicketListFilter,
  type FeatureListFilter,
  type CompleteTicketOptions,
  type FeatureUpdateMeta,
  type FeatureUsageInput,
  type FeatureManagementSummary,
} from './ticket-feature-service';

export type {
  ITicketFeatureRepository,
  TicketFeatureStore,
} from './interfaces/ticket-feature-repository.interface';

export {
  JsonTicketFeatureRepository,
  createJsonTicketFeatureRepository,
  type JsonTicketFeatureRepositoryOptions,
} from './repositories/json-repository';

export {
  SqliteTicketFeatureRepository,
  createSqliteTicketFeatureRepository,
  type SqliteTicketFeatureRepositoryOptions,
} from './repositories/sqlite-repository';

// External sync
export {
  ExternalSyncManager,
  GitHubSyncAdapter,
  createDefaultSyncConfig,
  type IExternalSyncAdapter,
  type ExternalSyncResult,
  type ExternalSyncConfig,
  type GitHubSyncConfig,
  type JiraSyncConfig,
} from './sync';
