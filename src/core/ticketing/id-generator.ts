import {
  FEATURE_ID_COUNTER_WIDTH,
  FEATURE_MGT_NUMBER_WIDTH,
  TICKET_ID_COUNTER_WIDTH,
  TICKET_MGT_NUMBER_WIDTH,
} from './constants';

export interface IIdGenerator {
  generateTicketId(counter: number): string;
  generateFeatureId(counter: number): string;
  generateFeatureManagementNumber(counter: number): string;
  generateManagementNumber(counter: number): string;
}

export class IdGenerator implements IIdGenerator {
  generateTicketId(counter: number): string {
    return `ticket-${new Date().getFullYear()}-${String(counter).padStart(TICKET_ID_COUNTER_WIDTH, '0')}`;
  }

  generateFeatureId(counter: number): string {
    return `feature-${new Date().getFullYear()}-${String(counter).padStart(FEATURE_ID_COUNTER_WIDTH, '0')}`;
  }

  generateFeatureManagementNumber(counter: number): string {
    return `FEAT-${new Date().getFullYear()}-${String(counter).padStart(FEATURE_MGT_NUMBER_WIDTH, '0')}`;
  }

  generateManagementNumber(counter: number): string {
    return `ACA-${new Date().getFullYear()}-${String(counter).padStart(TICKET_MGT_NUMBER_WIDTH, '0')}`;
  }
}

export function createIdGenerator(): IdGenerator {
  return new IdGenerator();
}
