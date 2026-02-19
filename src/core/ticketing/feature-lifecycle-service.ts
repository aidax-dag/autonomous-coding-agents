import type { TicketFeatureStore } from './interfaces/ticket-feature-repository.interface';
import type { IIdGenerator } from './id-generator';
import type { IVersionManager } from './version-manager';
import type {
  FeatureCreateInput,
  FeatureListFilter,
  FeatureManagementSummary,
  FeatureRecord,
  FeatureReview,
  FeatureUpdateMeta,
  FeatureUsageInput,
  FeatureVersionRecord,
} from './ticket-feature-service';

export class FeatureLifecycleService {
  constructor(
    private readonly idGenerator: IIdGenerator,
    private readonly versionManager: IVersionManager,
  ) {}

  createFeature(store: TicketFeatureStore, input: FeatureCreateInput): FeatureRecord {
    const now = new Date().toISOString();

    store.counters.feature += 1;
    const feature: FeatureRecord = {
      ...input,
      featureId: this.idGenerator.generateFeatureId(store.counters.feature),
      managementNumber: this.idGenerator.generateFeatureManagementNumber(store.counters.feature),
      usageCount: 0,
      versionHistory: [
        this.versionManager.createInitialEntry(input.version, now, input),
      ],
      createdAt: now,
      updatedAt: now,
    };

    store.features.push(feature);
    return feature;
  }

  listFeatures(store: TicketFeatureStore, filter: FeatureListFilter = {}): FeatureRecord[] {
    return store.features.filter((feature) => {
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
  }

  getFeature(store: TicketFeatureStore, featureId: string): FeatureRecord {
    return this.mustGetFeature(store, featureId);
  }

  updateFeature(
    store: TicketFeatureStore,
    featureId: string,
    patch: Partial<FeatureCreateInput>,
    parseFeatureInput: (input: FeatureCreateInput) => FeatureCreateInput,
    meta: FeatureUpdateMeta = {},
  ): FeatureRecord {
    const feature = this.mustGetFeature(store, featureId);
    const nextVersion = patch.version ?? this.versionManager.bumpPatchVersion(feature.version);
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

    const parsed = parseFeatureInput(next);
    const now = new Date().toISOString();
    Object.assign(feature, parsed, { updatedAt: now });
    feature.versionHistory.push(this.versionManager.createUpdateEntry(parsed.version, now, parsed, meta));
    return feature;
  }

  setFeatureStatus(
    store: TicketFeatureStore,
    featureId: string,
    status: FeatureRecord['status'],
  ): FeatureRecord {
    const feature = this.mustGetFeature(store, featureId);
    feature.status = status;
    feature.updatedAt = new Date().toISOString();
    return feature;
  }

  addFeatureReview(
    store: TicketFeatureStore,
    featureId: string,
    review: FeatureReview,
  ): FeatureRecord {
    const feature = this.mustGetFeature(store, featureId);
    const updatedAt = review.updatedAt ?? new Date().toISOString();

    const existingIndex = feature.reviews.findIndex((record) => record.reviewerId === review.reviewerId);
    const normalized = {
      reviewerType: review.reviewerType,
      reviewerId: review.reviewerId,
      decision: review.decision,
      comment: review.comment,
      updatedAt,
    };

    if (existingIndex >= 0) {
      feature.reviews[existingIndex] = normalized;
    } else {
      feature.reviews.push(normalized);
    }

    feature.updatedAt = updatedAt;
    return feature;
  }

  listFeatureLabels(store: TicketFeatureStore): string[] {
    const uniqueLabels = new Set<string>();
    for (const feature of store.features) {
      for (const label of feature.labels) {
        uniqueLabels.add(label);
      }
    }
    return Array.from(uniqueLabels).sort((first, second) => first.localeCompare(second));
  }

  updateFeatureLabels(
    store: TicketFeatureStore,
    featureId: string,
    options: { add?: string[]; remove?: string[] },
  ): FeatureRecord {
    const feature = this.mustGetFeature(store, featureId);
    const add = (options.add ?? []).map((item) => item.trim()).filter(Boolean);
    const remove = new Set((options.remove ?? []).map((item) => item.trim()).filter(Boolean));

    const labels = new Set(feature.labels);
    for (const label of add) {
      labels.add(label);
    }
    for (const label of remove) {
      labels.delete(label);
    }

    feature.labels = Array.from(labels).sort((first, second) => first.localeCompare(second));
    feature.updatedAt = new Date().toISOString();
    return feature;
  }

  listFeatureVersions(store: TicketFeatureStore, featureId: string): FeatureVersionRecord[] {
    const feature = this.mustGetFeature(store, featureId);
    return feature.versionHistory;
  }

  rollbackFeatureVersion(
    store: TicketFeatureStore,
    featureId: string,
    options: { toVersion: string; nextVersion?: string; updatedBy?: string; reason?: string },
    parseFeatureInput: (input: FeatureCreateInput) => FeatureCreateInput,
  ): FeatureRecord {
    const feature = this.mustGetFeature(store, featureId);
    const target = feature.versionHistory.find((entry) => entry.version === options.toVersion);
    if (!target) {
      throw new Error(`Feature version not found: ${options.toVersion}`);
    }

    const nextVersion = options.nextVersion ?? this.versionManager.bumpPatchVersion(feature.version);
    if (nextVersion === feature.version) {
      throw new Error('nextVersion must differ from current version');
    }

    const currentVersion = feature.version;
    const restored = parseFeatureInput({
      ...target.snapshot,
      version: nextVersion,
    });

    const now = new Date().toISOString();
    Object.assign(feature, restored, { updatedAt: now });
    feature.versionHistory.push(
      this.versionManager.createRollbackEntry({
        version: restored.version,
        updatedAt: now,
        snapshot: restored,
        fromVersion: currentVersion,
        toVersion: options.toVersion,
        meta: {
          ...(options.updatedBy ? { updatedBy: options.updatedBy } : {}),
          ...(options.reason ? { reason: options.reason } : {}),
        },
      }),
    );

    return feature;
  }

  markFeatureUsed(
    store: TicketFeatureStore,
    featureId: string,
    _usage: FeatureUsageInput = {},
  ): FeatureRecord {
    const feature = this.mustGetFeature(store, featureId);
    feature.usageCount += 1;
    feature.lastUsedAt = new Date().toISOString();
    feature.updatedAt = feature.lastUsedAt;
    return feature;
  }

  getFeatureManagementSummary(
    store: TicketFeatureStore,
    topLabelsLimit: number,
  ): FeatureManagementSummary {
    const byStatus: Record<FeatureRecord['status'], number> = {
      draft: 0,
      published: 0,
      deprecated: 0,
      archived: 0,
    };

    const labelCount = new Map<string, number>();
    let totalUsageCount = 0;

    for (const feature of store.features) {
      byStatus[feature.status] += 1;
      totalUsageCount += feature.usageCount;
      for (const label of feature.labels) {
        labelCount.set(label, (labelCount.get(label) ?? 0) + 1);
      }
    }

    const topLabels = Array.from(labelCount.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label))
      .slice(0, topLabelsLimit);

    return {
      totalFeatures: store.features.length,
      byStatus,
      totalUsageCount,
      topLabels,
    };
  }

  private mustGetFeature(store: TicketFeatureStore, featureId: string): FeatureRecord {
    const feature = store.features.find((item) => item.featureId === featureId);
    if (!feature) {
      throw new Error(`Feature not found: ${featureId}`);
    }
    return feature;
  }
}

export function createFeatureLifecycleService(
  idGenerator: IIdGenerator,
  versionManager: IVersionManager,
): FeatureLifecycleService {
  return new FeatureLifecycleService(idGenerator, versionManager);
}
