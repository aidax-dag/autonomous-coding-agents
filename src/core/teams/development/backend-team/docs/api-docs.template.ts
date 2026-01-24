/**
 * API Documentation Template
 *
 * Generates markdown documentation for APIs.
 *
 * Feature: Team System
 */

import { TaskDocument } from '../../../team-types';
import { APIAnalysis } from '../backend-team.types';
import { toResourceName } from '../utils/naming.utils';

/**
 * Generate API documentation
 */
export function generateAPIDocumentation(
  task: TaskDocument,
  analysis: APIAnalysis
): string {
  const resourceName = toResourceName(task.title);

  return `# ${task.title} API

## Description
${task.description}

## Base URL
\`/api/v1/${resourceName}s\`

## Authentication
${analysis.requiresAuth ? 'Required - Bearer token in Authorization header' : 'Not required'}

## Endpoints

${analysis.httpMethods.includes('GET') ? `
### List ${resourceName}s
\`\`\`
GET /${resourceName}s
\`\`\`

Query Parameters:
- \`page\` (number) - Page number (default: 1)
- \`limit\` (number) - Items per page (default: 20)

### Get ${resourceName} by ID
\`\`\`
GET /${resourceName}s/:id
\`\`\`
` : ''}

${analysis.httpMethods.includes('POST') ? `
### Create ${resourceName}
\`\`\`
POST /${resourceName}s
\`\`\`

Request Body:
\`\`\`json
{
  "name": "string"
}
\`\`\`
` : ''}

${analysis.httpMethods.includes('PUT') ? `
### Update ${resourceName}
\`\`\`
PUT /${resourceName}s/:id
\`\`\`

Request Body:
\`\`\`json
{
  "name": "string"
}
\`\`\`
` : ''}

${analysis.httpMethods.includes('DELETE') ? `
### Delete ${resourceName}
\`\`\`
DELETE /${resourceName}s/:id
\`\`\`
` : ''}

## Error Responses

- \`400\` - Bad Request
- \`401\` - Unauthorized
- \`404\` - Not Found
- \`500\` - Internal Server Error
`;
}
