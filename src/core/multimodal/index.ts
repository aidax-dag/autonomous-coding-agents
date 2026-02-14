/**
 * Multimodal Processing Module
 *
 * Handles image inputs (screenshots, UI mockups, diagrams) and converts
 * them to actionable code or architecture descriptions.
 *
 * @module core/multimodal
 */

export type {
  ModalityType,
  ImageFormat,
  MultimodalInput,
  ImageAnalysisResult,
  UIElement,
  LayoutInfo,
  DiagramAnalysisResult,
  DiagramComponent,
  DiagramConnection,
  CodeGenerationResult,
  MultimodalConfig,
} from './types';

export { DEFAULT_MULTIMODAL_CONFIG } from './types';

export {
  ImageAnalyzer,
  createImageAnalyzer,
  type ImageValidationResult,
  type DetectedModality,
  type VisionTask,
} from './image-analyzer';

export {
  UICodeGenerator,
  createUICodeGenerator,
  type CodeGenerationOptions,
} from './code-generator';

export {
  MultimodalProcessor,
  createMultimodalProcessor,
  type ProcessingResult,
  type MultimodalProcessorEvents,
} from './multimodal-processor';
