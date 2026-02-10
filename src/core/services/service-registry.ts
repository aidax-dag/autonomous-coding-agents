/**
 * Service Registry
 *
 * Lightweight service locator for initializing and managing integration modules
 * (validation, learning, context). Provides typed getters with null safety
 * and graceful degradation on initialization failures.
 *
 * @module core/services/service-registry
 */

import {
  ConfidenceChecker,
  createConfidenceChecker,
} from '../validation/confidence-checker.js';
import {
  SelfCheckProtocol,
  createSelfCheckProtocol,
} from '../validation/self-check-protocol.js';
import {
  GoalBackwardVerifier,
  createGoalBackwardVerifier,
} from '../validation/goal-backward-verifier.js';
import { ReflexionPattern, createReflexionPattern } from '../learning/reflexion-pattern.js';
import { InstinctStore, createInstinctStore } from '../learning/instinct-store.js';
import { SolutionsCache, createSolutionsCache } from '../learning/solutions-cache.js';
import { ContextManager, createContextManager } from '../context/context-manager.js';
import {
  SessionManager,
  createSessionManager,
  createJSONLPersistence,
  createSessionRecovery,
} from '../session/index.js';
import { mkdir } from 'fs/promises';

/**
 * Configuration for ServiceRegistry initialization
 */
export interface ServiceRegistryConfig {
  /** Project root directory */
  projectRoot?: string;
  /** Enable validation modules (ConfidenceChecker, SelfCheckProtocol, GoalBackwardVerifier) */
  enableValidation?: boolean;
  /** Enable learning modules (ReflexionPattern, InstinctStore, SolutionsCache) */
  enableLearning?: boolean;
  /** Enable context management module (ContextManager) */
  enableContext?: boolean;
  /** Enable session persistence module (SessionManager) */
  enableSession?: boolean;
  /** Directory for memory/learning persistence (default: 'docs/memory') */
  memoryDir?: string;
  /** Directory for session persistence (default: 'data/sessions') */
  sessionDir?: string;
}

/**
 * ServiceRegistry
 *
 * Singleton registry managing integration module lifecycle.
 * Each module initializes independently - one failure doesn't block others.
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private confidenceChecker: ConfidenceChecker | null = null;
  private selfCheckProtocol: SelfCheckProtocol | null = null;
  private goalBackwardVerifier: GoalBackwardVerifier | null = null;
  private reflexionPattern: ReflexionPattern | null = null;
  private instinctStore: InstinctStore | null = null;
  private solutionsCache: SolutionsCache | null = null;
  private contextManager: ContextManager | null = null;
  private sessionManager: SessionManager | null = null;
  private _initialized = false;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /** Reset singleton instance (for testing) */
  static resetInstance(): void {
    ServiceRegistry.instance = undefined as unknown as ServiceRegistry;
  }

  /**
   * Initialize enabled modules.
   * Idempotent - calling multiple times is safe.
   * Each module initializes in its own try/catch for graceful degradation.
   */
  async initialize(config: ServiceRegistryConfig = {}): Promise<void> {
    if (this._initialized) return;

    const {
      projectRoot = process.cwd(),
      enableValidation = false,
      enableLearning = false,
      enableContext = false,
      enableSession = false,
      memoryDir = 'docs/memory',
      sessionDir = 'data/sessions',
    } = config;

    const basePath = `${projectRoot}/${memoryDir}`;

    // Validation modules (synchronous initialization)
    if (enableValidation) {
      try {
        this.confidenceChecker = createConfidenceChecker();
      } catch {
        /* module init failed - continue */
      }

      try {
        this.selfCheckProtocol = createSelfCheckProtocol();
      } catch {
        /* module init failed - continue */
      }

      try {
        this.goalBackwardVerifier = createGoalBackwardVerifier();
      } catch {
        /* module init failed - continue */
      }
    }

    // Learning modules (async initialization)
    if (enableLearning) {
      // Ensure memory directory exists before module initialization
      try {
        await mkdir(basePath, { recursive: true });
      } catch {
        /* directory creation failed - modules will handle individually */
      }

      try {
        this.reflexionPattern = await createReflexionPattern({
          filePath: `${basePath}/solutions_learned.jsonl`,
        });
      } catch {
        /* module init failed - continue */
      }

      try {
        this.instinctStore = await createInstinctStore({
          storagePath: `${basePath}/instincts.jsonl`,
        });
      } catch {
        /* module init failed - continue */
      }

      try {
        this.solutionsCache = await createSolutionsCache({
          persistPath: `${basePath}/solutions_cache.jsonl`,
        });
      } catch {
        /* module init failed - continue */
      }
    }

    // Context module (synchronous initialization)
    if (enableContext) {
      try {
        this.contextManager = createContextManager();
      } catch {
        /* module init failed - continue */
      }
    }

    // Session module (async initialization)
    if (enableSession) {
      const sessionBasePath = `${projectRoot}/${sessionDir}`;
      try {
        const persistence = await createJSONLPersistence({ baseDir: sessionBasePath });
        const recovery = createSessionRecovery({ persistence });
        this.sessionManager = await createSessionManager({ persistence, recovery });
      } catch {
        /* module init failed - continue */
      }
    }

    this._initialized = true;
  }

  /**
   * Dispose all modules and clean up resources.
   */
  async dispose(): Promise<void> {
    try {
      if (this.solutionsCache) {
        await this.solutionsCache.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.contextManager) {
        this.contextManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    try {
      if (this.sessionManager) {
        await this.sessionManager.dispose();
      }
    } catch {
      /* dispose error ignored */
    }

    this.confidenceChecker = null;
    this.selfCheckProtocol = null;
    this.goalBackwardVerifier = null;
    this.reflexionPattern = null;
    this.instinctStore = null;
    this.solutionsCache = null;
    this.contextManager = null;
    this.sessionManager = null;
    this._initialized = false;
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  // Typed getters (null safety)
  getConfidenceChecker(): ConfidenceChecker | null {
    return this.confidenceChecker;
  }

  getSelfCheckProtocol(): SelfCheckProtocol | null {
    return this.selfCheckProtocol;
  }

  getGoalBackwardVerifier(): GoalBackwardVerifier | null {
    return this.goalBackwardVerifier;
  }

  getReflexionPattern(): ReflexionPattern | null {
    return this.reflexionPattern;
  }

  getInstinctStore(): InstinctStore | null {
    return this.instinctStore;
  }

  getSolutionsCache(): SolutionsCache | null {
    return this.solutionsCache;
  }

  getContextManager(): ContextManager | null {
    return this.contextManager;
  }

  getSessionManager(): SessionManager | null {
    return this.sessionManager;
  }
}
