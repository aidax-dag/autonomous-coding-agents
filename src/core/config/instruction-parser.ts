/**
 * Instruction Markdown Parser
 *
 * Parses CLAUDE.md, AGENT.md, or similar instruction files
 * into structured configuration data.
 *
 * Supported file names:
 * - CLAUDE.md
 * - AGENT.md
 * - INSTRUCTIONS.md
 * - .claude/instructions.md
 *
 * @module core/config/instruction-parser
 */

import { existsSync, readFileSync } from 'fs';
import { join, basename, dirname } from 'path';

/**
 * Supported instruction file names
 */
export const INSTRUCTION_FILE_NAMES = [
  'CLAUDE.md',
  'AGENT.md',
  'INSTRUCTIONS.md',
  '.claude/instructions.md',
  '.agent/instructions.md',
] as const;

/**
 * Instruction section types
 */
export enum InstructionSectionType {
  RULES = 'rules',
  CONVENTIONS = 'conventions',
  GUIDELINES = 'guidelines',
  CONSTRAINTS = 'constraints',
  PREFERENCES = 'preferences',
  CONTEXT = 'context',
  EXAMPLES = 'examples',
  CUSTOM = 'custom',
}

/**
 * Code block extracted from markdown
 */
export interface CodeBlock {
  /** Programming language identifier */
  language: string;
  /** Code content */
  code: string;
  /** Optional label or description */
  label?: string;
}

/**
 * A single instruction item
 */
export interface InstructionItem {
  /** The instruction text */
  text: string;
  /** Priority level (1-5, higher is more important) */
  priority?: number;
  /** Related code examples */
  codeBlocks?: CodeBlock[];
  /** Sub-items for nested instructions */
  children?: InstructionItem[];
}

/**
 * A section of instructions
 */
export interface InstructionSection {
  /** Section title */
  title: string;
  /** Section type */
  type: InstructionSectionType;
  /** Section level (1-6 for h1-h6) */
  level: number;
  /** Raw content of the section */
  rawContent: string;
  /** Parsed instruction items */
  items: InstructionItem[];
  /** Code blocks in this section */
  codeBlocks: CodeBlock[];
  /** Child sections */
  children: InstructionSection[];
}

/**
 * Parsed instruction document
 */
export interface ParsedInstructions {
  /** Source file path */
  filePath: string;
  /** File name (e.g., CLAUDE.md) */
  fileName: string;
  /** Document title (first h1 or file name) */
  title: string;
  /** Raw markdown content */
  rawContent: string;
  /** Parsed sections */
  sections: InstructionSection[];
  /** All code blocks in the document */
  codeBlocks: CodeBlock[];
  /** Flattened list of all instruction items */
  allItems: InstructionItem[];
  /** Metadata extracted from frontmatter (if any) */
  metadata: Record<string, unknown>;
  /** Parse timestamp */
  parsedAt: Date;
}

/**
 * Parser options
 */
export interface InstructionParserOptions {
  /** Include raw content in output */
  includeRawContent?: boolean;
  /** Extract code blocks */
  extractCodeBlocks?: boolean;
  /** Parse nested list items as children */
  parseNestedItems?: boolean;
  /** Custom section type mappings */
  sectionTypeMappings?: Record<string, InstructionSectionType>;
}

/**
 * Default section type mappings
 */
const DEFAULT_SECTION_MAPPINGS: Record<string, InstructionSectionType> = {
  // Rules
  rules: InstructionSectionType.RULES,
  rule: InstructionSectionType.RULES,
  requirements: InstructionSectionType.RULES,
  must: InstructionSectionType.RULES,
  mandatory: InstructionSectionType.RULES,

  // Conventions
  conventions: InstructionSectionType.CONVENTIONS,
  convention: InstructionSectionType.CONVENTIONS,
  standards: InstructionSectionType.CONVENTIONS,
  style: InstructionSectionType.CONVENTIONS,
  'coding style': InstructionSectionType.CONVENTIONS,
  'code style': InstructionSectionType.CONVENTIONS,

  // Guidelines
  guidelines: InstructionSectionType.GUIDELINES,
  guideline: InstructionSectionType.GUIDELINES,
  recommendations: InstructionSectionType.GUIDELINES,
  'best practices': InstructionSectionType.GUIDELINES,
  suggestions: InstructionSectionType.GUIDELINES,

  // Constraints
  constraints: InstructionSectionType.CONSTRAINTS,
  constraint: InstructionSectionType.CONSTRAINTS,
  limitations: InstructionSectionType.CONSTRAINTS,
  restrictions: InstructionSectionType.CONSTRAINTS,
  'do not': InstructionSectionType.CONSTRAINTS,
  avoid: InstructionSectionType.CONSTRAINTS,

  // Preferences
  preferences: InstructionSectionType.PREFERENCES,
  preference: InstructionSectionType.PREFERENCES,
  prefer: InstructionSectionType.PREFERENCES,
  defaults: InstructionSectionType.PREFERENCES,

  // Context
  context: InstructionSectionType.CONTEXT,
  background: InstructionSectionType.CONTEXT,
  overview: InstructionSectionType.CONTEXT,
  about: InstructionSectionType.CONTEXT,
  introduction: InstructionSectionType.CONTEXT,
  project: InstructionSectionType.CONTEXT,

  // Examples
  examples: InstructionSectionType.EXAMPLES,
  example: InstructionSectionType.EXAMPLES,
  samples: InstructionSectionType.EXAMPLES,
  usage: InstructionSectionType.EXAMPLES,
};

/**
 * Instruction Markdown Parser
 *
 * Parses markdown instruction files into structured data.
 */
export class InstructionParser {
  private readonly options: Required<InstructionParserOptions>;
  private readonly sectionMappings: Record<string, InstructionSectionType>;

  constructor(options: InstructionParserOptions = {}) {
    this.options = {
      includeRawContent: options.includeRawContent ?? true,
      extractCodeBlocks: options.extractCodeBlocks ?? true,
      parseNestedItems: options.parseNestedItems ?? true,
      sectionTypeMappings: options.sectionTypeMappings ?? {},
    };

    this.sectionMappings = {
      ...DEFAULT_SECTION_MAPPINGS,
      ...this.options.sectionTypeMappings,
    };
  }

  /**
   * Parse an instruction file
   */
  parse(filePath: string): ParsedInstructions {
    if (!existsSync(filePath)) {
      throw new Error(`Instruction file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, 'utf-8');
    return this.parseContent(content, filePath);
  }

  /**
   * Parse markdown content directly
   */
  parseContent(content: string, filePath: string = 'unknown'): ParsedInstructions {
    const fileName = basename(filePath);
    const { metadata, body } = this.extractFrontmatter(content);
    const codeBlocks = this.options.extractCodeBlocks ? this.extractCodeBlocks(body) : [];
    const sections = this.parseSections(body);
    const title = this.extractTitle(body, fileName);
    const allItems = this.flattenItems(sections);

    return {
      filePath,
      fileName,
      title,
      rawContent: this.options.includeRawContent ? content : '',
      sections,
      codeBlocks,
      allItems,
      metadata,
      parsedAt: new Date(),
    };
  }

  /**
   * Find and parse instruction file in a directory
   */
  findAndParse(directory: string): ParsedInstructions | null {
    for (const fileName of INSTRUCTION_FILE_NAMES) {
      const filePath = join(directory, fileName);
      if (existsSync(filePath)) {
        return this.parse(filePath);
      }
    }
    return null;
  }

  /**
   * Find all instruction files in a directory (including parent directories)
   */
  findAll(directory: string, maxDepth: number = 3): ParsedInstructions[] {
    const results: ParsedInstructions[] = [];
    let currentDir = directory;
    let depth = 0;

    while (depth < maxDepth) {
      const parsed = this.findAndParse(currentDir);
      if (parsed) {
        results.push(parsed);
      }

      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached root
      }
      currentDir = parentDir;
      depth++;
    }

    return results;
  }

  /**
   * Extract YAML frontmatter if present
   */
  private extractFrontmatter(content: string): {
    metadata: Record<string, unknown>;
    body: string;
  } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { metadata: {}, body: content };
    }

    const frontmatter = match[1];
    const body = content.slice(match[0].length);

    // Simple YAML parsing (key: value pairs)
    const metadata: Record<string, unknown> = {};
    const lines = frontmatter.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();

        // Parse simple types
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (!isNaN(Number(value)) && value !== '') value = Number(value);
        else if (typeof value === 'string') {
          // Remove quotes
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
        }

        metadata[key] = value;
      }
    }

    return { metadata, body };
  }

  /**
   * Extract all code blocks from content
   */
  private extractCodeBlocks(content: string): CodeBlock[] {
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
      });
    }

    return blocks;
  }

  /**
   * Extract title from content
   */
  private extractTitle(content: string, fallback: string): string {
    const h1Match = content.match(/^#\s+(.+)$/m);
    return h1Match ? h1Match[1].trim() : fallback.replace(/\.md$/i, '');
  }

  /**
   * Parse content into sections
   */
  private parseSections(content: string): InstructionSection[] {
    const lines = content.split('\n');
    const sections: InstructionSection[] = [];
    const sectionStack: { section: InstructionSection; level: number }[] = [];

    let currentContent: string[] = [];
    let currentSection: InstructionSection | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Save previous section content
        if (currentSection) {
          currentSection.rawContent = currentContent.join('\n').trim();
          currentSection.items = this.parseItems(currentSection.rawContent);
          currentSection.codeBlocks = this.extractCodeBlocks(currentSection.rawContent);
        }

        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const type = this.determineSectionType(title);

        const newSection: InstructionSection = {
          title,
          type,
          level,
          rawContent: '',
          items: [],
          codeBlocks: [],
          children: [],
        };

        // Handle section hierarchy
        while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
          sectionStack.pop();
        }

        if (sectionStack.length > 0) {
          sectionStack[sectionStack.length - 1].section.children.push(newSection);
        } else {
          sections.push(newSection);
        }

        sectionStack.push({ section: newSection, level });
        currentSection = newSection;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section content
    if (currentSection) {
      currentSection.rawContent = currentContent.join('\n').trim();
      currentSection.items = this.parseItems(currentSection.rawContent);
      currentSection.codeBlocks = this.extractCodeBlocks(currentSection.rawContent);
    }

    return sections;
  }

  /**
   * Determine section type from title
   */
  private determineSectionType(title: string): InstructionSectionType {
    const normalizedTitle = title.toLowerCase().trim();

    // Check exact match first
    if (this.sectionMappings[normalizedTitle]) {
      return this.sectionMappings[normalizedTitle];
    }

    // Check if title contains any mapping key
    for (const [key, type] of Object.entries(this.sectionMappings)) {
      if (normalizedTitle.includes(key)) {
        return type;
      }
    }

    return InstructionSectionType.CUSTOM;
  }

  /**
   * Parse list items from section content
   */
  private parseItems(content: string): InstructionItem[] {
    const items: InstructionItem[] = [];

    // Remove code blocks from content for item parsing
    const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '');
    const cleanLines = contentWithoutCode.split('\n');

    const itemStack: { item: InstructionItem; indent: number }[] = [];

    for (const line of cleanLines) {
      // Match list items: -, *, or numbered
      const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);

      if (listMatch) {
        const indent = listMatch[1].length;
        const text = listMatch[3].trim();

        // Check for priority markers
        let priority: number | undefined;
        const priorityMatch = text.match(/\[P([1-5])\]/i);
        if (priorityMatch) {
          priority = parseInt(priorityMatch[1], 10);
        }

        const item: InstructionItem = {
          text: text.replace(/\[P[1-5]\]/gi, '').trim(),
          priority,
          children: [],
        };

        if (this.options.parseNestedItems && itemStack.length > 0) {
          // Find parent based on indentation
          while (itemStack.length > 0 && itemStack[itemStack.length - 1].indent >= indent) {
            itemStack.pop();
          }

          if (itemStack.length > 0) {
            if (!itemStack[itemStack.length - 1].item.children) {
              itemStack[itemStack.length - 1].item.children = [];
            }
            itemStack[itemStack.length - 1].item.children!.push(item);
          } else {
            items.push(item);
          }
        } else {
          items.push(item);
        }

        itemStack.push({ item, indent });
      }
    }

    return items;
  }

  /**
   * Flatten all items from sections
   */
  private flattenItems(sections: InstructionSection[]): InstructionItem[] {
    const items: InstructionItem[] = [];

    const collectItems = (section: InstructionSection) => {
      items.push(...section.items);
      for (const child of section.children) {
        collectItems(child);
      }
    };

    for (const section of sections) {
      collectItems(section);
    }

    return items;
  }

  /**
   * Get items by section type
   */
  getItemsByType(
    parsed: ParsedInstructions,
    type: InstructionSectionType
  ): InstructionItem[] {
    const items: InstructionItem[] = [];

    const collectFromSection = (section: InstructionSection) => {
      if (section.type === type) {
        items.push(...section.items);
      }
      for (const child of section.children) {
        collectFromSection(child);
      }
    };

    for (const section of parsed.sections) {
      collectFromSection(section);
    }

    return items;
  }

  /**
   * Get all rules from parsed instructions
   */
  getRules(parsed: ParsedInstructions): InstructionItem[] {
    return this.getItemsByType(parsed, InstructionSectionType.RULES);
  }

  /**
   * Get all conventions from parsed instructions
   */
  getConventions(parsed: ParsedInstructions): InstructionItem[] {
    return this.getItemsByType(parsed, InstructionSectionType.CONVENTIONS);
  }

  /**
   * Get all constraints from parsed instructions
   */
  getConstraints(parsed: ParsedInstructions): InstructionItem[] {
    return this.getItemsByType(parsed, InstructionSectionType.CONSTRAINTS);
  }

  /**
   * Convert parsed instructions to a flat string format
   */
  toFlatString(parsed: ParsedInstructions): string {
    const lines: string[] = [];

    lines.push(`# ${parsed.title}`);
    lines.push('');

    for (const section of parsed.sections) {
      this.appendSectionToLines(section, lines);
    }

    return lines.join('\n');
  }

  private appendSectionToLines(section: InstructionSection, lines: string[]): void {
    const prefix = '#'.repeat(section.level);
    lines.push(`${prefix} ${section.title}`);
    lines.push('');

    for (const item of section.items) {
      this.appendItemToLines(item, lines, 0);
    }

    lines.push('');

    for (const child of section.children) {
      this.appendSectionToLines(child, lines);
    }
  }

  private appendItemToLines(item: InstructionItem, lines: string[], indent: number): void {
    const prefix = '  '.repeat(indent);
    const priorityMarker = item.priority ? ` [P${item.priority}]` : '';
    lines.push(`${prefix}- ${item.text}${priorityMarker}`);

    if (item.children) {
      for (const child of item.children) {
        this.appendItemToLines(child, lines, indent + 1);
      }
    }
  }
}

/**
 * Create an instruction parser instance
 */
export function createInstructionParser(
  options?: InstructionParserOptions
): InstructionParser {
  return new InstructionParser(options);
}

/**
 * Parse an instruction file (convenience function)
 */
export function parseInstructionFile(filePath: string): ParsedInstructions {
  const parser = new InstructionParser();
  return parser.parse(filePath);
}

/**
 * Find and parse instruction file in a directory (convenience function)
 */
export function findInstructions(directory: string): ParsedInstructions | null {
  const parser = new InstructionParser();
  return parser.findAndParse(directory);
}
