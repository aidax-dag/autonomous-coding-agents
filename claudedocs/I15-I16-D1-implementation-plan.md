# I-15 / I-16 / D1 구현 계획서

> 작성일: 2026-02-15
> 근거: 코드 검증 (2026-02-15) + 계획 문서 (`docs/04-planning/competitive-analysis/phase-i-unimplemented/`)

---

## 1. 현재 상태 분석 (문서 vs 실제 코드)

### 1.1 I-15 PostgreSQL/SQLite 연동

| 항목 | 문서 기재 | 실제 코드 | 차이 |
|------|-----------|-----------|------|
| `IDBClient` 인터페이스 | 존재 | `src/core/persistence/db-client.ts` ✅ | 일치 |
| `InMemoryDBClient` | 기본 구현 | `db-client.ts:86-400` ✅ (110+ 테스트) | 일치 |
| `PostgresClient` | 미구현 추정 | `postgres-client.ts` ✅ (197 lines, 풀 커넥션) | **문서 뒤처짐** — 드라이버 코드 존재 |
| `SQLiteClient` | 미구현 추정 | `sqlite-client.ts` ✅ (169 lines, WAL) | **문서 뒤처짐** — 드라이버 코드 존재 |
| `createDBClient` 팩토리 | 미구현 추정 | `db-factory.ts` ✅ (sqlite/postgres/memory 분기) | **문서 뒤처짐** |
| `MigrationEngine` | 기본 구조 | `migration-engine.ts` ✅ (261 lines, up/down/rollback) | 일치 |
| `001_initial_schema` | 존재 | `migrations/001_initial_schema.ts` ✅ | `down()` 미구현 (no-op) |
| `pg` / `better-sqlite3` dep | 없음 | `package.json`에 없음 ❌ | **핵심 갭** — 런타임 의존성 미설치 |
| ServiceRegistry 배선 | `enablePersistence` 존재 | `module-initializer.ts:584-592` — **항상 InMemoryDBClient 생성** | **핵심 갭** — `dbConfig` 무시됨 |
| 단위 테스트 | 존재 | `postgres-client.test.ts`, `sqlite-client.test.ts` ✅ | 모킹 기반, 실 DB 미사용 |
| 통합 테스트 | 없음 | 없음 ❌ | 실 DB E2E 부재 |

**요약**: 드라이버 코드는 존재하나 (1) 의존성 미설치, (2) ServiceRegistry가 `dbConfig`를 무시하고 항상 InMemory 생성, (3) migration `down()` 미구현, (4) 통합 테스트 부재.

### 1.2 I-16 옵저버빌리티 백엔드 연동

| 항목 | 문서 기재 | 실제 코드 | 차이 |
|------|-----------|-----------|------|
| `OTelProvider` | 인메모리만 | `otel-provider.ts` ✅ (105 lines) | 일치 |
| `OTLPTraceExporter` | 미구현 추정 | `otlp-exporter.ts` ✅ (OTLP/HTTP 배치 전송) | **문서 뒤처짐** — exporter 존재 |
| `PrometheusExporter` | 미구현 추정 | `prometheus-exporter.ts` ✅ (HTTP `/metrics` 엔드포인트) | **문서 뒤처짐** — exporter 존재 |
| `ObservabilityStack` | 미구현 추정 | `observability-stack.ts` ✅ (133 lines, 라이프사이클) | **문서 뒤처짐** |
| ServiceRegistry 배선 | 없음 | `service-registry.ts` / `module-initializer.ts`에 **전무** | **핵심 갭** — 배선 없음 |
| docker-compose 인프라 | 없음 | `docker-compose.yml`에 Jaeger/Prometheus/Grafana **없음** | **핵심 갭** |
| Grafana 대시보드 | 없음 | 없음 ❌ | 미구현 |
| 알림 규칙 / 런북 | 없음 | 없음 ❌ | 미구현 |
| 통합 테스트 | 없음 | 없음 ❌ | 실 백엔드 E2E 부재 |

**요약**: exporter 코드는 존재하나 (1) ServiceRegistry 미배선, (2) 인프라 컨테이너 없음, (3) 대시보드/알림/런북 부재.

---

## 2. I-15 구현 계획

### 2.1 ServiceRegistry 배선 수정

**파일**: `src/core/services/module-initializer.ts` (line 584-592)

현재:
```typescript
async initializePersistence(result: ModuleInitResult): Promise<void> {
  try {
    const client = createInMemoryDBClient();  // 항상 InMemory
    await client.connect();
    result.dbClient = client;
  } catch { /* ... */ }
}
```

변경:
```typescript
async initializePersistence(
  result: ModuleInitResult,
  dbConfig?: DBConfig,
): Promise<void> {
  try {
    const client = dbConfig
      ? createDBClient(dbConfig)
      : createInMemoryDBClient();
    await client.connect();
    result.dbClient = client;
  } catch { /* ... */ }
}
```

호출부도 `config.dbConfig`를 전달하도록 수정 (line 281-283):
```typescript
if (config.enablePersistence) {
  await this.initializePersistence(result, config.dbConfig);
}
```

### 2.2 Migration `down()` 구현

**파일**: `migrations/001_initial_schema.ts` (line 54-63)

현재 `down()`이 no-op (주석만 존재). 실전 DB에서 롤백이 동작하도록 구현:

```typescript
export async function down(client: IDBClient): Promise<void> {
  await client.execute('DROP TABLE IF EXISTS agent_logs');
  await client.execute('DROP TABLE IF EXISTS sessions');
  await client.execute('DROP TABLE IF EXISTS tasks');
}
```

### 2.3 통합 테스트 작성

**신규 파일**: `tests/integration/persistence/db-integration.test.ts`

테스트 범위:
1. SQLite: 연결 → 마이그레이션 up → CRUD → 트랜잭션 → 마이그레이션 rollback → 연결 해제
2. PostgreSQL: 동일 플로우 (Docker Postgres 또는 `DB_CONNECTION_STRING` 환경변수)
3. 팩토리: `createDBClient({ engine: 'sqlite' })` / `createDBClient({ engine: 'postgres' })` 경로 검증
4. 에러 시나리오: 잘못된 connectionString → `DatabaseError('CONNECT_ERROR')` 확인

실행 조건:
- SQLite 테스트: `better-sqlite3` 설치 시 항상 실행
- PostgreSQL 테스트: `DB_INTEGRATION_ENABLED=true` + `DB_CONNECTION_STRING` 환경변수 필요

### 2.4 운영 가이드

**신규 파일**: `docs/03-guides/database-operations.md`

내용:
- 로컬 개발: SQLite (`DB_ENGINE=sqlite`, `DB_FILE_PATH=./data/aca.db`)
- 프로덕션: PostgreSQL (`DB_ENGINE=postgres`, `DB_CONNECTION_STRING=postgresql://...`)
- 환경변수 목록 및 기본값
- 마이그레이션 실행/롤백 방법
- 헬스체크 엔드포인트 안내

### 2.5 Docker Compose에 PostgreSQL 추가

**파일**: `docker-compose.yml`에 `postgres` 서비스 추가 (프로파일: `db`):

```yaml
postgres:
  image: postgres:16-alpine
  container_name: aca-postgres
  profiles: ["db", "full"]
  environment:
    POSTGRES_DB: aca
    POSTGRES_USER: aca
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-aca_dev}
  ports:
    - "${POSTGRES_PORT:-5432}:5432"
  volumes:
    - aca-pgdata:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U aca"]
    interval: 10s
    timeout: 5s
    retries: 5
```

`api` 서비스에 `depends_on` 조건 추가 (프로파일 활성 시).

---

## 3. I-16 구현 계획

### 3.1 ServiceRegistry에 ObservabilityStack 배선

**파일**: `src/core/services/service-registry.ts`

`ServiceRegistryConfig`에 추가:
```typescript
enableObservability?: boolean;
observabilityConfig?: ObservabilityConfig;
```

`ModuleInitResult`에 추가:
```typescript
observabilityStack?: ObservabilityStack | null;
```

`ServiceRegistry`에 getter 추가:
```typescript
getObservabilityStack(): ObservabilityStack | null {
  return this.modules.observabilityStack;
}
```

**파일**: `src/core/services/module-initializer.ts`

`initializeObservability` 메서드 추가:
```typescript
async initializeObservability(
  result: ModuleInitResult,
  config?: ObservabilityConfig,
): Promise<void> {
  try {
    const provider = new OTelProvider({ serviceName: config?.serviceName ?? 'aca' });
    provider.initialize();
    const stack = createObservabilityStack(provider, config);
    await stack.start();
    result.observabilityStack = stack;
  } catch { /* module init failed - continue */ }
}
```

`initialize()` 메서드에 호출 추가:
```typescript
if (config.enableObservability) {
  await this.initializeObservability(result, config.observabilityConfig);
}
```

### 3.2 Docker Compose 옵저버빌리티 인프라

**파일**: `docker-compose.yml`에 프로파일 `observability` 서비스 추가:

```yaml
jaeger:
  image: jaegertracing/all-in-one:1.55
  container_name: aca-jaeger
  profiles: ["observability", "full"]
  ports:
    - "16686:16686"   # Jaeger UI
    - "4318:4318"     # OTLP HTTP
  environment:
    COLLECTOR_OTLP_ENABLED: "true"

prometheus:
  image: prom/prometheus:v2.50.0
  container_name: aca-prometheus
  profiles: ["observability", "full"]
  ports:
    - "9090:9090"
  volumes:
    - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml

grafana:
  image: grafana/grafana:10.3.1
  container_name: aca-grafana
  profiles: ["observability", "full"]
  ports:
    - "3001:3000"
  environment:
    GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-admin}
    GF_AUTH_ANONYMOUS_ENABLED: "true"
  volumes:
    - ./infra/grafana/provisioning:/etc/grafana/provisioning
    - ./infra/grafana/dashboards:/var/lib/grafana/dashboards
```

### 3.3 Prometheus 스크레이프 설정

**신규 파일**: `infra/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'aca-api'
    static_configs:
      - targets: ['api:9464']
    metrics_path: /metrics
```

### 3.4 Grafana 대시보드

**신규 파일**: `infra/grafana/dashboards/aca-overview.json`

패널 구성:
1. **Task Success Rate** — `rate(aca_task_completed_total[5m]) / rate(aca_task_total[5m])`
2. **Task Latency (p50/p95/p99)** — `histogram_quantile(0.95, aca_task_duration_seconds_bucket)`
3. **LLM Cost** — `sum(aca_llm_cost_total) by (model)`
4. **Error Rate** — `rate(aca_errors_total[5m])`
5. **Active Agents** — `aca_agents_active`
6. **Trace Throughput** — `rate(aca_spans_exported_total[5m])`

**신규 파일**: `infra/grafana/provisioning/dashboards/dashboards.yml`
**신규 파일**: `infra/grafana/provisioning/datasources/datasources.yml`

### 3.5 알림 규칙 및 런북

**신규 파일**: `infra/prometheus/alerts.yml`

기본 SLI 알림 4종:
| SLI | 조건 | 심각도 |
|-----|------|--------|
| Success Rate | < 95% (5분) | critical |
| Task Latency p99 | > 120s | warning |
| LLM Cost Rate | > $10/hr | warning |
| Error Spike | > 10 errors/min | critical |

**신규 파일**: `docs/03-guides/observability-runbook.md`

런북 구조:
- 알림별 대응 체크리스트
- 로그 조회 커맨드
- Jaeger 트레이스 검색 방법
- 에스컬레이션 경로

### 3.6 통합 테스트

**신규 파일**: `tests/integration/telemetry/observability-integration.test.ts`

테스트 범위:
1. `ObservabilityStack.start()` → Prometheus `/metrics` HTTP 응답 확인
2. `OTLPTraceExporter` → span enqueue → flush (mock OTLP 서버)
3. ServiceRegistry에서 `enableObservability: true` → `getObservabilityStack()` 반환 확인

---

## 4. D1 문서 갱신 계획

### 4.1 갱신 대상 문서

| 파일 | 변경 내용 |
|------|-----------|
| `phase-i-unimplemented/00-INDEX.md` | I-15, I-16 상태를 `✅ 완료`로 변경 |
| `phase-i-unimplemented/I15-*.md` | 상태 `🔄 구현중 → ✅ 완료`, 판정 근거에 구현 PR 링크 추가 |
| `phase-i-unimplemented/I16-*.md` | 상태 `🔄 구현중 → ✅ 완료`, 판정 근거에 구현 PR 링크 추가 |
| `phase-i-unimplemented/D1-*.md` | 상태 `🚧 진행중 → ✅ 완료` |
| `docs/06-roadmap/STATUS.md` | I-15/I-16 완료 반영, 테스트 수 갱신 |

### 4.2 갱신 규칙

1. `00-INDEX.md` **먼저** 업데이트
2. 개별 이슈 문서(`I15-*.md`, `I16-*.md`, `D1-*.md`) 업데이트
3. `STATUS.md` 최종 갱신 (테스트 수, 날짜)

---

## 5. 전체 파일 변경 목록

### 수정 대상

| # | 파일 | 변경 유형 |
|---|------|-----------|
| 1 | `src/core/services/module-initializer.ts` | I-15: `initializePersistence`에 `dbConfig` 전달 |
| 2 | `src/core/services/service-registry.ts` | I-16: `enableObservability`, `observabilityConfig`, getter 추가 |
| 3 | `src/core/services/module-initializer.ts` | I-16: `initializeObservability` 메서드 추가 |
| 4 | `migrations/001_initial_schema.ts` | I-15: `down()` 함수 실구현 |
| 5 | `docker-compose.yml` | I-15: postgres 서비스 / I-16: jaeger, prometheus, grafana 서비스 |
| 6 | `docs/04-planning/.../00-INDEX.md` | D1: 상태 갱신 |
| 7 | `docs/04-planning/.../I15-*.md` | D1: 상태 갱신 |
| 8 | `docs/04-planning/.../I16-*.md` | D1: 상태 갱신 |
| 9 | `docs/04-planning/.../D1-*.md` | D1: 상태 갱신 |
| 10 | `docs/06-roadmap/STATUS.md` | D1: 현황 반영 |

### 신규 생성 대상

| # | 파일 | 목적 |
|---|------|------|
| 11 | `tests/integration/persistence/db-integration.test.ts` | I-15: SQLite/Postgres 통합 테스트 |
| 12 | `tests/integration/telemetry/observability-integration.test.ts` | I-16: 옵저버빌리티 통합 테스트 |
| 13 | `docs/03-guides/database-operations.md` | I-15: DB 운영 가이드 |
| 14 | `docs/03-guides/observability-runbook.md` | I-16: 옵저버빌리티 런북 |
| 15 | `infra/prometheus/prometheus.yml` | I-16: Prometheus 스크레이프 설정 |
| 16 | `infra/prometheus/alerts.yml` | I-16: 알림 규칙 |
| 17 | `infra/grafana/dashboards/aca-overview.json` | I-16: Grafana 대시보드 |
| 18 | `infra/grafana/provisioning/dashboards/dashboards.yml` | I-16: Grafana 대시보드 프로비저닝 |
| 19 | `infra/grafana/provisioning/datasources/datasources.yml` | I-16: Grafana 데이터소스 설정 |

---

## 6. 검증 방법

### 6.1 I-15 검증

```bash
# 1. 타입 체크
npx tsc --noEmit

# 2. 기존 단위 테스트 통과 확인
npx jest tests/unit/core/persistence/ --verbose

# 3. SQLite 통합 테스트 (better-sqlite3 필요)
npx jest tests/integration/persistence/db-integration.test.ts --testNamePattern="SQLite"

# 4. PostgreSQL 통합 테스트 (Docker Postgres 필요)
docker compose --profile db up -d postgres
DB_INTEGRATION_ENABLED=true DB_CONNECTION_STRING=postgresql://aca:aca_dev@localhost:5432/aca \
  npx jest tests/integration/persistence/db-integration.test.ts --testNamePattern="PostgreSQL"

# 5. 마이그레이션 롤백 검증
npx jest tests/integration/persistence/db-integration.test.ts --testNamePattern="rollback"
```

### 6.2 I-16 검증

```bash
# 1. 타입 체크
npx tsc --noEmit

# 2. 기존 단위 테스트 통과 확인
npx jest tests/unit/shared/telemetry/ --verbose

# 3. 옵저버빌리티 스택 통합 테스트
npx jest tests/integration/telemetry/observability-integration.test.ts --verbose

# 4. 로컬 인프라 기동 확인
docker compose --profile observability up -d
curl -s http://localhost:9090/-/ready    # Prometheus
curl -s http://localhost:16686/          # Jaeger UI
curl -s http://localhost:3001/api/health # Grafana
```

### 6.3 D1 검증

```bash
# 문서 상태 확인
grep -c "✅" docs/04-planning/competitive-analysis/phase-i-unimplemented/00-INDEX.md
# I-15, I-16 행이 ✅로 변경됨을 확인

# STATUS.md 날짜 확인
head -5 docs/06-roadmap/STATUS.md
# 최종 수정일이 2026-02-15인지 확인
```

---

## 7. 구현 순서

1. **Step 2: I-15** — ServiceRegistry 배선 → migration down() → 통합 테스트 → 운영 가이드 → docker-compose postgres
2. **Step 3: I-16** — ServiceRegistry 배선 → docker-compose 인프라 → Prometheus/Grafana 설정 → 통합 테스트 → 런북
3. **Step 4: D1** — 문서 상태 갱신 (00-INDEX → 개별 이슈 → STATUS.md)

각 Step 완료 후 `npx tsc --noEmit` + 관련 테스트 통과를 게이트로 설정.
