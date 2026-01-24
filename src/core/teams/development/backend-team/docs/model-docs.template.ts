/**
 * Model Documentation Template
 *
 * Generates markdown documentation for database models.
 *
 * Feature: Team System
 */

import { TaskDocument } from '../../../team-types';
import { ModelAnalysis } from '../backend-team.types';

/**
 * Generate model documentation
 */
export function generateModelDocumentation(
  task: TaskDocument,
  analysis: ModelAnalysis
): string {
  return `# ${analysis.entityName} Model

## Description
${task.description}

## Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
${analysis.fields.map((f) => `| ${f.name} | ${f.type} | ${f.required ? 'Yes' : 'No'} | |`).join('\n')}

## Relations

${analysis.relations.length > 0
  ? analysis.relations.map((r) => `- ${r.type}: ${r.target}`).join('\n')
  : 'No relations defined'}

## Usage

\`\`\`typescript
import { prisma } from './prisma';

// Create
const ${analysis.entityName.toLowerCase()} = await prisma.${analysis.entityName.toLowerCase()}.create({
  data: { /* ... */ },
});

// Find
const found = await prisma.${analysis.entityName.toLowerCase()}.findUnique({
  where: { id: 'some-id' },
});
\`\`\`
`;
}
