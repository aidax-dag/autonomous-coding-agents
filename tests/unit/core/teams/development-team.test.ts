/**
 * Development Team Tests
 *
 * Tests for all development team implementations.
 */

import {
  FrontendTeam,
  BackendTeam,
  FullstackTeam,
  createFrontendTeam,
  createBackendTeam,
  createFullstackTeam,
  DEFAULT_FRONTEND_CONFIG,
  DEFAULT_BACKEND_CONFIG,
  DEFAULT_FULLSTACK_CONFIG,
} from '../../../../src/core/teams/development';
import { createTask } from '../../../../src/core/teams/base-team';
import { TeamType, TeamStatus } from '../../../../src/core/teams/team-types';

// ============================================================================
// Frontend Team Tests
// ============================================================================

describe('FrontendTeam', () => {
  let team: FrontendTeam;

  beforeEach(async () => {
    team = createFrontendTeam({
      id: 'frontend-test',
      name: 'Test Frontend Team',
      maxConcurrentTasks: 3,
      taskTimeoutMs: 10000,
    });
    await team.initialize();
  });

  afterEach(async () => {
    if (team.getStatus() !== TeamStatus.TERMINATED) {
      await team.stop();
    }
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_FRONTEND_CONFIG.uiFrameworks).toContain('react');
      expect(DEFAULT_FRONTEND_CONFIG.cssApproach).toBe('tailwind');
      expect(DEFAULT_FRONTEND_CONFIG.enableA11y).toBe(true);
      expect(DEFAULT_FRONTEND_CONFIG.enableResponsive).toBe(true);
    });

    it('should have correct team type', () => {
      expect(team.type).toBe(TeamType.FRONTEND);
    });

    it('should have frontend capabilities', () => {
      expect(team.hasCapability('code_generation')).toBe(true);
      expect(team.hasCapability('ui_design')).toBe(true);
    });

    it('should return UI frameworks', () => {
      const frameworks = team.getUIFrameworks();
      expect(Array.isArray(frameworks)).toBe(true);
      expect(frameworks.length).toBeGreaterThan(0);
    });

    it('should return CSS approach', () => {
      const cssApproach = team.getCSSApproach();
      expect(typeof cssApproach).toBe('string');
    });
  });

  describe('Initialization', () => {
    it('should initialize with idle status', () => {
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should have correct name', () => {
      expect(team.name).toBe('Test Frontend Team');
    });
  });

  describe('Task Processing - Components', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should process component task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('User Card', 'Create a user profile card component', {
          type: 'component',
        })
      );

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();

      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
      expect(result.outputs.filesGenerated).toBeGreaterThan(0);
    });

    it('should process page task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Dashboard Page', 'Create a user dashboard page', {
          type: 'page',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });

    it('should process style task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('App Theme', 'Create application theme and styles', {
          type: 'style',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });

    it('should process accessibility task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('A11y Utils', 'Create accessibility utilities', {
          type: 'accessibility',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });
  });

  describe('Component Statistics', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should track component statistics', async () => {
      await team.submitTask(
        createTask('Button', 'Create button component', { type: 'component' })
      );
      await team.submitTask(
        createTask('Modal', 'Create modal component', { type: 'component' })
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const stats = team.getComponentStats();
      expect(stats.totalComponents).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Factory Function', () => {
    it('should create team with defaults', () => {
      const newTeam = createFrontendTeam();
      expect(newTeam).toBeInstanceOf(FrontendTeam);
      expect(newTeam.type).toBe(TeamType.FRONTEND);
    });

    it('should accept custom config', () => {
      const newTeam = createFrontendTeam({
        name: 'Custom Frontend',
        uiFrameworks: ['vue'],
        cssApproach: 'styled-components',
      });
      expect(newTeam.name).toBe('Custom Frontend');
      expect(newTeam.getUIFrameworks()).toContain('vue');
    });
  });
});

// ============================================================================
// Backend Team Tests
// ============================================================================

describe('BackendTeam', () => {
  let team: BackendTeam;

  beforeEach(async () => {
    team = createBackendTeam({
      id: 'backend-test',
      name: 'Test Backend Team',
      maxConcurrentTasks: 3,
      taskTimeoutMs: 10000,
    });
    await team.initialize();
  });

  afterEach(async () => {
    if (team.getStatus() !== TeamStatus.TERMINATED) {
      await team.stop();
    }
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_BACKEND_CONFIG.serverFramework).toBe('express');
      expect(DEFAULT_BACKEND_CONFIG.databaseType).toBe('postgres');
      expect(DEFAULT_BACKEND_CONFIG.enableApiDocs).toBe(true);
      expect(DEFAULT_BACKEND_CONFIG.enableValidation).toBe(true);
    });

    it('should have correct team type', () => {
      expect(team.type).toBe(TeamType.BACKEND);
    });

    it('should have backend capabilities', () => {
      expect(team.hasCapability('code_generation')).toBe(true);
      expect(team.hasCapability('api_design')).toBe(true);
    });

    it('should return server framework', () => {
      const framework = team.getServerFramework();
      expect(typeof framework).toBe('string');
    });

    it('should return database type', () => {
      const dbType = team.getDatabaseType();
      expect(typeof dbType).toBe('string');
    });
  });

  describe('Initialization', () => {
    it('should initialize with idle status', () => {
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should have correct name', () => {
      expect(team.name).toBe('Test Backend Team');
    });
  });

  describe('Task Processing - API', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should process API task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('User API', 'Create user CRUD endpoints', {
          type: 'api',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();

      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
      expect(result.outputs.filesGenerated).toBeGreaterThan(0);
    });

    it('should process model task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('User Model', 'Create user database model', {
          type: 'model',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });

    it('should process middleware task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Auth Middleware', 'Create authentication middleware', {
          type: 'middleware',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });

    it('should process service task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Email Service', 'Create email notification service', {
          type: 'service',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });
  });

  describe('API Statistics', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should track API statistics', async () => {
      await team.submitTask(
        createTask('Products API', 'Create product endpoints', { type: 'api' })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stats = team.getAPIStats();
      expect(stats.totalEndpoints).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Factory Function', () => {
    it('should create team with defaults', () => {
      const newTeam = createBackendTeam();
      expect(newTeam).toBeInstanceOf(BackendTeam);
      expect(newTeam.type).toBe(TeamType.BACKEND);
    });

    it('should accept custom config', () => {
      const newTeam = createBackendTeam({
        name: 'Custom Backend',
        serverFramework: 'fastify',
        databaseType: 'mongodb',
      });
      expect(newTeam.name).toBe('Custom Backend');
      expect(newTeam.getServerFramework()).toBe('fastify');
      expect(newTeam.getDatabaseType()).toBe('mongodb');
    });
  });
});

// ============================================================================
// Fullstack Team Tests
// ============================================================================

describe('FullstackTeam', () => {
  let team: FullstackTeam;

  beforeEach(async () => {
    team = createFullstackTeam({
      id: 'fullstack-test',
      name: 'Test Fullstack Team',
      maxConcurrentTasks: 3,
      taskTimeoutMs: 10000,
    });
    await team.initialize();
  });

  afterEach(async () => {
    if (team.getStatus() !== TeamStatus.TERMINATED) {
      await team.stop();
    }
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_FULLSTACK_CONFIG.enableIntegration).toBe(true);
      expect(DEFAULT_FULLSTACK_CONFIG.generateApiClient).toBe(true);
      expect(DEFAULT_FULLSTACK_CONFIG.enableStateManagement).toBe(true);
      expect(DEFAULT_FULLSTACK_CONFIG.stateManagementLib).toBe('zustand');
    });

    it('should have correct team type', () => {
      expect(team.type).toBe(TeamType.FULLSTACK);
    });

    it('should have fullstack capabilities', () => {
      expect(team.hasCapability('code_generation')).toBe(true);
      expect(team.hasCapability('api_design')).toBe(true);
      expect(team.hasCapability('ui_design')).toBe(true);
    });

    it('should return frontend config', () => {
      const config = team.getFrontendConfig();
      expect(config).toBeDefined();
      expect(config.uiFrameworks).toBeDefined();
    });

    it('should return backend config', () => {
      const config = team.getBackendConfig();
      expect(config).toBeDefined();
      expect(config.serverFramework).toBeDefined();
    });
  });

  describe('Initialization', () => {
    it('should initialize with idle status', () => {
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should have correct name', () => {
      expect(team.name).toBe('Test Fullstack Team');
    });
  });

  describe('Task Processing - Fullstack Features', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should process fullstack feature task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('User Dashboard', 'Create user dashboard with API and UI', {
          type: 'fullstack',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();

      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
      expect(result.outputs.filesGenerated).toBeGreaterThan(0);
    });

    it('should process CRUD feature task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Product CRUD', 'Create product CRUD feature', {
          type: 'crud',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
      // CRUD should generate many files
      expect(result.outputs.filesGenerated).toBeGreaterThanOrEqual(5);
    });

    it('should process integration task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('Payment Integration', 'Create payment gateway integration', {
          type: 'integration',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });

    it('should process API client task', async () => {
      const completedHandler = jest.fn();
      team.on('task:completed', completedHandler);

      await team.submitTask(
        createTask('User API Client', 'Create API client for user service', {
          type: 'api-client',
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      expect(completedHandler).toHaveBeenCalled();
      const result = completedHandler.mock.calls[0][1];
      expect(result.success).toBe(true);
    });
  });

  describe('Fullstack Statistics', () => {
    beforeEach(async () => {
      await team.start();
    });

    it('should track fullstack statistics', async () => {
      await team.submitTask(
        createTask('Orders Feature', 'Create orders management', { type: 'fullstack' })
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stats = team.getFullstackStats();
      expect(stats.featuresImplemented).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Factory Function', () => {
    it('should create team with defaults', () => {
      const newTeam = createFullstackTeam();
      expect(newTeam).toBeInstanceOf(FullstackTeam);
      expect(newTeam.type).toBe(TeamType.FULLSTACK);
    });

    it('should accept custom config', () => {
      const newTeam = createFullstackTeam({
        name: 'Custom Fullstack',
        stateManagementLib: 'redux',
        frontend: { uiFrameworks: ['vue'] },
        backend: { serverFramework: 'fastify' },
      });
      expect(newTeam.name).toBe('Custom Fullstack');
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Development Teams Integration', () => {
  it('should all teams have common base functionality', async () => {
    const frontend = createFrontendTeam({ name: 'Frontend' });
    const backend = createBackendTeam({ name: 'Backend' });
    const fullstack = createFullstackTeam({ name: 'Fullstack' });

    await Promise.all([
      frontend.initialize(),
      backend.initialize(),
      fullstack.initialize(),
    ]);

    // All should support code generation
    expect(frontend.hasCapability('code_generation')).toBe(true);
    expect(backend.hasCapability('code_generation')).toBe(true);
    expect(fullstack.hasCapability('code_generation')).toBe(true);

    // All should have languages
    expect(frontend.getLanguages().length).toBeGreaterThan(0);
    expect(backend.getLanguages().length).toBeGreaterThan(0);
    expect(fullstack.getLanguages().length).toBeGreaterThan(0);

    // All should have frameworks
    expect(frontend.getFrameworks().length).toBeGreaterThan(0);
    expect(backend.getFrameworks().length).toBeGreaterThan(0);
    expect(fullstack.getFrameworks().length).toBeGreaterThan(0);

    // Cleanup
    await Promise.all([frontend.stop(), backend.stop(), fullstack.stop()]);
  });

  it('should generate test files when configured', async () => {
    const team = createFrontendTeam({
      generateTests: true,
      coverageTarget: 80,
    });
    await team.initialize();
    await team.start();

    const completedHandler = jest.fn();
    team.on('task:completed', completedHandler);

    await team.submitTask(
      createTask('Button', 'Create button component', { type: 'component' })
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(completedHandler).toHaveBeenCalled();
    const result = completedHandler.mock.calls[0][1];
    expect(result.outputs.testsGenerated).toBeGreaterThan(0);

    await team.stop();
  });

  it('should skip test files when not configured', async () => {
    const team = createBackendTeam({
      generateTests: false,
    });
    await team.initialize();
    await team.start();

    const completedHandler = jest.fn();
    team.on('task:completed', completedHandler);

    await team.submitTask(
      createTask('API', 'Create API', { type: 'api' })
    );

    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(completedHandler).toHaveBeenCalled();
    const result = completedHandler.mock.calls[0][1];
    expect(result.outputs.testsGenerated).toBe(0);

    await team.stop();
  });
});
