# Autonomous Coding Agents - 비전 요약

> **버전**: 1.1 (요약본)
> **최종 수정**: 2026-02-07
> **마스터 문서**: [UNIFIED_VISION.md](./UNIFIED_VISION.md)

---

## 핵심 비전

> **"CEO인 인간 한 명과 AI 에이전트로 구성된 완전 자율 소프트웨어 회사 구축"**

### Human-in-the-Loop 진화 단계

| Level | 단계 | 설명 | 목표 시점 |
|-------|------|------|----------|
| 0 | 수동 개발 | 인간 개발자가 모든 작업 수행 | - |
| 1 | AI 어시스턴트 | 인간 주도, AI 보조 (현재 대부분의 도구) | - |
| 2 | AI 주도 | AI 개발팀 주도, 인간 승인 | **MVP 12개월** |
| 3 | 완전 자율 | 인간 CEO 전략만, AI 운영 자율 | Enterprise 36개월 |

### 핵심 가치 제안

| 현재 상태 | 목표 상태 |
|-----------|----------|
| 개발자 80시간/주 필요 | AI 24/7 자동 개발 |
| 인건비 $200K+/년 | LLM API 비용 $5K-20K/년 |
| 채용 3-6개월 소요 | 즉시 스케일 가능 |
| 휴가, 병가, 퇴사 리스크 | 무중단 운영 |
| 지식 유실 (이직 시) | 영구 지식 축적 |

---

## 설계 원칙

| 원칙 | 기존 AI 도구 | 우리의 접근 |
|------|-------------|-------------|
| **팀 시뮬레이션** | 하나의 슈퍼 에이전트 | 역할 분담된 전문 에이전트들 협업 |
| **방법론 우선** | 모델 성능에 의존 | Agile/Kanban 방법론 내장 |
| **지식 축적** | 세션 종료 시 손실 | 온톨로지 + 벡터 DB로 영구 지식 |
| **문서 주도 개발** | 코드 생성에 집중 | HLD → MLD → LLD 체계 |
| **계약 > 지능** | 똑똑한 모델에 의존 | 정의된 계약/게이트/권한이 우선 |

---

## 4 Layer 제품 아키텍처

```
Layer 4: Feature Store     ← 재사용 가능한 기능 자산
Layer 3: Ontology Graph    ← 연결된 지식/증적 그래프
Layer 2: Agent Org         ← 역할 기반 에이전트 팀
Layer 1: Workflow OS       ← 칸반/아티팩트/승인흐름
```

---

## 로드맵 요약

| Phase | 기간 | 목표 |
|-------|------|------|
| **Phase 1** | 0-2개월 | 3 에이전트 시스템 안정화 (Coder, Reviewer, RepoManager) |
| **Phase 2** | 2-4개월 | 제품/개발 에이전트 확장 (PM, QA, Security, Infra) |
| **Phase 3** | 4-6개월 | 지식 레이어 구축 (Neo4j, Vector DB, Feature Store) |
| **Phase 4** | 6-9개월 | 경영진 에이전트 (CTO, COO, CFO) |
| **Phase 5** | 9-12개월 | 완전 자율화 (Human-out-of-the-loop) |

---

## 상세 문서

전체 비전, 아키텍처, 구현 명세는 마스터 문서를 참조하세요:

- **[UNIFIED_VISION.md](./UNIFIED_VISION.md)** - 통합 비전 문서 (v3.0)
  - 4 Layer 제품 아키텍처 상세
  - Feature Store 스키마 (PostgreSQL)
  - 에이전트 조직 및 산출물 계약
  - 온톨로지 설계
  - 10개 핵심 결정
  - 6개 운영 원칙
  - Phase 1 상세 실행 플랜

- **[AI_CODING_AGENTS_COMPARISON.md](./AI_CODING_AGENTS_COMPARISON.md)** - 경쟁 분석
  - Claude Code, Codex, Gemini CLI 등 비교
  - ACA 차별화 전략

---

*이 문서는 요약본입니다. 상세 내용은 [UNIFIED_VISION.md](./UNIFIED_VISION.md)를 참조하세요.*
