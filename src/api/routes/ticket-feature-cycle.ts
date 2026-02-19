import type { IWebServer, WebRequest, WebResponse } from '@/ui/web/interfaces/web.interface';
import {
  createTicketFeatureService,
  type TicketFeatureService,
  type TicketFeatureServiceOptions,
  type TicketStatus,
  type FeatureRecord,
  type TicketCreateInput,
  type TicketArtifact,
  type TicketIssue,
  type TicketReview,
  type FeatureCreateInput,
  type FeatureReview,
  type FeatureUpdateMeta,
  type FeatureUsageInput,
} from '@/core/ticketing';

export interface TicketFeatureCycleAPIOptions extends TicketFeatureServiceOptions {
  server: IWebServer;
}

export class TicketFeatureCycleAPI {
  private readonly server: IWebServer;
  private readonly service: TicketFeatureService;

  constructor(options: TicketFeatureCycleAPIOptions) {
    const { server, ...serviceOptions } = options;
    this.server = server;
    this.service = createTicketFeatureService(serviceOptions);
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.server.addRoute('POST', '/api/tickets', this.handleCreateTicket.bind(this));
    this.server.addRoute('GET', '/api/tickets', this.handleListTickets.bind(this));
    this.server.addRoute('GET', '/api/tickets/:ticketId', this.handleGetTicket.bind(this));
    this.server.addRoute('PUT', '/api/tickets/:ticketId/start', this.handleStartTicket.bind(this));
    this.server.addRoute('PUT', '/api/tickets/:ticketId/status', this.handleUpdateTicketStatus.bind(this));
    this.server.addRoute('POST', '/api/tickets/:ticketId/artifacts', this.handleAddTicketArtifact.bind(this));
    this.server.addRoute('POST', '/api/tickets/:ticketId/issues', this.handleAddTicketIssue.bind(this));
    this.server.addRoute('POST', '/api/tickets/:ticketId/reviews', this.handleAddTicketReview.bind(this));
    this.server.addRoute('PUT', '/api/tickets/:ticketId/complete', this.handleCompleteTicket.bind(this));
    this.server.addRoute('POST', '/api/tickets/:ticketId/register-feature', this.handleRegisterFeatureFromTicket.bind(this));

    this.server.addRoute('POST', '/api/features', this.handleCreateFeature.bind(this));
    this.server.addRoute('GET', '/api/features', this.handleListFeatures.bind(this));
    this.server.addRoute('GET', '/api/features/labels', this.handleListFeatureLabels.bind(this));
    this.server.addRoute('GET', '/api/features/management/summary', this.handleFeatureManagementSummary.bind(this));
    this.server.addRoute('GET', '/api/features/:featureId', this.handleGetFeature.bind(this));
    this.server.addRoute('GET', '/api/features/:featureId/versions', this.handleListFeatureVersions.bind(this));
    this.server.addRoute('PUT', '/api/features/:featureId', this.handleUpdateFeature.bind(this));
    this.server.addRoute('PUT', '/api/features/:featureId/labels', this.handleUpdateFeatureLabels.bind(this));
    this.server.addRoute('POST', '/api/features/:featureId/use', this.handleMarkFeatureUsed.bind(this));
    this.server.addRoute('PUT', '/api/features/:featureId/rollback', this.handleRollbackFeature.bind(this));
    this.server.addRoute('PUT', '/api/features/:featureId/status', this.handleUpdateFeatureStatus.bind(this));
    this.server.addRoute('POST', '/api/features/:featureId/reviews', this.handleAddFeatureReview.bind(this));
  }

  private async handleCreateTicket(req: WebRequest): Promise<WebResponse> {
    try {
      const ticket = await this.service.createTicket(this.expectBody(req) as TicketCreateInput);
      return { status: 201, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleListTickets(req: WebRequest): Promise<WebResponse> {
    try {
      const status = parseStatusFilter(req.query.status);
      const tickets = await this.service.listTickets({ status });
      return { status: 200, body: { count: tickets.length, tickets } };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleGetTicket(req: WebRequest): Promise<WebResponse> {
    try {
      const ticket = await this.service.getTicket(req.params.ticketId);
      return { status: 200, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleStartTicket(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req) as { agentId?: string };
      const ticket = await this.service.startTicket(req.params.ticketId, body.agentId ?? 'executor-agent');
      return { status: 200, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleUpdateTicketStatus(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req) as { status?: TicketStatus };
      if (!body.status) {
        return { status: 400, body: { error: 'status is required' } };
      }
      const ticket = await this.service.updateTicketStatus(req.params.ticketId, body.status);
      return { status: 200, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleAddTicketArtifact(req: WebRequest): Promise<WebResponse> {
    try {
      const ticket = await this.service.addArtifact(req.params.ticketId, this.expectBody(req) as TicketArtifact);
      return { status: 200, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleAddTicketIssue(req: WebRequest): Promise<WebResponse> {
    try {
      const ticket = await this.service.addIssue(req.params.ticketId, this.expectBody(req) as TicketIssue);
      return { status: 200, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleAddTicketReview(req: WebRequest): Promise<WebResponse> {
    try {
      const ticket = await this.service.addReview(req.params.ticketId, this.expectBody(req) as TicketReview);
      return { status: 200, body: ticket };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleCompleteTicket(req: WebRequest): Promise<WebResponse> {
    try {
      const body = (this.expectBody(req) as {
        registerFeature?: boolean;
        feature?: Partial<FeatureCreateInput>;
      }) ?? {};
      const result = await this.service.completeTicket(req.params.ticketId, {
        registerFeature: body.registerFeature,
        feature: body.feature,
      });
      return { status: 200, body: result };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleRegisterFeatureFromTicket(req: WebRequest): Promise<WebResponse> {
    try {
      const feature = await this.service.registerFeatureFromTicket(
        req.params.ticketId,
        (this.expectBody(req) as Partial<FeatureCreateInput>) ?? {},
      );
      return { status: 201, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleCreateFeature(req: WebRequest): Promise<WebResponse> {
    try {
      const feature = await this.service.createFeature(this.expectBody(req) as FeatureCreateInput);
      return { status: 201, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleListFeatures(req: WebRequest): Promise<WebResponse> {
    try {
      const features = await this.service.listFeatures({
        status: parseFeatureStatusFilter(req.query.status),
        ...(req.query.label ? { label: req.query.label } : {}),
        ...(req.query.language ? { language: req.query.language } : {}),
        ...(req.query.domain ? { domain: req.query.domain } : {}),
      });
      return { status: 200, body: { count: features.length, features } };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleGetFeature(req: WebRequest): Promise<WebResponse> {
    try {
      const feature = await this.service.getFeature(req.params.featureId);
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleListFeatureLabels(_req: WebRequest): Promise<WebResponse> {
    try {
      const labels = await this.service.listFeatureLabels();
      return { status: 200, body: { count: labels.length, labels } };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleFeatureManagementSummary(_req: WebRequest): Promise<WebResponse> {
    try {
      const summary = await this.service.getFeatureManagementSummary();
      return { status: 200, body: summary };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleListFeatureVersions(req: WebRequest): Promise<WebResponse> {
    try {
      const versions = await this.service.listFeatureVersions(req.params.featureId);
      return { status: 200, body: { count: versions.length, versions } };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleUpdateFeature(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req);
      const {
        updatedBy,
        reason,
        ...patch
      } = body as Record<string, unknown>;
      const meta: FeatureUpdateMeta = {
        ...(typeof updatedBy === 'string' && updatedBy.trim().length > 0 ? { updatedBy } : {}),
        ...(typeof reason === 'string' && reason.trim().length > 0 ? { reason } : {}),
      };

      const feature = await this.service.updateFeature(
        req.params.featureId,
        patch as Partial<FeatureCreateInput>,
        meta,
      );
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleUpdateFeatureLabels(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req) as { add?: string[]; remove?: string[] };
      const feature = await this.service.updateFeatureLabels(req.params.featureId, {
        add: body.add,
        remove: body.remove,
      });
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleMarkFeatureUsed(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req) as { actorId?: string; reason?: string };
      const feature = await this.service.markFeatureUsed(req.params.featureId, body as FeatureUsageInput);
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleRollbackFeature(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req) as {
        toVersion?: string;
        nextVersion?: string;
        updatedBy?: string;
        reason?: string;
      };
      if (!body.toVersion) {
        return { status: 400, body: { error: 'toVersion is required' } };
      }
      const feature = await this.service.rollbackFeatureVersion(req.params.featureId, {
        toVersion: body.toVersion,
        nextVersion: body.nextVersion,
        updatedBy: body.updatedBy,
        reason: body.reason,
      });
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleUpdateFeatureStatus(req: WebRequest): Promise<WebResponse> {
    try {
      const body = this.expectBody(req) as { status?: FeatureRecord['status'] };
      if (!body.status) {
        return { status: 400, body: { error: 'status is required' } };
      }
      const feature = await this.service.setFeatureStatus(req.params.featureId, body.status);
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private async handleAddFeatureReview(req: WebRequest): Promise<WebResponse> {
    try {
      const feature = await this.service.addFeatureReview(req.params.featureId, this.expectBody(req) as FeatureReview);
      return { status: 200, body: feature };
    } catch (error) {
      return this.toErrorResponse(error);
    }
  }

  private expectBody(req: WebRequest): Record<string, unknown> {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      throw new Error('Request body must be a JSON object');
    }
    return req.body as Record<string, unknown>;
  }

  private toErrorResponse(error: unknown): WebResponse {
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return { status: 404, body: { error: error.message } };
      }
      return { status: 400, body: { error: error.message } };
    }
    return { status: 500, body: { error: 'Unexpected error' } };
  }
}

function parseStatusFilter(raw: string | undefined): TicketStatus[] | undefined {
  if (!raw) {
    return undefined;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as TicketStatus[];
}

function parseFeatureStatusFilter(raw: string | undefined): Array<FeatureRecord['status']> | undefined {
  if (!raw) {
    return undefined;
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as Array<FeatureRecord['status']>;
}

export function createTicketFeatureCycleAPI(
  options: TicketFeatureCycleAPIOptions,
): TicketFeatureCycleAPI {
  return new TicketFeatureCycleAPI(options);
}
