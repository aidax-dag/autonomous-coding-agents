export interface VersionHistoryEntry<TSnapshot> {
  version: string;
  updatedAt: string;
  updatedBy?: string;
  reason?: string;
  snapshot: TSnapshot;
}

export interface VersionMeta {
  updatedBy?: string;
  reason?: string;
}

export interface IVersionManager {
  bumpPatchVersion(version: string): string;
  createInitialEntry<TSnapshot>(version: string, updatedAt: string, snapshot: TSnapshot): VersionHistoryEntry<TSnapshot>;
  createUpdateEntry<TSnapshot>(
    version: string,
    updatedAt: string,
    snapshot: TSnapshot,
    meta?: VersionMeta,
  ): VersionHistoryEntry<TSnapshot>;
  createRollbackEntry<TSnapshot>(options: {
    version: string;
    updatedAt: string;
    snapshot: TSnapshot;
    fromVersion: string;
    toVersion: string;
    meta?: VersionMeta;
  }): VersionHistoryEntry<TSnapshot>;
}

export class VersionManager implements IVersionManager {
  bumpPatchVersion(version: string): string {
    const [major, minor, patch] = version.split('.').map((value) => Number.parseInt(value, 10));
    if (![major, minor, patch].every((part) => Number.isInteger(part) && part >= 0)) {
      throw new Error(`Invalid version format: ${version}`);
    }
    return `${major}.${minor}.${patch + 1}`;
  }

  createInitialEntry<TSnapshot>(
    version: string,
    updatedAt: string,
    snapshot: TSnapshot,
  ): VersionHistoryEntry<TSnapshot> {
    return {
      version,
      updatedAt,
      reason: 'initial create',
      snapshot,
    };
  }

  createUpdateEntry<TSnapshot>(
    version: string,
    updatedAt: string,
    snapshot: TSnapshot,
    meta: VersionMeta = {},
  ): VersionHistoryEntry<TSnapshot> {
    return {
      version,
      updatedAt,
      ...(meta.updatedBy ? { updatedBy: meta.updatedBy } : {}),
      ...(meta.reason ? { reason: meta.reason } : {}),
      snapshot,
    };
  }

  createRollbackEntry<TSnapshot>(options: {
    version: string;
    updatedAt: string;
    snapshot: TSnapshot;
    fromVersion: string;
    toVersion: string;
    meta?: VersionMeta;
  }): VersionHistoryEntry<TSnapshot> {
    return {
      version: options.version,
      updatedAt: options.updatedAt,
      ...(options.meta?.updatedBy ? { updatedBy: options.meta.updatedBy } : {}),
      reason: options.meta?.reason ?? `rollback from ${options.fromVersion} to ${options.toVersion}`,
      snapshot: options.snapshot,
    };
  }
}

export function createVersionManager(): VersionManager {
  return new VersionManager();
}
