# Observability Runbook

Operational procedures for the ACA observability stack (Jaeger, Prometheus, Grafana).

## Quick Start

```bash
# Start observability services
docker compose --profile observability up -d

# Verify services
curl -s http://localhost:9090/-/ready     # Prometheus
curl -s http://localhost:16686/           # Jaeger UI
curl -s http://localhost:3001/api/health  # Grafana

# Start all services (api + web + db + observability)
docker compose --profile full up -d
```

## Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Jaeger UI | http://localhost:16686 | Trace search and visualization |
| Prometheus | http://localhost:9090 | Metrics queries and alerting |
| Grafana | http://localhost:3001 | Dashboards (login: admin / admin) |
| ACA Metrics | http://localhost:9464/metrics | Raw Prometheus metrics endpoint |

## ServiceRegistry Configuration

```typescript
await registry.initialize({
  enableObservability: true,
  observabilityConfig: {
    enableTracing: true,
    enableMetrics: true,
    serviceName: 'aca',
    otlp: {
      endpoint: 'http://localhost:4318/v1/traces',
    },
    prometheus: {
      port: 9464,
      path: '/metrics',
    },
  },
});
```

## Alert Response Procedures

### Low Success Rate

**Alert**: `ACALowSuccessRate` — Task success rate below 95%

**Severity**: Critical

**Steps**:
1. Check Grafana "ACA Overview" dashboard for error trends
2. Search Jaeger for failed traces: Service=aca, Tags=error=true
3. Check application logs: `docker compose logs api --tail 100`
4. Identify failing task types and common error patterns
5. If LLM provider errors: check provider status page
6. If infrastructure errors: check database and network connectivity

### High Latency

**Alert**: `ACAHighLatency` — Task p99 latency exceeds 120s

**Severity**: Warning

**Steps**:
1. Check Grafana latency panel for spike timing
2. Search Jaeger for slow traces: Service=aca, Min Duration=60s
3. Look for common slow spans (LLM calls, file I/O, network)
4. Check if specific LLM models show higher latency
5. Verify database query performance if persistence is enabled
6. Consider scaling or rate limiting if under load

### High LLM Cost

**Alert**: `ACAHighLLMCost` — LLM spend exceeds $10/hr

**Severity**: Warning

**Steps**:
1. Check Grafana "LLM Cost by Model" panel
2. Identify which model is driving costs (expensive models vs high volume)
3. Review recent task submissions for unusual patterns
4. Check for retry loops or repeated LLM calls in traces
5. Consider switching to cheaper models for non-critical tasks
6. Set rate limits if cost is caused by volume

### Error Spike

**Alert**: `ACAErrorSpike` — Error rate exceeds 10 errors/min

**Severity**: Critical

**Steps**:
1. Check Grafana error rate panel for spike start time
2. Search Jaeger: Service=aca, Tags=error=true, Lookback=15m
3. Group errors by type (LLM, database, validation, timeout)
4. Check application logs: `docker compose logs api --since 15m`
5. If database errors: verify database connectivity and health
6. If LLM errors: check provider status and API key validity
7. If validation errors: check for malformed input patterns

## Key Metrics Reference

| Metric | Type | Description |
|--------|------|-------------|
| `aca_task_completed_total` | Counter | Successfully completed tasks |
| `aca_task_failed_total` | Counter | Failed tasks |
| `aca_task_duration_seconds` | Histogram | Task execution duration |
| `aca_llm_cost_total` | Counter | Cumulative LLM API cost (USD) |
| `aca_errors_total` | Counter | Total application errors |
| `aca_agents_active` | Gauge | Currently active agents |
| `aca_spans_exported_total` | Counter | Traces exported to backend |

## Jaeger Trace Search

Common search patterns:

```
# Find failed task traces
Service: aca
Tags: error=true

# Find slow traces
Service: aca
Min Duration: 30s

# Find traces for specific task
Service: aca
Tags: task.id=<task-id>
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No metrics at /metrics | Prometheus exporter not started | Verify `enableMetrics: true` in config |
| No traces in Jaeger | OTLP exporter misconfigured | Check endpoint URL, verify Jaeger OTLP collector is running |
| Grafana shows "No data" | Prometheus not scraping | Check Prometheus targets at :9090/targets |
| Alerts not firing | Rules not loaded | Verify alerts.yml is mounted in Prometheus container |
