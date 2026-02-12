/**
 * Session Compactor
 *
 * Compresses old session entries into summary records to reclaim space.
 * Retains recent entries and replaces older ones with a `compaction_summary`.
 *
 * @module core/session/session-compactor
 */

import type {
  ISessionCompactor,
  IJSONLPersistence,
  SessionEntry,
  CompactionResult,
  CompactionPolicy,
} from './interfaces/session.interface';
import type { JSONLPersistence } from './jsonl-persistence';

export const DEFAULT_COMPACTION_POLICY: CompactionPolicy = {
  maxEntries: 10_000,
  maxSizeBytes: 50 * 1024 * 1024,
  maxAgeMs: 7 * 24 * 60 * 60 * 1000,
  keepRecentCount: 500,
};

function defaultSummarizer(entries: SessionEntry[]): SessionEntry {
  const typeCounts: Record<string, number> = {};
  for (const entry of entries) {
    typeCounts[entry.type] = (typeCounts[entry.type] ?? 0) + 1;
  }

  const first = entries[0];
  const last = entries[entries.length - 1];

  return {
    timestamp: new Date().toISOString(),
    type: 'compaction_summary',
    data: {
      compactedCount: entries.length,
      timeRange: {
        from: first?.timestamp,
        to: last?.timestamp,
      },
      typeCounts,
    },
  };
}

export class SessionCompactor implements ISessionCompactor {
  private readonly persistence: IJSONLPersistence & { listSessionIds(): Promise<string[]> };
  private readonly policy: CompactionPolicy;

  constructor(
    persistence: IJSONLPersistence & { listSessionIds(): Promise<string[]> },
    policy: CompactionPolicy,
  ) {
    this.persistence = persistence;
    this.policy = policy;
  }

  async shouldCompact(sessionId: string): Promise<boolean> {
    const info = await this.persistence.getInfo(sessionId);
    if (!info) return false;

    if (info.entryCount > this.policy.maxEntries) return true;
    if (info.sizeBytes > this.policy.maxSizeBytes) return true;

    const age = Date.now() - new Date(info.createdAt).getTime();
    if (age > this.policy.maxAgeMs && info.entryCount > this.policy.keepRecentCount) {
      return true;
    }

    return false;
  }

  async compact(
    sessionId: string,
    summarizer?: (entries: SessionEntry[]) => SessionEntry,
  ): Promise<CompactionResult> {
    const info = await this.persistence.getInfo(sessionId);
    if (!info) {
      return {
        sessionId,
        originalEntries: 0,
        compactedEntries: 0,
        bytesReclaimed: 0,
      };
    }

    const allEntries: SessionEntry[] = [];
    for await (const entry of this.persistence.readAll(sessionId)) {
      allEntries.push(entry);
    }

    const originalEntries = allEntries.length;
    const originalSize = info.sizeBytes;

    if (originalEntries <= this.policy.keepRecentCount) {
      return {
        sessionId,
        originalEntries,
        compactedEntries: originalEntries,
        bytesReclaimed: 0,
      };
    }

    const cutoff = originalEntries - this.policy.keepRecentCount;
    const oldEntries = allEntries.slice(0, cutoff);
    const recentEntries = allEntries.slice(cutoff);

    const summary = (summarizer ?? defaultSummarizer)(oldEntries);

    // Use persistence.compact with a summarizer that returns our pre-built output
    await this.persistence.compact(sessionId, () => summary);

    // Now re-append the recent entries
    for (const entry of recentEntries) {
      await this.persistence.append(sessionId, entry);
    }

    const newInfo = await this.persistence.getInfo(sessionId);
    const newSize = newInfo?.sizeBytes ?? 0;

    return {
      sessionId,
      originalEntries,
      compactedEntries: 1 + recentEntries.length,
      bytesReclaimed: Math.max(0, originalSize - newSize),
    };
  }

  async compactAll(): Promise<CompactionResult[]> {
    const sessionIds = await this.persistence.listSessionIds();
    const results: CompactionResult[] = [];

    for (const sessionId of sessionIds) {
      if (await this.shouldCompact(sessionId)) {
        results.push(await this.compact(sessionId));
      }
    }

    return results;
  }
}

export function createSessionCompactor(options: {
  persistence: JSONLPersistence;
  policy?: Partial<CompactionPolicy>;
}): SessionCompactor {
  const policy = { ...DEFAULT_COMPACTION_POLICY, ...options.policy };
  return new SessionCompactor(options.persistence, policy);
}
