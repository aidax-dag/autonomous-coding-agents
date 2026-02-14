/**
 * Multimodal Processing Types
 *
 * Type definitions for the multimodal processing system that handles
 * image inputs (screenshots, UI mockups, diagrams) and converts them
 * to actionable code or architecture descriptions.
 *
 * @module core/multimodal
 */

/** Supported input modality types */
export type ModalityType = 'image' | 'text' | 'code' | 'diagram';

/** Supported image formats */
export type ImageFormat = 'png' | 'jpg' | 'jpeg' | 'gif' | 'svg' | 'webp';

/**
 * Multimodal input representing a single piece of content
 */
export interface MultimodalInput {
  /** Unique identifier for this input */
  id: string;
  /** Type of modality */
  type: ModalityType;
  /** Content: text string or base64-encoded image data */
  content: string | Buffer;
  /** MIME type of the content */
  mimeType?: string;
  /** Input metadata */
  metadata: {
    /** Source identifier (file path, URL, etc.) */
    source: string;
    /** Image width in pixels */
    width?: number;
    /** Image height in pixels */
    height?: number;
    /** Image format */
    format?: ImageFormat;
    /** File size in bytes */
    fileSize?: number;
  };
}

/**
 * Result from analyzing a UI screenshot or mockup
 */
export interface ImageAnalysisResult {
  /** Natural language description of the image */
  description: string;
  /** Detected UI elements */
  elements: UIElement[];
  /** Overall layout information */
  layout: LayoutInfo;
  /** Detected color palette (hex values) */
  colors: string[];
  /** Suggested frontend framework for code generation */
  suggestedFramework: string;
}

/**
 * A detected UI element within an image
 */
export interface UIElement {
  /** Element type */
  type:
    | 'button'
    | 'input'
    | 'text'
    | 'image'
    | 'container'
    | 'nav'
    | 'list'
    | 'table'
    | 'form'
    | 'card';
  /** Element label or text content */
  label?: string;
  /** Bounding box position and dimensions */
  position: { x: number; y: number; width: number; height: number };
  /** Additional element properties */
  properties: Record<string, unknown>;
  /** Nested child elements */
  children?: UIElement[];
}

/**
 * Layout information detected from an image
 */
export interface LayoutInfo {
  /** Primary layout type */
  type: 'flex' | 'grid' | 'absolute' | 'mixed';
  /** Layout direction (for flex layouts) */
  direction?: 'row' | 'column';
  /** Number of columns (for grid layouts) */
  columns?: number;
  /** Whether the layout appears responsive */
  responsive: boolean;
}

/**
 * Result from analyzing a diagram image
 */
export interface DiagramAnalysisResult {
  /** Detected diagram type */
  type: 'architecture' | 'sequence' | 'flow' | 'er' | 'class' | 'unknown';
  /** Detected components in the diagram */
  components: DiagramComponent[];
  /** Detected connections between components */
  connections: DiagramConnection[];
  /** Natural language description of the diagram */
  description: string;
}

/**
 * A component detected within a diagram
 */
export interface DiagramComponent {
  /** Unique identifier */
  id: string;
  /** Component name */
  name: string;
  /** Component type (service, database, module, etc.) */
  type: string;
  /** Additional component properties */
  properties: Record<string, unknown>;
}

/**
 * A connection between diagram components
 */
export interface DiagramConnection {
  /** Source component ID */
  from: string;
  /** Target component ID */
  to: string;
  /** Connection label */
  label?: string;
  /** Visual connection type */
  type: 'arrow' | 'line' | 'dashed' | 'bidirectional';
}

/**
 * Result from generating code based on analysis
 */
export interface CodeGenerationResult {
  /** Target framework */
  framework: string;
  /** Target programming language */
  language: string;
  /** Generated files */
  files: Array<{ path: string; content: string }>;
  /** Required dependencies */
  dependencies: string[];
}

/**
 * Configuration for the multimodal processing system
 */
export interface MultimodalConfig {
  /** Supported image formats */
  supportedFormats: ImageFormat[];
  /** Maximum image file size in bytes */
  maxImageSize: number;
  /** Enable UI mockup analysis */
  enableUIAnalysis: boolean;
  /** Enable diagram analysis */
  enableDiagramAnalysis: boolean;
  /** Default frontend framework for code generation */
  defaultFramework: string;
}

/**
 * Default configuration for multimodal processing
 */
export const DEFAULT_MULTIMODAL_CONFIG: MultimodalConfig = {
  supportedFormats: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'],
  maxImageSize: 10 * 1024 * 1024, // 10MB
  enableUIAnalysis: true,
  enableDiagramAnalysis: true,
  defaultFramework: 'react',
};
