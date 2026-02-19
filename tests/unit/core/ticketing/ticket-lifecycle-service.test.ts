import { createIdGenerator } from '../../../../src/core/ticketing/id-generator';
import {
  createTicketLifecycleService,
  TicketLifecycleService,
} from '../../../../src/core/ticketing/ticket-lifecycle-service';
import type {
  TicketCreateInput,
  TicketRecord,
} from '../../../../src/core/ticketing/ticket-feature-service';
import type { TicketFeatureStore } from '../../../../src/core/ticketing/interfaces/ticket-feature-repository.interface';

function makeStore(overrides: Partial<TicketFeatureStore> = {}): TicketFeatureStore {
  return {
    version: 1,
    counters: { ticket: 0, feature: 0, management: 0 },
    tickets: [],
    features: [],
    ...overrides,
  };
}

function makeTicketInput(overrides: Partial<TicketCreateInput> = {}): TicketCreateInput {
  return {
    title: 'Implement feature',
    background: 'Background',
    problem: 'Problem',
    workDescription: 'Do work',
    expectedArtifacts: [{ name: 'code', type: 'source', description: 'implementation' }],
    verification: {
      method: 'manual',
      conditions: ['works'],
      checklist: ['checked'],
    },
    createdBy: { agentId: 'planner-1', role: 'planner' },
    assignees: [],
    ...overrides,
  };
}

function makeTicketRecord(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    ticketId: 'ticket-2026-000001',
    managementNumber: 'ACA-2026-00001',
    title: 'Implement feature',
    background: 'Background',
    problem: 'Problem',
    workDescription: 'Do work',
    expectedArtifacts: [{ name: 'code', type: 'source', description: 'implementation' }],
    verification: {
      method: 'manual',
      conditions: ['works'],
      checklist: ['checked'],
    },
    createdBy: { agentId: 'planner-1', role: 'planner' },
    assignees: [],
    status: 'created',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    artifacts: [],
    issues: [],
    reviews: [],
    ...overrides,
  };
}

describe('TicketLifecycleService', () => {
  let service: TicketLifecycleService;

  beforeEach(() => {
    service = createTicketLifecycleService(createIdGenerator());
  });

  it('creates a ticket and increments counters', () => {
    const store = makeStore();
    const ticket = service.createTicket(store, makeTicketInput());

    expect(ticket.ticketId).toMatch(/^ticket-\d{4}-\d{6}$/);
    expect(ticket.managementNumber).toMatch(/^ACA-\d{4}-\d{5}$/);
    expect(ticket.status).toBe('created');
    expect(store.counters.ticket).toBe(1);
    expect(store.counters.management).toBe(1);
    expect(store.tickets).toHaveLength(1);
  });

  it('starts a ticket and appends executor assignee', () => {
    const ticket = makeTicketRecord();
    const store = makeStore({ tickets: [ticket] });

    const first = service.startTicket(store, ticket.ticketId, 'executor-1');

    expect(first.oldStatus).toBe('created');
    expect(first.ticket.status).toBe('in_progress');
    expect(first.ticket.assignees.filter((entry) => entry.agentId === 'executor-1')).toHaveLength(1);
  });

  it('throws on invalid status transition', () => {
    const ticket = makeTicketRecord({ status: 'created' });
    const store = makeStore({ tickets: [ticket] });

    expect(() => service.updateTicketStatus(store, ticket.ticketId, 'completed')).toThrow(
      'Invalid status transition: created -> completed',
    );
  });

  it('completes a reviewing ticket with required checks', () => {
    const ticket = makeTicketRecord({
      status: 'reviewing',
      artifacts: [{ name: 'artifact', url: 'https://example.com/a', kind: 'guide' }],
      reviews: [{
        reviewerId: 'reviewer-1',
        decision: 'approved',
        comment: 'ok',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      assignees: [{ agentId: 'reviewer-1', role: 'reviewer' }],
    });
    const store = makeStore({ tickets: [ticket] });

    const result = service.completeTicket(store, ticket.ticketId);

    expect(result.oldStatus).toBe('reviewing');
    expect(result.ticket.status).toBe('completed');
    expect(result.ticket.endedAt).toBeDefined();
  });

  it('throws when completing ticket without required reviewer approval', () => {
    const ticket = makeTicketRecord({
      status: 'reviewing',
      artifacts: [{ name: 'artifact', url: 'https://example.com/a', kind: 'guide' }],
      reviews: [{
        reviewerId: 'reviewer-1',
        decision: 'approved',
        comment: 'ok',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
      assignees: [{ agentId: 'reviewer-2', role: 'reviewer' }],
    });
    const store = makeStore({ tickets: [ticket] });

    expect(() => service.completeTicket(store, ticket.ticketId)).toThrow(
      'Reviewer reviewer-2 approval is required',
    );
  });
});
