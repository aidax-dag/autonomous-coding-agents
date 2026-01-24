/**
 * Backend Team Templates
 *
 * Re-exports all template generators.
 *
 * Feature: Team System
 */

export { generateController, generateGetMethod, generatePostMethod, generatePutMethod, generateDeleteMethod } from './controller.template';
export { generateRoutes } from './routes.template';
export { generateAPITypes } from './api-types.template';
export { generateValidation } from './validation.template';
export { generateOpenAPISpec } from './openapi.template';
export { generateModelFile, generatePrismaModelContent } from './model.template';
export { generateRepository } from './repository.template';
export { generateMigrationFile, generateMigration } from './migration.template';
export { generateSeedFile } from './seed.template';
export { generateMiddlewareFile } from './middleware.template';
export { generateServiceFile, generateServiceInterface } from './service.template';
