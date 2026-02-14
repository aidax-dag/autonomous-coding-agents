# ACA Observability Guide

This guide covers how to run, configure, and operate the ACA observability stack:
distributed tracing (Jaeger), metrics collection (Prometheus), and dashboards (Grafana).

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Service Reference](#service-reference)
4. [Enabling Observability in ACA](#enabling-observability-in-aca)
5. [Key Metrics Reference](#key-metrics-reference)
6. [Alert Reference](#alert-reference)
7. [Grafana Dashboard Guide](#grafana-dashboard-guide)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

Start the full observability stack alongside the ACA API:

```bash
docker compose --profile observability up -d
```

This starts Jaeger, Prometheus, and Grafana in addition to the core ACA services.
To include the database as well:

```bash
docker compose --profile full up -d
```

Verify all services are running:

```bash
docker compose --profile observability ps
```

Expected healthy containers:

| Container        | Port  | Status   |
|-----------------|-------|----------|
| aca-api          | 3000  | healthy  |
| aca-jaeger       | 16686 | running  |
| aca-prometheus   | 9090  | running  |
| aca-grafana      | 3001  | running  |

---

## Architecture Overview

```
ACA Application
  |
  |-- OTelProvider (in-memory traces + metrics)
  |     |
  |     |-- OTLP Exporter -----> Jaeger (:4318 OTLP HTTP, :16686 UI)
  |     |
  |     |-- Prometheus Exporter --> /metrics endpoint (:9464)
  |                                     |
  |                              Prometheus (:9090) <-- scrapes every 10s
  |                                     |
  |                              Grafana (:3001) <-- queries Prometheus
  |                                                   queries Jaeger
```

**Data flow:**

1. The ACA application records traces and metrics via the `OTelProvider`.
2. Completed spans are exported to Jaeger through the OTLP HTTP exporter.
3. Metrics are exposed in Prometheus exposition format at `:9464/metrics`.
4. Prometheus scrapes the metrics endpoint every 10 seconds.
5. Grafana queries both Prometheus and Jaeger to render dashboards and traces.

---

## Service Reference

### Jaeger -- Distributed Tracing

- **Purpose**: Collects, stores, and visualizes distributed traces. Each task
  execution generates a trace with spans for individual phases (planning, coding,
  review, etc.).
- **UI**: [http://localhost:16686](http://localhost:16686)
- **OTLP receiver**: `http://localhost:4318/v1/traces`
- **Docker image**: `jaegertracing/all-in-one:1.55`

**What to look for:**
- Search by service name `aca-runner` to find ACA traces.
- Each trace shows the full lifecycle of a task execution.
- Span attributes include `task.id`, `task.team`, and error details.
- Use the comparison view to contrast slow vs. fast task executions.

### Prometheus -- Metrics Collection

- **Purpose**: Scrapes, stores, and queries time-series metrics. Powers alerting
  rules for SLI violations.
- **UI**: [http://localhost:9090](http://localhost:9090)
- **Scrape target**: `aca-api:9464/metrics` (every 10 seconds)
- **Docker image**: `prom/prometheus:v2.50.0`

**What to look for:**
- Navigate to Status > Targets to verify the `aca-api` target is `UP`.
- Navigate to Alerts to see the status of all configured alert rules.
- Use the expression browser to run ad-hoc PromQL queries.

### Grafana -- Dashboards & Visualization

- **Purpose**: Provides pre-built dashboards for the ACA platform and unified
  access to both Prometheus metrics and Jaeger traces.
- **UI**: [http://localhost:3001](http://localhost:3001)
- **Default credentials**: `admin` / `admin` (or the `GRAFANA_PASSWORD` env var)
- **Docker image**: `grafana/grafana:10.3.1`

**Pre-provisioned resources:**
- Datasource: `Prometheus` (default, pointing to `http://prometheus:9090`)
- Datasource: `Jaeger` (pointing to `http://jaeger:16686`)
- Dashboard: `ACA Overview` (folder: ACA)

---

## Enabling Observability in ACA

### Option 1: Environment Variable

```bash
export ENABLE_TELEMETRY=true
```

### Option 2: Programmatic Configuration

```typescript
import { createOrchestratorRunner } from './src/core/orchestrator/orchestrator-runner';

const runner = createOrchestratorRunner({
  llmClient: myClient,
  workspaceDir: '/workspace',
  enableTelemetry: true,   // Enables OTelProvider
});
```

### Option 3: Full Observability Stack

For production deployments that need OTLP export and Prometheus scraping:

```typescript
import { createOTelProvider } from './src/shared/telemetry/otel-provider';
import { createObservabilityStack } from './src/shared/telemetry/observability-stack';

const provider = createOTelProvider({
  enabled: true,
  serviceName: 'aca-runner',
});
provider.initialize();

const stack = createObservabilityStack(provider, {
  enableTracing: true,
  enableMetrics: true,
  otlp: {
    endpoint: 'http://localhost:4318/v1/traces',  // Jaeger OTLP
  },
  prometheus: {
    port: 9464,
    path: '/metrics',
    prefix: 'aca',
  },
});

await stack.start();
// ... run tasks ...
await stack.stop();
```

### Configuration Reference

| Setting | Environment Variable | Default | Description |
|---------|---------------------|---------|-------------|
| Telemetry toggle | `ENABLE_TELEMETRY` | `false` | Master switch for telemetry |
| OTLP endpoint | `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318/v1/traces` | Jaeger/Tempo OTLP receiver |
| Prometheus port | -- | `9464` | Port for `/metrics` endpoint |
| Prometheus prefix | -- | `aca` | Metric name prefix |
| Service name | -- | `aca-runner` | Applied to all telemetry data |

---

## Key Metrics Reference

All metrics use the `aca_` prefix when exposed via the Prometheus exporter.

### Task Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `aca_task_completed_total` | Counter | -- | Total successfully completed tasks |
| `aca_task_failed_total` | Counter | -- | Total failed tasks |
| `aca_task_duration_seconds` | Histogram | -- | Task execution duration in seconds. Buckets: 0.005s to 10s+ |

**Useful PromQL queries:**

```promql
# Task completion rate (tasks/min)
rate(aca_task_completed_total[5m]) * 60

# Task success rate (ratio)
rate(aca_task_completed_total[5m])
/ (rate(aca_task_completed_total[5m]) + rate(aca_task_failed_total[5m]))

# p95 task latency
histogram_quantile(0.95, sum(rate(aca_task_duration_seconds_bucket[5m])) by (le))
```

### LLM Cost Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `aca_llm_cost_total` | Counter | `model`, `provider` | Cumulative LLM spend in USD |
| `aca_llm_input_tokens_total` | Counter | `model`, `provider` | Total input tokens sent |
| `aca_llm_output_tokens_total` | Counter | `model`, `provider` | Total output tokens received |

**Useful PromQL queries:**

```promql
# Hourly cost rate by model
sum(rate(aca_llm_cost_total[5m])) by (model) * 3600

# Total cost over last 24h
sum(increase(aca_llm_cost_total[24h]))

# Token throughput (tokens/min)
sum(rate(aca_llm_input_tokens_total[5m])) * 60
```

### Error Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `aca_errors_total` | Counter | `type` | Total errors by type |

**Useful PromQL queries:**

```promql
# Error rate (errors/second)
sum(rate(aca_errors_total[5m]))

# Error rate by type
sum(rate(aca_errors_total[5m])) by (type)
```

### Agent & System Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `aca_agents_active` | Gauge | -- | Currently active agent count |
| `aca_spans_exported_total` | Counter | -- | Total spans exported via OTLP |
| `aca_spans_export_errors_total` | Counter | -- | Failed OTLP span exports |

---

## Alert Reference

Alerts are defined in `infra/prometheus/alerts.yml` and evaluated every 15 seconds.

### ACALowSuccessRate

- **Severity**: Critical
- **Condition**: Task success rate falls below 95% for 5 minutes.
- **Expression**: `(rate(aca_task_completed_total[5m]) / (rate(aca_task_completed_total[5m]) + rate(aca_task_failed_total[5m]))) < 0.95`
- **Response**:
  1. Check the Grafana "Error Rate Over Time" panel for error spikes.
  2. Look at recent traces in Jaeger filtered by `error=true`.
  3. Review application logs for recurring error patterns.
  4. If LLM-related, check provider status pages and rate limit headers.

### ACAHighLatency

- **Severity**: Warning
- **Condition**: p99 task duration exceeds 120 seconds for 5 minutes.
- **Expression**: `histogram_quantile(0.99, rate(aca_task_duration_seconds_bucket[5m])) > 120`
- **Response**:
  1. Open the Grafana "Task Duration p50 / p95 / p99" panel.
  2. Compare p50 vs. p99 -- a large gap suggests tail-latency issues.
  3. In Jaeger, find slow traces and identify which span is the bottleneck.
  4. Common causes: LLM provider latency, large context windows, rate limiting.

### ACAHighLLMCost

- **Severity**: Warning
- **Condition**: LLM spend rate exceeds $10/hour for 10 minutes.
- **Expression**: `rate(aca_llm_cost_total[1h]) * 3600 > 10`
- **Response**:
  1. Check the Grafana "LLM Cost per Hour by Model" panel.
  2. Identify which model is driving the cost spike.
  3. Review task volume -- a burst of tasks will naturally increase cost.
  4. Consider switching to a less expensive model for non-critical tasks.

### ACAErrorSpike

- **Severity**: Critical
- **Condition**: Error rate exceeds 10 errors per minute for 2 minutes.
- **Expression**: `rate(aca_errors_total[1m]) > 10`
- **Response**:
  1. Immediately check the Grafana "Error Rate Over Time" and "Errors by Type" panels.
  2. If errors are provider-related, check external API health.
  3. If errors are internal, check application logs and recent code changes.
  4. Consider pausing task submission until the root cause is identified.

---

## Grafana Dashboard Guide

The **ACA Overview** dashboard (`uid: aca-overview`) is organized into five sections:

### System Health Overview (Row 1)

Six stat panels providing at-a-glance health indicators:

- **Task Success Rate**: Green (>= 95%), yellow (>= 90%), red (< 90%).
- **Active Agents**: Current agent count.
- **Error Rate**: Errors per second with threshold coloring.
- **LLM Cost/Hour**: Extrapolated hourly LLM spend.
- **Tasks Completed**: Cumulative completed task count.
- **Trace Throughput**: Spans exported per second.

### Task Completion Rate (Row 2)

- **Task Completion Rate**: Completed and failed tasks per minute over time.
- **Success Rate Over Time**: The success ratio as a time series with threshold lines.

### Task Duration (Row 3)

- **Task Duration p50/p95/p99**: Percentile latencies with a red threshold at 120s.
- **Task Duration Heatmap**: Visual distribution of task durations over time.

### LLM Cost Analytics (Row 4)

- **LLM Cost per Hour by Model**: Stacked time series of cost per model.
- **LLM Cost by Provider**: Donut chart showing provider cost distribution.
- **LLM Token Throughput**: Input and output token rates per minute.

### Error Rate & Reliability (Row 5)

- **Error Rate Over Time**: Error rates by type with alert threshold line.
- **Error Budget Remaining (30d)**: Gauge showing remaining error budget for a 99.5% SLO.
- **Errors by Type**: Donut chart of error distribution in the last hour.

### Agent Capacity (Row 6)

- **Active Agents Over Time**: Step-line chart of agent concurrency.
- **Trace Export Rate & Errors**: OTLP export throughput and failures.

---

## Troubleshooting

### No data in Grafana dashboards

1. **Verify Prometheus target is up**:
   - Open [http://localhost:9090/targets](http://localhost:9090/targets).
   - The `aca-api` target should show status `UP`.
   - If it shows `DOWN`, the ACA API is not running or the metrics port is misconfigured.

2. **Verify metrics are being emitted**:
   ```bash
   curl http://localhost:9464/metrics
   ```
   You should see `aca_*` metric lines. If empty, telemetry is not enabled
   in the ACA configuration.

3. **Check Grafana datasource**:
   - Navigate to Grafana > Configuration > Data Sources.
   - Click the Prometheus datasource and use "Test" to verify connectivity.

4. **Check the time range**:
   - Metrics only appear after the first scrape. Wait at least 15 seconds
     after starting the stack.
   - Ensure the dashboard time range covers the period when ACA was active.

### Connection refused errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Connection refused :9464` | Prometheus exporter not started | Set `ENABLE_TELEMETRY=true` and verify ObservabilityStack is started |
| `Connection refused :4318` | Jaeger OTLP receiver not running | Verify Jaeger container is running: `docker compose --profile observability ps` |
| `Connection refused :9090` | Prometheus not running | Check Prometheus container logs: `docker logs aca-prometheus` |
| `Connection refused :3001` | Grafana not running | Check Grafana container logs: `docker logs aca-grafana` |
| `Connection refused :16686` | Jaeger UI not running | Restart: `docker compose --profile observability restart jaeger` |

### OTLP export errors in logs

The message `OTLP export error: fetch failed` is expected when Jaeger is not
running (e.g., during local development without the observability profile).
To resolve:

1. Start the observability stack:
   ```bash
   docker compose --profile observability up -d
   ```
2. If Jaeger is running but exports still fail, verify network connectivity:
   ```bash
   docker exec aca-api wget -q -O- http://jaeger:4318/v1/traces --post-data='{}' || echo "Cannot reach Jaeger"
   ```

### Prometheus "No data" for specific metrics

- **Metric not yet recorded**: Some metrics (like `aca_task_completed_total`) only
  appear after the first task completes. Submit a test task to generate data.
- **Wrong prefix**: The Prometheus exporter uses the service name as prefix.
  Verify by checking `curl localhost:9464/metrics` -- the prefix should be `aca_`.
- **Label mismatch**: If PromQL queries filter by labels (e.g., `model`, `provider`),
  verify those labels exist in the raw metrics output.

### Grafana dashboard not loading

1. Check provisioning configuration:
   ```bash
   docker exec aca-grafana cat /etc/grafana/provisioning/dashboards/dashboards.yml
   ```
2. Verify the dashboard file is mounted:
   ```bash
   docker exec aca-grafana ls /var/lib/grafana/dashboards/
   ```
   You should see `aca-overview.json`.

3. Check Grafana startup logs for provisioning errors:
   ```bash
   docker logs aca-grafana 2>&1 | grep -i "error\|provision"
   ```

### High memory usage in Prometheus

If Prometheus memory grows unexpectedly:

1. Check the number of active time series:
   ```promql
   prometheus_tsdb_head_series
   ```
2. Reduce cardinality by limiting high-cardinality labels in the application code.
3. Adjust the retention period in `docker-compose.yml`:
   ```yaml
   command:
     - '--storage.tsdb.retention.time=7d'
   ```

### Worker process exit warning in tests

The message "A worker process has failed to exit gracefully" during test runs is
caused by the Prometheus HTTP server and OTLP exporter timers not being fully
cleaned up. This does not affect test correctness. To suppress it, ensure all
`ObservabilityStack.stop()` calls complete before the test process exits.
