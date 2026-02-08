# Spec-Based Test Cases

> 스펙 기반 테스트는 `tests/unit/` 디렉토리로 통합되었습니다.

## 현재 상태

스펙 기반 테스트 파일들은 단위 테스트와 중복되어 제거되었습니다 (2026-02-08).

## 실제 테스트 위치

```
tests/unit/core/
├── validation/                         # Validation 모듈 테스트
│   ├── confidence-checker.test.ts      # 사전 실행 신뢰도 검사
│   ├── self-check-protocol.test.ts     # 사후 실행 자체 검사
│   └── goal-backward-verifier.test.ts  # 목표 역방향 검증
└── learning/                           # Learning 모듈 테스트
    ├── reflexion-pattern.test.ts       # 에러 학습 시스템
    ├── instinct-store.test.ts          # Instinct 기반 학습
    └── solutions-cache.test.ts         # 빠른 조회 캐시
```

## 테스트 실행

```bash
# Validation + Learning 모듈 테스트
npm test -- tests/unit/core/validation tests/unit/core/learning

# 전체 테스트
npm test
```

## 테스트 결과 (2026-02-08)

```
Test Suites: 6 passed, 6 total
Tests:       312 passed, 312 total
```

## 관련 문서

- [docs/05-specifications/v2/](../../docs/05-specifications/v2/) - Feature 스펙 (통합)
- [SPEC_DRIVEN_DEVELOPMENT.md](../../docs/04-planning/SPEC_DRIVEN_DEVELOPMENT.md) - SDD 프로세스
