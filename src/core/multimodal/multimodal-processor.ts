/**
 * Multimodal Processor
 *
 * Main orchestrator for the multimodal processing pipeline.
 * Coordinates image analysis and code generation, emitting events
 * at each stage of processing.
 *
 * @module core/multimodal
 */

import { EventEmitter } from 'events';

import type {
  MultimodalConfig,
  MultimodalInput,
  ImageAnalysisResult,
  DiagramAnalysisResult,
  CodeGenerationResult,
} from './types';
import { DEFAULT_MULTIMODAL_CONFIG } from './types';
import { ImageAnalyzer } from './image-analyzer';
import { UICodeGenerator } from './code-generator';

/**
 * Processing result returned by the multimodal processor
 */
export interface ProcessingResult {
  /** Analysis result (UI or diagram) */
  analysis: ImageAnalysisResult | DiagramAnalysisResult;
  /** Generated code, if applicable */
  code?: CodeGenerationResult;
  /** Vision prompt for LLM providers without built-in vision */
  visionPrompt?: string;
}

/**
 * Events emitted by the MultimodalProcessor
 */
export interface MultimodalProcessorEvents {
  'input:validated': (input: MultimodalInput) => void;
  'analysis:complete': (result: ImageAnalysisResult | DiagramAnalysisResult) => void;
  'code:generated': (result: CodeGenerationResult) => void;
  'processing:error': (error: Error) => void;
}

/**
 * Orchestrates the multimodal processing pipeline:
 * 1. Validates input
 * 2. Detects modality (UI mockup, diagram, screenshot)
 * 3. Runs appropriate analysis
 * 4. Generates code from analysis results
 * 5. Provides vision prompts for external LLM integration
 */
export class MultimodalProcessor extends EventEmitter {
  private readonly imageAnalyzer: ImageAnalyzer;
  private readonly codeGenerator: UICodeGenerator;
  private readonly config: MultimodalConfig;

  constructor(config: Partial<MultimodalConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MULTIMODAL_CONFIG, ...config };
    this.imageAnalyzer = new ImageAnalyzer(this.config);
    this.codeGenerator = new UICodeGenerator(this.config.defaultFramework);
  }

  /**
   * Process a multimodal input through the full pipeline
   */
  async process(input: MultimodalInput): Promise<ProcessingResult> {
    // Step 1: Validate input
    const validation = this.imageAnalyzer.validateImage(input);
    if (!validation.valid) {
      const error = new Error(`Validation failed: ${validation.error}`);
      this.emit('processing:error', error);
      throw error;
    }
    this.emit('input:validated', input);

    // Step 2: Detect modality
    const modality = this.imageAnalyzer.detectModality(input);

    // Step 3: Run appropriate analysis
    let analysis: ImageAnalysisResult | DiagramAnalysisResult;
    let visionPrompt: string | undefined;
    let code: CodeGenerationResult | undefined;

    try {
      if (modality === 'diagram' && this.config.enableDiagramAnalysis) {
        analysis = this.imageAnalyzer.analyzeDiagram(input);
        visionPrompt = this.imageAnalyzer.generateVisionPrompt(input, 'diagram-analysis');

        // Generate architecture code from diagram
        const diagramResult = analysis as DiagramAnalysisResult;
        if (diagramResult.components.length > 0) {
          code = this.codeGenerator.generateArchitectureFromDiagram(diagramResult);
          this.emit('code:generated', code);
        }
      } else if (this.config.enableUIAnalysis) {
        analysis = this.imageAnalyzer.analyzeUI(input);
        visionPrompt = this.imageAnalyzer.generateVisionPrompt(input, 'ui-analysis');

        // Generate UI code from analysis
        const uiResult = analysis as ImageAnalysisResult;
        code = this.codeGenerator.generateFromAnalysis(uiResult);
        this.emit('code:generated', code);
      } else {
        // Both analysis types disabled: provide basic result
        analysis = {
          description: `Processing disabled for modality: ${modality}`,
          elements: [],
          layout: { type: 'flex', direction: 'column', responsive: true },
          colors: [],
          suggestedFramework: this.config.defaultFramework,
        } satisfies ImageAnalysisResult;
        visionPrompt = this.imageAnalyzer.generateVisionPrompt(input, 'ui-analysis');
      }

      this.emit('analysis:complete', analysis);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit('processing:error', error);
      throw error;
    }

    return { analysis, code, visionPrompt };
  }

  /**
   * Get the underlying image analyzer instance
   */
  getImageAnalyzer(): ImageAnalyzer {
    return this.imageAnalyzer;
  }

  /**
   * Get the underlying code generator instance
   */
  getCodeGenerator(): UICodeGenerator {
    return this.codeGenerator;
  }

  /**
   * Get the current configuration
   */
  getConfig(): Readonly<MultimodalConfig> {
    return this.config;
  }
}

/**
 * Factory function for creating a MultimodalProcessor
 */
export function createMultimodalProcessor(
  config?: Partial<MultimodalConfig>,
): MultimodalProcessor {
  return new MultimodalProcessor(config);
}
