/**
 * Tests for Multimodal Processing System
 */

import {
  ImageAnalyzer,
  createImageAnalyzer,
  UICodeGenerator,
  createUICodeGenerator,
  MultimodalProcessor,
  createMultimodalProcessor,
  DEFAULT_MULTIMODAL_CONFIG,
} from '@/core/multimodal';
import type {
  MultimodalInput,
  UIElement,
  LayoutInfo,
  ImageAnalysisResult,
  DiagramAnalysisResult,
  DiagramComponent,
  DiagramConnection,
  MultimodalConfig,
} from '@/core/multimodal';

// ──────────────────────────────────────────
// Test Fixtures
// ──────────────────────────────────────────

function createMockImageInput(overrides: Partial<MultimodalInput> = {}): MultimodalInput {
  return {
    id: 'test-img-001',
    type: 'image',
    content: Buffer.from('fake-image-data'),
    mimeType: 'image/png',
    metadata: {
      source: 'test/mockup.png',
      width: 1920,
      height: 1080,
      format: 'png',
      fileSize: 1024 * 100, // 100KB
    },
    ...overrides,
  };
}

function createMockDiagramInput(overrides: Partial<MultimodalInput> = {}): MultimodalInput {
  return {
    id: 'test-diagram-001',
    type: 'diagram',
    content: Buffer.from('fake-diagram-data'),
    mimeType: 'image/png',
    metadata: {
      source: 'test/architecture-diagram.png',
      width: 2000,
      height: 1500,
      format: 'png',
      fileSize: 1024 * 200, // 200KB
    },
    ...overrides,
  };
}

function createMockUIElement(overrides: Partial<UIElement> = {}): UIElement {
  return {
    type: 'button',
    label: 'Submit',
    position: { x: 100, y: 200, width: 120, height: 40 },
    properties: {},
    ...overrides,
  };
}

// ──────────────────────────────────────────
// ImageAnalyzer Tests
// ──────────────────────────────────────────

describe('ImageAnalyzer', () => {
  let analyzer: ImageAnalyzer;

  beforeEach(() => {
    analyzer = new ImageAnalyzer();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(analyzer).toBeInstanceOf(ImageAnalyzer);
    });

    it('should accept custom config', () => {
      const custom = new ImageAnalyzer({ maxImageSize: 5 * 1024 * 1024 });
      expect(custom).toBeInstanceOf(ImageAnalyzer);
    });

    it('should create via factory function', () => {
      const instance = createImageAnalyzer({ defaultFramework: 'vue' });
      expect(instance).toBeInstanceOf(ImageAnalyzer);
    });
  });

  describe('validateImage', () => {
    it('should validate a valid image input', () => {
      const input = createMockImageInput();
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty content', () => {
      const input = createMockImageInput({ content: '' });
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject unsupported modality type', () => {
      const input = createMockImageInput({ type: 'text' });
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported modality type');
    });

    it('should reject unsupported image format', () => {
      const input = createMockImageInput({
        metadata: {
          source: 'test.bmp',
          format: 'bmp' as any,
        },
      });
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported image format');
    });

    it('should reject images exceeding max size', () => {
      const input = createMockImageInput({
        metadata: {
          source: 'test.png',
          format: 'png',
          fileSize: 20 * 1024 * 1024, // 20MB
        },
      });
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum');
    });

    it('should accept images within custom size limit', () => {
      const smallAnalyzer = new ImageAnalyzer({ maxImageSize: 1024 });
      const input = createMockImageInput({
        metadata: { source: 'test.png', format: 'png', fileSize: 512 },
      });
      const result = smallAnalyzer.validateImage(input);
      expect(result.valid).toBe(true);
    });

    it('should accept diagram type inputs', () => {
      const input = createMockDiagramInput();
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(true);
    });

    it('should accept input without fileSize', () => {
      const input = createMockImageInput({
        metadata: { source: 'test.png', format: 'png' },
      });
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(true);
    });

    it('should accept input without format', () => {
      const input = createMockImageInput({
        metadata: { source: 'test.png' },
      });
      const result = analyzer.validateImage(input);
      expect(result.valid).toBe(true);
    });
  });

  describe('detectModality', () => {
    it('should detect diagram type input', () => {
      const input = createMockDiagramInput();
      expect(analyzer.detectModality(input)).toBe('diagram');
    });

    it('should detect diagram from source path keywords', () => {
      const cases = ['architecture-overview.png', 'flow-chart.png', 'sequence-diagram.png', 'erd-model.png', 'uml-class.png'];
      for (const source of cases) {
        const input = createMockImageInput({ metadata: { source } });
        expect(analyzer.detectModality(input)).toBe('diagram');
      }
    });

    it('should detect ui-mockup from source path keywords', () => {
      const cases = ['login-mockup.png', 'wireframe-v2.png', 'ui-design.png', 'prototype-home.png'];
      for (const source of cases) {
        const input = createMockImageInput({ metadata: { source } });
        expect(analyzer.detectModality(input)).toBe('ui-mockup');
      }
    });

    it('should detect screenshot from source path keywords', () => {
      const cases = ['screenshot-2024.png', 'screen-capture.png'];
      for (const source of cases) {
        const input = createMockImageInput({ metadata: { source } });
        expect(analyzer.detectModality(input)).toBe('screenshot');
      }
    });

    it('should detect diagram from SVG format', () => {
      const input = createMockImageInput({
        metadata: { source: 'component.svg', format: 'svg' },
      });
      expect(analyzer.detectModality(input)).toBe('diagram');
    });

    it('should return unknown for ambiguous images', () => {
      const input = createMockImageInput({
        metadata: { source: 'image.png', format: 'png' },
      });
      expect(analyzer.detectModality(input)).toBe('unknown');
    });
  });

  describe('generateVisionPrompt', () => {
    it('should generate a UI analysis prompt', () => {
      const input = createMockImageInput();
      const prompt = analyzer.generateVisionPrompt(input, 'ui-analysis');
      expect(prompt).toContain('UI image');
      expect(prompt).toContain('UI elements');
      expect(prompt).toContain('layout type');
      expect(prompt).toContain('Color palette');
      expect(prompt).toContain('ImageAnalysisResult');
    });

    it('should generate a diagram analysis prompt', () => {
      const input = createMockDiagramInput();
      const prompt = analyzer.generateVisionPrompt(input, 'diagram-analysis');
      expect(prompt).toContain('diagram');
      expect(prompt).toContain('components');
      expect(prompt).toContain('connections');
      expect(prompt).toContain('DiagramAnalysisResult');
    });

    it('should include image metadata in prompt', () => {
      const input = createMockImageInput({
        metadata: { source: 'dashboard.png', width: 1920, height: 1080, format: 'png' },
      });
      const prompt = analyzer.generateVisionPrompt(input, 'ui-analysis');
      expect(prompt).toContain('dashboard.png');
      expect(prompt).toContain('1920x1080');
      expect(prompt).toContain('png');
    });
  });

  describe('extractColors', () => {
    it('should return empty array as framework placeholder', () => {
      const input = createMockImageInput();
      const colors = analyzer.extractColors(input);
      expect(colors).toEqual([]);
    });
  });

  describe('detectLayout', () => {
    it('should return default flex-column layout for empty elements', () => {
      const layout = analyzer.detectLayout([]);
      expect(layout.type).toBe('flex');
      expect(layout.direction).toBe('column');
      expect(layout.responsive).toBe(true);
    });

    it('should detect row layout when elements share Y positions', () => {
      const elements: UIElement[] = [
        createMockUIElement({ position: { x: 0, y: 100, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 120, y: 100, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 240, y: 100, width: 100, height: 40 } }),
      ];
      const layout = analyzer.detectLayout(elements);
      expect(layout.type).toBe('flex');
      expect(layout.direction).toBe('row');
    });

    it('should detect column layout when elements share X positions', () => {
      const elements: UIElement[] = [
        createMockUIElement({ position: { x: 100, y: 0, width: 200, height: 40 } }),
        createMockUIElement({ position: { x: 100, y: 50, width: 200, height: 40 } }),
        createMockUIElement({ position: { x: 100, y: 100, width: 200, height: 40 } }),
      ];
      const layout = analyzer.detectLayout(elements);
      expect(layout.type).toBe('flex');
      expect(layout.direction).toBe('column');
    });

    it('should detect grid layout when elements form a matrix', () => {
      const elements: UIElement[] = [
        createMockUIElement({ position: { x: 0, y: 0, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 120, y: 0, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 240, y: 0, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 0, y: 50, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 120, y: 50, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 240, y: 50, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 0, y: 100, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 120, y: 100, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 240, y: 100, width: 100, height: 40 } }),
      ];
      const layout = analyzer.detectLayout(elements);
      expect(layout.type).toBe('grid');
      expect(layout.columns).toBe(3);
    });

    it('should detect mixed layout for irregular positioning', () => {
      const elements: UIElement[] = [
        createMockUIElement({ position: { x: 10, y: 10, width: 100, height: 40 } }),
        createMockUIElement({ position: { x: 200, y: 300, width: 100, height: 40 } }),
      ];
      const layout = analyzer.detectLayout(elements);
      expect(layout.type).toBe('mixed');
    });
  });

  describe('analyzeUI', () => {
    it('should return a framework result for valid input', () => {
      const input = createMockImageInput();
      const result = analyzer.analyzeUI(input);
      expect(result.description).toContain('UI analysis pending');
      expect(result.elements).toEqual([]);
      expect(result.layout).toBeDefined();
      expect(result.colors).toEqual([]);
      expect(result.suggestedFramework).toBe('react');
    });

    it('should throw for invalid input', () => {
      const input = createMockImageInput({ type: 'text' });
      expect(() => analyzer.analyzeUI(input)).toThrow('Invalid image input');
    });

    it('should use configured default framework', () => {
      const vueAnalyzer = new ImageAnalyzer({ defaultFramework: 'vue' });
      const input = createMockImageInput();
      const result = vueAnalyzer.analyzeUI(input);
      expect(result.suggestedFramework).toBe('vue');
    });
  });

  describe('analyzeDiagram', () => {
    it('should return a framework result for valid input', () => {
      const input = createMockDiagramInput();
      const result = analyzer.analyzeDiagram(input);
      expect(result.type).toBe('unknown');
      expect(result.components).toEqual([]);
      expect(result.connections).toEqual([]);
      expect(result.description).toContain('Diagram analysis pending');
    });

    it('should throw for invalid input', () => {
      const input = createMockDiagramInput({ content: '' });
      expect(() => analyzer.analyzeDiagram(input)).toThrow('Invalid image input');
    });
  });

  describe('getMimeType', () => {
    it('should return correct MIME types', () => {
      expect(ImageAnalyzer.getMimeType('png')).toBe('image/png');
      expect(ImageAnalyzer.getMimeType('jpg')).toBe('image/jpeg');
      expect(ImageAnalyzer.getMimeType('jpeg')).toBe('image/jpeg');
      expect(ImageAnalyzer.getMimeType('gif')).toBe('image/gif');
      expect(ImageAnalyzer.getMimeType('svg')).toBe('image/svg+xml');
      expect(ImageAnalyzer.getMimeType('webp')).toBe('image/webp');
    });
  });
});

// ──────────────────────────────────────────
// UICodeGenerator Tests
// ──────────────────────────────────────────

describe('UICodeGenerator', () => {
  let generator: UICodeGenerator;

  beforeEach(() => {
    generator = new UICodeGenerator('react');
  });

  describe('constructor', () => {
    it('should create with default framework', () => {
      const gen = new UICodeGenerator();
      expect(gen).toBeInstanceOf(UICodeGenerator);
    });

    it('should create via factory function', () => {
      const gen = createUICodeGenerator('vue');
      expect(gen).toBeInstanceOf(UICodeGenerator);
    });
  });

  describe('generateComponent', () => {
    it('should generate a React button component', () => {
      const element = createMockUIElement({ type: 'button', label: 'Submit' });
      const code = generator.generateComponent(element, 'react');
      expect(code).toContain('import React');
      expect(code).toContain('React.FC');
      expect(code).toContain('button');
      expect(code).toContain('Submit');
    });

    it('should generate a React input component', () => {
      const element = createMockUIElement({ type: 'input', label: 'Email' });
      const code = generator.generateComponent(element, 'react');
      expect(code).toContain('import React');
      expect(code).toContain('input');
    });

    it('should generate an HTML fallback for unknown frameworks', () => {
      const element = createMockUIElement({ type: 'button', label: 'Click' });
      const code = generator.generateComponent(element, 'unknown');
      expect(code).toContain('<button');
      expect(code).toContain('Click');
    });

    it('should generate a component with children', () => {
      const element = createMockUIElement({
        type: 'container',
        children: [
          createMockUIElement({ type: 'text', label: 'Hello' }),
          createMockUIElement({ type: 'button', label: 'OK' }),
        ],
      });
      const code = generator.generateComponent(element, 'react');
      expect(code).toContain('div');
      expect(code).toContain('Hello');
      expect(code).toContain('OK');
    });
  });

  describe('generateLayout', () => {
    it('should generate React layout for flex column', () => {
      const layout: LayoutInfo = { type: 'flex', direction: 'column', responsive: true };
      const code = generator.generateLayout(layout, 'react');
      expect(code).toContain('import React');
      expect(code).toContain('Layout');
      expect(code).toContain('children');
      expect(code).toContain('layout-container');
    });

    it('should generate React layout for grid', () => {
      const layout: LayoutInfo = { type: 'grid', columns: 3, responsive: true };
      const code = generator.generateLayout(layout, 'react');
      expect(code).toContain('layout-container');
      expect(code).toContain('layout-grid');
    });

    it('should generate HTML fallback layout', () => {
      const layout: LayoutInfo = { type: 'flex', direction: 'row', responsive: false };
      const code = generator.generateLayout(layout, 'html');
      expect(code).toContain('<div');
      expect(code).toContain('layout-container');
    });
  });

  describe('generateStyles', () => {
    it('should generate CSS with color variables', () => {
      const colors = ['#ff0000', '#00ff00', '#0000ff'];
      const layout: LayoutInfo = { type: 'flex', direction: 'column', responsive: true };
      const css = generator.generateStyles(colors, layout);
      expect(css).toContain('--color-1: #ff0000');
      expect(css).toContain('--color-2: #00ff00');
      expect(css).toContain('--color-3: #0000ff');
    });

    it('should generate grid layout CSS', () => {
      const layout: LayoutInfo = { type: 'grid', columns: 4, responsive: false };
      const css = generator.generateStyles([], layout);
      expect(css).toContain('display: grid');
      expect(css).toContain('grid-template-columns: repeat(4, 1fr)');
    });

    it('should generate flex layout CSS', () => {
      const layout: LayoutInfo = { type: 'flex', direction: 'row', responsive: true };
      const css = generator.generateStyles([], layout);
      expect(css).toContain('display: flex');
      expect(css).toContain('flex-direction: row');
    });

    it('should generate responsive media queries when responsive is true', () => {
      const layout: LayoutInfo = { type: 'flex', direction: 'row', responsive: true };
      const css = generator.generateStyles([], layout);
      expect(css).toContain('@media');
      expect(css).toContain('max-width: 768px');
    });

    it('should not generate media queries when responsive is false', () => {
      const layout: LayoutInfo = { type: 'flex', direction: 'row', responsive: false };
      const css = generator.generateStyles([], layout);
      expect(css).not.toContain('@media');
    });

    it('should handle absolute layout CSS', () => {
      const layout: LayoutInfo = { type: 'absolute', responsive: false };
      const css = generator.generateStyles([], layout);
      expect(css).toContain('position: relative');
    });

    it('should handle mixed layout CSS', () => {
      const layout: LayoutInfo = { type: 'mixed', responsive: false };
      const css = generator.generateStyles([], layout);
      expect(css).toContain('flex-wrap: wrap');
    });
  });

  describe('generateFromAnalysis', () => {
    it('should generate a full code result from analysis with elements', () => {
      const analysis: ImageAnalysisResult = {
        description: 'A login form',
        elements: [createMockUIElement({ type: 'form', label: 'Login' })],
        layout: { type: 'flex', direction: 'column', responsive: true },
        colors: ['#333', '#fff'],
        suggestedFramework: 'react',
      };

      const result = generator.generateFromAnalysis(analysis);
      expect(result.framework).toBe('react');
      expect(result.language).toBe('typescript');
      expect(result.files.length).toBeGreaterThanOrEqual(2);
      expect(result.dependencies).toContain('react');
      expect(result.dependencies).toContain('react-dom');
    });

    it('should generate layout and styles even without elements', () => {
      const analysis: ImageAnalysisResult = {
        description: 'Empty page',
        elements: [],
        layout: { type: 'flex', direction: 'column', responsive: true },
        colors: [],
        suggestedFramework: 'react',
      };

      const result = generator.generateFromAnalysis(analysis);
      // Should have Layout.tsx and generated.css
      expect(result.files.length).toBeGreaterThanOrEqual(2);
      const paths = result.files.map((f) => f.path);
      expect(paths).toContain('src/components/Layout.tsx');
      expect(paths).toContain('src/styles/generated.css');
    });

    it('should override framework via options', () => {
      const analysis: ImageAnalysisResult = {
        description: 'A page',
        elements: [],
        layout: { type: 'flex', direction: 'column', responsive: true },
        colors: [],
        suggestedFramework: 'react',
      };

      const result = generator.generateFromAnalysis(analysis, { framework: 'vue', language: 'javascript' });
      expect(result.framework).toBe('vue');
      expect(result.language).toBe('javascript');
    });

    it('should include TypeScript dependencies for React', () => {
      const analysis: ImageAnalysisResult = {
        description: 'A page',
        elements: [createMockUIElement()],
        layout: { type: 'flex', direction: 'column', responsive: true },
        colors: [],
        suggestedFramework: 'react',
      };

      const result = generator.generateFromAnalysis(analysis);
      expect(result.dependencies).toContain('@types/react');
      expect(result.dependencies).toContain('@types/react-dom');
    });
  });

  describe('generateArchitectureFromDiagram', () => {
    it('should generate module files from diagram components', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'architecture',
        description: 'Microservices architecture',
        components: [
          { id: 'api', name: 'ApiGateway', type: 'service', properties: {} },
          { id: 'auth', name: 'AuthService', type: 'service', properties: {} },
          { id: 'db', name: 'Database', type: 'database', properties: {} },
        ],
        connections: [
          { from: 'api', to: 'auth', label: 'authenticate', type: 'arrow' },
          { from: 'auth', to: 'db', label: 'query', type: 'arrow' },
        ],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      expect(result.framework).toBe('node');
      expect(result.language).toBe('typescript');
      expect(result.files.length).toBe(4); // 3 modules + 1 index

      // Check index file
      const indexFile = result.files.find((f) => f.path === 'src/index.ts');
      expect(indexFile).toBeDefined();
      expect(indexFile!.content).toContain('ApiGateway');
      expect(indexFile!.content).toContain('AuthService');
      expect(indexFile!.content).toContain('Database');
    });

    it('should generate imports for connected components', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'architecture',
        description: 'Service connections',
        components: [
          { id: 'a', name: 'ServiceA', type: 'service', properties: {} },
          { id: 'b', name: 'ServiceB', type: 'service', properties: {} },
        ],
        connections: [
          { from: 'a', to: 'b', label: 'calls', type: 'arrow' },
        ],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      const serviceAFile = result.files.find((f) => f.path === 'src/service-a.ts');
      expect(serviceAFile).toBeDefined();
      expect(serviceAFile!.content).toContain("import type { ServiceB } from './service-b'");
    });

    it('should handle components with properties', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'architecture',
        description: 'Component with properties',
        components: [
          { id: 'svc', name: 'UserService', type: 'service', properties: { port: '8080', host: 'localhost' } },
        ],
        connections: [],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      const file = result.files.find((f) => f.path === 'src/user-service.ts');
      expect(file).toBeDefined();
      expect(file!.content).toContain('port: string');
      expect(file!.content).toContain('host: string');
    });

    it('should return empty files for no components', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'unknown',
        description: 'Empty diagram',
        components: [],
        connections: [],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      expect(result.files).toEqual([]);
    });
  });
});

// ──────────────────────────────────────────
// MultimodalProcessor Tests
// ──────────────────────────────────────────

describe('MultimodalProcessor', () => {
  let processor: MultimodalProcessor;

  beforeEach(() => {
    processor = new MultimodalProcessor();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(processor).toBeInstanceOf(MultimodalProcessor);
    });

    it('should accept custom config', () => {
      const custom = new MultimodalProcessor({ defaultFramework: 'vue' });
      expect(custom.getConfig().defaultFramework).toBe('vue');
    });

    it('should create via factory function', () => {
      const instance = createMultimodalProcessor({ maxImageSize: 5 * 1024 * 1024 });
      expect(instance).toBeInstanceOf(MultimodalProcessor);
      expect(instance.getConfig().maxImageSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('process', () => {
    it('should process a UI mockup image', async () => {
      const input = createMockImageInput({
        metadata: { source: 'test/mockup.png', format: 'png', fileSize: 1024 },
      });

      const result = await processor.process(input);
      expect(result.analysis).toBeDefined();
      expect(result.visionPrompt).toBeDefined();
      expect(result.code).toBeDefined();
    });

    it('should process a diagram image', async () => {
      const input = createMockDiagramInput();

      const result = await processor.process(input);
      expect(result.analysis).toBeDefined();
      expect(result.visionPrompt).toContain('diagram');
    });

    it('should throw for invalid input', async () => {
      const input = createMockImageInput({ content: '' });
      await expect(processor.process(input)).rejects.toThrow('Validation failed');
    });

    it('should throw for unsupported type', async () => {
      const input = createMockImageInput({ type: 'code' });
      await expect(processor.process(input)).rejects.toThrow('Validation failed');
    });

    it('should handle disabled UI analysis', async () => {
      const disabledProcessor = new MultimodalProcessor({
        enableUIAnalysis: false,
        enableDiagramAnalysis: false,
      });
      const input = createMockImageInput();
      const result = await disabledProcessor.process(input);
      expect((result.analysis as ImageAnalysisResult).description).toContain('Processing disabled');
    });

    it('should include vision prompt for UI analysis', async () => {
      const input = createMockImageInput();
      const result = await processor.process(input);
      expect(result.visionPrompt).toContain('UI image');
    });

    it('should include vision prompt for diagram analysis', async () => {
      const input = createMockDiagramInput();
      const result = await processor.process(input);
      expect(result.visionPrompt).toContain('diagram');
    });
  });

  describe('events', () => {
    it('should emit input:validated on successful validation', async () => {
      const events: string[] = [];
      processor.on('input:validated', () => events.push('validated'));

      const input = createMockImageInput();
      await processor.process(input);

      expect(events).toContain('validated');
    });

    it('should emit analysis:complete after analysis', async () => {
      const events: string[] = [];
      processor.on('analysis:complete', () => events.push('analysis'));

      const input = createMockImageInput();
      await processor.process(input);

      expect(events).toContain('analysis');
    });

    it('should emit code:generated when code is produced', async () => {
      const events: string[] = [];
      processor.on('code:generated', () => events.push('code'));

      const input = createMockImageInput();
      await processor.process(input);

      expect(events).toContain('code');
    });

    it('should emit processing:error on validation failure', async () => {
      const errors: Error[] = [];
      processor.on('processing:error', (err: Error) => errors.push(err));

      const input = createMockImageInput({ content: '' });
      await expect(processor.process(input)).rejects.toThrow();

      expect(errors.length).toBe(1);
      expect(errors[0].message).toContain('Validation failed');
    });
  });

  describe('accessors', () => {
    it('should expose image analyzer', () => {
      expect(processor.getImageAnalyzer()).toBeInstanceOf(ImageAnalyzer);
    });

    it('should expose code generator', () => {
      expect(processor.getCodeGenerator()).toBeInstanceOf(UICodeGenerator);
    });

    it('should expose configuration', () => {
      const config = processor.getConfig();
      expect(config.supportedFormats).toEqual(DEFAULT_MULTIMODAL_CONFIG.supportedFormats);
      expect(config.maxImageSize).toBe(DEFAULT_MULTIMODAL_CONFIG.maxImageSize);
    });
  });
});

// ──────────────────────────────────────────
// DiagramAnalysis Tests
// ──────────────────────────────────────────

describe('DiagramAnalysis', () => {
  let analyzer: ImageAnalyzer;
  let generator: UICodeGenerator;

  beforeEach(() => {
    analyzer = new ImageAnalyzer();
    generator = new UICodeGenerator();
  });

  describe('diagram type detection', () => {
    it('should detect diagram type from input type field', () => {
      const input = createMockDiagramInput();
      const modality = analyzer.detectModality(input);
      expect(modality).toBe('diagram');
    });

    it('should detect diagram type from architecture keyword', () => {
      const input = createMockImageInput({
        metadata: { source: 'my-architecture-v2.png' },
      });
      const modality = analyzer.detectModality(input);
      expect(modality).toBe('diagram');
    });
  });

  describe('component and connection extraction', () => {
    it('should generate typed interfaces from components', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'class',
        description: 'Class diagram',
        components: [
          { id: 'user', name: 'User', type: 'class', properties: { name: 'string', email: 'string' } },
        ],
        connections: [],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      const userFile = result.files.find((f) => f.path === 'src/user.ts');
      expect(userFile).toBeDefined();
      expect(userFile!.content).toContain('interface User');
      expect(userFile!.content).toContain('name: string');
      expect(userFile!.content).toContain('email: string');
    });

    it('should document inbound and outbound connections', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'flow',
        description: 'Data flow',
        components: [
          { id: 'src', name: 'DataSource', type: 'service', properties: {} },
          { id: 'proc', name: 'Processor', type: 'service', properties: {} },
          { id: 'sink', name: 'DataSink', type: 'service', properties: {} },
        ],
        connections: [
          { from: 'src', to: 'proc', label: 'raw data', type: 'arrow' },
          { from: 'proc', to: 'sink', label: 'processed', type: 'arrow' },
        ],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      const procFile = result.files.find((f) => f.path === 'src/processor.ts');
      expect(procFile).toBeDefined();
      expect(procFile!.content).toContain('Receives from');
      expect(procFile!.content).toContain('Sends to');
    });
  });

  describe('architecture code generation', () => {
    it('should generate barrel export for multiple components', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'architecture',
        description: 'Service architecture',
        components: [
          { id: 'gw', name: 'Gateway', type: 'service', properties: {} },
          { id: 'cache', name: 'CacheLayer', type: 'service', properties: {} },
        ],
        connections: [],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      const indexFile = result.files.find((f) => f.path === 'src/index.ts');
      expect(indexFile).toBeDefined();
      expect(indexFile!.content).toContain("export { Gateway } from './gateway'");
      expect(indexFile!.content).toContain("export { CacheLayer } from './cache-layer'");
    });

    it('should handle bidirectional connections', () => {
      const analysis: DiagramAnalysisResult = {
        type: 'architecture',
        description: 'Bidirectional services',
        components: [
          { id: 'a', name: 'Frontend', type: 'app', properties: {} },
          { id: 'b', name: 'Backend', type: 'api', properties: {} },
        ],
        connections: [
          { from: 'a', to: 'b', label: 'request/response', type: 'bidirectional' },
        ],
      };

      const result = generator.generateArchitectureFromDiagram(analysis);
      expect(result.files.length).toBe(3); // 2 modules + index
    });
  });
});

// ──────────────────────────────────────────
// Integration Tests
// ──────────────────────────────────────────

describe('Integration: Full Pipeline', () => {
  it('should process an image input through to code generation', async () => {
    const processor = new MultimodalProcessor({ defaultFramework: 'react' });
    const input = createMockImageInput({
      metadata: { source: 'design/homepage-mockup.png', width: 1440, height: 900, format: 'png', fileSize: 50000 },
    });

    const result = await processor.process(input);

    // Analysis should be present
    expect(result.analysis).toBeDefined();
    const uiAnalysis = result.analysis as ImageAnalysisResult;
    expect(uiAnalysis.suggestedFramework).toBe('react');

    // Vision prompt should reference the source
    expect(result.visionPrompt).toContain('homepage-mockup.png');

    // Code should be generated
    expect(result.code).toBeDefined();
    expect(result.code!.framework).toBe('react');
  });

  it('should process a diagram input through to architecture code', async () => {
    const processor = new MultimodalProcessor();
    const input = createMockDiagramInput({
      metadata: { source: 'docs/architecture-diagram.png', format: 'png', fileSize: 80000 },
    });

    const result = await processor.process(input);

    // Analysis should detect diagram
    expect(result.analysis).toBeDefined();
    const diagramAnalysis = result.analysis as DiagramAnalysisResult;
    expect(diagramAnalysis.type).toBe('unknown'); // Framework placeholder

    // Vision prompt should be for diagram analysis
    expect(result.visionPrompt).toContain('diagram');
  });

  it('should emit all lifecycle events in order', async () => {
    const processor = new MultimodalProcessor();
    const events: string[] = [];

    processor.on('input:validated', () => events.push('validated'));
    processor.on('analysis:complete', () => events.push('analysis'));
    processor.on('code:generated', () => events.push('code'));
    processor.on('processing:error', () => events.push('error'));

    const input = createMockImageInput();
    await processor.process(input);

    expect(events).toEqual(['validated', 'code', 'analysis']);
  });

  it('should handle the full pipeline with custom configuration', async () => {
    const config: Partial<MultimodalConfig> = {
      defaultFramework: 'vue',
      maxImageSize: 5 * 1024 * 1024,
      supportedFormats: ['png', 'jpg'],
    };
    const processor = new MultimodalProcessor(config);

    const input = createMockImageInput({
      metadata: { source: 'test.png', format: 'png', fileSize: 1024 },
    });

    const result = await processor.process(input);
    expect(result.analysis).toBeDefined();
    expect(result.visionPrompt).toBeDefined();
  });

  it('should reject unsupported formats in custom config', async () => {
    const processor = new MultimodalProcessor({
      supportedFormats: ['png'],
    });

    const input = createMockImageInput({
      metadata: { source: 'test.gif', format: 'gif', fileSize: 1024 },
    });

    await expect(processor.process(input)).rejects.toThrow('Unsupported image format');
  });

  it('should default config values match DEFAULT_MULTIMODAL_CONFIG', () => {
    const processor = new MultimodalProcessor();
    const config = processor.getConfig();
    expect(config.supportedFormats).toEqual(DEFAULT_MULTIMODAL_CONFIG.supportedFormats);
    expect(config.maxImageSize).toBe(DEFAULT_MULTIMODAL_CONFIG.maxImageSize);
    expect(config.enableUIAnalysis).toBe(DEFAULT_MULTIMODAL_CONFIG.enableUIAnalysis);
    expect(config.enableDiagramAnalysis).toBe(DEFAULT_MULTIMODAL_CONFIG.enableDiagramAnalysis);
    expect(config.defaultFramework).toBe(DEFAULT_MULTIMODAL_CONFIG.defaultFramework);
  });
});
