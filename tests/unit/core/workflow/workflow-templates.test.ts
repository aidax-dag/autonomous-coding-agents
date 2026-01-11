/**
 * Workflow Templates Tests
 *
 * Tests for WorkflowTemplate, WorkflowTemplateBuilder,
 * WorkflowTemplateRegistry, and built-in templates.
 */

import {
  WorkflowTemplate,
  WorkflowTemplateBuilder,
  WorkflowTemplateRegistry,
  TemplateParameterType,
  TemplateCategory,
  TemplateRegistryEvents,
  WorkflowTemplateSchema,
  TemplateParameterSchema,
  builtInTemplates,
  sequentialTemplate,
  parallelTemplate,
  codeReviewTemplate,
  cicdPipelineTemplate,
  approvalTemplate,
  createTemplateRegistry,
  createTemplateBuilder,
} from '../../../../src/core/workflow';
import { StepType } from '../../../../src/core/workflow';
import { AgentType } from '../../../../src/core/interfaces/agent.interface';

describe('Workflow Templates', () => {
  // ==========================================================================
  // Enums
  // ==========================================================================

  describe('TemplateParameterType', () => {
    it('should have all expected parameter types', () => {
      expect(TemplateParameterType.STRING).toBe('string');
      expect(TemplateParameterType.NUMBER).toBe('number');
      expect(TemplateParameterType.BOOLEAN).toBe('boolean');
      expect(TemplateParameterType.ARRAY).toBe('array');
      expect(TemplateParameterType.OBJECT).toBe('object');
    });

    it('should have exactly 5 parameter types', () => {
      const types = Object.values(TemplateParameterType);
      expect(types).toHaveLength(5);
    });
  });

  describe('TemplateCategory', () => {
    it('should have all expected categories', () => {
      expect(TemplateCategory.GENERAL).toBe('general');
      expect(TemplateCategory.CI_CD).toBe('ci-cd');
      expect(TemplateCategory.CODE_REVIEW).toBe('code-review');
      expect(TemplateCategory.DEPLOYMENT).toBe('deployment');
      expect(TemplateCategory.TESTING).toBe('testing');
      expect(TemplateCategory.DATA_PROCESSING).toBe('data-processing');
      expect(TemplateCategory.CUSTOM).toBe('custom');
    });

    it('should have exactly 7 categories', () => {
      const categories = Object.values(TemplateCategory);
      expect(categories).toHaveLength(7);
    });
  });

  // ==========================================================================
  // Schemas
  // ==========================================================================

  describe('TemplateParameterSchema', () => {
    it('should validate valid parameter', () => {
      const param = {
        name: 'testParam',
        type: TemplateParameterType.STRING,
        required: true,
        description: 'Test parameter',
        defaultValue: 'default',
      };

      const result = TemplateParameterSchema.safeParse(param);
      expect(result.success).toBe(true);
    });

    it('should validate parameter with validation rules', () => {
      const param = {
        name: 'count',
        type: TemplateParameterType.NUMBER,
        required: false,
        validation: {
          min: 1,
          max: 100,
        },
      };

      const result = TemplateParameterSchema.safeParse(param);
      expect(result.success).toBe(true);
    });

    it('should reject parameter without name', () => {
      const param = {
        type: TemplateParameterType.STRING,
      };

      const result = TemplateParameterSchema.safeParse(param);
      expect(result.success).toBe(false);
    });
  });

  describe('WorkflowTemplateSchema', () => {
    it('should validate minimal template', () => {
      const template = {
        id: 'test-template',
        name: 'Test Template',
      };

      const result = WorkflowTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });

    it('should validate complete template', () => {
      const template = {
        id: 'complete-template',
        name: 'Complete Template',
        description: 'A complete template',
        version: '2.0.0',
        category: TemplateCategory.CI_CD,
        tags: ['test', 'complete'],
        parameters: [
          { name: 'param1', type: TemplateParameterType.STRING },
        ],
        steps: [],
        variables: [],
        metadata: { author: 'test' },
      };

      const result = WorkflowTemplateSchema.safeParse(template);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // WorkflowTemplate Class
  // ==========================================================================

  describe('WorkflowTemplate', () => {
    let template: WorkflowTemplate;

    beforeEach(() => {
      template = new WorkflowTemplateBuilder('test-template')
        .withName('Test Template')
        .withDescription('A test template')
        .withVersion('1.0.0')
        .withCategory(TemplateCategory.TESTING)
        .withTags(['test', 'unit'])
        .withParameter('name', TemplateParameterType.STRING, true, 'Name parameter')
        .withParameter('count', TemplateParameterType.NUMBER, false, 'Count parameter', 5)
        .withStep('step-1', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} })
        .build();
    });

    describe('Properties', () => {
      it('should return correct id', () => {
        expect(template.id).toBe('test-template');
      });

      it('should return correct name', () => {
        expect(template.name).toBe('Test Template');
      });

      it('should return correct description', () => {
        expect(template.description).toBe('A test template');
      });

      it('should return correct version', () => {
        expect(template.version).toBe('1.0.0');
      });

      it('should return correct category', () => {
        expect(template.category).toBe(TemplateCategory.TESTING);
      });

      it('should return copy of tags', () => {
        const tags = template.tags;
        expect(tags).toEqual(['test', 'unit']);
        tags.push('modified');
        expect(template.tags).toEqual(['test', 'unit']);
      });

      it('should return copy of parameters', () => {
        const params = template.parameters;
        expect(params).toHaveLength(2);
        params.push({ name: 'new', type: TemplateParameterType.STRING, required: true });
        expect(template.parameters).toHaveLength(2);
      });
    });

    describe('validateParameters', () => {
      it('should validate valid parameters', () => {
        const result = template.validateParameters({ name: 'test', count: 10 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should validate with only required parameters', () => {
        const result = template.validateParameters({ name: 'test' });
        expect(result.valid).toBe(true);
      });

      it('should reject missing required parameter', () => {
        const result = template.validateParameters({ count: 5 });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing required parameter: name');
      });

      it('should reject wrong type', () => {
        const result = template.validateParameters({ name: 123 });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Invalid type');
      });

      it('should validate array type', () => {
        const arrayTemplate = new WorkflowTemplateBuilder('array-test')
          .withName('Array Test')
          .withParameter('items', TemplateParameterType.ARRAY, true)
          .build();

        expect(arrayTemplate.validateParameters({ items: [1, 2, 3] }).valid).toBe(true);
        expect(arrayTemplate.validateParameters({ items: 'not-array' }).valid).toBe(false);
      });

      it('should validate object type', () => {
        const objTemplate = new WorkflowTemplateBuilder('obj-test')
          .withName('Object Test')
          .withParameter('config', TemplateParameterType.OBJECT, true)
          .build();

        expect(objTemplate.validateParameters({ config: { key: 'value' } }).valid).toBe(true);
        expect(objTemplate.validateParameters({ config: [1, 2] }).valid).toBe(false);
        expect(objTemplate.validateParameters({ config: null }).valid).toBe(false);
      });

      it('should validate boolean type', () => {
        const boolTemplate = new WorkflowTemplateBuilder('bool-test')
          .withName('Bool Test')
          .withParameter('enabled', TemplateParameterType.BOOLEAN, true)
          .build();

        expect(boolTemplate.validateParameters({ enabled: true }).valid).toBe(true);
        expect(boolTemplate.validateParameters({ enabled: 'yes' }).valid).toBe(false);
      });
    });

    describe('validateParameters with validation rules', () => {
      it('should validate pattern', () => {
        const patternTemplate = new WorkflowTemplateBuilder('pattern-test')
          .withName('Pattern Test')
          .withParameter('email', TemplateParameterType.STRING, true, 'Email', undefined, {
            pattern: '^[a-z]+@[a-z]+\\.[a-z]+$',
          })
          .build();

        expect(patternTemplate.validateParameters({ email: 'test@example.com' }).valid).toBe(true);
        expect(patternTemplate.validateParameters({ email: 'invalid' }).valid).toBe(false);
      });

      it('should validate min/max', () => {
        const rangeTemplate = new WorkflowTemplateBuilder('range-test')
          .withName('Range Test')
          .withParameter('count', TemplateParameterType.NUMBER, true, 'Count', undefined, {
            min: 1,
            max: 10,
          })
          .build();

        expect(rangeTemplate.validateParameters({ count: 5 }).valid).toBe(true);
        expect(rangeTemplate.validateParameters({ count: 0 }).valid).toBe(false);
        expect(rangeTemplate.validateParameters({ count: 11 }).valid).toBe(false);
      });

      it('should validate enum', () => {
        const enumTemplate = new WorkflowTemplateBuilder('enum-test')
          .withName('Enum Test')
          .withParameter('env', TemplateParameterType.STRING, true, 'Environment', undefined, {
            enum: ['dev', 'staging', 'prod'],
          })
          .build();

        expect(enumTemplate.validateParameters({ env: 'dev' }).valid).toBe(true);
        expect(enumTemplate.validateParameters({ env: 'invalid' }).valid).toBe(false);
      });
    });

    describe('instantiate', () => {
      it('should instantiate workflow with parameters', () => {
        const workflow = template.instantiate({ name: 'Test Workflow' });

        expect(workflow.id).toContain('test-template');
        expect(workflow.name).toBe('Test Template Instance');
        expect(workflow.description).toBe('A test template');
        const annotations = workflow.metadata?.annotations as Record<string, string>;
        expect(annotations?.templateId).toBe('test-template');
        expect(annotations?.templateVersion).toBe('1.0.0');
        expect(annotations?.instantiatedAt).toBeDefined();
      });

      it('should use custom workflow id', () => {
        const workflow = template.instantiate({ name: 'Test' }, 'custom-workflow-id');
        expect(workflow.id).toBe('custom-workflow-id');
      });

      it('should apply default values', () => {
        const workflow = template.instantiate({ name: 'Test' });
        expect(workflow).toBeDefined();
        // count should use default value of 5
      });

      it('should throw on invalid parameters', () => {
        expect(() => template.instantiate({})).toThrow('Invalid template parameters');
      });

      it('should resolve placeholder values', () => {
        const placeholderTemplate = new WorkflowTemplateBuilder('placeholder-test')
          .withName('Placeholder Test')
          .withParameter('projectName', TemplateParameterType.STRING, true)
          .withStep('build', StepType.AGENT, {
            agentType: AgentType.CODER,
            taskType: 'build',
            payload: { project: '{{projectName}}' },
          })
          .build();

        const workflow = placeholderTemplate.instantiate({ projectName: 'my-project' });
        expect(workflow.steps[0].config).toEqual({
          agentType: AgentType.CODER,
          taskType: 'build',
          payload: { project: 'my-project' },
        });
      });
    });

    describe('toJSON', () => {
      it('should return template data', () => {
        const data = template.toJSON();

        expect(data.id).toBe('test-template');
        expect(data.name).toBe('Test Template');
        expect(data.version).toBe('1.0.0');
        expect(data.parameters).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // WorkflowTemplateBuilder Class
  // ==========================================================================

  describe('WorkflowTemplateBuilder', () => {
    describe('Constructor', () => {
      it('should create builder with id', () => {
        const builder = new WorkflowTemplateBuilder('my-template');
        const template = builder.build();

        expect(template.id).toBe('my-template');
        expect(template.name).toBe('my-template'); // defaults to id
      });
    });

    describe('Fluent Methods', () => {
      it('should set name', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withName('Custom Name')
          .build();

        expect(template.name).toBe('Custom Name');
      });

      it('should set description', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withDescription('Custom description')
          .build();

        expect(template.description).toBe('Custom description');
      });

      it('should set version', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withVersion('2.0.0')
          .build();

        expect(template.version).toBe('2.0.0');
      });

      it('should set category', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withCategory(TemplateCategory.DEPLOYMENT)
          .build();

        expect(template.category).toBe(TemplateCategory.DEPLOYMENT);
      });

      it('should set multiple tags at once', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withTags(['tag1', 'tag2', 'tag3'])
          .build();

        expect(template.tags).toEqual(['tag1', 'tag2', 'tag3']);
      });

      it('should add individual tags', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withTag('tag1')
          .withTag('tag2')
          .build();

        expect(template.tags).toEqual(['tag1', 'tag2']);
      });

      it('should add parameters', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withParameter('name', TemplateParameterType.STRING, true, 'Name')
          .withParameter('count', TemplateParameterType.NUMBER, false, 'Count', 10)
          .build();

        expect(template.parameters).toHaveLength(2);
        expect(template.parameters[0].name).toBe('name');
        expect(template.parameters[1].defaultValue).toBe(10);
      });

      it('should add variables', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withVariable('input', 'string', 'default', 'Input variable')
          .build();

        const data = template.toJSON();
        expect(data.variables).toHaveLength(1);
        expect(data.variables[0].name).toBe('input');
      });

      it('should add steps', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withStep('step-1', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} })
          .withStep('step-2', StepType.AGENT, { agentType: AgentType.REVIEWER, taskType: 'analyze', payload: {} }, {
            name: 'Analyze',
            description: 'Analysis step',
            dependsOn: ['step-1'],
            timeout: 5000,
          })
          .build();

        const data = template.toJSON();
        expect(data.steps).toHaveLength(2);
        expect(data.steps[1].dependsOn).toEqual(['step-1']);
      });

      it('should set metadata', () => {
        const template = new WorkflowTemplateBuilder('test')
          .withMetadata({ author: 'test', createdAt: '2024-01-01' })
          .withMetadata({ version: '1.0' })
          .build();

        const data = template.toJSON();
        expect(data.metadata?.author).toBe('test');
        expect(data.metadata?.version).toBe('1.0');
      });

      it('should chain all methods', () => {
        const template = new WorkflowTemplateBuilder('chained')
          .withName('Chained Template')
          .withDescription('Test chaining')
          .withVersion('1.0.0')
          .withCategory(TemplateCategory.TESTING)
          .withTags(['chain', 'test'])
          .withParameter('name', TemplateParameterType.STRING, true)
          .withVariable('output', 'string')
          .withStep('step-1', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} })
          .withMetadata({ test: true })
          .build();

        expect(template.id).toBe('chained');
        expect(template.name).toBe('Chained Template');
        expect(template.category).toBe(TemplateCategory.TESTING);
        expect(template.tags).toHaveLength(2);
        expect(template.parameters).toHaveLength(1);
      });
    });

    describe('from', () => {
      it('should create builder from existing template', () => {
        const original = new WorkflowTemplateBuilder('original')
          .withName('Original')
          .withCategory(TemplateCategory.CI_CD)
          .withTags(['original'])
          .build();

        const modified = WorkflowTemplateBuilder.from(original)
          .withName('Modified')
          .withTag('modified')
          .build();

        expect(modified.id).toBe('original');
        expect(modified.name).toBe('Modified');
        expect(modified.tags).toContain('original');
        expect(modified.tags).toContain('modified');
      });
    });
  });

  // ==========================================================================
  // WorkflowTemplateRegistry Class
  // ==========================================================================

  describe('WorkflowTemplateRegistry', () => {
    let registry: WorkflowTemplateRegistry;

    beforeEach(() => {
      registry = new WorkflowTemplateRegistry();
    });

    describe('Registration', () => {
      it('should register a template', () => {
        const template = new WorkflowTemplateBuilder('test').build();
        registry.register(template);

        expect(registry.has('test')).toBe(true);
        expect(registry.count()).toBe(1);
      });

      it('should emit TEMPLATE_REGISTERED event', () => {
        const listener = jest.fn();
        registry.on(TemplateRegistryEvents.TEMPLATE_REGISTERED, listener);

        const template = new WorkflowTemplateBuilder('test').build();
        registry.register(template);

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            template,
            timestamp: expect.any(Date),
          })
        );
      });

      it('should emit TEMPLATE_UPDATED when re-registering', () => {
        const registerListener = jest.fn();
        const updateListener = jest.fn();
        registry.on(TemplateRegistryEvents.TEMPLATE_REGISTERED, registerListener);
        registry.on(TemplateRegistryEvents.TEMPLATE_UPDATED, updateListener);

        const template1 = new WorkflowTemplateBuilder('test').withName('V1').build();
        const template2 = new WorkflowTemplateBuilder('test').withName('V2').build();

        registry.register(template1);
        registry.register(template2);

        expect(registerListener).toHaveBeenCalledTimes(1);
        expect(updateListener).toHaveBeenCalledTimes(1);
      });

      it('should update existing template', () => {
        const template = new WorkflowTemplateBuilder('test').withName('V1').build();
        registry.register(template);

        const updated = new WorkflowTemplateBuilder('test').withName('V2').build();
        registry.update(updated);

        expect(registry.get('test')?.name).toBe('V2');
      });

      it('should throw when updating non-existent template', () => {
        const template = new WorkflowTemplateBuilder('test').build();
        expect(() => registry.update(template)).toThrow('Template not found');
      });

      it('should unregister template', () => {
        const template = new WorkflowTemplateBuilder('test').build();
        registry.register(template);

        expect(registry.unregister('test')).toBe(true);
        expect(registry.has('test')).toBe(false);
      });

      it('should return false when unregistering non-existent', () => {
        expect(registry.unregister('non-existent')).toBe(false);
      });

      it('should emit TEMPLATE_UNREGISTERED event', () => {
        const listener = jest.fn();
        registry.on(TemplateRegistryEvents.TEMPLATE_UNREGISTERED, listener);

        const template = new WorkflowTemplateBuilder('test').build();
        registry.register(template);
        registry.unregister('test');

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: 'test',
            timestamp: expect.any(Date),
          })
        );
      });
    });

    describe('Retrieval', () => {
      beforeEach(() => {
        registry.register(new WorkflowTemplateBuilder('t1').withName('Template 1').build());
        registry.register(new WorkflowTemplateBuilder('t2').withName('Template 2').build());
        registry.register(new WorkflowTemplateBuilder('t3').withName('Template 3').build());
      });

      it('should get template by id', () => {
        const template = registry.get('t2');
        expect(template?.name).toBe('Template 2');
      });

      it('should return null for non-existent id', () => {
        expect(registry.get('non-existent')).toBeNull();
      });

      it('should get all templates', () => {
        const all = registry.getAll();
        expect(all).toHaveLength(3);
      });

      it('should check existence', () => {
        expect(registry.has('t1')).toBe(true);
        expect(registry.has('non-existent')).toBe(false);
      });

      it('should count templates', () => {
        expect(registry.count()).toBe(3);
      });
    });

    describe('Search', () => {
      beforeEach(() => {
        registry.register(
          new WorkflowTemplateBuilder('ci-template')
            .withName('CI Pipeline')
            .withCategory(TemplateCategory.CI_CD)
            .withTags(['ci', 'build'])
            .build()
        );
        registry.register(
          new WorkflowTemplateBuilder('deploy-template')
            .withName('Deployment Pipeline')
            .withCategory(TemplateCategory.DEPLOYMENT)
            .withTags(['deploy', 'build'])
            .build()
        );
        registry.register(
          new WorkflowTemplateBuilder('test-template')
            .withName('Test Suite')
            .withCategory(TemplateCategory.TESTING)
            .withTags(['test', 'quality'])
            .build()
        );
      });

      it('should search by name', () => {
        const result = registry.search({ name: 'pipeline' });
        expect(result.templates).toHaveLength(2);
        expect(result.total).toBe(2);
      });

      it('should search by category', () => {
        const result = registry.search({ category: TemplateCategory.CI_CD });
        expect(result.templates).toHaveLength(1);
        expect(result.templates[0].id).toBe('ci-template');
      });

      it('should search by tags', () => {
        const result = registry.search({ tags: ['build'] });
        expect(result.templates).toHaveLength(2);
      });

      it('should apply pagination', () => {
        const result = registry.search({ limit: 2, offset: 0 });
        expect(result.templates).toHaveLength(2);
        expect(result.total).toBe(3);
        expect(result.hasMore).toBe(true);
      });

      it('should combine filters', () => {
        const result = registry.search({
          name: 'pipeline',
          tags: ['ci'],
        });
        expect(result.templates).toHaveLength(1);
        expect(result.templates[0].id).toBe('ci-template');
      });
    });

    describe('findByCategory', () => {
      beforeEach(() => {
        registry.register(
          new WorkflowTemplateBuilder('ci-1').withCategory(TemplateCategory.CI_CD).build()
        );
        registry.register(
          new WorkflowTemplateBuilder('ci-2').withCategory(TemplateCategory.CI_CD).build()
        );
        registry.register(
          new WorkflowTemplateBuilder('test-1').withCategory(TemplateCategory.TESTING).build()
        );
      });

      it('should find templates by category', () => {
        const ciTemplates = registry.findByCategory(TemplateCategory.CI_CD);
        expect(ciTemplates).toHaveLength(2);
      });

      it('should return empty for unused category', () => {
        const templates = registry.findByCategory(TemplateCategory.DATA_PROCESSING);
        expect(templates).toHaveLength(0);
      });
    });

    describe('findByTag', () => {
      beforeEach(() => {
        registry.register(
          new WorkflowTemplateBuilder('t1').withTags(['common', 'build']).build()
        );
        registry.register(
          new WorkflowTemplateBuilder('t2').withTags(['common', 'test']).build()
        );
        registry.register(
          new WorkflowTemplateBuilder('t3').withTags(['deploy']).build()
        );
      });

      it('should find templates by tag', () => {
        const commonTemplates = registry.findByTag('common');
        expect(commonTemplates).toHaveLength(2);
      });

      it('should return empty for unused tag', () => {
        const templates = registry.findByTag('unused');
        expect(templates).toHaveLength(0);
      });
    });

    describe('Instantiation', () => {
      beforeEach(() => {
        registry.register(
          new WorkflowTemplateBuilder('simple')
            .withName('Simple Template')
            .withParameter('name', TemplateParameterType.STRING, true)
            .withStep('step-1', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} })
            .build()
        );
      });

      it('should instantiate workflow from template', () => {
        const workflow = registry.instantiate('simple', { name: 'Test' });

        expect(workflow.name).toBe('Simple Template Instance');
        expect(workflow.steps).toHaveLength(1);
        const annotations = workflow.metadata?.annotations as Record<string, string>;
        expect(annotations?.templateId).toBe('simple');
      });

      it('should use custom workflow id', () => {
        const workflow = registry.instantiate('simple', { name: 'Test' }, 'custom-id');
        expect(workflow.id).toBe('custom-id');
      });

      it('should throw for non-existent template', () => {
        expect(() => registry.instantiate('non-existent', {})).toThrow('Template not found');
      });

      it('should emit WORKFLOW_INSTANTIATED event', () => {
        const listener = jest.fn();
        registry.on(TemplateRegistryEvents.WORKFLOW_INSTANTIATED, listener);

        registry.instantiate('simple', { name: 'Test' }, 'workflow-123');

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            templateId: 'simple',
            workflowId: 'workflow-123',
            parameters: { name: 'Test' },
            timestamp: expect.any(Date),
          })
        );
      });
    });

    describe('Utilities', () => {
      beforeEach(() => {
        registry.register(new WorkflowTemplateBuilder('t1').build());
        registry.register(new WorkflowTemplateBuilder('t2').build());
      });

      it('should clear all templates', () => {
        registry.clear();
        expect(registry.count()).toBe(0);
      });

      it('should export templates', () => {
        const exported = registry.export();
        expect(exported).toHaveLength(2);
        expect(exported[0].id).toBeDefined();
      });

      it('should import templates', () => {
        registry.clear();
        // Import requires full data, so export existing and reimport
        const template1 = new WorkflowTemplateBuilder('import-1').withName('Import 1').build();
        const template2 = new WorkflowTemplateBuilder('import-2').withName('Import 2').build();
        const toImport = [template1.toJSON(), template2.toJSON()];

        const count = registry.import(toImport);
        expect(count).toBe(2);
        expect(registry.count()).toBe(2);
      });

      it('should skip invalid templates on import', () => {
        registry.clear();
        const valid = new WorkflowTemplateBuilder('valid').withName('Valid').build();
        const toImport = [
          valid.toJSON(),
          { name: 'Missing ID' } as any, // invalid
          { id: '', name: 'Empty ID' } as any, // invalid
        ];

        const count = registry.import(toImport);
        expect(count).toBe(1);
        expect(registry.count()).toBe(1);
      });
    });

    describe('Index Management', () => {
      it('should update indices on register', () => {
        registry.register(
          new WorkflowTemplateBuilder('t1')
            .withCategory(TemplateCategory.CI_CD)
            .withTags(['tag1', 'tag2'])
            .build()
        );

        expect(registry.findByCategory(TemplateCategory.CI_CD)).toHaveLength(1);
        expect(registry.findByTag('tag1')).toHaveLength(1);
        expect(registry.findByTag('tag2')).toHaveLength(1);
      });

      it('should update indices on re-register', () => {
        registry.register(
          new WorkflowTemplateBuilder('t1')
            .withCategory(TemplateCategory.CI_CD)
            .withTags(['old-tag'])
            .build()
        );

        registry.register(
          new WorkflowTemplateBuilder('t1')
            .withCategory(TemplateCategory.TESTING)
            .withTags(['new-tag'])
            .build()
        );

        expect(registry.findByCategory(TemplateCategory.CI_CD)).toHaveLength(0);
        expect(registry.findByCategory(TemplateCategory.TESTING)).toHaveLength(1);
        expect(registry.findByTag('old-tag')).toHaveLength(0);
        expect(registry.findByTag('new-tag')).toHaveLength(1);
      });

      it('should remove from indices on unregister', () => {
        registry.register(
          new WorkflowTemplateBuilder('t1')
            .withCategory(TemplateCategory.CI_CD)
            .withTags(['tag1'])
            .build()
        );

        registry.unregister('t1');

        expect(registry.findByCategory(TemplateCategory.CI_CD)).toHaveLength(0);
        expect(registry.findByTag('tag1')).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // Built-in Templates
  // ==========================================================================

  describe('Built-in Templates', () => {
    describe('builtInTemplates', () => {
      it('should have 5 built-in templates', () => {
        expect(builtInTemplates).toHaveLength(5);
      });

      it('should include all expected templates', () => {
        const ids = builtInTemplates.map((t) => t.id);
        expect(ids).toContain('sequential-pipeline');
        expect(ids).toContain('parallel-pipeline');
        expect(ids).toContain('code-review');
        expect(ids).toContain('cicd-pipeline');
        expect(ids).toContain('approval-workflow');
      });
    });

    describe('sequentialTemplate', () => {
      it('should have correct properties', () => {
        expect(sequentialTemplate.id).toBe('sequential-pipeline');
        expect(sequentialTemplate.name).toBe('Sequential Pipeline');
        expect(sequentialTemplate.category).toBe(TemplateCategory.GENERAL);
        expect(sequentialTemplate.tags).toContain('sequential');
      });

      it('should have stepCount parameter', () => {
        const param = sequentialTemplate.parameters.find((p) => p.name === 'stepCount');
        expect(param).toBeDefined();
        expect(param?.type).toBe(TemplateParameterType.NUMBER);
        expect(param?.defaultValue).toBe(3);
      });

      it('should instantiate valid workflow', () => {
        const workflow = sequentialTemplate.instantiate({});
        expect(workflow).toBeDefined();
        expect(workflow.steps.length).toBeGreaterThan(0);
      });
    });

    describe('parallelTemplate', () => {
      it('should have correct properties', () => {
        expect(parallelTemplate.id).toBe('parallel-pipeline');
        expect(parallelTemplate.category).toBe(TemplateCategory.GENERAL);
        expect(parallelTemplate.tags).toContain('parallel');
      });

      it('should have parallelism parameter', () => {
        const param = parallelTemplate.parameters.find((p) => p.name === 'parallelism');
        expect(param).toBeDefined();
        expect(param?.validation?.min).toBe(2);
      });
    });

    describe('codeReviewTemplate', () => {
      it('should have correct properties', () => {
        expect(codeReviewTemplate.id).toBe('code-review');
        expect(codeReviewTemplate.category).toBe(TemplateCategory.CODE_REVIEW);
        expect(codeReviewTemplate.tags).toContain('code-review');
      });

      it('should require repositoryUrl', () => {
        const validation = codeReviewTemplate.validateParameters({});
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Missing required parameter: repositoryUrl');
      });

      it('should validate with required params', () => {
        const validation = codeReviewTemplate.validateParameters({
          repositoryUrl: 'https://github.com/test/repo',
        });
        expect(validation.valid).toBe(true);
      });

      it('should have reviewScope enum validation', () => {
        const param = codeReviewTemplate.parameters.find((p) => p.name === 'reviewScope');
        expect(param?.validation?.enum).toContain('full');
        expect(param?.validation?.enum).toContain('changed-only');
        expect(param?.validation?.enum).toContain('critical');
      });
    });

    describe('cicdPipelineTemplate', () => {
      it('should have correct properties', () => {
        expect(cicdPipelineTemplate.id).toBe('cicd-pipeline');
        expect(cicdPipelineTemplate.category).toBe(TemplateCategory.CI_CD);
        expect(cicdPipelineTemplate.tags).toContain('deployment');
      });

      it('should require projectPath and environment', () => {
        const validation = cicdPipelineTemplate.validateParameters({});
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Missing required parameter: projectPath');
        expect(validation.errors).toContain('Missing required parameter: environment');
      });

      it('should validate environment enum', () => {
        const invalid = cicdPipelineTemplate.validateParameters({
          projectPath: '/app',
          environment: 'invalid',
        });
        expect(invalid.valid).toBe(false);

        const valid = cicdPipelineTemplate.validateParameters({
          projectPath: '/app',
          environment: 'production',
        });
        expect(valid.valid).toBe(true);
      });
    });

    describe('approvalTemplate', () => {
      it('should have correct properties', () => {
        expect(approvalTemplate.id).toBe('approval-workflow');
        expect(approvalTemplate.category).toBe(TemplateCategory.GENERAL);
        expect(approvalTemplate.tags).toContain('approval');
      });

      it('should require requestTitle and approvers', () => {
        const validation = approvalTemplate.validateParameters({});
        expect(validation.valid).toBe(false);
        expect(validation.errors).toContain('Missing required parameter: requestTitle');
        expect(validation.errors).toContain('Missing required parameter: approvers');
      });

      it('should have timeout parameter with limits', () => {
        const param = approvalTemplate.parameters.find((p) => p.name === 'timeout');
        expect(param?.defaultValue).toBe(24);
        expect(param?.validation?.min).toBe(1);
        expect(param?.validation?.max).toBe(168);
      });
    });
  });

  // ==========================================================================
  // Factory Functions
  // ==========================================================================

  describe('Factory Functions', () => {
    describe('createTemplateRegistry', () => {
      it('should create empty registry by default', () => {
        const registry = createTemplateRegistry();
        expect(registry.count()).toBe(0);
      });

      it('should include built-in templates when requested', () => {
        const registry = createTemplateRegistry(true);
        expect(registry.count()).toBe(5);
        expect(registry.has('sequential-pipeline')).toBe(true);
      });
    });

    describe('createTemplateBuilder', () => {
      it('should create builder with id', () => {
        const builder = createTemplateBuilder('test');
        const template = builder.build();
        expect(template.id).toBe('test');
      });
    });
  });

  // ==========================================================================
  // Events
  // ==========================================================================

  describe('TemplateRegistryEvents', () => {
    it('should have all expected events', () => {
      expect(TemplateRegistryEvents.TEMPLATE_REGISTERED).toBe('template:registered');
      expect(TemplateRegistryEvents.TEMPLATE_UPDATED).toBe('template:updated');
      expect(TemplateRegistryEvents.TEMPLATE_UNREGISTERED).toBe('template:unregistered');
      expect(TemplateRegistryEvents.WORKFLOW_INSTANTIATED).toBe('workflow:instantiated');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should support full workflow from builder to instantiation', () => {
      // Create template with builder
      const template = new WorkflowTemplateBuilder('integration-test')
        .withName('Integration Test Template')
        .withDescription('Test full workflow')
        .withCategory(TemplateCategory.TESTING)
        .withTags(['integration', 'test'])
        .withParameter('testName', TemplateParameterType.STRING, true, 'Test name')
        .withParameter('parallel', TemplateParameterType.BOOLEAN, false, 'Run in parallel', false)
        .withStep('setup', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'setup', payload: { name: '{{testName}}' } })
        .withStep('execute', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'execute', payload: {} }, { dependsOn: ['setup'] })
        .withStep('cleanup', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'cleanup', payload: {} }, { dependsOn: ['execute'] })
        .build();

      // Register in registry
      const registry = createTemplateRegistry();
      registry.register(template);

      // Verify registration
      expect(registry.has('integration-test')).toBe(true);
      expect(registry.findByCategory(TemplateCategory.TESTING)).toHaveLength(1);
      expect(registry.findByTag('integration')).toHaveLength(1);

      // Instantiate workflow
      const workflow = registry.instantiate(
        'integration-test',
        { testName: 'My Integration Test' },
        'test-workflow-1'
      );

      // Verify workflow
      expect(workflow.id).toBe('test-workflow-1');
      expect(workflow.steps).toHaveLength(3);
      const annotations = workflow.metadata?.annotations as Record<string, string>;
      expect(annotations?.templateId).toBe('integration-test');

      // Export and import
      const exported = registry.export();
      registry.clear();
      expect(registry.count()).toBe(0);

      registry.import(exported);
      expect(registry.count()).toBe(1);
      expect(registry.has('integration-test')).toBe(true);
    });

    it('should handle complex parameter validation', () => {
      const template = new WorkflowTemplateBuilder('validation-test')
        .withName('Validation Test')
        .withParameter('email', TemplateParameterType.STRING, true, 'Email', undefined, {
          pattern: '^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$',
        })
        .withParameter('count', TemplateParameterType.NUMBER, true, 'Count', undefined, {
          min: 1,
          max: 100,
        })
        .withParameter('env', TemplateParameterType.STRING, true, 'Environment', undefined, {
          enum: ['dev', 'staging', 'prod'],
        })
        .withParameter('items', TemplateParameterType.ARRAY, false, 'Items', [])
        .withParameter('config', TemplateParameterType.OBJECT, false, 'Config', {})
        .withStep('step', StepType.AGENT, { agentType: AgentType.CUSTOM, taskType: 'process', payload: {} })
        .build();

      // All valid
      expect(
        template.validateParameters({
          email: 'test@example.com',
          count: 50,
          env: 'prod',
          items: [1, 2, 3],
          config: { key: 'value' },
        }).valid
      ).toBe(true);

      // Invalid email
      expect(
        template.validateParameters({
          email: 'invalid',
          count: 50,
          env: 'prod',
        }).valid
      ).toBe(false);

      // Count out of range
      expect(
        template.validateParameters({
          email: 'test@example.com',
          count: 200,
          env: 'prod',
        }).valid
      ).toBe(false);

      // Invalid enum value
      expect(
        template.validateParameters({
          email: 'test@example.com',
          count: 50,
          env: 'invalid',
        }).valid
      ).toBe(false);
    });
  });
});
