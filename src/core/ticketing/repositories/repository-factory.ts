import path from 'path';
import type { ITicketFeatureRepository } from '../interfaces/ticket-feature-repository.interface';
import { JsonTicketFeatureRepository } from './json-repository';

export interface TicketFeatureRepositoryFactoryOptions {
  dataDir?: string;
}

export type TicketFeatureRepositoryFactory = (
  options?: TicketFeatureRepositoryFactoryOptions,
) => ITicketFeatureRepository;

export const createDefaultTicketFeatureRepository: TicketFeatureRepositoryFactory = (
  options = {},
) =>
  new JsonTicketFeatureRepository({
    filePath: path.join(
      options.dataDir ?? path.join(process.cwd(), 'data', 'ticket-cycle'),
      'store.json',
    ),
  });
