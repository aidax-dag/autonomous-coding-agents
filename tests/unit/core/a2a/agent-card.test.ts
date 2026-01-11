/**
 * Agent Card System Tests
 *
 * @module tests/unit/core/a2a/agent-card
 */

import {
  AgentCardBuilder,
  AgentCardRegistry,
  AgentCardRegistryStatus,
  AgentCardRegistryEvents,
  createAgentCardRegistry,
  createAgentCardBuilder,
  A2AContentMode,
  A2AAuthType,
} from '../../../../src/core/a2a';

// ============================================================================
// AgentCardBuilder Tests
// ============================================================================

describe('AgentCardBuilder', () => {
  describe('basic building', () => {
    it('should create a minimal agent card', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test agent description')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      expect(card.name).toBe('TestAgent');
      expect(card.description).toBe('Test agent description');
      expect(card.url).toBe('http://localhost:3000/agents/test');
      expect(card.version).toBe('1.0.0');
    });

    it('should set version', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withVersion('2.0.0')
        .build();

      expect(card.version).toBe('2.0.0');
    });

    it('should set documentation URL', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withDocumentationUrl('http://docs.example.com')
        .build();

      expect(card.documentationUrl).toBe('http://docs.example.com');
    });

    it('should set provider information', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withProvider('TestOrg', 'http://testorg.com')
        .build();

      expect(card.provider?.organization).toBe('TestOrg');
      expect(card.provider?.url).toBe('http://testorg.com');
    });
  });

  describe('capabilities', () => {
    it('should add a single capability', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withCapability('code-generation', 'Generates code')
        .build();

      expect(card.capabilities).toHaveLength(1);
      expect(card.capabilities[0].name).toBe('code-generation');
      expect(card.capabilities[0].description).toBe('Generates code');
    });

    it('should add multiple capabilities', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withCapabilities([
          { name: 'code-generation', description: 'Generates code' },
          { name: 'code-review', description: 'Reviews code' },
        ])
        .build();

      expect(card.capabilities).toHaveLength(2);
    });

    it('should combine single and multiple capabilities', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withCapability('cap1', 'Capability 1')
        .withCapabilities([
          { name: 'cap2', description: 'Capability 2' },
          { name: 'cap3', description: 'Capability 3' },
        ])
        .build();

      expect(card.capabilities).toHaveLength(3);
    });
  });

  describe('skills', () => {
    it('should add a single skill', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withSkill('typescript', 'TypeScript', 'TypeScript support', ['ts', 'code'], ['Generate TS code'])
        .build();

      expect(card.skills).toHaveLength(1);
      expect(card.skills[0].id).toBe('typescript');
      expect(card.skills[0].name).toBe('TypeScript');
      expect(card.skills[0].description).toBe('TypeScript support');
      expect(card.skills[0].examples).toEqual(['Generate TS code']);
      expect(card.skills[0].tags).toEqual(['ts', 'code']);
    });

    it('should add multiple skills', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withSkills([
          { id: 'typescript', name: 'TypeScript', description: 'TS support', tags: ['ts'], examples: ['TS code'] },
          { id: 'python', name: 'Python', description: 'Python support', tags: ['py'], examples: ['Python code'] },
        ])
        .build();

      expect(card.skills).toHaveLength(2);
    });
  });

  describe('modes and features', () => {
    it('should set input modes', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withInputModes([A2AContentMode.TEXT, A2AContentMode.FILE])
        .build();

      expect(card.defaultInputModes).toEqual([A2AContentMode.TEXT, A2AContentMode.FILE]);
    });

    it('should set output modes', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withOutputModes([A2AContentMode.TEXT, A2AContentMode.DATA])
        .build();

      expect(card.defaultOutputModes).toEqual([A2AContentMode.TEXT, A2AContentMode.DATA]);
    });

    it('should enable streaming', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withStreaming()
        .build();

      expect(card.supportsStreaming).toBe(true);
    });

    it('should enable push notifications', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withPushNotifications()
        .build();

      expect(card.supportsPushNotifications).toBe(true);
    });

    it('should set max concurrent tasks', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withMaxConcurrentTasks(5)
        .build();

      expect(card.maxConcurrentTasks).toBe(5);
    });
  });

  describe('authentication', () => {
    it('should set authentication requirements', () => {
      const card = new AgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .withAuthentication({
          type: A2AAuthType.API_KEY,
          schemes: ['X-API-Key'],
        })
        .build();

      expect(card.authentication?.type).toBe(A2AAuthType.API_KEY);
      expect(card.authentication?.schemes).toContain('X-API-Key');
    });
  });

  describe('builder utilities', () => {
    it('should create builder from existing card', () => {
      const originalCard = new AgentCardBuilder('OriginalAgent')
        .withDescription('Original')
        .withUrl('http://localhost:3000/agents/original')
        .withCapability('cap1', 'Capability 1')
        .build();

      const modifiedCard = AgentCardBuilder.from(originalCard)
        .withDescription('Modified')
        .withCapability('cap2', 'Capability 2')
        .build();

      expect(modifiedCard.name).toBe('OriginalAgent');
      expect(modifiedCard.description).toBe('Modified');
      expect(modifiedCard.capabilities).toHaveLength(2);
    });

    it('should build unsafe without validation', () => {
      const card = new AgentCardBuilder('TestAgent').buildUnsafe();

      expect(card.name).toBe('TestAgent');
      // This would fail build() due to missing url
    });

    it('should throw on invalid card', () => {
      expect(() => {
        new AgentCardBuilder('TestAgent').build();
      }).toThrow();
    });
  });
});

// ============================================================================
// AgentCardRegistry Tests
// ============================================================================

describe('AgentCardRegistry', () => {
  let registry: AgentCardRegistry;

  beforeEach(() => {
    registry = createAgentCardRegistry();
  });

  describe('status', () => {
    it('should have active status by default', () => {
      expect(registry.getStatus()).toBe(AgentCardRegistryStatus.ACTIVE);
    });
  });

  describe('registration', () => {
    it('should register a card', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      const entry = registry.register(card);

      expect(entry.card.name).toBe('TestAgent');
      expect(entry.metadata.version).toBe(1);
      expect(entry.metadata.isActive).toBe(true);
    });

    it('should register card with tags', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      const entry = registry.register(card, ['production', 'v1']);

      expect(entry.metadata.tags).toEqual(['production', 'v1']);
    });

    it('should increment version on re-registration', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      const entry = registry.register(card);

      expect(entry.metadata.version).toBe(2);
    });

    it('should emit event on registration', () => {
      const handler = jest.fn();
      registry.on(AgentCardRegistryEvents.CARD_REGISTERED, handler);

      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          card: expect.objectContaining({ name: 'TestAgent' }),
        })
      );
    });

    it('should emit update event on re-registration', () => {
      const handler = jest.fn();
      registry.on(AgentCardRegistryEvents.CARD_UPDATED, handler);

      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      registry.register(card);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          previousVersion: 1,
          newVersion: 2,
        })
      );
    });
  });

  describe('update', () => {
    it('should update an existing card', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Original')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      const updated = registry.update('TestAgent', { description: 'Updated' });

      expect(updated?.card.description).toBe('Updated');
      expect(updated?.metadata.version).toBe(2);
    });

    it('should return null for non-existent card', () => {
      const result = registry.update('NonExistent', { description: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('unregister', () => {
    it('should unregister a card', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      const result = registry.unregister('TestAgent');

      expect(result).toBe(true);
      expect(registry.has('TestAgent')).toBe(false);
    });

    it('should return false for non-existent card', () => {
      const result = registry.unregister('NonExistent');
      expect(result).toBe(false);
    });

    it('should emit event on unregister', () => {
      const handler = jest.fn();
      registry.on(AgentCardRegistryEvents.CARD_UNREGISTERED, handler);

      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      registry.unregister('TestAgent');

      expect(handler).toHaveBeenCalled();
    });
  });

  describe('retrieval', () => {
    it('should get a card by name', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      const entry = registry.get('TestAgent');

      expect(entry?.card.name).toBe('TestAgent');
    });

    it('should return null for non-existent card', () => {
      const entry = registry.get('NonExistent');
      expect(entry).toBeNull();
    });

    it('should get all cards', () => {
      registry.register(
        createAgentCardBuilder('Agent1')
          .withDescription('Test 1')
          .withUrl('http://localhost:3000/agents/1')
          .build()
      );
      registry.register(
        createAgentCardBuilder('Agent2')
          .withDescription('Test 2')
          .withUrl('http://localhost:3000/agents/2')
          .build()
      );

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it('should check if card exists', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);

      expect(registry.has('TestAgent')).toBe(true);
      expect(registry.has('NonExistent')).toBe(false);
    });

    it('should return count', () => {
      expect(registry.count()).toBe(0);

      registry.register(
        createAgentCardBuilder('Agent1')
          .withDescription('Test')
          .withUrl('http://localhost:3000/agents/1')
          .build()
      );

      expect(registry.count()).toBe(1);
    });
  });

  describe('activation', () => {
    it('should activate a card', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      registry.deactivate('TestAgent');

      const result = registry.activate('TestAgent');
      expect(result).toBe(true);
      expect(registry.isActive('TestAgent')).toBe(true);
    });

    it('should deactivate a card', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);

      const result = registry.deactivate('TestAgent');
      expect(result).toBe(true);
      expect(registry.isActive('TestAgent')).toBe(false);
    });

    it('should emit events on activation/deactivation', () => {
      const activateHandler = jest.fn();
      const deactivateHandler = jest.fn();
      registry.on(AgentCardRegistryEvents.CARD_ACTIVATED, activateHandler);
      registry.on(AgentCardRegistryEvents.CARD_DEACTIVATED, deactivateHandler);

      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);
      registry.deactivate('TestAgent');
      registry.activate('TestAgent');

      expect(deactivateHandler).toHaveBeenCalled();
      expect(activateHandler).toHaveBeenCalled();
    });

    it('should return false when already in desired state', () => {
      const card = createAgentCardBuilder('TestAgent')
        .withDescription('Test')
        .withUrl('http://localhost:3000/agents/test')
        .build();

      registry.register(card);

      expect(registry.activate('TestAgent')).toBe(false); // Already active
      expect(registry.deactivate('TestAgent')).toBe(true);
      expect(registry.deactivate('TestAgent')).toBe(false); // Already inactive
    });
  });

  describe('discovery', () => {
    beforeEach(() => {
      // Register test agents
      registry.register(
        createAgentCardBuilder('CodeAgent')
          .withDescription('Code generation agent')
          .withUrl('http://localhost:3000/agents/code')
          .withCapability('code-generation', 'Generates code')
          .withCapability('code-review', 'Reviews code')
          .withSkill('typescript', 'TypeScript', 'TypeScript support', ['ts'], ['Generate TS'])
          .withStreaming()
          .build(),
        ['production', 'code']
      );

      registry.register(
        createAgentCardBuilder('ReviewAgent')
          .withDescription('Code review agent')
          .withUrl('http://localhost:3000/agents/review')
          .withCapability('code-review', 'Reviews code')
          .withSkill('security', 'Security', 'Security scanning', ['sec'], ['Security review'])
          .build(),
        ['production', 'review']
      );

      registry.register(
        createAgentCardBuilder('TestAgent')
          .withDescription('Test agent')
          .withUrl('http://localhost:3000/agents/test')
          .withCapability('testing', 'Runs tests')
          .withSkill('jest', 'Jest', 'Jest testing', ['test'], ['Run Jest tests'])
          .build(),
        ['development']
      );
    });

    it('should search by name', () => {
      const result = registry.search({ name: 'Code' });
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].card.name).toBe('CodeAgent');
    });

    it('should search by capability', () => {
      const result = registry.search({ capabilities: ['code-review'] });
      expect(result.cards).toHaveLength(2);
    });

    it('should search by multiple capabilities', () => {
      const result = registry.search({
        capabilities: ['code-generation', 'code-review'],
      });
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].card.name).toBe('CodeAgent');
    });

    it('should search by skill', () => {
      const result = registry.search({ skills: ['typescript'] });
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].card.name).toBe('CodeAgent');
    });

    it('should search by tag', () => {
      const result = registry.search({ tags: ['production'] });
      expect(result.cards).toHaveLength(2);
    });

    it('should search by streaming support', () => {
      const result = registry.search({ supportsStreaming: true });
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0].card.name).toBe('CodeAgent');
    });

    it('should search by active status', () => {
      registry.deactivate('TestAgent');
      const result = registry.search({ isActive: true });
      expect(result.cards).toHaveLength(2);
    });

    it('should apply pagination', () => {
      const result = registry.search({ limit: 2, offset: 0 });
      expect(result.cards).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should find by capability using index', () => {
      const cards = registry.findByCapability('code-review');
      expect(cards).toHaveLength(2);
    });

    it('should find by skill using index', () => {
      const cards = registry.findBySkill('typescript');
      expect(cards).toHaveLength(1);
      expect(cards[0].card.name).toBe('CodeAgent');
    });

    it('should find by tag using index', () => {
      const cards = registry.findByTag('production');
      expect(cards).toHaveLength(2);
    });

    it('should return empty for non-existent capability', () => {
      const cards = registry.findByCapability('non-existent');
      expect(cards).toHaveLength(0);
    });
  });

  describe('utilities', () => {
    it('should clear all cards', () => {
      registry.register(
        createAgentCardBuilder('Agent1')
          .withDescription('Test')
          .withUrl('http://localhost:3000/agents/1')
          .build()
      );

      registry.clear();
      expect(registry.count()).toBe(0);
    });

    it('should export cards', () => {
      registry.register(
        createAgentCardBuilder('Agent1')
          .withDescription('Test 1')
          .withUrl('http://localhost:3000/agents/1')
          .build()
      );
      registry.register(
        createAgentCardBuilder('Agent2')
          .withDescription('Test 2')
          .withUrl('http://localhost:3000/agents/2')
          .build()
      );

      const exported = registry.export();
      expect(exported).toHaveLength(2);
      expect(exported[0].name).toBeDefined();
    });

    it('should import cards', () => {
      const cards = [
        createAgentCardBuilder('Agent1')
          .withDescription('Test 1')
          .withUrl('http://localhost:3000/agents/1')
          .build(),
        createAgentCardBuilder('Agent2')
          .withDescription('Test 2')
          .withUrl('http://localhost:3000/agents/2')
          .build(),
      ];

      const imported = registry.import(cards);
      expect(imported).toBe(2);
      expect(registry.count()).toBe(2);
    });

    it('should skip invalid cards during import', () => {
      const cards = [
        createAgentCardBuilder('ValidAgent')
          .withDescription('Valid')
          .withUrl('http://localhost:3000/agents/valid')
          .build(),
        { name: 'Invalid' } as any, // Invalid card
      ];

      const imported = registry.import(cards);
      expect(imported).toBe(1);
      expect(registry.count()).toBe(1);
    });
  });
});

// ============================================================================
// Factory Tests
// ============================================================================

describe('Factory Functions', () => {
  it('should create registry with createAgentCardRegistry', () => {
    const registry = createAgentCardRegistry();
    expect(registry).toBeInstanceOf(AgentCardRegistry);
  });

  it('should create builder with createAgentCardBuilder', () => {
    const builder = createAgentCardBuilder('TestAgent');
    expect(builder).toBeInstanceOf(AgentCardBuilder);
  });
});
