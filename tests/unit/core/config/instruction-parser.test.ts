/**
 * Instruction Parser Tests
 *
 * Tests for CLAUDE.md/AGENT.md instruction file parser.
 */

import { join } from 'path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import {
  InstructionParser,
  InstructionSectionType,
  ParsedInstructions,
  INSTRUCTION_FILE_NAMES,
  createInstructionParser,
  parseInstructionFile,
  findInstructions,
} from '@/core/config/instruction-parser';

describe('InstructionParser', () => {
  let parser: InstructionParser;
  const testDir = join(__dirname, '.test-instructions');

  beforeEach(() => {
    parser = new InstructionParser();
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('parseContent', () => {
    it('should parse basic markdown content', () => {
      const content = `# Project Instructions

## Rules

- Always use TypeScript
- Follow ESLint rules

## Guidelines

- Prefer functional programming
- Use meaningful variable names
`;

      const result = parser.parseContent(content, 'CLAUDE.md');

      expect(result.title).toBe('Project Instructions');
      expect(result.fileName).toBe('CLAUDE.md');
      // h1 is the root section, h2 sections are children
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Project Instructions');
      expect(result.sections[0].children).toHaveLength(2);
      expect(result.sections[0].children[0].title).toBe('Rules');
      expect(result.sections[0].children[0].type).toBe(InstructionSectionType.RULES);
      expect(result.sections[0].children[0].items).toHaveLength(2);
      expect(result.sections[0].children[1].title).toBe('Guidelines');
      expect(result.sections[0].children[1].type).toBe(InstructionSectionType.GUIDELINES);
    });

    it('should extract frontmatter metadata', () => {
      const content = `---
version: 1
author: "Test User"
enabled: true
---

# Instructions

## Rules

- Rule 1
`;

      const result = parser.parseContent(content);

      expect(result.metadata).toEqual({
        version: 1,
        author: 'Test User',
        enabled: true,
      });
      expect(result.title).toBe('Instructions');
    });

    it('should extract code blocks', () => {
      const content = `# Instructions

## Examples

Here is an example:

\`\`\`typescript
function example() {
  return 42;
}
\`\`\`

And another:

\`\`\`javascript
const value = 'test';
\`\`\`
`;

      const result = parser.parseContent(content);

      expect(result.codeBlocks).toHaveLength(2);
      expect(result.codeBlocks[0].language).toBe('typescript');
      expect(result.codeBlocks[0].code).toContain('function example()');
      expect(result.codeBlocks[1].language).toBe('javascript');
    });

    it('should parse nested list items', () => {
      const content = `# Instructions

## Rules

- Main rule
  - Sub-rule 1
  - Sub-rule 2
    - Sub-sub-rule
- Another main rule
`;

      const result = parser.parseContent(content);
      // h2 Rules is child of h1 Instructions
      const rulesSection = result.sections[0].children[0];
      const items = rulesSection.items;

      expect(items).toHaveLength(2);
      expect(items[0].text).toBe('Main rule');
      expect(items[0].children).toHaveLength(2);
      expect(items[0].children![0].text).toBe('Sub-rule 1');
      expect(items[0].children![1].children).toHaveLength(1);
      expect(items[0].children![1].children![0].text).toBe('Sub-sub-rule');
    });

    it('should parse priority markers', () => {
      const content = `# Instructions

## Rules

- [P1] Critical rule
- [P3] Medium priority rule
- Regular rule without priority
`;

      const result = parser.parseContent(content);
      const rulesSection = result.sections[0].children[0];
      const items = rulesSection.items;

      expect(items[0].priority).toBe(1);
      expect(items[0].text).toBe('Critical rule');
      expect(items[1].priority).toBe(3);
      expect(items[2].priority).toBeUndefined();
    });

    it('should handle nested sections', () => {
      const content = `# Project

## Section Level 2

Content here

### Subsection Level 3

More content

#### Deep Section Level 4

Deep content
`;

      const result = parser.parseContent(content);

      // h1 "Project" is the root section
      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Project');
      // h2 is child of h1
      expect(result.sections[0].children).toHaveLength(1);
      expect(result.sections[0].children[0].title).toBe('Section Level 2');
      // h3 is child of h2
      expect(result.sections[0].children[0].children).toHaveLength(1);
      expect(result.sections[0].children[0].children[0].title).toBe('Subsection Level 3');
      // h4 is child of h3
      expect(result.sections[0].children[0].children[0].children).toHaveLength(1);
      expect(result.sections[0].children[0].children[0].children[0].title).toBe('Deep Section Level 4');
    });

    it('should flatten all items from all sections', () => {
      const content = `# Instructions

## Rules

- Rule 1
- Rule 2

## Guidelines

- Guideline 1
- Guideline 2
- Guideline 3
`;

      const result = parser.parseContent(content);

      expect(result.allItems).toHaveLength(5);
    });

    it('should use filename as title when no h1', () => {
      const content = `## Just a section

- Item 1
`;

      const result = parser.parseContent(content, 'AGENT.md');

      expect(result.title).toBe('AGENT');
    });
  });

  describe('section type detection', () => {
    const testCases: Array<{ title: string; expectedType: InstructionSectionType }> = [
      { title: 'Rules', expectedType: InstructionSectionType.RULES },
      { title: 'Project Rules', expectedType: InstructionSectionType.RULES },
      { title: 'Requirements', expectedType: InstructionSectionType.RULES },
      { title: 'Conventions', expectedType: InstructionSectionType.CONVENTIONS },
      { title: 'Coding Style', expectedType: InstructionSectionType.CONVENTIONS },
      { title: 'Guidelines', expectedType: InstructionSectionType.GUIDELINES },
      { title: 'Best Practices', expectedType: InstructionSectionType.GUIDELINES },
      { title: 'Constraints', expectedType: InstructionSectionType.CONSTRAINTS },
      { title: 'Limitations', expectedType: InstructionSectionType.CONSTRAINTS },
      { title: 'Preferences', expectedType: InstructionSectionType.PREFERENCES },
      { title: 'Context', expectedType: InstructionSectionType.CONTEXT },
      { title: 'Project Overview', expectedType: InstructionSectionType.CONTEXT },
      { title: 'Examples', expectedType: InstructionSectionType.EXAMPLES },
      { title: 'Usage Examples', expectedType: InstructionSectionType.EXAMPLES },
      { title: 'Random Section', expectedType: InstructionSectionType.CUSTOM },
    ];

    testCases.forEach(({ title, expectedType }) => {
      it(`should detect "${title}" as ${expectedType}`, () => {
        const content = `# Doc\n\n## ${title}\n\n- Item`;
        const result = parser.parseContent(content);
        // h2 section is a child of h1 "Doc"
        expect(result.sections[0].children[0].type).toBe(expectedType);
      });
    });
  });

  describe('custom section mappings', () => {
    it('should use custom section type mappings', () => {
      const customParser = new InstructionParser({
        sectionTypeMappings: {
          'my custom': InstructionSectionType.RULES,
          'special section': InstructionSectionType.CONSTRAINTS,
        },
      });

      const content = `# Doc

## My Custom Section

- Item 1

## Special Section Info

- Item 2
`;

      const result = customParser.parseContent(content);

      // h2 sections are children of h1 "Doc"
      expect(result.sections[0].children[0].type).toBe(InstructionSectionType.RULES);
      expect(result.sections[0].children[1].type).toBe(InstructionSectionType.CONSTRAINTS);
    });
  });

  describe('parse (file)', () => {
    it('should parse a file from disk', () => {
      const filePath = join(testDir, 'CLAUDE.md');
      const content = `# Test

## Rules

- Test rule
`;
      writeFileSync(filePath, content);

      const result = parser.parse(filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.fileName).toBe('CLAUDE.md');
      expect(result.sections).toHaveLength(1);
    });

    it('should throw error for non-existent file', () => {
      expect(() => parser.parse('/non/existent/file.md')).toThrow(
        'Instruction file not found'
      );
    });
  });

  describe('findAndParse', () => {
    it('should find CLAUDE.md in directory', () => {
      const filePath = join(testDir, 'CLAUDE.md');
      writeFileSync(filePath, '# Instructions\n\n## Rules\n\n- Rule');

      const result = parser.findAndParse(testDir);

      expect(result).not.toBeNull();
      expect(result!.fileName).toBe('CLAUDE.md');
    });

    it('should find AGENT.md when CLAUDE.md not present', () => {
      const filePath = join(testDir, 'AGENT.md');
      writeFileSync(filePath, '# Agent\n\n## Rules\n\n- Rule');

      const result = parser.findAndParse(testDir);

      expect(result).not.toBeNull();
      expect(result!.fileName).toBe('AGENT.md');
    });

    it('should find INSTRUCTIONS.md when others not present', () => {
      const filePath = join(testDir, 'INSTRUCTIONS.md');
      writeFileSync(filePath, '# Instr\n\n## Rules\n\n- Rule');

      const result = parser.findAndParse(testDir);

      expect(result).not.toBeNull();
      expect(result!.fileName).toBe('INSTRUCTIONS.md');
    });

    it('should find .claude/instructions.md', () => {
      const claudeDir = join(testDir, '.claude');
      mkdirSync(claudeDir, { recursive: true });
      const filePath = join(claudeDir, 'instructions.md');
      writeFileSync(filePath, '# Instr\n\n## Rules\n\n- Rule');

      const result = parser.findAndParse(testDir);

      expect(result).not.toBeNull();
      expect(result!.fileName).toBe('instructions.md');
    });

    it('should return null when no instruction file found', () => {
      const result = parser.findAndParse(testDir);

      expect(result).toBeNull();
    });

    it('should prefer CLAUDE.md over AGENT.md', () => {
      writeFileSync(join(testDir, 'CLAUDE.md'), '# Claude');
      writeFileSync(join(testDir, 'AGENT.md'), '# Agent');

      const result = parser.findAndParse(testDir);

      expect(result!.title).toBe('Claude');
    });
  });

  describe('findAll', () => {
    it('should find instruction files in parent directories', () => {
      const subDir = join(testDir, 'sub', 'deep');
      mkdirSync(subDir, { recursive: true });

      writeFileSync(join(testDir, 'CLAUDE.md'), '# Root');
      writeFileSync(join(testDir, 'sub', 'AGENT.md'), '# Sub');

      const results = parser.findAll(subDir);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.title)).toContain('Root');
      expect(results.map((r) => r.title)).toContain('Sub');
    });

    it('should respect maxDepth', () => {
      const subDir = join(testDir, 'a', 'b', 'c', 'd');
      mkdirSync(subDir, { recursive: true });

      writeFileSync(join(testDir, 'CLAUDE.md'), '# Root');
      writeFileSync(join(testDir, 'a', 'b', 'AGENT.md'), '# Deep');

      const results = parser.findAll(subDir, 2);

      // With maxDepth 2, should find at most 2 levels up
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('helper methods', () => {
    const content = `# Project

## Rules

- Rule 1
- Rule 2

## Conventions

- Convention 1

## Constraints

- Constraint 1
- Constraint 2
- Constraint 3

## Examples

- Example 1
`;

    let parsed: ParsedInstructions;

    beforeEach(() => {
      parsed = parser.parseContent(content);
    });

    it('should get rules', () => {
      const rules = parser.getRules(parsed);
      expect(rules).toHaveLength(2);
      expect(rules[0].text).toBe('Rule 1');
    });

    it('should get conventions', () => {
      const conventions = parser.getConventions(parsed);
      expect(conventions).toHaveLength(1);
      expect(conventions[0].text).toBe('Convention 1');
    });

    it('should get constraints', () => {
      const constraints = parser.getConstraints(parsed);
      expect(constraints).toHaveLength(3);
    });
  });

  describe('toFlatString', () => {
    it('should convert parsed instructions back to markdown', () => {
      const content = `# Project

## Rules

- Rule 1
- Rule 2

## Guidelines

- Guideline 1
`;

      const parsed = parser.parseContent(content);
      const flatString = parser.toFlatString(parsed);

      expect(flatString).toContain('# Project');
      expect(flatString).toContain('## Rules');
      expect(flatString).toContain('- Rule 1');
      expect(flatString).toContain('- Rule 2');
      expect(flatString).toContain('## Guidelines');
      expect(flatString).toContain('- Guideline 1');
    });

    it('should include priority markers in output', () => {
      const content = `# Doc

## Rules

- [P1] High priority rule
`;

      const parsed = parser.parseContent(content);
      const flatString = parser.toFlatString(parsed);

      expect(flatString).toContain('[P1]');
    });
  });

  describe('options', () => {
    it('should not include raw content when disabled', () => {
      const customParser = new InstructionParser({
        includeRawContent: false,
      });

      const content = '# Test\n\n## Rules\n\n- Rule';
      const result = customParser.parseContent(content);

      expect(result.rawContent).toBe('');
    });

    it('should not extract code blocks when disabled', () => {
      const customParser = new InstructionParser({
        extractCodeBlocks: false,
      });

      const content = '# Test\n\n```js\ncode\n```';
      const result = customParser.parseContent(content);

      expect(result.codeBlocks).toHaveLength(0);
    });

    it('should not parse nested items when disabled', () => {
      const customParser = new InstructionParser({
        parseNestedItems: false,
      });

      const content = `# Test

## Rules

- Parent
  - Child
`;

      const result = customParser.parseContent(content);
      // h2 Rules is child of h1 Test
      const rulesSection = result.sections[0].children[0];
      const items = rulesSection.items;

      // All items should be at root level
      expect(items).toHaveLength(2);
      expect(items[0].children).toHaveLength(0);
    });
  });

  describe('INSTRUCTION_FILE_NAMES constant', () => {
    it('should include expected file names', () => {
      expect(INSTRUCTION_FILE_NAMES).toContain('CLAUDE.md');
      expect(INSTRUCTION_FILE_NAMES).toContain('AGENT.md');
      expect(INSTRUCTION_FILE_NAMES).toContain('INSTRUCTIONS.md');
      expect(INSTRUCTION_FILE_NAMES).toContain('.claude/instructions.md');
      expect(INSTRUCTION_FILE_NAMES).toContain('.agent/instructions.md');
    });
  });

  describe('convenience functions', () => {
    it('createInstructionParser should create parser instance', () => {
      const instance = createInstructionParser();
      expect(instance).toBeInstanceOf(InstructionParser);
    });

    it('createInstructionParser should accept options', () => {
      const instance = createInstructionParser({ includeRawContent: false });
      const result = instance.parseContent('# Test');
      expect(result.rawContent).toBe('');
    });

    it('parseInstructionFile should parse file', () => {
      const filePath = join(testDir, 'CLAUDE.md');
      writeFileSync(filePath, '# Test\n\n## Rules\n\n- Rule');

      const result = parseInstructionFile(filePath);

      expect(result.title).toBe('Test');
    });

    it('findInstructions should find and parse', () => {
      const filePath = join(testDir, 'CLAUDE.md');
      writeFileSync(filePath, '# Test\n\n## Rules\n\n- Rule');

      const result = findInstructions(testDir);

      expect(result).not.toBeNull();
      expect(result!.title).toBe('Test');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = parser.parseContent('');
      expect(result.sections).toHaveLength(0);
      expect(result.allItems).toHaveLength(0);
    });

    it('should handle content with only frontmatter', () => {
      const content = `---
version: 1
---
`;
      const result = parser.parseContent(content);
      expect(result.metadata).toEqual({ version: 1 });
      expect(result.sections).toHaveLength(0);
    });

    it('should handle numbered lists', () => {
      const content = `# Doc

## Rules

1. First rule
2. Second rule
3. Third rule
`;

      const result = parser.parseContent(content);
      // h2 Rules is child of h1 Doc
      const rulesSection = result.sections[0].children[0];
      const items = rulesSection.items;

      expect(items).toHaveLength(3);
      expect(items[0].text).toBe('First rule');
      expect(items[2].text).toBe('Third rule');
    });

    it('should handle mixed list styles', () => {
      const content = `# Doc

## Rules

- Dash item
* Star item
1. Numbered item
`;

      const result = parser.parseContent(content);
      // h2 Rules is child of h1 Doc
      const rulesSection = result.sections[0].children[0];
      const items = rulesSection.items;

      expect(items).toHaveLength(3);
    });

    it('should handle code blocks in sections', () => {
      const content = `# Doc

## Examples

Example code:

\`\`\`typescript
const x = 1;
\`\`\`

- List item after code
`;

      const result = parser.parseContent(content);
      // h2 Examples is child of h1 Doc
      const examplesSection = result.sections[0].children[0];

      expect(examplesSection.codeBlocks).toHaveLength(1);
      expect(examplesSection.items).toHaveLength(1);
      expect(examplesSection.items[0].text).toBe('List item after code');
    });

    it('should handle special characters in titles', () => {
      const content = `# Project: Test-123 (Beta)

## Rules & Guidelines

- Item
`;

      const result = parser.parseContent(content);

      expect(result.title).toBe('Project: Test-123 (Beta)');
      // h2 is child of h1
      expect(result.sections[0].children[0].title).toBe('Rules & Guidelines');
    });

    it('should handle frontmatter with quoted strings', () => {
      const content = `---
name: "Project Name"
description: 'Single quoted'
---

# Doc
`;

      const result = parser.parseContent(content);

      expect(result.metadata.name).toBe('Project Name');
      expect(result.metadata.description).toBe('Single quoted');
    });

    it('should parse timestamp', () => {
      const before = new Date();
      const result = parser.parseContent('# Test');
      const after = new Date();

      expect(result.parsedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.parsedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
