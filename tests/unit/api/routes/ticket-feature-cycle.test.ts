/**
 * Ticket/Feature Cycle API Tests
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TicketFeatureCycleAPI } from '../../../../src/api/routes/ticket-feature-cycle';
import { WebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';

function makeRequest(
  method: 'GET' | 'POST' | 'PUT',
  requestPath: string,
  body?: unknown,
  query?: Record<string, string>,
): WebRequest {
  return {
    method,
    path: requestPath,
    params: {},
    query: query ?? {},
    body,
    headers: {},
  };
}

function makeTicketPayload() {
  return {
    title: 'Implement ticket cycle API',
    background: 'Need consistent ticket workflow',
    problem: 'Execution and review state is not persisted',
    workDescription: 'Implement lifecycle storage and APIs',
    expectedArtifacts: [
      { name: 'implementation PR', type: 'code', description: 'Code changes for lifecycle APIs' },
    ],
    verification: {
      method: 'automated-tests',
      conditions: ['ticket transitions are valid'],
      checklist: ['run ticket route tests'],
    },
    createdBy: { agentId: 'planner-1', role: 'planner' },
    assignees: [
      { agentId: 'reviewer-1', role: 'reviewer' },
    ],
  };
}

describe('TicketFeatureCycleAPI', () => {
  let tmpDir: string;
  let server: WebServer;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aca-ticket-cycle-'));
    server = new WebServer();
    ServiceRegistry.resetInstance();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    ServiceRegistry.resetInstance();
  });

  it('supports ticket lifecycle completion with feature registration', async () => {
    new TicketFeatureCycleAPI({ server, dataDir: tmpDir, requireMCP: false });

    const created = await server.handleRequest(
      makeRequest('POST', '/api/tickets', makeTicketPayload()),
    );
    expect(created.status).toBe(201);
    const ticket = created.body as { ticketId: string; status: string };
    expect(ticket.status).toBe('created');

    const started = await server.handleRequest(
      makeRequest('PUT', `/api/tickets/${ticket.ticketId}/start`, { agentId: 'executor-1' }),
    );
    expect(started.status).toBe(200);
    expect((started.body as { status: string }).status).toBe('in_progress');

    const reviewing = await server.handleRequest(
      makeRequest('PUT', `/api/tickets/${ticket.ticketId}/status`, { status: 'reviewing' }),
    );
    expect(reviewing.status).toBe(200);

    const artifact = await server.handleRequest(
      makeRequest('POST', `/api/tickets/${ticket.ticketId}/artifacts`, {
        name: 'Usage guide',
        url: 'https://example.com/usage-guide',
        kind: 'guide',
      }),
    );
    expect(artifact.status).toBe(200);

    const issue = await server.handleRequest(
      makeRequest('POST', `/api/tickets/${ticket.ticketId}/issues`, {
        message: 'Minor blocker resolved',
        severity: 'low',
      }),
    );
    expect(issue.status).toBe(200);

    const review = await server.handleRequest(
      makeRequest('POST', `/api/tickets/${ticket.ticketId}/reviews`, {
        reviewerId: 'reviewer-1',
        decision: 'approved',
        comment: 'Looks good',
      }),
    );
    expect(review.status).toBe(200);

    const completed = await server.handleRequest(
      makeRequest('PUT', `/api/tickets/${ticket.ticketId}/complete`, { registerFeature: true }),
    );
    expect(completed.status).toBe(200);
    const completedBody = completed.body as {
      ticket: { status: string; issues: unknown[] };
      feature?: { featureId: string; status: string };
    };
    expect(completedBody.ticket.status).toBe('completed');
    expect(completedBody.ticket.issues).toHaveLength(1);
    expect(completedBody.feature?.featureId).toBeDefined();

    const featureId = completedBody.feature!.featureId;

    const featureDetail = await server.handleRequest(
      makeRequest('GET', `/api/features/${featureId}`),
    );
    expect(featureDetail.status).toBe(200);

    const updatedFeature = await server.handleRequest(
      makeRequest('PUT', `/api/features/${featureId}`, {
        title: 'Implement ticket cycle API v2',
        labels: ['ticketing', 'feature-mgmt'],
        updatedBy: 'feature-manager-agent',
        reason: 'improve discoverability metadata',
      }),
    );
    expect(updatedFeature.status).toBe(200);
    expect((updatedFeature.body as { version: string }).version).toBe('1.0.1');

    const versions = await server.handleRequest(
      makeRequest('GET', `/api/features/${featureId}/versions`),
    );
    expect(versions.status).toBe(200);
    const versionsBody = versions.body as { count: number };
    expect(versionsBody.count).toBeGreaterThanOrEqual(2);

    const labelsGlobal = await server.handleRequest(
      makeRequest('GET', '/api/features/labels'),
    );
    expect(labelsGlobal.status).toBe(200);
    const labelsBody = labelsGlobal.body as { labels: string[] };
    expect(labelsBody.labels).toContain('feature-mgmt');

    const labelsUpdated = await server.handleRequest(
      makeRequest('PUT', `/api/features/${featureId}/labels`, {
        add: ['backend'],
        remove: ['ticketing'],
      }),
    );
    expect(labelsUpdated.status).toBe(200);
    expect((labelsUpdated.body as { labels: string[] }).labels).toContain('backend');
    expect((labelsUpdated.body as { labels: string[] }).labels).not.toContain('ticketing');

    const usageMarked = await server.handleRequest(
      makeRequest('POST', `/api/features/${featureId}/use`, {
        actorId: 'executor-1',
        reason: 'reused in follow-up ticket',
      }),
    );
    expect(usageMarked.status).toBe(200);
    expect((usageMarked.body as { usageCount: number }).usageCount).toBeGreaterThanOrEqual(1);

    const managementSummary = await server.handleRequest(
      makeRequest('GET', '/api/features/management/summary'),
    );
    expect(managementSummary.status).toBe(200);
    expect((managementSummary.body as { totalFeatures: number }).totalFeatures).toBeGreaterThanOrEqual(1);

    const rollback = await server.handleRequest(
      makeRequest('PUT', `/api/features/${featureId}/rollback`, { toVersion: '1.0.0' }),
    );
    expect(rollback.status).toBe(200);
    expect((rollback.body as { version: string }).version).toBe('1.0.2');
    expect((rollback.body as { title: string }).title).toBe('Implement ticket cycle API');

    const featureStatus = await server.handleRequest(
      makeRequest('PUT', `/api/features/${featureId}/status`, { status: 'published' }),
    );
    expect(featureStatus.status).toBe(200);
    expect((featureStatus.body as { status: string }).status).toBe('published');

    const featureReview = await server.handleRequest(
      makeRequest('POST', `/api/features/${featureId}/reviews`, {
        reviewerType: 'agent',
        reviewerId: 'review-bot',
        decision: 'approved',
        comment: 'Reusable and validated',
      }),
    );
    expect(featureReview.status).toBe(200);

    const featureList = await server.handleRequest(
      makeRequest('GET', '/api/features', undefined, { status: 'published' }),
    );
    expect(featureList.status).toBe(200);
    const listBody = featureList.body as { count: number };
    expect(listBody.count).toBeGreaterThanOrEqual(1);
  });

  it('returns 400 for invalid ticket payload', async () => {
    new TicketFeatureCycleAPI({ server, dataDir: tmpDir, requireMCP: false });

    const res = await server.handleRequest(
      makeRequest('POST', '/api/tickets', { title: '' }),
    );

    expect(res.status).toBe(400);
    const body = res.body as { error: string };
    expect(body.error).toMatch(/Required|invalid_type|too_small/i);
  });

  it('enforces MCP gate when starting ticket if MCP is required', async () => {
    new TicketFeatureCycleAPI({ server, dataDir: tmpDir, requireMCP: true });

    const created = await server.handleRequest(
      makeRequest('POST', '/api/tickets', makeTicketPayload()),
    );
    expect(created.status).toBe(201);

    const ticket = created.body as { ticketId: string };
    const started = await server.handleRequest(
      makeRequest('PUT', `/api/tickets/${ticket.ticketId}/start`, { agentId: 'executor-1' }),
    );

    expect(started.status).toBe(400);
    const body = started.body as { error: string };
    expect(body.error).toContain('MCP gate check failed');
  });
});
