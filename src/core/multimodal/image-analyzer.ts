/**
 * Image Analyzer
 *
 * Provides a structured analysis framework for images including
 * UI mockups, screenshots, and diagrams. Generates vision prompts
 * that LLM providers with vision capabilities can process.
 *
 * @module core/multimodal
 */

import type {
  MultimodalConfig,
  MultimodalInput,
  ImageAnalysisResult,
  DiagramAnalysisResult,
  UIElement,
  LayoutInfo,
  ImageFormat,
} from './types';
import { DEFAULT_MULTIMODAL_CONFIG } from './types';

/**
 * Validation result for image input
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Detected modality of an image input
 */
export type DetectedModality = 'ui-mockup' | 'diagram' | 'screenshot' | 'unknown';

/**
 * Vision analysis task type
 */
export type VisionTask = 'ui-analysis' | 'diagram-analysis';

/**
 * Analyzes image inputs and provides structured frameworks for
 * LLM vision integration. Does not perform actual pixel-level
 * image processing but instead generates structured prompts and
 * analysis scaffolding.
 */
export class ImageAnalyzer {
  private readonly config: MultimodalConfig;

  constructor(config: Partial<MultimodalConfig> = {}) {
    this.config = { ...DEFAULT_MULTIMODAL_CONFIG, ...config };
  }

  /**
   * Validate an image input against configuration constraints
   */
  validateImage(input: MultimodalInput): ImageValidationResult {
    if (!input.content) {
      return { valid: false, error: 'Image content is empty' };
    }

    if (input.type !== 'image' && input.type !== 'diagram') {
      return { valid: false, error: `Unsupported modality type: ${input.type}` };
    }

    const format = input.metadata.format;
    if (format && !this.config.supportedFormats.includes(format)) {
      return {
        valid: false,
        error: `Unsupported image format: ${format}. Supported: ${this.config.supportedFormats.join(', ')}`,
      };
    }

    const fileSize = input.metadata.fileSize;
    if (fileSize !== undefined && fileSize > this.config.maxImageSize) {
      const maxMB = Math.round(this.config.maxImageSize / (1024 * 1024));
      const actualMB = (fileSize / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `Image size ${actualMB}MB exceeds maximum ${maxMB}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Analyze a UI mockup or screenshot image.
   * Returns a structured analysis result with detected elements and layout.
   * In production, this would be augmented by an LLM vision API.
   */
  analyzeUI(input: MultimodalInput): ImageAnalysisResult {
    const validation = this.validateImage(input);
    if (!validation.valid) {
      throw new Error(`Invalid image input: ${validation.error}`);
    }

    // Provide a framework result that an LLM vision provider would populate
    const elements: UIElement[] = [];
    const colors = this.extractColors(input);
    const layout = this.detectLayout(elements);

    return {
      description: `UI analysis pending for image from ${input.metadata.source}`,
      elements,
      layout,
      colors,
      suggestedFramework: this.config.defaultFramework,
    };
  }

  /**
   * Analyze a diagram image.
   * Returns a structured result with detected components and connections.
   * In production, this would be augmented by an LLM vision API.
   */
  analyzeDiagram(input: MultimodalInput): DiagramAnalysisResult {
    const validation = this.validateImage(input);
    if (!validation.valid) {
      throw new Error(`Invalid image input: ${validation.error}`);
    }

    return {
      type: 'unknown',
      components: [],
      connections: [],
      description: `Diagram analysis pending for image from ${input.metadata.source}`,
    };
  }

  /**
   * Detect the modality of an image input based on metadata and heuristics
   */
  detectModality(input: MultimodalInput): DetectedModality {
    if (input.type === 'diagram') {
      return 'diagram';
    }

    const source = input.metadata.source.toLowerCase();

    // Check source path for diagram indicators
    if (
      source.includes('diagram') ||
      source.includes('architecture') ||
      source.includes('flow') ||
      source.includes('sequence') ||
      source.includes('erd') ||
      source.includes('uml')
    ) {
      return 'diagram';
    }

    // Check source path for UI/mockup indicators
    if (
      source.includes('mockup') ||
      source.includes('wireframe') ||
      source.includes('design') ||
      source.includes('ui') ||
      source.includes('prototype')
    ) {
      return 'ui-mockup';
    }

    // Check source path for screenshot indicators
    if (
      source.includes('screenshot') ||
      source.includes('capture') ||
      source.includes('screen')
    ) {
      return 'screenshot';
    }

    // SVG files are often diagrams
    if (input.metadata.format === 'svg') {
      return 'diagram';
    }

    return 'unknown';
  }

  /**
   * Extract color palette from image metadata.
   * Returns placeholder colors; an LLM vision provider would extract actual colors.
   */
  extractColors(_input: MultimodalInput): string[] {
    // Framework placeholder: actual extraction requires vision API
    return [];
  }

  /**
   * Detect layout type from a set of UI elements based on their positions
   */
  detectLayout(elements: UIElement[]): LayoutInfo {
    if (elements.length === 0) {
      return { type: 'flex', direction: 'column', responsive: true };
    }

    // Analyze element positions to determine layout type
    const xPositions = new Set(elements.map((e) => e.position.x));
    const yPositions = new Set(elements.map((e) => e.position.y));

    // Multiple elements share the same Y position -> row layout
    const hasManyColumns = xPositions.size > 2 && yPositions.size < elements.length;
    // Multiple elements share the same X position -> column layout
    const hasManyRows = yPositions.size > 2 && xPositions.size < elements.length;

    if (hasManyColumns && hasManyRows) {
      // Grid-like: elements form a matrix
      const estimatedColumns = xPositions.size;
      return { type: 'grid', columns: estimatedColumns, responsive: true };
    }

    if (hasManyColumns) {
      return { type: 'flex', direction: 'row', responsive: true };
    }

    if (hasManyRows) {
      return { type: 'flex', direction: 'column', responsive: true };
    }

    return { type: 'mixed', responsive: false };
  }

  /**
   * Generate a structured vision prompt for an LLM provider with
   * vision capabilities to analyze the given image.
   */
  generateVisionPrompt(input: MultimodalInput, task: VisionTask): string {
    const baseContext = [
      `Image source: ${input.metadata.source}`,
      input.metadata.width ? `Dimensions: ${input.metadata.width}x${input.metadata.height}` : '',
      input.metadata.format ? `Format: ${input.metadata.format}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (task === 'ui-analysis') {
      return [
        'Analyze this UI image and provide a structured breakdown:',
        '',
        baseContext,
        '',
        'Please identify and describe:',
        '1. All UI elements (buttons, inputs, text, images, containers, navigation, lists, tables, forms, cards)',
        '2. For each element: type, label/text, approximate position (x, y, width, height as percentages)',
        '3. Overall layout type (flex-row, flex-column, grid, absolute, mixed)',
        '4. Color palette (list of hex color values used)',
        '5. Whether the layout appears responsive',
        '6. Suggested frontend framework best suited for implementation',
        '',
        'Return the analysis in a structured JSON format matching the ImageAnalysisResult schema.',
      ].join('\n');
    }

    // diagram-analysis
    return [
      'Analyze this diagram and provide a structured breakdown:',
      '',
      baseContext,
      '',
      'Please identify and describe:',
      '1. Diagram type (architecture, sequence, flow, er, class, or unknown)',
      '2. All components with: id, name, type (service, database, module, etc.), properties',
      '3. All connections between components: from, to, label, type (arrow, line, dashed, bidirectional)',
      '4. Overall description of what the diagram represents',
      '',
      'Return the analysis in a structured JSON format matching the DiagramAnalysisResult schema.',
    ].join('\n');
  }

  /**
   * Get the MIME type for a given image format
   */
  static getMimeType(format: ImageFormat): string {
    const mimeMap: Record<ImageFormat, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
    };
    return mimeMap[format] ?? 'application/octet-stream';
  }
}

/**
 * Factory function for creating an ImageAnalyzer
 */
export function createImageAnalyzer(
  config?: Partial<MultimodalConfig>,
): ImageAnalyzer {
  return new ImageAnalyzer(config);
}
