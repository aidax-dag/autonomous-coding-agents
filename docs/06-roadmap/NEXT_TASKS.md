# 다음 작업 리스트

> 생성일: 2026-01-24 | 최종 수정: 2026-02-13

## 현재 상태 요약

| 항목 | 상태 |
|------|------|
| Phase 0-4 | ✅ 완료 |
| Phase 5 (Platform) | 📋 계획됨 |
| Enhancement Strategy (Phase A-F, T1-T17) | ✅ 완료 |
| P0 멀티모델 라우팅 에이전트 연동 | ✅ 완료 |
| 총 테스트 | 3,267개 (197 스위트) |
| TypeScript | ✅ Clean (npx tsc --noEmit) |

---

## 🔴 P0: Critical (즉시 필요)

| # | 작업 | 설명 | 상태 |
|---|------|------|------|
| 1 | CLI E2E 테스트 완료 | CLI LLM 클라이언트 통합 테스트 | ✅ 완료 (24 tests) |
| 2 | 빌드 검증 | TypeScript 빌드 오류 확인 및 수정 | ✅ Clean |
| 3 | 문서 동기화 | 코드와 문서 최종 동기화 | ✅ 완료 |

### 즉시 실행 명령어

```bash
# 빌드 확인
npm run build

# 테스트 실행
npm test

# 린트 검사
npm run lint

# 타입 체크
npm run typecheck
```

---

## 🟠 P1: High (v1.0 릴리스 필수)

| # | 작업 | 설명 | 예상 작업량 |
|---|------|------|------------|
| 4 | Desktop App 완성 | Tauri 2 + React + Rust IPC | ✅ 완료 |
| 5 | Web Dashboard 완성 | Vite+React+Tailwind+React Query | ✅ 완료 |
| 6 | E2E 테스트 스위트 | 전체 시스템 E2E 테스트 | ✅ 완료 (13 tests) |
| 7 | Production 설정 | 환경별 설정, 시크릿 관리 | ✅ 완료 (.env.production) |
| 8 | CI/CD 파이프라인 | GitHub Actions 배포 자동화 | ✅ 완료 (ci.yml + release.yml) |

### Desktop App (✅ 완료)

- [x] 메인 윈도우 레이아웃 (Tauri 2 + 1200x800)
- [x] 에이전트 상태 모니터링 UI (React 공유)
- [x] 워크플로우 실행 UI (React 공유)
- [x] 설정 화면 (React 공유)
- [x] Rust IPC 커맨드 (health, snapshot, agents, submit_task)

### Web Dashboard (✅ 완료)

- [x] 대시보드 메인 화면 (StatCard, AgentOverview, SSE)
- [x] 에이전트 관리 페이지 (카드 그리드, 실시간 업데이트)
- [x] 워크플로우 관리 페이지 (태스크 제출 폼)
- [x] 로그 뷰어 (SSE 실시간, 필터, 자동스크롤)
- [x] 설정 페이지 (환경변수 참조, 리소스 링크)
- [ ] 인증/로그인 (P3로 이동)

---

## 🟡 P2: Medium (권장)

| # | 작업 | 설명 | 상태 |
|---|------|------|------|
| 9 | 테스트 커버리지 80% | 실제 88.6% 달성 (목표 초과) | ✅ 완료 |
| 10 | 성능 최적화 | Set필터링, 배치처리, 슬라이딩윈도우 | ✅ 완료 |
| 11 | 에러 핸들링 강화 | hook 에러 로깅, GoalResult.error, AgentError | ✅ 완료 |
| 12 | 로깅 개선 | LLM 에러 로깅, 모듈/상관 로거 | ✅ 완료 |
| 13 | API 문서화 | OpenAPI 3.0 스펙 (docs/api/openapi.yaml) | ✅ 완료 |
| 14 | 사용자 가이드 | 설치/설정/사용 종합 가이드 (USER_GUIDE.md) | ✅ 완료 |

### 테스트 커버리지 현황 (목표 초과 달성)

| 모듈 | 현재 | 목표 | 상태 |
|------|------|------|------|
| api | 100% | 75% | ✅ 초과 |
| agents | 94.92% | 80% | ✅ 초과 |
| 전체 | 88.6% | 80% | ✅ 초과 |

---

## 🟢 P3: Low (Nice to have)

| # | 작업 | 설명 |
|---|------|------|
| 15 | 플러그인 시스템 | 사용자 플러그인 개발 지원 |
| 16 | 다국어 지원 | i18n 적용 |
| 17 | 테마 시스템 | 다크/라이트 모드 |
| 18 | 단축키 시스템 | 키보드 단축키 지원 |
| 19 | 알림 시스템 | 데스크톱/웹 알림 |

---

## 🔵 P4: Future (향후 고려)

| # | 작업 | 설명 |
|---|------|------|
| 20 | 팀 협업 기능 | 실시간 협업, 공유 |
| 21 | 멀티 프로젝트 관리 | 여러 프로젝트 동시 관리 |
| 22 | SaaS 기능 | 클라우드 서비스 전환 |
| 23 | 사용량 분석 | 사용 패턴 분석 대시보드 |
| 24 | AI 모델 파인튜닝 | 도메인 특화 모델 |

---

## 권장 실행 순서

```
Phase 1: 안정화 (1주)
├── CLI E2E 테스트 완료
├── 빌드 검증
└── 문서 동기화

Phase 2: 플랫폼 UI (4-6주)
├── Desktop App 완성
└── Web Dashboard 완성

Phase 3: 배포 준비 (1주)
├── E2E 테스트 스위트
├── Production 설정
└── CI/CD 파이프라인

Phase 4: v1.0 릴리스
└── 릴리스 노트 작성
```

---

## 마일스톤

| 마일스톤 | 목표 시점 | 상태 |
|----------|----------|------|
| Phase 4 완료 | 2026-01-24 | ✅ 완료 |
| Enhancement Strategy 통합 완료 | 2026-02-13 | ✅ 완료 |
| v1.0-alpha | 2026-02 | 📋 계획 |
| v1.0-beta | 2026-03 | 📋 계획 |
| v1.0 Release | 2026-Q2 | 📋 계획 |

---

## 관련 문서

- [STATUS.md](./STATUS.md) - 현재 진행 상황
- [ROADMAP.md](./ROADMAP.md) - 개발 로드맵
- [IMPLEMENTATION_GUIDE.md](../03-guides/IMPLEMENTATION_GUIDE.md) - 구현 가이드
- [OVERVIEW.md](../02-architecture/OVERVIEW.md) - 아키텍처 개요
- [Enhancement Strategy](../04-planning/COMPETITIVE_ANALYSIS_AND_ENHANCEMENT_STRATEGY.md) - 경쟁 분석 및 강화 전략
