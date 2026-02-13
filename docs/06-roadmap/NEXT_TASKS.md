# 다음 작업 리스트

> 최종 수정: 2026-02-13

---

## Phase B: 프로덕션 준비 (v1.0-alpha) ✅ COMPLETED

> B-1 ~ B-6, B-docker 모두 완료. 상세는 ROADMAP.md 참조.

---

## Phase C: 기능 확장 (v1.0-beta) ✅ COMPLETED

> C-1 ~ C-4 모두 완료.

### 구현 결과

| 모듈 | 상태 | 생성 파일 | 테스트 |
|------|------|-----------|--------|
| C-1 MCP 도구 실전 연동 | ✅ | MCPConnectionManager (365줄), presets/index.ts, config 스키마 | 28 tests |
| C-2 병렬 실행 통합 | ✅ | AgentPool↔ParallelExecutor wiring, Runner API, 이벤트 | 17 tests |
| C-3 Evals 모듈 | ✅ | EvalRunner, EvalReporter, 3 definitions | 25 tests |
| C-4 LSP 실전 통합 | ✅ | DocumentSync, SymbolCache, LSPConnectionManager, RefactorEngine | 37 tests (new) |

---

## Phase D: 플랫폼 확장 (v1.0 GA)

> Phase C 일부 완료 후 착수

| # | 작업 | 상세 | 의존성 |
|---|------|------|--------|
| D-1 | 인스틴트 공유 | 팀 간 학습 전이, import/export UI | `src/core/instinct-transfer/` 있음 |
| D-2 | 팀 협업 | 실시간 협업, 공유 세션 (WebSocket) | C-2 완료 권장 |
| D-3 | 멀티 프로젝트 | 여러 프로젝트 동시 관리, 워크스페이스 전환 | - |
| D-4 | SaaS 기능 | 멀티 테넌트, 과금 (Stripe) | D-1~D-3 일부 |
| D-5 | 사용량 분석 | 비용 리포트, 사용 패턴 대시보드, CostTracker 연동 | `src/shared/llm/cost-tracker.ts` 있음 |
