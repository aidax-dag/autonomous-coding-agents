import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { ServiceRegistry } from '@/core/services/service-registry';

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

interface TicketFeatureStore {
  version: number;
  counters: {
    ticket: number;
    feature: number;
    management: number;
  };
  tickets: TicketRecord[];
  features: FeatureRecord[];
}

export interface TicketFeatureServiceOptions {
  dataDir?: string;
  requireMCP?: boolean;
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

const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  created: ['in_progress', 'pending', 'cancelled'],
  in_progress: ['pending', 'reviewing', 'cancelled'],
  pending: ['in_progress', 'reviewing', 'cancelled'],
  reviewing: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class TicketFeatureService {
  private readonly filePath: string;
  private readonly requireMCP: boolean;
  private store: TicketFeatureStore = structuredClone(DEFAULT_STORE);
  private loaded = false;

  constructor(options: TicketFeatureServiceOptions = {}) {
    const dataDir = options.dataDir ?? path.join(process.cwd(), 'data', 'ticket-cycle');
    this.filePath = path.join(dataDir, 'store.json');
    this.requireMCP = options.requireMCP ?? process.env.ACA_REQUIRE_MCP_FOR_TICKET_CYCLE !== 'false';
  }

  async createTicket(input: TicketCreateInput): Promise<TicketRecord> {
    await this.ensureLoaded();
    const parsed = ticketCreateSchema.parse(input);
    const now = new Date().toISOString();

    this.store.counters.ticket += 1;
    this.store.counters.management += 1;

    const ticket: TicketRecord = {
      ...parsed,
      ticketId: this.generateTicketId(this.store.counters.ticket),
      managementNumber:
        parsed.managementNumber ?? this.generateManagementNumber(this.store.counters.management),
      status: 'created',
      createdAt: now,
      updatedAt: now,
      artifacts: [],
      issues: [],
      reviews: [],
    };

    this.store.tickets.push(ticket);
    await this.persist();
    return structuredClone(ticket);
  }

  async listTickets(filter: TicketListFilter = {}): Promise<TicketRecord[]> {
    await this.ensureLoaded();
    const filtered = this.store.tickets.filter((ticket) => {
      if (filter.status && filter.status.length > 0 && !filter.status.includes(ticket.status)) {
        return false;
      }
      return true;
    });

    return structuredClone(filtered);
  }

  async getTicket(ticketId: string): Promise<TicketRecord> {
    await this.ensureLoaded();
    return structuredClone(this.mustGetTicket(ticketId));
  }

  async startTicket(ticketId: string, agentId: string): Promise<TicketRecord> {
    this.assertNonEmpty(agentId, 'agentId');
    await this.ensureLoaded();
    this.assertMCPReady();

    const ticket = this.mustGetTicket(ticketId);
    this.assertTransition(ticket.status, 'in_progress');

    const now = new Date().toISOString();
    ticket.status = 'in_progress';
    ticket.startedAt = ticket.startedAt ?? now;
    ticket.updatedAt = now;

    const hasExecutor = ticket.assignees.some((a) => a.agentId === agentId && a.role === 'executor');
    if (!hasExecutor) {
      ticket.assignees.push({ agentId, role: 'executor' });
    }

    await this.persist();
    return structuredClone(ticket);
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<TicketRecord> {
    await this.ensureLoaded();
    const parsed = ticketStatusSchema.parse(status);

    const ticket = this.mustGetTicket(ticketId);
    this.assertTransition(ticket.status, parsed);

    ticket.status = parsed;
    ticket.updatedAt = new Date().toISOString();
    if (parsed === 'cancelled') {
      ticket.endedAt = ticket.updatedAt;
    }

    await this.persist();
    return structuredClone(ticket);
  }

  async addArtifact(ticketId: string, artifact: TicketArtifact): Promise<TicketRecord> {
    await this.ensureLoaded();
    const parsed = ticketArtifactSchema.parse(artifact);

    const ticket = this.mustGetTicket(ticketId);
    ticket.artifacts.push(parsed);
    ticket.updatedAt = new Date().toISOString();

    await this.persist();
    return structuredClone(ticket);
  }

  async addIssue(ticketId: string, issue: TicketIssue): Promise<TicketRecord> {
    await this.ensureLoaded();
    const parsed = ticketIssueSchema.parse(issue);

    const ticket = this.mustGetTicket(ticketId);
    ticket.issues.push({
      message: parsed.message,
      severity: parsed.severity,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    });
    ticket.updatedAt = new Date().toISOString();

    await this.persist();
    return structuredClone(ticket);
  }

  async addReview(ticketId: string, review: TicketReview): Promise<TicketRecord> {
    await this.ensureLoaded();
    const parsed = ticketReviewSchema.parse(review);

    const ticket = this.mustGetTicket(ticketId);
    const updatedAt = parsed.updatedAt ?? new Date().toISOString();

    const existingIndex = ticket.reviews.findIndex((r) => r.reviewerId === parsed.reviewerId);
    const normalized = {
      reviewerId: parsed.reviewerId,
      decision: parsed.decision,
      comment: parsed.comment,
      updatedAt,
    };

    if (existingIndex >= 0) {
      ticket.reviews[existingIndex] = normalized;
    } else {
      ticket.reviews.push(normalized);
    }

    ticket.updatedAt = updatedAt;
    await this.persist();
    return structuredClone(ticket);
  }

  async completeTicket(
    ticketId: string,
    options: CompleteTicketOptions = {},
  ): Promise<{ ticket: TicketRecord; feature?: FeatureRecord }> {
    await this.ensureLoaded();
    this.assertMCPReady();

    const ticket = this.mustGetTicket(ticketId);

    if (ticket.status !== 'reviewing') {
      throw new Error('Ticket can only be completed from reviewing status');
    }

    if (ticket.artifacts.length === 0) {
      throw new Error('At least one artifact is required before completion');
    }

    if (ticket.reviews.length === 0) {
      throw new Error('At least one review is required before completion');
    }

    const hasRejectedReview = ticket.reviews.some((review) => review.decision === 'changes_requested');
    if (hasRejectedReview) {
      throw new Error('Cannot complete ticket while reviews request changes');
    }

    const reviewerAssignees = ticket.assignees.filter((assignee) => assignee.role === 'reviewer');
    if (reviewerAssignees.length > 0) {
      const approvedReviewers = new Set(ticket.reviews.map((r) => r.reviewerId));
      for (const reviewer of reviewerAssignees) {
        if (!approvedReviewers.has(reviewer.agentId)) {
          throw new Error(`Reviewer ${reviewer.agentId} approval is required`);
        }
      }
    }

    const now = new Date().toISOString();
    ticket.status = 'completed';
    ticket.endedAt = now;
    ticket.updatedAt = now;

    let feature: FeatureRecord | undefined;
    if (options.registerFeature) {
      feature = await this.registerFeatureFromTicket(ticketId, options.feature);
    } else {
      await this.persist();
    }

    return {
      ticket: structuredClone(ticket),
      ...(feature ? { feature: structuredClone(feature) } : {}),
    };
  }

  async registerFeatureFromTicket(
    ticketId: string,
    input: Partial<FeatureCreateInput> = {},
  ): Promise<FeatureRecord> {
    await this.ensureLoaded();

    const ticket = this.mustGetTicket(ticketId);
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
  }

  async createFeature(input: FeatureCreateInput): Promise<FeatureRecord> {
    await this.ensureLoaded();
    const parsed = featureCreateSchema.parse(input);
    const now = new Date().toISOString();

    this.store.counters.feature += 1;
    const feature: FeatureRecord = {
      ...parsed,
      featureId: this.generateFeatureId(this.store.counters.feature),
      managementNumber: this.generateFeatureManagementNumber(this.store.counters.feature),
      usageCount: 0,
      versionHistory: [
        {
          version: parsed.version,
          updatedAt: now,
          reason: 'initial create',
          snapshot: parsed,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.store.features.push(feature);
    await this.persist();
    return structuredClone(feature);
  }

  async listFeatures(filter: FeatureListFilter = {}): Promise<FeatureRecord[]> {
    await this.ensureLoaded();

    const filtered = this.store.features.filter((feature) => {
      if (filter.status && filter.status.length > 0 && !filter.status.includes(feature.status)) {
        return false;
      }
      if (filter.label && !feature.labels.includes(filter.label)) {
        return false;
      }
      if (filter.language && !feature.options.languages.includes(filter.language)) {
        return false;
      }
      if (filter.domain && !feature.options.applicableDomains.includes(filter.domain)) {
        return false;
      }
      return true;
    });

    return structuredClone(filtered);
  }

  async getFeature(featureId: string): Promise<FeatureRecord> {
    await this.ensureLoaded();
    return structuredClone(this.mustGetFeature(featureId));
  }

  async updateFeature(
    featureId: string,
    patch: Partial<FeatureCreateInput>,
    meta: FeatureUpdateMeta = {},
  ): Promise<FeatureRecord> {
    await this.ensureLoaded();

    const feature = this.mustGetFeature(featureId);
    const nextVersion = patch.version ?? this.bumpPatchVersion(feature.version);
    if (nextVersion === feature.version) {
      throw new Error('version must change when updating feature');
    }

    const next: FeatureCreateInput = {
      title: patch.title ?? feature.title,
      background: patch.background ?? feature.background,
      problem: patch.problem ?? feature.problem,
      requirements: patch.requirements ?? feature.requirements,
      verificationChecklist: patch.verificationChecklist ?? feature.verificationChecklist,
      artifactLinks: patch.artifactLinks ?? feature.artifactLinks,
      usageGuideLinks: patch.usageGuideLinks ?? feature.usageGuideLinks,
      labels: patch.labels ?? feature.labels,
      options: patch.options ?? feature.options,
      version: nextVersion,
      status: patch.status ?? feature.status,
      reviews: patch.reviews ?? feature.reviews,
      sourceTickets: patch.sourceTickets ?? feature.sourceTickets,
    };

    const parsed = featureCreateSchema.parse(next);
    const now = new Date().toISOString();
    Object.assign(feature, parsed, { updatedAt: now });
    feature.versionHistory.push({
      version: parsed.version,
      updatedAt: now,
      ...(meta.updatedBy ? { updatedBy: meta.updatedBy } : {}),
      ...(meta.reason ? { reason: meta.reason } : {}),
      snapshot: parsed,
    });

    await this.persist();
    return structuredClone(feature);
  }

  async setFeatureStatus(
    featureId: string,
    status: FeatureRecord['status'],
  ): Promise<FeatureRecord> {
    await this.ensureLoaded();
    const feature = this.mustGetFeature(featureId);
    feature.status = featureStatusSchema.parse(status);
    feature.updatedAt = new Date().toISOString();
    await this.persist();
    return structuredClone(feature);
  }

  async addFeatureReview(featureId: string, review: FeatureReview): Promise<FeatureRecord> {
    await this.ensureLoaded();
    const parsed = featureReviewSchema.parse(review);
    const feature = this.mustGetFeature(featureId);
    const updatedAt = parsed.updatedAt ?? new Date().toISOString();

    const existingIndex = feature.reviews.findIndex((r) => r.reviewerId === parsed.reviewerId);
    const normalized = {
      reviewerType: parsed.reviewerType,
      reviewerId: parsed.reviewerId,
      decision: parsed.decision,
      comment: parsed.comment,
      updatedAt,
    };

    if (existingIndex >= 0) {
      feature.reviews[existingIndex] = normalized;
    } else {
      feature.reviews.push(normalized);
    }

    feature.updatedAt = updatedAt;
    await this.persist();
    return structuredClone(feature);
  }

  async listFeatureLabels(): Promise<string[]> {
    await this.ensureLoaded();
    const uniqueLabels = new Set<string>();
    for (const feature of this.store.features) {
      for (const label of feature.labels) {
        uniqueLabels.add(label);
      }
    }
    return Array.from(uniqueLabels).sort((a, b) => a.localeCompare(b));
  }

  async updateFeatureLabels(
    featureId: string,
    options: { add?: string[]; remove?: string[] },
  ): Promise<FeatureRecord> {
    await this.ensureLoaded();
    const feature = this.mustGetFeature(featureId);
    const add = (options.add ?? []).map((item) => item.trim()).filter(Boolean);
    const remove = new Set((options.remove ?? []).map((item) => item.trim()).filter(Boolean));

    const labels = new Set(feature.labels);
    for (const label of add) {
      labels.add(label);
    }
    for (const label of remove) {
      labels.delete(label);
    }

    feature.labels = Array.from(labels).sort((a, b) => a.localeCompare(b));
    feature.updatedAt = new Date().toISOString();
    await this.persist();
    return structuredClone(feature);
  }

  async listFeatureVersions(featureId: string): Promise<FeatureVersionRecord[]> {
    await this.ensureLoaded();
    const feature = this.mustGetFeature(featureId);
    return structuredClone(feature.versionHistory);
  }

  async rollbackFeatureVersion(
    featureId: string,
    options: { toVersion: string; nextVersion?: string; updatedBy?: string; reason?: string },
  ): Promise<FeatureRecord> {
    await this.ensureLoaded();
    this.assertNonEmpty(options.toVersion, 'toVersion');

    const feature = this.mustGetFeature(featureId);
    const target = feature.versionHistory.find((entry) => entry.version === options.toVersion);
    if (!target) {
      throw new Error(`Feature version not found: ${options.toVersion}`);
    }

    const nextVersion = options.nextVersion ?? this.bumpPatchVersion(feature.version);
    if (nextVersion === feature.version) {
      throw new Error('nextVersion must differ from current version');
    }

    const currentVersion = feature.version;
    const restored: FeatureCreateInput = featureCreateSchema.parse({
      ...target.snapshot,
      version: nextVersion,
    });

    const now = new Date().toISOString();
    Object.assign(feature, restored, { updatedAt: now });
    feature.versionHistory.push({
      version: restored.version,
      updatedAt: now,
      ...(options.updatedBy ? { updatedBy: options.updatedBy } : {}),
      reason: options.reason ?? `rollback from ${currentVersion} to ${options.toVersion}`,
      snapshot: restored,
    });

    await this.persist();
    return structuredClone(feature);
  }

  async markFeatureUsed(featureId: string, usage: FeatureUsageInput = {}): Promise<FeatureRecord> {
    await this.ensureLoaded();
    const feature = this.mustGetFeature(featureId);
    feature.usageCount += 1;
    feature.lastUsedAt = new Date().toISOString();
    feature.updatedAt = feature.lastUsedAt;
    void usage;

    await this.persist();
    return structuredClone(feature);
  }

  async getFeatureManagementSummary(): Promise<FeatureManagementSummary> {
    await this.ensureLoaded();
    const byStatus: Record<FeatureRecord['status'], number> = {
      draft: 0,
      published: 0,
      deprecated: 0,
      archived: 0,
    };

    const labelCount = new Map<string, number>();
    let totalUsageCount = 0;

    for (const feature of this.store.features) {
      byStatus[feature.status] += 1;
      totalUsageCount += feature.usageCount;
      for (const label of feature.labels) {
        labelCount.set(label, (labelCount.get(label) ?? 0) + 1);
      }
    }

    const topLabels = Array.from(labelCount.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, 20);

    return {
      totalFeatures: this.store.features.length,
      byStatus,
      totalUsageCount,
      topLabels,
    };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<TicketFeatureStore>;
      this.store = {
        version: parsed.version ?? DEFAULT_STORE.version,
        counters: {
          ticket: parsed.counters?.ticket ?? 0,
          feature: parsed.counters?.feature ?? 0,
          management: parsed.counters?.management ?? 0,
        },
        tickets: parsed.tickets ?? [],
        features: (parsed.features ?? []).map((feature, index) => this.normalizeFeatureRecord(feature, index)),
      };
      this.store.counters.feature = Math.max(this.store.counters.feature, this.store.features.length);
      this.store.counters.ticket = Math.max(this.store.counters.ticket, this.store.tickets.length);
    } catch {
      this.store = structuredClone(DEFAULT_STORE);
      await this.persist();
    }

    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  private mustGetTicket(ticketId: string): TicketRecord {
    const ticket = this.store.tickets.find((item) => item.ticketId === ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }
    return ticket;
  }

  private mustGetFeature(featureId: string): FeatureRecord {
    const feature = this.store.features.find((item) => item.featureId === featureId);
    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }
    return feature;
  }

  private generateTicketId(counter: number): string {
    return `ticket-${new Date().getFullYear()}-${String(counter).padStart(6, '0')}`;
  }

  private generateFeatureId(counter: number): string {
    return `feature-${new Date().getFullYear()}-${String(counter).padStart(6, '0')}`;
  }

  private generateFeatureManagementNumber(counter: number): string {
    return `FEAT-${new Date().getFullYear()}-${String(counter).padStart(5, '0')}`;
  }

  private generateManagementNumber(counter: number): string {
    return `ACA-${new Date().getFullYear()}-${String(counter).padStart(5, '0')}`;
  }

  private bumpPatchVersion(version: string): string {
    const [major, minor, patch] = version.split('.').map((value) => Number.parseInt(value, 10));
    if (![major, minor, patch].every((part) => Number.isInteger(part) && part >= 0)) {
      throw new Error(`Invalid version format: ${version}`);
    }
    return `${major}.${minor}.${patch + 1}`;
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

    const featureId = asObject.featureId ?? this.generateFeatureId(index + 1);
    const managementNumber = asObject.managementNumber ?? this.generateFeatureManagementNumber(index + 1);
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

  private assertTransition(from: TicketStatus, to: TicketStatus): void {
    if (!TICKET_TRANSITIONS[from].includes(to)) {
      throw new Error(`Invalid status transition: ${from} -> ${to}`);
    }
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

  private assertMCPReady(): void {
    if (!this.requireMCP) {
      return;
    }

    const registry = ServiceRegistry.getInstance();
    if (!registry.isInitialized()) {
      throw new Error('MCP is required for ticket cycle, but ServiceRegistry is not initialized');
    }

    const manager = registry.getMCPConnectionManager();
    if (manager) {
      const connected = manager.getStatus().some((status) => status.connected);
      if (!connected) {
        throw new Error('MCP is required for ticket cycle, but no MCP server is connected');
      }
      return;
    }

    const client = registry.getMCPClient();
    if (!client || !client.isConnected()) {
      throw new Error('MCP is required for ticket cycle, but MCP client is not connected');
    }
  }
}

export function createTicketFeatureService(
  options?: TicketFeatureServiceOptions,
): TicketFeatureService {
  return new TicketFeatureService(options);
}
