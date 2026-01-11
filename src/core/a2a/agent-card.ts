/**
 * Agent Card System
 *
 * Comprehensive system for managing agent capability descriptions (A2A standard).
 * Includes builder, registry, discovery, and versioning.
 *
 * @module core/a2a/agent-card
 *
 * @example
 * ```typescript
 * import {
 *   AgentCardBuilder,
 *   AgentCardRegistry,
 *   createAgentCardRegistry,
 * } from '@core/a2a/agent-card';
 *
 * // Build an agent card
 * const card = new AgentCardBuilder('CodeAgent')
 *   .withDescription('Code generation and analysis agent')
 *   .withUrl('http://localhost:3000/agents/code-agent')
 *   .withCapability('code-generation', 'Generates code from natural language')
 *   .withSkill('typescript', ['Generate TypeScript code'], ['code', 'ts'])
 *   .withStreaming()
 *   .build();
 *
 * // Register with registry
 * const registry = createAgentCardRegistry();
 * registry.register(card);
 *
 * // Discover agents
 * const codeAgents = registry.findByCapability('code-generation');
 * ```
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import {
  AgentCard,
  AgentCardSchema,
  AgentSkill,
  A2ACapability,
  A2AContentMode,
  AuthenticationInfo,
} from './a2a-server';

// ============================================================================
// Enums
// ============================================================================

/**
 * Agent Card registry status
 */
export enum AgentCardRegistryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  INITIALIZING = 'initializing',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Agent card metadata schema
 */
export const AgentCardMetadataSchema = z.object({
  registeredAt: z.date(),
  updatedAt: z.date(),
  version: z.number().int().min(1),
  isActive: z.boolean(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
});

export type AgentCardMetadata = z.infer<typeof AgentCardMetadataSchema>;

/**
 * Registered agent card entry
 */
export interface RegisteredCard {
  card: AgentCard;
  metadata: AgentCardMetadata;
}

/**
 * Search criteria for agent cards
 */
export interface AgentCardSearchCriteria {
  /** Search by name (partial match) */
  name?: string;
  /** Search by capability names */
  capabilities?: string[];
  /** Search by skill IDs */
  skills?: string[];
  /** Search by tags */
  tags?: string[];
  /** Search by input modes */
  inputModes?: A2AContentMode[];
  /** Search by output modes */
  outputModes?: A2AContentMode[];
  /** Filter by streaming support */
  supportsStreaming?: boolean;
  /** Filter by active status */
  isActive?: boolean;
  /** Maximum results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Search result
 */
export interface AgentCardSearchResult {
  cards: RegisteredCard[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Agent card registry events
 */
export const AgentCardRegistryEvents = {
  CARD_REGISTERED: 'card:registered',
  CARD_UPDATED: 'card:updated',
  CARD_UNREGISTERED: 'card:unregistered',
  CARD_ACTIVATED: 'card:activated',
  CARD_DEACTIVATED: 'card:deactivated',
} as const;

export type AgentCardRegistryEventType =
  (typeof AgentCardRegistryEvents)[keyof typeof AgentCardRegistryEvents];

// ============================================================================
// Agent Card Builder
// ============================================================================

/**
 * Fluent builder for creating AgentCards
 *
 * @example
 * ```typescript
 * const card = new AgentCardBuilder('MyAgent')
 *   .withDescription('My awesome agent')
 *   .withUrl('http://localhost:3000/agents/my-agent')
 *   .withCapability('task-execution', 'Executes tasks')
 *   .withSkill('typescript', ['Code generation'], ['ts', 'code'])
 *   .withStreaming()
 *   .build();
 * ```
 */
export class AgentCardBuilder {
  private card: Partial<AgentCard>;
  private capabilities: A2ACapability[] = [];
  private skills: AgentSkill[] = [];

  constructor(name: string) {
    this.card = {
      name,
      description: '',
      url: '',
      version: '1.0.0',
      capabilities: [],
      skills: [],
      defaultInputModes: [A2AContentMode.TEXT],
      defaultOutputModes: [A2AContentMode.TEXT],
      supportsStreaming: false,
      supportsPushNotifications: false,
    };
  }

  /**
   * Set the agent description
   */
  withDescription(description: string): this {
    this.card.description = description;
    return this;
  }

  /**
   * Set the agent URL
   */
  withUrl(url: string): this {
    this.card.url = url;
    return this;
  }

  /**
   * Set the agent version
   */
  withVersion(version: string): this {
    this.card.version = version;
    return this;
  }

  /**
   * Set documentation URL
   */
  withDocumentationUrl(url: string): this {
    this.card.documentationUrl = url;
    return this;
  }

  /**
   * Set provider information
   */
  withProvider(organization: string, url?: string): this {
    this.card.provider = { organization, url };
    return this;
  }

  /**
   * Add a capability
   */
  withCapability(name: string, description: string): this {
    this.capabilities.push({ name, description });
    return this;
  }

  /**
   * Add multiple capabilities
   */
  withCapabilities(capabilities: A2ACapability[]): this {
    this.capabilities.push(...capabilities);
    return this;
  }

  /**
   * Add a skill
   */
  withSkill(
    id: string,
    name: string,
    description: string,
    tags: string[] = [],
    examples?: string[]
  ): this {
    this.skills.push({ id, name, description, tags, examples });
    return this;
  }

  /**
   * Add multiple skills
   */
  withSkills(skills: AgentSkill[]): this {
    this.skills.push(...skills);
    return this;
  }

  /**
   * Set authentication requirements
   */
  withAuthentication(auth: AuthenticationInfo): this {
    this.card.authentication = auth;
    return this;
  }

  /**
   * Set input modes
   */
  withInputModes(modes: A2AContentMode[]): this {
    this.card.defaultInputModes = modes;
    return this;
  }

  /**
   * Set output modes
   */
  withOutputModes(modes: A2AContentMode[]): this {
    this.card.defaultOutputModes = modes;
    return this;
  }

  /**
   * Enable streaming support
   */
  withStreaming(enabled = true): this {
    this.card.supportsStreaming = enabled;
    return this;
  }

  /**
   * Enable push notifications support
   */
  withPushNotifications(enabled = true): this {
    this.card.supportsPushNotifications = enabled;
    return this;
  }

  /**
   * Set maximum concurrent tasks
   */
  withMaxConcurrentTasks(max: number): this {
    this.card.maxConcurrentTasks = max;
    return this;
  }

  /**
   * Build the agent card
   * @throws {ZodError} If the card is invalid
   */
  build(): AgentCard {
    const card = {
      ...this.card,
      capabilities: this.capabilities,
      skills: this.skills,
    };

    return AgentCardSchema.parse(card);
  }

  /**
   * Build without validation (useful for testing)
   */
  buildUnsafe(): AgentCard {
    return {
      ...this.card,
      capabilities: this.capabilities,
      skills: this.skills,
    } as AgentCard;
  }

  /**
   * Create a builder from an existing card
   */
  static from(card: AgentCard): AgentCardBuilder {
    const builder = new AgentCardBuilder(card.name);
    builder.card = { ...card };
    builder.capabilities = [...card.capabilities];
    builder.skills = [...card.skills];
    return builder;
  }
}

// ============================================================================
// Agent Card Registry Interface
// ============================================================================

/**
 * Agent Card Registry interface
 */
export interface IAgentCardRegistry {
  // Status
  getStatus(): AgentCardRegistryStatus;

  // Registration
  register(card: AgentCard, tags?: string[]): RegisteredCard;
  update(name: string, updates: Partial<AgentCard>): RegisteredCard | null;
  unregister(name: string): boolean;

  // Retrieval
  get(name: string): RegisteredCard | null;
  getAll(): RegisteredCard[];
  has(name: string): boolean;
  count(): number;

  // Activation
  activate(name: string): boolean;
  deactivate(name: string): boolean;
  isActive(name: string): boolean;

  // Discovery
  search(criteria: AgentCardSearchCriteria): AgentCardSearchResult;
  findByCapability(capability: string): RegisteredCard[];
  findBySkill(skillId: string): RegisteredCard[];
  findByTag(tag: string): RegisteredCard[];

  // Events
  on(event: AgentCardRegistryEventType, listener: (...args: unknown[]) => void): void;
  off(event: AgentCardRegistryEventType, listener: (...args: unknown[]) => void): void;

  // Utilities
  clear(): void;
  export(): AgentCard[];
  import(cards: AgentCard[]): number;
}

// ============================================================================
// Agent Card Registry Implementation
// ============================================================================

/**
 * Agent Card Registry
 *
 * Manages registration, discovery, and versioning of agent cards.
 */
export class AgentCardRegistry extends EventEmitter implements IAgentCardRegistry {
  private cards: Map<string, RegisteredCard> = new Map();
  private status: AgentCardRegistryStatus = AgentCardRegistryStatus.ACTIVE;
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private skillIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  // === Status ===

  getStatus(): AgentCardRegistryStatus {
    return this.status;
  }

  // === Registration ===

  register(card: AgentCard, tags: string[] = []): RegisteredCard {
    // Validate card
    const validatedCard = AgentCardSchema.parse(card);

    // Check for existing
    const existing = this.cards.get(validatedCard.name);

    const now = new Date();
    const metadata: AgentCardMetadata = {
      registeredAt: existing?.metadata.registeredAt || now,
      updatedAt: now,
      version: existing ? existing.metadata.version + 1 : 1,
      isActive: true,
      tags,
      metadata: {},
    };

    const entry: RegisteredCard = {
      card: validatedCard,
      metadata,
    };

    // Store
    this.cards.set(validatedCard.name, entry);

    // Update indices
    this.updateIndices(validatedCard.name, validatedCard, tags);

    // Emit event
    if (existing) {
      this.emit(AgentCardRegistryEvents.CARD_UPDATED, {
        card: validatedCard,
        previousVersion: existing.metadata.version,
        newVersion: metadata.version,
        timestamp: now,
      });
    } else {
      this.emit(AgentCardRegistryEvents.CARD_REGISTERED, {
        card: validatedCard,
        timestamp: now,
      });
    }

    return entry;
  }

  update(name: string, updates: Partial<AgentCard>): RegisteredCard | null {
    const existing = this.cards.get(name);
    if (!existing) {
      return null;
    }

    const updatedCard = AgentCardSchema.parse({
      ...existing.card,
      ...updates,
    });

    return this.register(updatedCard, existing.metadata.tags);
  }

  unregister(name: string): boolean {
    const entry = this.cards.get(name);
    if (!entry) {
      return false;
    }

    // Remove from indices
    this.removeFromIndices(name);

    // Remove from map
    this.cards.delete(name);

    // Emit event
    this.emit(AgentCardRegistryEvents.CARD_UNREGISTERED, {
      card: entry.card,
      timestamp: new Date(),
    });

    return true;
  }

  // === Retrieval ===

  get(name: string): RegisteredCard | null {
    return this.cards.get(name) || null;
  }

  getAll(): RegisteredCard[] {
    return Array.from(this.cards.values());
  }

  has(name: string): boolean {
    return this.cards.has(name);
  }

  count(): number {
    return this.cards.size;
  }

  // === Activation ===

  activate(name: string): boolean {
    const entry = this.cards.get(name);
    if (!entry || entry.metadata.isActive) {
      return false;
    }

    entry.metadata.isActive = true;
    entry.metadata.updatedAt = new Date();

    this.emit(AgentCardRegistryEvents.CARD_ACTIVATED, {
      card: entry.card,
      timestamp: entry.metadata.updatedAt,
    });

    return true;
  }

  deactivate(name: string): boolean {
    const entry = this.cards.get(name);
    if (!entry || !entry.metadata.isActive) {
      return false;
    }

    entry.metadata.isActive = false;
    entry.metadata.updatedAt = new Date();

    this.emit(AgentCardRegistryEvents.CARD_DEACTIVATED, {
      card: entry.card,
      timestamp: entry.metadata.updatedAt,
    });

    return true;
  }

  isActive(name: string): boolean {
    const entry = this.cards.get(name);
    return entry?.metadata.isActive ?? false;
  }

  // === Discovery ===

  search(criteria: AgentCardSearchCriteria): AgentCardSearchResult {
    let results = Array.from(this.cards.values());

    // Filter by name
    if (criteria.name) {
      const lowerName = criteria.name.toLowerCase();
      results = results.filter((entry) =>
        entry.card.name.toLowerCase().includes(lowerName)
      );
    }

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      results = results.filter((entry) =>
        criteria.capabilities!.every((cap) =>
          entry.card.capabilities.some((c) => c.name === cap)
        )
      );
    }

    // Filter by skills
    if (criteria.skills && criteria.skills.length > 0) {
      results = results.filter((entry) =>
        criteria.skills!.every((skillId) =>
          entry.card.skills.some((s) => s.id === skillId)
        )
      );
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter((entry) =>
        criteria.tags!.every((tag) => entry.metadata.tags.includes(tag))
      );
    }

    // Filter by input modes
    if (criteria.inputModes && criteria.inputModes.length > 0) {
      results = results.filter((entry) =>
        criteria.inputModes!.some((mode) =>
          entry.card.defaultInputModes.includes(mode)
        )
      );
    }

    // Filter by output modes
    if (criteria.outputModes && criteria.outputModes.length > 0) {
      results = results.filter((entry) =>
        criteria.outputModes!.some((mode) =>
          entry.card.defaultOutputModes.includes(mode)
        )
      );
    }

    // Filter by streaming support
    if (criteria.supportsStreaming !== undefined) {
      results = results.filter(
        (entry) => entry.card.supportsStreaming === criteria.supportsStreaming
      );
    }

    // Filter by active status
    if (criteria.isActive !== undefined) {
      results = results.filter(
        (entry) => entry.metadata.isActive === criteria.isActive
      );
    }

    // Apply pagination
    const total = results.length;
    const offset = criteria.offset || 0;
    const limit = criteria.limit || results.length;

    results = results.slice(offset, offset + limit);

    return {
      cards: results,
      total,
      hasMore: offset + results.length < total,
    };
  }

  findByCapability(capability: string): RegisteredCard[] {
    const names = this.capabilityIndex.get(capability);
    if (!names) {
      return [];
    }

    return Array.from(names)
      .map((name) => this.cards.get(name))
      .filter((entry): entry is RegisteredCard => entry !== undefined);
  }

  findBySkill(skillId: string): RegisteredCard[] {
    const names = this.skillIndex.get(skillId);
    if (!names) {
      return [];
    }

    return Array.from(names)
      .map((name) => this.cards.get(name))
      .filter((entry): entry is RegisteredCard => entry !== undefined);
  }

  findByTag(tag: string): RegisteredCard[] {
    const names = this.tagIndex.get(tag);
    if (!names) {
      return [];
    }

    return Array.from(names)
      .map((name) => this.cards.get(name))
      .filter((entry): entry is RegisteredCard => entry !== undefined);
  }

  // === Utilities ===

  clear(): void {
    this.cards.clear();
    this.capabilityIndex.clear();
    this.skillIndex.clear();
    this.tagIndex.clear();
  }

  export(): AgentCard[] {
    return Array.from(this.cards.values()).map((entry) => entry.card);
  }

  import(cards: AgentCard[]): number {
    let imported = 0;
    for (const card of cards) {
      try {
        this.register(card);
        imported++;
      } catch {
        // Skip invalid cards
      }
    }
    return imported;
  }

  // === Private Methods ===

  private updateIndices(name: string, card: AgentCard, tags: string[]): void {
    // Remove old indices first
    this.removeFromIndices(name);

    // Add to capability index
    for (const capability of card.capabilities) {
      if (!this.capabilityIndex.has(capability.name)) {
        this.capabilityIndex.set(capability.name, new Set());
      }
      this.capabilityIndex.get(capability.name)!.add(name);
    }

    // Add to skill index
    for (const skill of card.skills) {
      if (!this.skillIndex.has(skill.id)) {
        this.skillIndex.set(skill.id, new Set());
      }
      this.skillIndex.get(skill.id)!.add(name);
    }

    // Add to tag index
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(name);
    }
  }

  private removeFromIndices(name: string): void {
    // Remove from capability index
    for (const [, names] of this.capabilityIndex) {
      names.delete(name);
    }

    // Remove from skill index
    for (const [, names] of this.skillIndex) {
      names.delete(name);
    }

    // Remove from tag index
    for (const [, names] of this.tagIndex) {
      names.delete(name);
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new Agent Card Registry
 */
export function createAgentCardRegistry(): AgentCardRegistry {
  return new AgentCardRegistry();
}

/**
 * Create an Agent Card Builder
 */
export function createAgentCardBuilder(name: string): AgentCardBuilder {
  return new AgentCardBuilder(name);
}
