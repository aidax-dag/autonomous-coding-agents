# Worklist: Benchmark and DeepWorker

## Scope

벤치마크/사전탐색 모듈의 기본 동작을 "빈 결과"에서 "실행 가능한 기본값"으로 개선한다.

## Tasks

### B1. Benchmark Suite Loader

- Status: `done`
- Current:
  - `src/core/benchmark/benchmark-runner.ts` 기본 loader가 빈 배열 반환
- Deliverables:
  - 파일 기반 suite loader (`benchmarks/<suite>.jsonl` 등)
  - task schema validation
  - CLI 진입점(선택)
- Acceptance:
  - loader 미지정이어도 최소 1개 suite 로드 가능
  - invalid task 입력은 명확한 에러 메시지 반환

### B2. Benchmark Default Executor Policy

- Status: `done`
- Current:
  - executor 미설정 시 실패 결과만 반환
- Deliverables:
  - safe-mode executor (dry-run + reason code)
  - orchestrator executor 자동 연결 옵션
- Acceptance:
  - executor 미설정 시에도 "왜 실행 불가인지" 구조화된 결과 제공
  - executor 설정 시 토큰/시간/호출수 측정 정상 집계

### B3. PreExploration Non-LLM Fallback

- Status: `done`
- Current:
  - `src/core/deep-worker/pre-exploration.ts` 기본 relevantFiles/patterns/dependencies 비어 있음
- Deliverables:
  - 파일명/확장자/경로 힌트 기반 relevant file 추출
  - import 그래프 기반 간단 dependency 추출
  - task description 키워드 매칭
- Acceptance:
  - executor 미지정이어도 relevantFiles가 비어있지 않음
  - maxFiles 제한 준수

## Validation Commands

```bash
npm test -- tests/unit/core/benchmark
npm test -- tests/unit/core/deep-worker/pre-exploration.test.ts
```

## Evidence

- B1: `src/core/benchmark/default-suite-loader.ts` + `benchmarks/sample-suite.json`, 15 tests passed
- B2: `src/core/benchmark/dry-run-executor.ts`, 8 tests passed
- B3: `src/core/deep-worker/pre-exploration.ts` (keyword/score/import analysis), 59 tests passed
- All 7,149 tests passed (2026-02-16)
