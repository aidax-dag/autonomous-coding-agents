# Competitive Analysis & Enhancement Strategy (v6, Condensed)

> ACA(Autonomous Coding Agents) 경쟁 분석 문서의 현행화/축약판
>
> 작성일: 2026-02-15
> 버전: 6.0 (Phase B~J 전체 완료 기준, I-15/I-16 해소)
> 목적: 대용량 원문을 유지하지 않고, 프로젝트 현황 중심으로 관리

---

## 1. 문서 개편 이유

- 기존 v4.0 문서는 작성 시점이 Phase H 완료 + Phase I Sprint 1 진행 기준이었다.
- v5.0은 Phase I/J 완료 기준이나 I-15, I-16이 불명확 상태였다.
- v6.0은 Phase B~J 전체 완료, I-15/I-16 해소, TUI React/Ink 전환 완료 기준이다.
- 기존 본문은 2,127줄로 세션 토큰 비용이 크다.
- 따라서 v6에서는 아래 원칙으로 축약한다.
  - 완료된 경쟁 분석 상세는 분리 문서 참조
  - 모든 항목이 완료되었으므로 본 문서는 현황 기록 역할로 전환
  - 기존 분리 문서(`competitive-analysis/`)는 전 항목 완료 후 삭제됨 (git 이력 보존)

---

## 2. 기준 문서

- `docs/06-roadmap/ROADMAP.md` (Phase B~J 완료, 스프린트 결과)
- `docs/06-roadmap/NEXT_TASKS.md` (Phase J 완료 상태)
- `docs/04-planning/tool-reviews/` 도구 리뷰 문서

---

## 3. v4 기준 Gap 6.6 재평가

| # | Gap | v4 문서 상태 | 2026-02-14 기준 상태 | 근거/비고 |
|---|---|---|---|---|
| 1 | 실전 LLM 통합 테스트 | 미실행 | ✅ 완료 | Phase I Sprint 2, integration tests 116 |
| 2 | VS Code Extension | 프로토콜만 | ✅ 완료 | Sprint 3, 7 commands + WebView + Marketplace |
| 3 | JetBrains 기초 | 미구현 | ✅ 완료 | Sprint 3, JSON-RPC 기초 |
| 4 | 벡터 임베딩 | 로컬 n-gram만 | ✅ 완료 | Sprint 4, Ollama/HuggingFace |
| 5 | 벡터 DB | InMemory만 | ✅ 완료 | Sprint 4, Qdrant/Weaviate |
| 6 | 실전 DB (PostgreSQL/SQLite) | InMemory만 | ✅ 완료 | `postgres-client.ts` (pg Pool), `sqlite-client.ts` (better-sqlite3) 실전 드라이버 구현 |
| 7 | 옵저버빌리티 실전 연동 | OTel 인터페이스만 | ✅ 완료 | `otlp-exporter.ts` (HTTP→Jaeger/Tempo), `prometheus-exporter.ts` (/metrics) 구현 |

요약:
- 7개 전체 완료
- I-15, I-16 모두 실전 드라이버/exporter 구현으로 해소됨

---

## 4. Phase I Sprint 2~4 재평가

### Sprint 2 (I-5~I-8): 실전 LLM 통합

- 상태: ✅ 완료
- 핵심 결과: Integration Test Framework, 실 API 검증, Resilience 테스트, Model Router 실전 검증

### Sprint 3 (I-9~I-12): IDE 생태계

- 상태: ✅ 완료
- 핵심 결과: VS Code Extension(명령/웹뷰/배포), JetBrains 기초(JSON-RPC)

### Sprint 4 (I-13~I-16): 인프라 고도화

- 상태: ✅ 완료
- `I-13`, `I-14`: 완료 근거 명확
- `I-15`: ✅ 완료 -- PostgreSQL(pg Pool) + SQLite(better-sqlite3) 실전 드라이버 구현
- `I-16`: ✅ 완료 -- OTLP exporter(HTTP→Jaeger/Tempo) + Prometheus endpoint(/metrics) 구현

---

## 5. 완료된 작업 요약

- I-15 (PostgreSQL/SQLite): ✅ `postgres-client.ts` (pg Pool), `sqlite-client.ts` (better-sqlite3) 실전 드라이버
- I-16 (옵저버빌리티): ✅ `otlp-exporter.ts` (HTTP→Jaeger/Tempo), `prometheus-exporter.ts` (/metrics)
- D1 (문서 현행화): ✅ v6 기준 동기화 완료
- TUI React/Ink 전환: ✅ Ink 5.x 기반 구현 완료

---

## 6. 핵심 갭 (Phase J 기준, 미구현)

| # | 갭 | 상태 | 비고 |
|---|---|---|---|
| 1 | Ticket Cycle 런타임 | ⚠️ 스키마만 | Ticket CRUD + 상태전이 강제 API 미구현 |
| 2 | Feature Catalog 런타임 | ⚠️ 스키마만 | Feature 등록/조회/리뷰/상태관리 API 미구현 |
| 3 | MCP 필수 사용 강제 | ⚠️ optional | Ticket 수행 시 MCP 준비 상태 필수 게이트 미적용 |
| 4 | 외부 티켓 동기화 | ❌ 미구현 | GitHub/Jira 양방향 상태 동기화 커넥터 |

> 위 4개 항목은 CLAUDE.md에 정의된 "티켓 운영 표준" 및 "Feature 관리 원칙"의 런타임 구현에 해당. 현재 스키마/스펙은 있으나 API/서비스 계층이 부재.

---

## 7. ACA 개선 계획

### 7.1 개선 목표

1. MAL 기반 다중 엔진 실행 표준화
2. Ticket 기반 Working Cycle 강제
3. Feature Catalog를 재사용 자산으로 운영
4. MCP 사용을 Ticket 수행의 필수 게이트로 강제

### 7.2 우선 구현 항목

| # | 항목 | 상태 | 상세 |
|---|------|------|------|
| 1 | Ticket/Feature Service | ⚠️ 미구현 | Ticket CRUD + 상태전이 + 리뷰 + 검증 게이트. Feature 등록/조회/리뷰/상태관리 |
| 2 | Ticket Cycle API | ⚠️ 미구현 | `/api/tickets/*`, `/api/features/*`. 완료 조건: 검증 충족 + 리뷰 승인 + 아티팩트 링크 |
| 3 | MCP 필수 게이트 | ⚠️ 미구현 | Ticket 수행 시작/완료 전 MCP 준비 상태 검사. 미충족 시 상태전이 차단 |
| 4 | OpenAPI 반영 | ⚠️ 미구현 | 신규 Ticket/Feature API를 endpoint registry에 반영 |

### 7.3 완료된 기반 작업

| 항목 | 상태 | 비고 |
|------|------|------|
| 스키마 정의 | ✅ | ticket.schema.json, feature.schema.json |
| MAL 스펙 문서 | ✅ | docs/05-specifications/v3/ |
| API 보안 기반 | ✅ | JWT + API Key + Rate Limiter |
| DB 영속화 | ✅ | SQLite/PostgreSQL 드라이버 + Migration |
| OpenAPI 생성기 | ✅ | endpoint-registry + spec-generator |
| MCP 모듈 | ✅ | src/core/mcp/ (optional flag) |

### 7.4 후속 항목

| # | 항목 | 우선순위 | 비고 |
|---|------|---------|------|
| 1 | GitHub/Jira connector | P2 | 외부 티켓 시스템 양방향 동기화 |
| 2 | MAL compatibility test pipeline | P2 | 다중 엔진 호환성 자동 검증 |
| 3 | Agent Economy 결제/정산 모듈 | P3 | x402/escrow 기반 실제 트랜잭션 |

---

## 8. 운영 규칙 (업데이트 정책)

- 문서 상태 값은 `✅ 완료 / ⚠️ 불명확 / 🚧 진행중 / ⏸ 보류`만 사용
- 완료 판정은 코드/테스트/운영증거 중 최소 1개 링크를 남긴다
- 범위 변경으로 대체된 항목은 완료 처리하지 않고 `⚠️ 불명확`으로 유지
- 테스트/커버리지 수치는 상대 비교만 기록하고, 기준 날짜를 함께 표기한다

---

## 9. 결론

v4 기준 Gap 7개 전체가 Phase I/J에서 해소되었다.
Phase J 완료 후 남은 미구현 항목은 §6의 핵심 갭 4개(Ticket/Feature 런타임, MCP 게이트, 외부 동기화)이며, §7에 개선 계획을 통합하였다.

프로젝트 수치 (2026-02-15):
- 테스트 스위트: 330+, 테스트 케이스: 6,754+
- 소스 파일: 400+, 코어 모듈: 30+, LLM 프로바이더: 10

본 문서는 "프로젝트 현황 대시보드 + 개선 계획" 역할로 유지한다.
