# Worklist: Analyzer and Generator Implementation

## Scope

현재 스텁인 분석/문서생성 모듈을 실제 코드베이스 분석 결과를 반환하는 모듈로 전환한다.

## Tasks

### A1. Brownfield Real Analyzer

- Status: `done`
- Current:
  - `src/core/brownfield/brownfield-analyzer.ts` 기본 metric/techDebt/pattern 값이 스텁
- Deliverables:
  - 파일 시스템 스캔 기반 LOC/언어/대형 파일 집계
  - 정적 패턴 탐지(TODO/FIXME, 복잡도 임계치, 중복 패턴 후보)
  - 기술부채 severity 산출 규칙
- Acceptance:
  - 실제 프로젝트에서 `totalFiles > 0`, `totalLoc > 0`
  - techDebt/pattern 결과가 빈 배열만 반환하지 않음

### A2. DocsGenerator Analyzer Backend

- Status: `done`
- Current:
  - `src/core/docs-generator/docs-generator.ts` analyzer 미지정 시 템플릿 문서만 생성
- Deliverables:
  - 코드 구조 기반 HLD/MLD/LLD content analyzer
  - source file linkage 포함
  - 문서 레벨별 최소 섹션 품질 규칙
- Acceptance:
  - HLD/MLD/LLD 문서가 실제 컴포넌트/인터페이스 이름 포함
  - generated doc의 sourceFiles가 실경로로 채워짐

## Validation Commands

```bash
npm test -- tests/unit/core/brownfield/brownfield-analyzer.test.ts
npm test -- tests/unit/core/docs-generator
```

## Evidence

- A1: `src/core/brownfield/brownfield-analyzer.ts` (real FS scanner), 46 tests passed
- A2: `src/core/docs-generator/code-analyzer.ts` (HLD/MLD/LLD), 41 tests passed
- All 7,149 tests passed (2026-02-16)
