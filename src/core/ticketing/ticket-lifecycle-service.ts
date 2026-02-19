import type { TicketFeatureStore } from './interfaces/ticket-feature-repository.interface';
import type { IIdGenerator } from './id-generator';
import type {
  TicketArtifact,
  TicketCreateInput,
  TicketIssue,
  TicketListFilter,
  TicketRecord,
  TicketReview,
  TicketStatus,
} from './ticket-feature-service';

const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  created: ['in_progress', 'pending', 'cancelled'],
  in_progress: ['pending', 'reviewing', 'cancelled'],
  pending: ['in_progress', 'reviewing', 'cancelled'],
  reviewing: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class TicketLifecycleService {
  constructor(private readonly idGenerator: IIdGenerator) {}

  createTicket(store: TicketFeatureStore, input: TicketCreateInput): TicketRecord {
    const now = new Date().toISOString();

    store.counters.ticket += 1;
    store.counters.management += 1;

    const ticket: TicketRecord = {
      ...input,
      ticketId: this.idGenerator.generateTicketId(store.counters.ticket),
      managementNumber:
        input.managementNumber ?? this.idGenerator.generateManagementNumber(store.counters.management),
      status: 'created',
      createdAt: now,
      updatedAt: now,
      artifacts: [],
      issues: [],
      reviews: [],
    };

    store.tickets.push(ticket);
    return ticket;
  }

  listTickets(store: TicketFeatureStore, filter: TicketListFilter = {}): TicketRecord[] {
    return store.tickets.filter((ticket) => {
      if (filter.status && filter.status.length > 0 && !filter.status.includes(ticket.status)) {
        return false;
      }
      return true;
    });
  }

  getTicket(store: TicketFeatureStore, ticketId: string): TicketRecord {
    return this.mustGetTicket(store, ticketId);
  }

  startTicket(
    store: TicketFeatureStore,
    ticketId: string,
    agentId: string,
  ): { ticket: TicketRecord; oldStatus: TicketStatus } {
    const ticket = this.mustGetTicket(store, ticketId);
    const oldStatus = ticket.status;
    this.assertTransition(ticket.status, 'in_progress');

    const now = new Date().toISOString();
    ticket.status = 'in_progress';
    ticket.startedAt = ticket.startedAt ?? now;
    ticket.updatedAt = now;

    const hasExecutor = ticket.assignees.some((assignee) => assignee.agentId === agentId && assignee.role === 'executor');
    if (!hasExecutor) {
      ticket.assignees.push({ agentId, role: 'executor' });
    }

    return { ticket, oldStatus };
  }

  updateTicketStatus(
    store: TicketFeatureStore,
    ticketId: string,
    status: TicketStatus,
  ): { ticket: TicketRecord; oldStatus: TicketStatus } {
    const ticket = this.mustGetTicket(store, ticketId);
    const oldStatus = ticket.status;
    this.assertTransition(ticket.status, status);

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    if (status === 'cancelled') {
      ticket.endedAt = ticket.updatedAt;
    }

    return { ticket, oldStatus };
  }

  addArtifact(
    store: TicketFeatureStore,
    ticketId: string,
    artifact: TicketArtifact,
  ): TicketRecord {
    const ticket = this.mustGetTicket(store, ticketId);
    ticket.artifacts.push(artifact);
    ticket.updatedAt = new Date().toISOString();
    return ticket;
  }

  addIssue(
    store: TicketFeatureStore,
    ticketId: string,
    issue: TicketIssue,
  ): TicketRecord {
    const ticket = this.mustGetTicket(store, ticketId);
    ticket.issues.push({
      message: issue.message,
      severity: issue.severity,
      createdAt: issue.createdAt ?? new Date().toISOString(),
    });
    ticket.updatedAt = new Date().toISOString();
    return ticket;
  }

  addReview(
    store: TicketFeatureStore,
    ticketId: string,
    review: TicketReview,
  ): TicketRecord {
    const ticket = this.mustGetTicket(store, ticketId);
    const updatedAt = review.updatedAt ?? new Date().toISOString();

    const existingIndex = ticket.reviews.findIndex((record) => record.reviewerId === review.reviewerId);
    const normalized = {
      reviewerId: review.reviewerId,
      decision: review.decision,
      comment: review.comment,
      updatedAt,
    };

    if (existingIndex >= 0) {
      ticket.reviews[existingIndex] = normalized;
    } else {
      ticket.reviews.push(normalized);
    }

    ticket.updatedAt = updatedAt;
    return ticket;
  }

  completeTicket(store: TicketFeatureStore, ticketId: string): { ticket: TicketRecord; oldStatus: TicketStatus } {
    const ticket = this.mustGetTicket(store, ticketId);
    const oldStatus = ticket.status;

    if (ticket.status !== 'reviewing') {
      throw new Error('Ticket can only be completed from reviewing status');
    }

    if (ticket.artifacts.length === 0) {
      throw new Error('At least one artifact is required before completion');
    }

    if (ticket.reviews.length === 0) {
      throw new Error('At least one review is required before completion');
    }

    const hasRejectedReview = ticket.reviews.some((review) => review.decision === 'changes_requested');
    if (hasRejectedReview) {
      throw new Error('Cannot complete ticket while reviews request changes');
    }

    const reviewerAssignees = ticket.assignees.filter((assignee) => assignee.role === 'reviewer');
    if (reviewerAssignees.length > 0) {
      const approvedReviewers = new Set(ticket.reviews.map((review) => review.reviewerId));
      for (const reviewer of reviewerAssignees) {
        if (!approvedReviewers.has(reviewer.agentId)) {
          throw new Error(`Reviewer ${reviewer.agentId} approval is required`);
        }
      }
    }

    const now = new Date().toISOString();
    ticket.status = 'completed';
    ticket.endedAt = now;
    ticket.updatedAt = now;

    return { ticket, oldStatus };
  }

  private mustGetTicket(store: TicketFeatureStore, ticketId: string): TicketRecord {
    const ticket = store.tickets.find((item) => item.ticketId === ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }
    return ticket;
  }

  private assertTransition(from: TicketStatus, to: TicketStatus): void {
    if (!TICKET_TRANSITIONS[from].includes(to)) {
      throw new Error(`Invalid status transition: ${from} -> ${to}`);
    }
  }
}

export function createTicketLifecycleService(idGenerator: IIdGenerator): TicketLifecycleService {
  return new TicketLifecycleService(idGenerator);
}
