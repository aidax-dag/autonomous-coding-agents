/**
 * Model Template
 *
 * Generates Prisma model files.
 *
 * Feature: Team System
 */

import { TaskDocument } from '../../../team-types';
import { GeneratedFile } from '../../development-team';
import { ModelAnalysis } from '../backend-team.types';
import { toPrismaType } from '../utils/type-mapping';

/**
 * Generate Prisma model content
 */
export function generatePrismaModelContent(
  task: TaskDocument,
  analysis: ModelAnalysis
): string {
  const fieldLines = analysis.fields.map((field) => {
    const prismaType = toPrismaType(field.type);
    const optional = field.required ? '' : '?';
    const unique = field.unique ? ' @unique' : '';
    const defaultVal = field.name === 'id' ? ' @id @default(uuid())' : '';
    const dateDefault = field.name.includes('createdAt') ? ' @default(now())' : '';
    const updatedDefault = field.name.includes('updatedAt') ? ' @updatedAt' : '';

    return `  ${field.name} ${prismaType}${optional}${unique}${defaultVal}${dateDefault}${updatedDefault}`;
  });

  const relationLines = analysis.relations.map((relation) => {
    if (relation.type === 'one-to-one') {
      return `  ${relation.target.toLowerCase()} ${relation.target}?`;
    } else if (relation.type === 'one-to-many') {
      return `  ${relation.target.toLowerCase()}s ${relation.target}[]`;
    } else {
      return `  ${relation.target.toLowerCase()}s ${relation.target}[]`;
    }
  });

  return `/// ${task.description}
model ${analysis.entityName} {
${fieldLines.join('\n')}
${relationLines.length > 0 ? '\n  // Relations\n' + relationLines.join('\n') : ''}
}
`;
}

/**
 * Generate model file
 */
export function generateModelFile(
  task: TaskDocument,
  analysis: ModelAnalysis
): GeneratedFile {
  const content = generatePrismaModelContent(task, analysis);

  return {
    path: `prisma/models/${analysis.entityName.toLowerCase()}.prisma`,
    content,
    language: 'prisma',
    linesOfCode: content.split('\n').length,
    isTest: false,
  };
}
