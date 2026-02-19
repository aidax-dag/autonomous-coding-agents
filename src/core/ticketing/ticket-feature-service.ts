import { z } from 'zod';
import { ServiceRegistry } from '@/core/services/service-registry';
import { checkMCPReadiness, type MCPGateResult } from './mcp-gate';
import type { ITicketFeatureRepository, TicketFeatureStore } from './interfaces/ticket-feature-repository.interface';
import {
  createDefaultTicketFeatureRepository,
  type TicketFeatureRepositoryFactory,
} from './repositories/repository-factory';
import type { ExternalSyncConfig } from './sync/external-sync.interface';
import { ExternalSyncManager } from './sync/sync-manager';
import {
  TOP_LABELS_LIMIT,
} from './constants';
import { createIdGenerator, type IIdGenerator } from './id-generator';
import { createVersionManager, type IVersionManager } from './version-manager';
import { createTicketLifecycleService, TicketLifecycleService } from './ticket-lifecycle-service';
import { createFeatureLifecycleService, FeatureLifecycleService } from './feature-lifecycle-service';

const ticketStatusSchema = z.enum([
  'created',
  'in_progress',
  'pending',
  'reviewing',
  'completed',
  'cancelled',
]);

const ticketRoleSchema = z.enum(['planner', 'executor', 'reviewer', 'human']);
const assigneeRoleSchema = z.enum(['planner', 'executor', 'reviewer']);

const ticketArtifactSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  kind: z.string().min(1),
});

const ticketIssueSchema = z.object({
  message: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  createdAt: z.string().datetime().optional(),
});

const ticketReviewSchema = z.object({
  reviewerId: z.string().min(1),
  decision: z.enum(['approved', 'changes_requested']),
  comment: z.string().min(1),
  updatedAt: z.string().datetime().optional(),
});

const ticketVerificationSchema = z.object({
  method: z.string().min(1),
  conditions: z.array(z.string().min(1)).min(1),
  checklist: z.array(z.string().min(1)).min(1),
});

const expectedArtifactSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
});

const ticketCreateSchema = z.object({
  managementNumber: z.string().min(1).optional(),
  title: z.string().min(1),
  background: z.string().min(1),
  problem: z.string().min(1),
  workDescription: z.string().min(1),
  expectedArtifacts: z.array(expectedArtifactSchema).min(1),
  verification: ticketVerificationSchema,
  createdBy: z.object({
    agentId: z.string().min(1),
    role: ticketRoleSchema,
  }),
  assignees: z
    .array(
      z.object({
        agentId: z.string().min(1),
        role: assigneeRoleSchema,
      }),
    )
    .optional()
    .default([]),
  externalRefs: z
    .object({
      githubIssue: z.string().optional(),
      githubProjectItem: z.string().optional(),
      jiraIssue: z.string().optional(),
    })
    .optional(),
});

const featureReviewSchema = z.object({
  reviewerType: z.enum(['human', 'agent']),
  reviewerId: z.string().min(1),
  decision: z.enum(['approved', 'changes_requested']),
  comment: z.string().min(1),
  updatedAt: z.string().datetime().optional(),
});

const featureOptionSchema = z.object({
  languages: z.array(z.string().min(1)),
  applicableDomains: z.array(z.string().min(1)),
  constraints: z.array(z.string().min(1)),
});

const usageGuideLinkSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

const featureCreateSchema = z.object({
  title: z.string().min(1),
  background: z.string().min(1),
  problem: z.string().min(1),
  requirements: z.array(z.string().min(1)).min(1),
  verificationChecklist: z.array(z.string().min(1)).min(1),
  artifactLinks: z.array(ticketArtifactSchema).min(1),
  usageGuideLinks: z.array(usageGuideLinkSchema).min(1),
  labels: z.array(z.string().min(1)).default([]),
  options: featureOptionSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('1.0.0'),
  status: z.enum(['draft', 'published', 'deprecated', 'archived']).default('draft'),
  reviews: z.array(featureReviewSchema).optional().default([]),
  sourceTickets: z.array(z.string().min(1)).optional().default([]),
});

const featureStatusSchema = z.enum(['draft', 'published', 'deprecated', 'archived']);

export type TicketStatus = z.infer<typeof ticketStatusSchema>;
export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type TicketArtifact = z.infer<typeof ticketArtifactSchema>;
export type TicketIssue = z.infer<typeof ticketIssueSchema>;
export type TicketReview = z.infer<typeof ticketReviewSchema>;
export type FeatureCreateInput = z.infer<typeof featureCreateSchema>;
export type FeatureReview = z.infer<typeof featureReviewSchema>;

export interface FeatureVersionRecord {
  version: string;
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
  snapshot: FeatureCreateInput;
}

export interface TicketRecord extends Omit<TicketCreateInput, 'managementNumber'> {
  ticketId: string;
  managementNumber: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  artifacts: TicketArtifact[];
  issues: Array<Required<Pick<TicketIssue, 'message' | 'createdAt'>> & Pick<TicketIssue, 'severity'>>;
  reviews: Array<Required<Pick<TicketReview, 'reviewerId' | 'decision' | 'comment' | 'updatedAt'>>>;
}

export interface FeatureRecord extends FeatureCreateInput {
  featureId: string;
  managementNumber: string;
  usageCount: number;
  lastUsedAt?: string;
  versionHistory: FeatureVersionRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketFeatureServiceOptions {
  dataDir?: string;
  requireMCP?: boolean;
  /** Pluggable storage backend. Defaults to JsonTicketFeatureRepository. */
  repository?: ITicketFeatureRepository;
  /**
   * Factory used when repository is not explicitly provided.
   * Allows DI without concrete repository construction in this service.
   */
  repositoryFactory?: TicketFeatureRepositoryFactory;
  /** External sync configuration. Disabled by default. */
  syncConfig?: Partial<ExternalSyncConfig>;
  /** Pre-configured sync manager instance (overrides syncConfig). */
  syncManager?: ExternalSyncManager;
  /** ID generation strategy for ticket/feature identifiers. */
  idGenerator?: IIdGenerator;
  /** Version utility for semantic version bumps and history entries. */
  versionManager?: IVersionManager;
}

export interface TicketListFilter {
  status?: TicketStatus[];
}

export interface FeatureListFilter {
  status?: Array<FeatureRecord['status']>;
  label?: string;
  language?: string;
  domain?: string;
}

export interface CompleteTicketOptions {
  registerFeature?: boolean;
  feature?: Partial<FeatureCreateInput>;
}

export interface FeatureUpdateMeta {
  updatedBy?: string;
  reason?: string;
}

export interface FeatureUsageInput {
  actorId?: string;
  reason?: string;
}

export interface FeatureManagementSummary {
  totalFeatures: number;
  byStatus: Record<FeatureRecord['status'], number>;
  totalUsageCount: number;
  topLabels: Array<{ label: string; count: number }>;
}

const DEFAULT_STORE: TicketFeatureStore = {
  version: 1,
  counters: { ticket: 0, feature: 0, management: 0 },
  tickets: [],
  features: [],
};

export class TicketFeatureService {
  private readonly repository: ITicketFeatureRepository;
  private readonly requireMCP: boolean;
  private readonly syncManager: ExternalSyncManager;
  private readonly idGenerator: IIdGenerator;
  private readonly versionManager: IVersionManager;
  private readonly ticketLifecycle: TicketLifecycleService;
  private readonly featureLifecycle: FeatureLifecycleService;
  private store: TicketFeatureStore = structuredClone(DEFAULT_STORE);
  private loaded = false;

  constructor(options: TicketFeatureServiceOptions = {}) {
    const repositoryFactory = options.repositoryFactory ?? createDefaultTicketFeatureRepository;
    this.repository =
      options.repository ??
      repositoryFactory({
        dataDir: options.dataDir,
      });
    this.requireMCP = options.requireMCP ?? process.env.ACA_REQUIRE_MCP_FOR_TICKET_CYCLE !== 'false';
    this.syncManager = options.syncManager ?? new ExternalSyncManager(options.syncConfig);
    this.idGenerator = options.idGenerator ?? createIdGenerator();
    this.versionManager = options.versionManager ?? createVersionManager();
    this.ticketLifecycle = createTicketLifecycleService(this.idGenerator);
    this.featureLifecycle = createFeatureLifecycleService(this.idGenerator, this.versionManager);
  }

  /**
   * Returns the external sync manager for configuration or testing.
   */
  getSyncManager(): ExternalSyncManager {
    return this.syncManager;
  }

  async createTicket(input: TicketCreateInput): Promise<TicketRecord> {
    return this.withLoaded(async () => {
      const parsed = ticketCreateSchema.parse(input);
      const ticket = this.ticketLifecycle.createTicket(this.store, parsed);
      await this.persist();

      // Fire-and-forget: sync to external system
      this.fireAndForgetSync(() => this.syncManager.onTicketCreated(ticket));

      return structuredClone(ticket);
    });
  }

  async listTickets(filter: TicketListFilter = {}): Promise<TicketRecord[]> {
    return this.withLoaded(async () => {
      const filtered = this.ticketLifecycle.listTickets(this.store, filter);
      return structuredClone(filtered);
    });
  }

  async getTicket(ticketId: string): Promise<TicketRecord> {
    return this.withLoaded(async () => structuredClone(this.ticketLifecycle.getTicket(this.store, ticketId)));
  }

  async startTicket(ticketId: string, agentId: string): Promise<TicketRecord> {
    this.assertNonEmpty(agentId, 'agentId');
    return this.withLoaded(async () => {
      this.assertMCPReady();

      const { ticket, oldStatus } = this.ticketLifecycle.startTicket(this.store, ticketId, agentId);

      await this.persist();

      // Fire-and-forget: sync status change to external system
      this.fireAndForgetSync(() => this.syncManager.onStatusChange(ticketId, oldStatus, 'in_progress'));

      return structuredClone(ticket);
    });
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<TicketRecord> {
    return this.withLoaded(async () => {
      const parsed = ticketStatusSchema.parse(status);
      const { ticket, oldStatus } = this.ticketLifecycle.updateTicketStatus(this.store, ticketId, parsed);

      await this.persist();

      // Fire-and-forget: sync status change to external system
      this.fireAndForgetSync(() => this.syncManager.onStatusChange(ticketId, oldStatus, parsed));

      return structuredClone(ticket);
    });
  }

  async addArtifact(ticketId: string, artifact: TicketArtifact): Promise<TicketRecord> {
    return this.withLoaded(async () => {
      const parsed = ticketArtifactSchema.parse(artifact);
      const ticket = this.ticketLifecycle.addArtifact(this.store, ticketId, parsed);
      await this.persist();
      return structuredClone(ticket);
    });
  }

  async addIssue(ticketId: string, issue: TicketIssue): Promise<TicketRecord> {
    return this.withLoaded(async () => {
      const parsed = ticketIssueSchema.parse(issue);
      const ticket = this.ticketLifecycle.addIssue(this.store, ticketId, parsed);
      await this.persist();
      return structuredClone(ticket);
    });
  }

  async addReview(ticketId: string, review: TicketReview): Promise<TicketRecord> {
    return this.withLoaded(async () => {
      const parsed = ticketReviewSchema.parse(review);
      const ticket = this.ticketLifecycle.addReview(this.store, ticketId, parsed);
      await this.persist();

      // Fire-and-forget: sync review to external system
      this.fireAndForgetSync(() => this.syncManager.onReviewAdded(ticketId, parsed));

      return structuredClone(ticket);
    });
  }

  async completeTicket(
    ticketId: string,
    options: CompleteTicketOptions = {},
  ): Promise<{ ticket: TicketRecord; feature?: FeatureRecord }> {
    return this.withLoaded(async () => {
      this.assertMCPReady();
      const { ticket, oldStatus } = this.ticketLifecycle.completeTicket(this.store, ticketId);

      let feature: FeatureRecord | undefined;
      if (options.registerFeature) {
        feature = await this.registerFeatureFromTicket(ticketId, options.feature);
      } else {
        await this.persist();
      }

      // Fire-and-forget: sync status change to external system
      this.fireAndForgetSync(() => this.syncManager.onStatusChange(ticketId, oldStatus, 'completed'));

      return {
        ticket: structuredClone(ticket),
        ...(feature ? { feature: structuredClone(feature) } : {}),
      };
    });
  }

  async registerFeatureFromTicket(
    ticketId: string,
    input: Partial<FeatureCreateInput> = {},
  ): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const ticket = this.ticketLifecycle.getTicket(this.store, ticketId);
      if (ticket.artifacts.length === 0) {
        throw new Error('Ticket requires artifacts before feature registration');
      }

      const usageGuideLinks = input.usageGuideLinks ?? this.extractUsageGuideLinks(ticket.artifacts);
      if (usageGuideLinks.length === 0) {
        throw new Error('Feature registration requires usageGuideLinks');
      }

      const featureInput: FeatureCreateInput = {
        title: input.title ?? ticket.title,
        background: input.background ?? ticket.background,
        problem: input.problem ?? ticket.problem,
        requirements: input.requirements ?? [ticket.workDescription],
        verificationChecklist: input.verificationChecklist ?? ticket.verification.checklist,
        artifactLinks: input.artifactLinks ?? ticket.artifacts,
        usageGuideLinks,
        labels: input.labels ?? [],
        options:
          input.options ??
          {
            languages: [],
            applicableDomains: [],
            constraints: [],
          },
        version: input.version ?? '1.0.0',
        status: input.status ?? 'draft',
        reviews: input.reviews ?? [],
        sourceTickets: [...new Set([...(input.sourceTickets ?? []), ticket.ticketId])],
      };

      return this.createFeature(featureInput);
    });
  }

  async createFeature(input: FeatureCreateInput): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const parsed = featureCreateSchema.parse(input);
      const feature = this.featureLifecycle.createFeature(this.store, parsed);
      await this.persist();
      return structuredClone(feature);
    });
  }

  async listFeatures(filter: FeatureListFilter = {}): Promise<FeatureRecord[]> {
    return this.withLoaded(async () => {
      const filtered = this.featureLifecycle.listFeatures(this.store, filter);
      return structuredClone(filtered);
    });
  }

  async getFeature(featureId: string): Promise<FeatureRecord> {
    return this.withLoaded(async () => structuredClone(this.featureLifecycle.getFeature(this.store, featureId)));
  }

  async updateFeature(
    featureId: string,
    patch: Partial<FeatureCreateInput>,
    meta: FeatureUpdateMeta = {},
  ): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const feature = this.featureLifecycle.updateFeature(
        this.store,
        featureId,
        patch,
        (nextInput) => featureCreateSchema.parse(nextInput),
        meta,
      );
      await this.persist();
      return structuredClone(feature);
    });
  }

  async setFeatureStatus(
    featureId: string,
    status: FeatureRecord['status'],
  ): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const parsedStatus = featureStatusSchema.parse(status);
      const feature = this.featureLifecycle.setFeatureStatus(this.store, featureId, parsedStatus);
      await this.persist();
      return structuredClone(feature);
    });
  }

  async addFeatureReview(featureId: string, review: FeatureReview): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const parsed = featureReviewSchema.parse(review);
      const feature = this.featureLifecycle.addFeatureReview(this.store, featureId, parsed);
      await this.persist();
      return structuredClone(feature);
    });
  }

  async listFeatureLabels(): Promise<string[]> {
    return this.withLoaded(async () => this.featureLifecycle.listFeatureLabels(this.store));
  }

  async updateFeatureLabels(
    featureId: string,
    options: { add?: string[]; remove?: string[] },
  ): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const feature = this.featureLifecycle.updateFeatureLabels(this.store, featureId, options);
      await this.persist();
      return structuredClone(feature);
    });
  }

  async listFeatureVersions(featureId: string): Promise<FeatureVersionRecord[]> {
    return this.withLoaded(async () => structuredClone(this.featureLifecycle.listFeatureVersions(this.store, featureId)));
  }

  async rollbackFeatureVersion(
    featureId: string,
    options: { toVersion: string; nextVersion?: string; updatedBy?: string; reason?: string },
  ): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      this.assertNonEmpty(options.toVersion, 'toVersion');
      const feature = this.featureLifecycle.rollbackFeatureVersion(
        this.store,
        featureId,
        options,
        (nextInput) => featureCreateSchema.parse(nextInput),
      );
      await this.persist();
      return structuredClone(feature);
    });
  }

  async markFeatureUsed(featureId: string, usage: FeatureUsageInput = {}): Promise<FeatureRecord> {
    return this.withLoaded(async () => {
      const feature = this.featureLifecycle.markFeatureUsed(this.store, featureId, usage);
      await this.persist();
      return structuredClone(feature);
    });
  }

  async getFeatureManagementSummary(): Promise<FeatureManagementSummary> {
    return this.withLoaded(async () => this.featureLifecycle.getFeatureManagementSummary(this.store, TOP_LABELS_LIMIT));
  }

  private async withLoaded<T>(operation: () => Promise<T>): Promise<T> {
    await this.ensureLoaded();
    return operation();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    const loaded = await this.repository.load();
    this.store = {
      version: loaded.version,
      counters: {
        ticket: loaded.counters.ticket,
        feature: loaded.counters.feature,
        management: loaded.counters.management,
      },
      tickets: loaded.tickets,
      features: loaded.features.map((feature, index) => this.normalizeFeatureRecord(feature, index)),
    };
    this.store.counters.feature = Math.max(this.store.counters.feature, this.store.features.length);
    this.store.counters.ticket = Math.max(this.store.counters.ticket, this.store.tickets.length);

    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await this.repository.save(this.store);
  }

  private normalizeFeatureRecord(raw: unknown, index: number): FeatureRecord {
    const asObject = (raw ?? {}) as Partial<FeatureRecord>;
    const now = new Date().toISOString();

    const parsedInput = featureCreateSchema.parse({
      title: asObject.title,
      background: asObject.background,
      problem: asObject.problem,
      requirements: asObject.requirements,
      verificationChecklist: asObject.verificationChecklist,
      artifactLinks: asObject.artifactLinks,
      usageGuideLinks: asObject.usageGuideLinks,
      labels: asObject.labels,
      options: asObject.options,
      version: asObject.version,
      status: asObject.status,
      reviews: asObject.reviews,
      sourceTickets: asObject.sourceTickets,
    });

    const versionHistory = (asObject.versionHistory ?? [])
      .filter((entry): entry is FeatureVersionRecord => {
        return !!entry && typeof entry.version === 'string' && !!entry.snapshot;
      })
      .map((entry) => ({
        version: entry.version,
        updatedAt: entry.updatedAt ?? now,
        ...(entry.updatedBy ? { updatedBy: entry.updatedBy } : {}),
        ...(entry.reason ? { reason: entry.reason } : {}),
        snapshot: featureCreateSchema.parse(entry.snapshot),
      }));

    if (versionHistory.length === 0) {
      versionHistory.push({
        version: parsedInput.version,
        updatedAt: asObject.updatedAt ?? now,
        reason: 'migrated baseline snapshot',
        snapshot: parsedInput,
      });
    }

    const featureId = asObject.featureId ?? this.idGenerator.generateFeatureId(index + 1);
    const managementNumber = asObject.managementNumber ?? this.idGenerator.generateFeatureManagementNumber(index + 1);
    const usageCount = typeof asObject.usageCount === 'number' && asObject.usageCount >= 0
      ? asObject.usageCount
      : 0;

    return {
      ...parsedInput,
      featureId,
      managementNumber,
      usageCount,
      ...(asObject.lastUsedAt ? { lastUsedAt: asObject.lastUsedAt } : {}),
      versionHistory,
      createdAt: asObject.createdAt ?? now,
      updatedAt: asObject.updatedAt ?? now,
    };
  }

  private extractUsageGuideLinks(artifacts: TicketArtifact[]): Array<{ name: string; url: string }> {
    return artifacts
      .filter((artifact) => artifact.kind.toLowerCase().includes('guide') || artifact.kind.toLowerCase().includes('doc'))
      .map((artifact) => ({ name: artifact.name, url: artifact.url }));
  }

  private assertNonEmpty(value: string, field: string): void {
    if (!value || value.trim().length === 0) {
      throw new Error(`${field} is required`);
    }
  }

  /**
   * Execute a sync operation without blocking the caller.
   * Errors are silently swallowed -- sync must never interfere with
   * internal ticket operations.
   */
  private fireAndForgetSync(operation: () => Promise<unknown>): void {
    void operation().catch(() => {
      // Intentionally swallowed. The SyncManager already logs failures.
    });
  }

  private assertMCPReady(): void {
    if (!this.requireMCP) {
      return;
    }

    const registry = ServiceRegistry.getInstance();
    const gateResult: MCPGateResult = checkMCPReadiness(registry);

    if (!gateResult.ready) {
      throw new Error(
        `MCP gate check failed [${gateResult.reasonCode}]: ${gateResult.details}`,
      );
    }
  }
}

export function createTicketFeatureService(
  options?: TicketFeatureServiceOptions,
): TicketFeatureService {
  return new TicketFeatureService(options);
}
