# Autonomous Coding Agents - 개선 권고 문서 v3.2

> **버전**: 3.2 (통합 검증 반영)
> **작성일**: 2026-02-08
> **이전 버전**: v3.1 (팩트체크), v3.0, v2.3 (2026-02-06)
> **문서 유형**: 비권위적 분석 (Non-Authoritative Analysis)
> **방법론**: AGENT.md 원칙 기반 비판적 사고
> **분석 대상**: 9개 외부 프로젝트 (2차 심층 분석)

---

## ⚠️ 중요 공지

**이 문서는 비권위적입니다.** 모든 권고사항은 가설이며, 검증이 필요합니다. 최종 결정 권한은 프로젝트 소유자에게 있습니다.

---

## 📋 v3.0 주요 변경사항

### 완료된 작업 (P0/P1) — ⚠️ 통합 미완료
| 우선순위 | 모듈 | 구현물 | 모듈 구현 | 파이프라인 통합 |
|---------|------|--------|:--------:|:-------------:|
| **P0** | `core/validation/` | ConfidenceChecker (11KB), SelfCheckProtocol (10KB), GoalBackwardVerifier (12KB) | ✅ 완료 | ❌ **미연결** |
| **P1** | `core/learning/` | ReflexionPattern (10KB), InstinctStore (22KB), SolutionsCache (17KB) | ✅ 완료 | ❌ **미연결** |

> **🔴 v3.2 발견**: P0/P1 모듈이 구현은 되었으나 실행 파이프라인에 연결되지 않음.
> OrchestratorRunner, CEOOrchestrator, 어떤 에이전트도 validation/ 또는 learning/ 모듈을 import하지 않음.
> DI 컨테이너도 부트스트랩되지 않아 토큰 등록/해석 불가. **통합 작업이 최우선 과제.**

### v3.0 신규 분석 내용
- 9개 프로젝트 2차 심층 분석 (코드 레벨 패턴 추출)
- **12개 신규 개선 영역** 발견 (기존 6개 → 18개)
- Next-Phase 우선순위 재편성 (New P0~P3)
- FEATURE_IMPROVEMENTS.md 미반영 콘텐츠 통합

### 코드베이스 현황 (2026-02-08 통합 검증)

| 이전 주장 | 모듈 상태 | 파이프라인 연결 | 관련 코드 |
|----------|:--------:|:-------------:|----------|
| "Hook 시스템 미완성" | ✅ 9개 Hook 구현 | ⚠️ **1/9만 연결** | `src/core/hooks/` (31개 파일) |
| "세션 간 지식 유실" | ✅ 세션 관리 구현 | ❌ **미연결** | `session-manager.ts` (1229 LOC) |
| "컨텍스트 품질 저하" | ✅ 컨텍스트 구현 | ❌ **미연결** (hooks는 dx/ 사용) | `core/context/` (~2K LOC) |
| "Provider 종속" | ✅ 7 Provider 지원 | ✅ **작동 중** | 3 API + 4 CLI Provider |
| "토큰 최적화 없음" | ✅ 토큰 최적화 구현 | ⚠️ hooks만 (core/context/ 미사용) | `token-optimizer.hook.ts` |
| "품질 검증 부재" | ✅ 검증 시스템 구현 | ❌ **미연결** (소비자 0) | `core/validation/` |
| "에러 학습 부재" | ✅ 학습 시스템 구현 | ❌ **미연결** (소비자 0) | `core/learning/` |
| "A2A 통신 부재" | ✅ A2A 프로토콜 구현 | ❌ **미연결** (소비자 0) | `core/a2a/` (~5K LOC) |

> **실제 작동 파이프라인** (2026-02-08 검증):
> `OrchestratorRunner` → `CEOOrchestrator` → Team Agents (Planning, Dev, QA) → `TeamAgentLLMAdapter` → `ILLMClient`
> 위 파이프라인 외의 core/ 모듈 대부분은 구현은 되었으나 연결되지 않은 상태.

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [분석 대상 프로젝트 요약](#2-분석-대상-프로젝트-요약)
3. [기존 개선 영역 (v2.3, 현황 업데이트)](#3-기존-개선-영역-v23-현황-업데이트)
4. [신규 개선 영역 (v3.0 심층 분석)](#4-신규-개선-영역-v30-심층-분석)
5. [Next-Phase 우선순위 로드맵](#5-next-phase-우선순위-로드맵)
6. [불확실성 예산](#6-불확실성-예산)
7. [지식 계보](#7-지식-계보)
8. [코드 구조 분석 및 개선 방안](#8-코드-구조-분석-및-개선-방안)

---

## 1. Executive Summary

### 1.1 가설 (Hypothesis)

**주 가설**: 분석된 9개 외부 프로젝트의 검증된 패턴을 선택적으로 적용하면, autonomous-coding-agents의 약점을 개선하면서 프로젝트 고유의 비전("CEO 1명 + AI 에이전트 완전 자율 소프트웨어 회사")을 유지할 수 있다.

**부 가설들**:
- ~~H1: Project Memory 시스템 도입~~ → **이미 구현됨** (session-manager.ts, project-store.ts)
- H2: 행동 평가(Behavioral Evals) 프레임워크가 에이전트 품질 보장에 필수적
- H3: 보안 샌드박싱의 강화가 자율 실행 신뢰도를 높임
- ~~H4: 토큰 효율화 시스템~~ → **기본 구현됨** (token-optimizer.hook.ts)
- **H5: ConfidenceChecker** → 🟡 **모듈 구현 완료, 파이프라인 통합 필요** (confidence-checker.ts)
- ~~H6: 컨텍스트 엔지니어링~~ → **기본 구현됨** (context-monitor.hook.ts)
- **H7: Instinct 기반 학습** → 🟡 **모듈 구현 완료, 파이프라인 통합 필요** (instinct-store.ts)
- **H8: Goal-Backward 검증** → 🟡 **모듈 구현 완료, 파이프라인 통합 필요** (goal-backward-verifier.ts)
- ~~H9: Provider-Agnostic~~ → **이미 구현됨** (7 Provider 지원)
- **H10 (신규)**: Behavioral Evals가 에이전트 품질을 객관적으로 측정 가능
- **H11 (신규)**: Tiered Model Routing이 30-50% 비용 절감 달성
- **H12 (신규)**: JSONL Session Persistence가 crash-safe 세션 복구 제공
- **H13 (신규)**: Thin Orchestrator 패턴이 CEO Orchestrator 복잡성 감소

### 1.2 증거 요약 (Evidence Summary) - v3.0 심층 분석

| 프로젝트 | 핵심 강점 (v2.3) | **v3.0 신규 발견** | 적용 가능성 |
|---------|-----------------|-------------------|------------|
| oh-my-claudecode | Project Memory, Ultrapilot | **Tiered Model Routing, Composable Skills, HUD, SWE-bench** | ⭐⭐⭐⭐⭐ |
| claude-code | Plugin Architecture, Hooks | **7-Phase Workflow, Ralph Loop, Agent Teams, Progressive Disclosure** | ⭐⭐⭐⭐ |
| codex | Rust Sandbox, JSON-RPC | **JSONL Session Persistence, Progressive Sandbox, MCP Bidirectional** | ⭐⭐⭐⭐ |
| gemini-cli | Behavioral Evals, A2A | **31 Semantic Error Types, Scheduler State Machine, Non-Interactive Mode** | ⭐⭐⭐⭐⭐ |
| everything-claude-code | Instinct, Iterative Retrieval | **Instinct Import/Export, PM2 Orchestration, Context Modes** | ⭐⭐⭐⭐ |
| get-shit-done | Context Engineering, Goal-Backward | **Thin Orchestrator, XML Tasks, Checkpoint Protocol, Brownfield Analysis** | ⭐⭐⭐⭐⭐ |
| oh-my-opencode | Sisyphus, Boulder State | **Hephaestus Deep Worker, Todo Continuation, Dynamic Prompts** | ⭐⭐⭐⭐ |
| opencode | Provider-Agnostic, Permission | **ACP Protocol, 5 Frontends, Spec-Driven Dev, 2.37M Downloads** | ⭐⭐⭐⭐ |
| SuperClaude | ConfidenceChecker, SelfCheck, Reflexion | **Wave Execution Pattern** (기존 분석 충분) | ⭐⭐⭐⭐⭐ |

### 1.3 Gap 매핑 - v3.0 업데이트

#### 🟡 모듈 구현 완료, 통합 미완료 (P0/P1)

| Gap | 해결 방법 | 구현 파일 | 모듈 | 통합 |
|-----|----------|----------|:----:|:----:|
| 사전 검증 시스템 부재 | ConfidenceChecker 도입 | `core/validation/confidence-checker.ts` | ✅ | ❌ |
| 사후 검증 시스템 부재 | SelfCheckProtocol + GoalBackwardVerifier | `core/validation/*.ts` | ✅ | ❌ |
| 에러 학습 시스템 부재 | ReflexionPattern 도입 | `core/learning/reflexion-pattern.ts` | ✅ | ❌ |
| Instinct 기반 학습 부재 | InstinctStore 도입 | `core/learning/instinct-store.ts` | ✅ | ❌ |
| 해결책 캐시 부재 | SolutionsCache 도입 | `core/learning/solutions-cache.ts` | ✅ | ❌ |

> **통합이 필요한 작업**: OrchestratorRunner 또는 Agent 라이프사이클에서 위 모듈을 import하고 호출해야 함.
> DI 컨테이너 부트스트랩 또는 직접 주입 방식 중 결정 필요.

#### 🔴 신규 Gap (v3.0 심층 분석 발견)

| autonomous-coding-agents 약점 | 외부 프로젝트 해결책 | 신규 우선순위 |
|-------------------------------|---------------------|-------------|
| **에이전트 품질 객관적 측정 부재** | **gemini-cli Behavioral Evals** | **New P0** |
| **모델별 비용 최적화 미흡** | **oh-my-claudecode Tiered Model Routing** | **New P0** |
| **세션 crash-safety 부재** | **codex JSONL Session Persistence** | **New P1** |
| **보안 단계별 에스컬레이션 없음** | **codex Progressive Sandbox Escalation** | **New P1** |
| **오케스트레이터 과도한 복잡성** | **get-shit-done Thin Orchestrator** | **New P1** |
| **스킬 조합 불가** | **oh-my-claudecode Composable Skills** | **New P2** |
| **진정한 자율 실행 미달** | **oh-my-opencode Hephaestus Deep Worker** | **New P2** |
| **단일 인터페이스 한계** | **opencode ACP / Multi-Frontend** | **New P2** |
| **실시간 모니터링 부재** | **oh-my-claudecode HUD Dashboard** | **New P3** |
| **객관적 벤치마크 부재** | **oh-my-claudecode SWE-bench** | **New P3** |
| **문서 자동생성 미구현** | **FEATURE_IMPROVEMENTS.md HLD/MLD/LLD 시스템** | **New P3** |
| **기존 코드베이스 분석 부재** | **get-shit-done Brownfield Analysis** | **New P3** |

#### 🔶 고도화 필요 (기존 구현 개선)

| 기능 | 현재 구현 | 참고 패턴 | 권장 조치 |
|-----|----------|----------|----------|
| 컨텍스트 모니터링 | context-monitor.hook.ts (70%/85%/95%) | get-shit-done 품질 곡선 | 4단계 품질 곡선 세분화 |
| 완료 검증 | completion-detector.ts | Goal-Backward 3단계 | validation/ 모듈과 통합 |
| 세션 관리 | session-manager.ts (1229 LOC) | oh-my-opencode Boulder State | .sisyphus 패턴 참고 |
| Provider 추상화 | 7 Provider 지원 | opencode Vercel AI SDK | SDK 기반 표준화 |
| 토큰 최적화 | token-optimizer.hook.ts | oh-my-claudecode Ecomode | 30-50% 절감 목표 |
| Hook 시스템 | 9개 Hook 타입 | everything-claude-code 6-Phase | 필요시 확장 |
| 보안 모듈 | security/ (6개 모듈) | opencode Permission System | 세분화 검토 |

---

## 2. 분석 대상 프로젝트 요약

### 2.1 oh-my-claudecode (101K+ lines)

```yaml
# v2.3 기존 분석
핵심_강점:
  - Project Memory: 컴팩션 저항 지시어 저장
  - Ultrapilot: 3-5x 병렬 실행 속도
  - Ecomode: 30-50% 토큰 절감
  - 32 에이전트, 37 스킬, 31 훅
```

**v3.0 심층 분석 신규 발견**:

```yaml
tiered_model_routing:
  설명: "작업 복잡도에 따른 자동 모델 선택"
  구조:
    tier_1_haiku: "간단한 작업 (파일 읽기, 포맷팅)"
    tier_2_sonnet: "중간 복잡도 (코드 작성, 리팩토링)"
    tier_3_opus: "고복잡도 (아키텍처 설계, 디버깅)"
  효과: "30-50% 비용 절감, 응답 속도 향상"
  구현: "agents/tiered-model-router.ts"

composable_skills:
  설명: "32개 스킬의 조합 가능한 아키텍처"
  패턴: "각 스킬이 독립적 모듈로 존재, 파이프라인 조합"
  예시:
    - "analyze → plan → implement → test (4-skill 파이프라인)"
    - "review → fix → verify (3-skill 파이프라인)"
  효과: "새 워크플로우를 기존 스킬 조합으로 빠르게 생성"

hud_dashboard:
  설명: "실시간 에이전트 상태 모니터링 대시보드"
  표시: "에이전트 상태, 토큰 사용량, 작업 진행률, 에러율"
  구현: "터미널 기반 TUI"

swe_bench_benchmarking:
  설명: "SWE-bench 기반 객관적 에이전트 품질 측정"
  방법론: "표준화된 코딩 과제로 에이전트 성능 비교"
  활용: "에이전트 개선의 정량적 검증"

comment_checker:
  설명: "AI 생성 주석 품질 제어"
  규칙: "불필요한 주석 탐지, 'AI generated' 패턴 제거"
  효과: "코드 품질 일관성 유지"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Project Memory, Ultrapilot, Ecomode
2. 🆕 **Tiered Model Routing**: 7 Provider를 비용/성능별 자동 선택
3. 🆕 **Composable Skills**: 에이전트 스킬을 조합 가능한 파이프라인으로 구성
4. 🆕 **HUD Dashboard**: PM2 기반 실시간 모니터링
5. 🆕 **SWE-bench**: 에이전트 품질 객관적 벤치마크

---

### 2.2 claude-code (Anthropic 공식 CLI)

```yaml
# v2.3 기존 분석
핵심_강점:
  - Plugin Architecture (commands/agents/skills/hooks)
  - Permission Model (Level 0-5)
  - MCP Integration
```

**v3.0 심층 분석 신규 발견**:

```yaml
seven_phase_workflow:
  설명: "7단계 워크플로우 + 승인 게이트"
  단계:
    1_understand: "요구사항 이해"
    2_plan: "실행 계획 수립"
    3_approve: "사용자 승인 게이트"
    4_implement: "코드 구현"
    5_test: "테스트 실행"
    6_review: "자동 리뷰"
    7_commit: "커밋/PR 생성"
  효과: "각 단계별 품질 게이트로 실패 조기 감지"

ralph_loop:
  설명: "자율 반복 실행 루프"
  동작: "실패 시 자동 재시도 + 전략 변경"
  패턴: "Plan → Execute → Evaluate → Adjust (PEEA loop)"
  효과: "인간 개입 없이 문제 해결 시도"

agent_teams:
  설명: "멀티 에이전트 팀 구성 및 조율"
  패턴: "Lead Agent + Worker Agents + Review Agent"
  활용: "대규모 리팩토링, 멀티파일 작업"

progressive_disclosure:
  설명: "권한 수준 점진적 확대"
  단계:
    level_0: "읽기 전용"
    level_1: "파일 편집 (승인 필요)"
    level_2: "bash 실행 (승인 필요)"
    level_3: "자동 편집"
    level_4: "자동 bash"
    level_5: "완전 자율"
  효과: "신뢰 구축 후 자율성 확대"

headless_mode:
  설명: "SDK를 통한 프로그래밍 방식 사용"
  활용: "CI/CD 통합, 자동화 파이프라인"
  효과: "인터랙티브 없이 에이전트 실행 가능"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Plugin Architecture, Permission Model
2. 🆕 **7-Phase Workflow**: CEO Orchestrator에 단계별 승인 게이트 적용
3. 🆕 **Ralph Loop**: 에이전트 자율 재시도 메커니즘
4. 🆕 **Progressive Disclosure**: 신뢰도 기반 권한 에스컬레이션
5. 🆕 **Headless Mode**: API/CI-CD 파이프라인 연동

---

### 2.3 codex (OpenAI CLI - Rust + Node.js)

```yaml
# v2.3 기존 분석
핵심_강점:
  - 커널 레벨 샌드박싱 (Seatbelt/Landlock)
  - JSON-RPC 2.0 프로토콜
  - 45+ Rust 크레이트
```

**v3.0 심층 분석 신규 발견**:

```yaml
jsonl_session_persistence:
  설명: "JSONL 기반 append-only 세션 저장"
  특징:
    - append_only: "기존 데이터 손상 없이 추가만"
    - crash_safe: "비정상 종료 시에도 데이터 보존"
    - streamable: "대용량 세션도 스트리밍 읽기"
    - line_by_line: "각 턴이 독립적 JSON 라인"
  위치: "~/.codex/sessions/{id}.jsonl"
  효과: "세션 복구 100% 신뢰도"

progressive_sandbox_escalation:
  설명: "3단계 보안 에스컬레이션"
  단계:
    suggest: "제안만, 실행 불가"
    auto_edit: "파일 편집 자동, bash 승인 필요"
    full_auto: "모든 작업 자율 실행"
  구현: "Seatbelt (macOS) + Landlock (Linux)"
  효과: "신뢰 수준에 따른 점진적 권한 확대"

protocol_first_design:
  설명: "마이크로커널 + JSON-RPC 2.0 프로토콜"
  특징:
    - "모든 도구 호출이 프로토콜 메시지"
    - "도구 추가 = 새 핸들러 등록"
    - "프론트엔드/백엔드 분리"
  효과: "확장성 높은 플러그인 아키텍처"

mcp_bidirectional:
  설명: "MCP 서버이자 클라이언트"
  의미:
    - "외부 MCP 서버 사용 (클라이언트)"
    - "자체 기능을 MCP로 노출 (서버)"
  효과: "다른 AI 도구와 양방향 통합"

approval_pattern:
  설명: "사용자 의도 → 승인 → 실행 3단계"
  구현: "apply_patch → user_confirm → execute"
  효과: "위험한 작업의 안전한 실행"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Kernel Sandbox, JSON-RPC
2. 🆕 **JSONL Session Persistence**: crash-safe 세션 복구
3. 🆕 **Progressive Sandbox Escalation**: 3단계 신뢰 기반 권한
4. 🆕 **Protocol-First Design**: JSON-RPC 기반 확장성
5. 🆕 **MCP Bidirectional**: MCP 서버 + 클라이언트 동시 구현

---

### 2.4 gemini-cli (Google CLI)

```yaml
# v2.3 기존 분석
핵심_강점:
  - Behavioral Evals 프레임워크
  - Agent-to-Agent Protocol
  - 1M 토큰 컨텍스트
  - 61+ 도구, 20+ 훅
```

**v3.0 심층 분석 신규 발견**:

```yaml
behavioral_evals_deep:
  설명: "에이전트 행동 자동 평가 시스템"
  심각도_레벨:
    ALWAYS_PASSES: "100% 통과 필수 (회귀 방지)"
    USUALLY_PASSES: "80%+ 통과 기대 (품질 트렌드)"
  평가_항목:
    - "코드 품질 (정확성, 스타일)"
    - "도구 사용 적절성"
    - "에러 처리 정확성"
    - "응답 일관성"
  자동화: "CI/CD에 통합하여 매 릴리스 품질 검증"
  효과: "에이전트 품질의 객관적, 반복 가능한 측정"

semantic_error_types:
  설명: "31개 의미적 에러 타입 정의"
  카테고리:
    file_operations: ["FileNotFound", "PermissionDenied", "PathTooLong"]
    code_analysis: ["SyntaxError", "TypeMismatch", "UnresolvedImport"]
    tool_execution: ["ToolTimeout", "ToolNotFound", "InvalidArguments"]
    llm_errors: ["ContextOverflow", "RateLimited", "InvalidResponse"]
  효과: "에러 유형별 정확한 복구 전략 적용"

scheduler_state_machine:
  설명: "작업 스케줄러 상태 기계"
  상태:
    IDLE: "대기"
    PLANNING: "계획 수립"
    EXECUTING: "실행 중"
    WAITING_INPUT: "사용자 입력 대기"
    ERROR_RECOVERY: "에러 복구"
    COMPLETED: "완료"
  전환_규칙: "각 상태에서 허용된 전환만 가능"
  효과: "예측 가능한 에이전트 라이프사이클"

non_interactive_mode:
  설명: "-n 플래그로 비대화형 실행"
  활용:
    - "CI/CD 파이프라인 통합"
    - "스크립트 기반 자동화"
    - "배치 작업 실행"
  효과: "자동화 파이프라인과의 원활한 통합"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Behavioral Evals, A2A Protocol
2. 🆕 **Behavioral Evals 심층**: ALWAYS_PASSES/USUALLY_PASSES 심각도 시스템
3. 🆕 **31 Semantic Error Types**: 에러 유형별 복구 전략
4. 🆕 **Scheduler State Machine**: 에이전트 라이프사이클 관리
5. 🆕 **Non-Interactive Mode**: CI/CD 통합 자동화

---

### 2.5 everything-claude-code (Production-Ready Config)

```yaml
# v2.3 기존 분석
핵심_구조:
  에이전트: 13개 전문화 에이전트
  스킬: 30+ 도메인별 스킬
  훅: 24+ 이벤트 기반 훅
  명령어: 24개 슬래시 명령어

혁신적_기능:
  instinct_system:
    설명: "신뢰도 점수 기반 원자적 학습 패턴"
    특징:
      - 0.3-0.9 신뢰도 스케일
      - 관찰 → 분석 → Instinct 생성 → 클러스터링 → 진화
    저장: "~/.claude/homunculus/instincts/"

  iterative_retrieval:
    설명: "서브에이전트 컨텍스트 문제 해결"
    프로세스: "DISPATCH → EVALUATE(0-1점) → REFINE → LOOP(max 3)"
```

**v3.0 심층 분석 신규 발견**:

```yaml
instinct_import_export:
  설명: "프로젝트 간 Instinct 이전 메커니즘"
  기능:
    export: "특정 도메인의 instinct를 JSON으로 추출"
    import: "다른 프로젝트의 검증된 instinct 가져오기"
    merge: "신뢰도 기반 중복 해결"
  효과: "프로젝트 간 학습 전파, 신규 프로젝트 빠른 부트스트래핑"

pm2_orchestration:
  설명: "PM2 기반 에이전트 프로세스 관리"
  기능:
    - "에이전트별 프로세스 관리"
    - "자동 재시작 (crash recovery)"
    - "로그 통합"
    - "클러스터 모드"
  효과: "프로덕션 환경 안정성"

context_modes:
  설명: "작업 유형별 컨텍스트 동적 전환"
  모드:
    dev: "개발 중심 (코드 생성, 편집)"
    review: "리뷰 중심 (분석, 피드백)"
    research: "연구 중심 (탐색, 문서화)"
  효과: "작업 유형에 최적화된 프롬프트 및 도구 세트"

cross_platform_hooks:
  설명: "Windows/Mac/Linux 호환 Hook 시스템"
  구현: "OS 감지 → 플랫폼별 스크립트 실행"
  효과: "크로스 플랫폼 배포 가능"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Instinct System, Iterative Retrieval, 6-Phase Hook
2. 🆕 **Instinct Import/Export**: 프로젝트 간 학습 전파 (InstinctStore 확장)
3. 🆕 **PM2 Orchestration**: ACA의 ecosystem.config.js와 직접 연동
4. 🆕 **Context Modes**: 에이전트별 작업 모드 동적 전환

---

### 2.6 get-shit-done (Context Engineering Master)

```yaml
# v2.3 기존 분석
핵심_구조:
  에이전트: 11개 전문 에이전트
  명령어: 27개 CLI 명령어
  워크플로우: 12개 오케스트레이션 워크플로우
  문서: 15,765 lines (Documentation-as-Code)

혁신적_기능:
  context_engineering:
    품질_곡선:
      0-30%: "PEAK (포괄적, 철저함)"
      30-50%: "GOOD (확신, 견고함)"
      50-70%: "DEGRADING (효율 모드)"
      70%+: "POOR (급한, 최소한)"

  goal_backward_verification:
    3단계_검증:
      1_exists: "파일이 예상 경로에 존재"
      2_substantive: "실제 구현, placeholder 아님"
      3_wired: "시스템에 연결됨"
```

**v3.0 심층 분석 신규 발견**:

```yaml
thin_orchestrator:
  설명: "최소한의 조정자 패턴"
  원칙:
    - "오케스트레이터는 라우팅과 상태 관리만"
    - "실제 작업은 전문 에이전트에 위임"
    - "오케스트레이터에 비즈니스 로직 금지"
  비교:
    fat_orchestrator: "CEO가 모든 결정 + 실행 (현재 ACA)"
    thin_orchestrator: "CEO는 위임과 모니터링만 (GSD 패턴)"
  효과: "오케스트레이터 복잡성 50%+ 감소"

xml_task_structure:
  설명: "실행 가능한 XML 태스크 명세"
  예시: |
    <task type="auto">
      <name>Create login endpoint</name>
      <files>src/api/auth/route.ts</files>
      <action>POST endpoint accepting {email, password}...</action>
      <verify>curl -X POST returns 200 with Set-Cookie</verify>
      <done>Valid → 200 + cookie. Invalid → 401.</done>
    </task>
  효과: "태스크 명세가 곧 실행 계획이자 검증 기준"

checkpoint_protocol:
  설명: "3가지 체크포인트 유형"
  유형:
    pre_action: "위험한 작업 전 상태 저장"
    milestone: "주요 마일스톤 완료 시 저장"
    emergency: "에러 발생 시 즉시 저장"
  저장: "STATE.md + git commit"
  효과: "어떤 시점에서든 안전하게 복구 가능"

deviation_handling:
  설명: "사용자 결정 충실도 시스템"
  카테고리:
    locked_decisions: "반드시 구현 (협상 불가)"
    deferred_ideas: "반드시 구현 안 함 (범위 방지)"
    claude_discretion: "합리적 판단 위임"
  효과: "범위 확대(scope creep) 방지"

brownfield_analysis:
  설명: "기존 코드베이스 존중 패턴"
  규칙:
    - "새 코드 작성 전 기존 패턴 분석"
    - "기존 명명 규칙 따르기"
    - "기존 아키텍처 패턴 존중"
    - "불필요한 리팩토링 금지"
  효과: "기존 코드와 자연스러운 통합"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Context Engineering, Goal-Backward, User Decision Fidelity, XML Task, Atomic Commits
2. 🆕 **Thin Orchestrator**: CEO Orchestrator 경량화
3. 🆕 **Checkpoint Protocol**: 3종류 체크포인트 시스템
4. 🆕 **Brownfield Analysis**: 기존 코드 존중 패턴

---

### 2.7 oh-my-opencode (97K+ lines, Sisyphus 오케스트레이션)

```yaml
# v2.3 기존 분석
핵심_구조:
  에이전트: 11개 (Sisyphus/Atlas/Prometheus 핵심)
  훅: 34개 라이프사이클 훅
  도구: 20+ 전문화 도구
  테스트: 144개 테스트 파일

혁신적_기능:
  planning_execution_separation:
    prometheus: "순수 계획, 코드 작성 안 함"
    atlas: "실행 + Todo 상태 관리"
    sisyphus: "메인 오케스트레이터 (Opus 4.5)"

  boulder_state:
    저장: ".sisyphus/boulder.json"
    효과: "컨텍스트 손실 없이 세션 복구"
```

**v3.0 심층 분석 신규 발견**:

```yaml
hephaestus_deep_worker:
  설명: "진정한 자율 실행 에이전트"
  특징:
    - "단계별 안내 없이 목표 지향 실행"
    - "구현 전 2-5개 병렬 탐색"
    - "GPT-5.2-Codex 전용 (고성능 모델)"
  철학: "autonomy must be genuine, not simulated"
  차별점: "다른 에이전트가 '자율적'이라 주장하지만 실제로는 단계별 안내 필요. Hephaestus는 진정한 자율"
  효과: "복잡한 작업의 완전 자율 처리"

todo_continuation_enforcer:
  설명: "미완성 작업 방지 시스템 (~1.8K LOC)"
  동작:
    - "에이전트가 작업 중단 시 감지"
    - "미완료 todo 항목 식별"
    - "강제 완료 지시"
  철학: "The boulder must keep rolling"
  효과: "작업 포기 방지, 100% 완료율 목표"

background_agent_concurrency:
  설명: "비차단 병렬 에이전트 실행"
  방식:
    - "background_task() 호출로 비동기 실행"
    - "provider별 동시성 제한"
    - "알림 시스템으로 완료 통지"
    - "task_id로 결과 비동기 조회"
  효과: "메인 작업 중단 없이 5+ 에이전트 병렬"

dynamic_prompts:
  설명: "런타임 시스템 프롬프트 동적 생성"
  기법:
    - "작업 유형에 따른 프롬프트 템플릿 선택"
    - "컨텍스트 기반 지시어 주입"
    - "성능 데이터 기반 프롬프트 최적화"
  효과: "상황에 최적화된 에이전트 행동"

tmux_integration:
  설명: "tmux 기반 병렬 에이전트 시각화"
  기능:
    - "에이전트별 독립 패널"
    - "실시간 출력 모니터링"
    - "패널 간 전환"
  효과: "병렬 작업의 시각적 모니터링"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Planning/Execution 분리, Boulder State, Background Agents, Todo Continuation
2. 🆕 **Hephaestus Deep Worker**: 진정한 자율 실행 패턴
3. 🆕 **Dynamic Prompts**: 런타임 프롬프트 최적화
4. 🆕 **Tmux Integration**: 병렬 에이전트 시각화

---

### 2.8 opencode (2.37M+ 다운로드, Provider-Agnostic)

```yaml
# v2.3 기존 분석
핵심_구조:
  도구: 24개 내장 도구
  에이전트: build/plan/general/explore
  테마: 15+ 내장 테마
  코드: 43K+ LOC (메인 패키지)

혁신적_기능:
  provider_agnostic: "모델 종속 없는 아키텍처"
  permission_system: "세분화된 권한 제어"
  lsp_integration: "완전한 LSP 통합 (9개 작업)"
```

**v3.0 심층 분석 신규 발견**:

```yaml
acp_protocol:
  설명: "Agent Communication Protocol"
  특징:
    - "에이전트 간 표준화된 통신 프로토콜"
    - "A2A와 유사하지만 독립 규격"
    - "양방향 메시지 교환"
  비교_a2a: "Google A2A가 서비스 간 통신이라면, ACP는 에이전트 내부 통신"
  효과: "이종 에이전트 시스템 간 상호운용"

five_frontends:
  설명: "5개 프론트엔드 인터페이스 동시 지원"
  구현:
    tui: "터미널 (Ink/React 기반)"
    web: "웹 인터페이스"
    desktop: "Tauri 기반 데스크톱 앱"
    mobile: "모바일 앱 (계획)"
    api: "REST/WebSocket API"
  효과: "하나의 백엔드로 다양한 접근점 제공"

spec_driven_development:
  설명: "TypeSpec/Stainless 기반 API 개발"
  방식:
    - "스펙 먼저 정의"
    - "스펙에서 코드 자동 생성"
    - "스펙과 구현의 일치 보장"
  효과: "API 일관성, 자동 문서 생성, SDK 자동 생성"

nix_builds:
  설명: "Nix 기반 재현 가능한 빌드"
  장점:
    - "동일한 의존성 = 동일한 결과"
    - "개발 환경 100% 재현"
    - "크로스 플랫폼 빌드"
  효과: "빌드 재현성 100%"

market_validation:
  다운로드: "2.37M+ (npm)"
  의미: "Provider-Agnostic 접근의 시장 검증"
  시사점: "ACA도 멀티 Provider 지원이 경쟁력"
```

**ACA 적용 가능 패턴 (v3.0 추가)**:
1. ✅ (v2.3) Provider-Agnostic, Permission System, LSP Integration
2. 🆕 **ACP Protocol**: A2A와 보완적인 에이전트 내부 통신
3. 🆕 **Multi-Frontend**: API 레이어 위에 다양한 프론트엔드
4. 🆕 **Spec-Driven Development**: API 스펙 우선 개발

---

### 2.9 SuperClaude_Framework (PM Agent 시스템)

```yaml
# v2.3 기존 분석 (충분히 심층적, 주요 추가 없음)
핵심_구조:
  에이전트: 16개 전문화 에이전트
  패턴: PM Agent 3-Pattern 시스템
  모드: 7개 행동 모드
  MCP: 8개 서버 통합

혁신적_기능:
  confidence_checker: "사전 실행 신뢰도 평가 (25-250x ROI)" # → P0 완료
  self_check_protocol: "사후 구현 검증 (4대 질문 + 7대 위험신호)" # → P0 완료
  reflexion_pattern: "에러 학습 및 예방" # → P1 완료
  parallel_execution: "Wave → Checkpoint → Wave 패턴"
```

**v3.0 추가 메모**: SuperClaude의 핵심 패턴(ConfidenceChecker, SelfCheckProtocol, ReflexionPattern)은 이미 P0/P1로 구현 완료. Wave-based Parallel Execution 패턴은 P2 컨텍스트 통합 시 참고 가능.

---

## 3. 기존 개선 영역 (v2.3, 현황 업데이트)

> 이 섹션은 v2.3에서 정의된 6개 개선 영역의 현재 상태를 업데이트합니다.

### 3.1 영역 1: Pre-Execution Confidence System → ✅ 완료

- **구현**: `core/validation/confidence-checker.ts` (11KB)
- **상태**: P0 완료 (2026-02-06)
- **검증**: 5대 체크항목, 90%/70% 임계값 로직 구현
- **다음 단계**: 실제 워크플로우 통합 및 ROI 측정

### 3.2 영역 2: Context Engineering → 🔶 고도화 대기 (P2)

- **현재**: `context-monitor.hook.ts` 기본 구현 (70%/85%/95%)
- **목표**: get-shit-done 품질 곡선 (0-30% PEAK, 30-50% GOOD 등) 적용
- **상태**: 기존 P2 우선순위 유지

### 3.3 영역 3: Post-Execution Validation → ✅ 완료

- **구현**: `core/validation/self-check-protocol.ts` (10KB) + `goal-backward-verifier.ts` (12KB)
- **상태**: P0 완료 (2026-02-06)
- **다음 단계**: completion-detector.ts와 통합

### 3.4 영역 4: Error Learning System → ✅ 완료

- **구현**: `core/learning/reflexion-pattern.ts` (10KB) + `instinct-store.ts` (22KB) + `solutions-cache.ts` (17KB)
- **상태**: P1 완료 (2026-02-06)
- **다음 단계**: Instinct Import/Export 확장 (v3.0 신규 발견 기반)

### 3.5 영역 5: Planning/Execution Separation → ⏳ 대기

- **현재**: CEO Orchestrator가 계획+실행 혼합
- **참고**: oh-my-opencode Prometheus/Atlas 분리
- **상태**: Thin Orchestrator (New P1)와 통합 검토

### 3.6 영역 6: Provider-Agnostic Architecture → ✅ 기본 완료

- **현재**: 7 Provider 지원 (Claude, OpenAI, Gemini API + 4 CLI)
- **고도화**: Vercel AI SDK 패턴 참고, Fallback Chain 구현
- **상태**: 기본 구현 완료, Tiered Model Routing (New P0)으로 고도화

---

## 4. 신규 개선 영역 (v3.0 심층 분석)

### 4.1 영역 7: Behavioral Evals Framework ⭐ (New P0)

#### 가설

gemini-cli의 Behavioral Evals를 도입하면, ACA 에이전트의 품질을 객관적으로 측정하고 회귀를 방지할 수 있다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | gemini-cli: ALWAYS_PASSES/USUALLY_PASSES 시스템 | `gemini-cli/evals/` |
| [IMPL] | oh-my-claudecode: SWE-bench 벤치마킹 | `oh-my-claudecode/benchmark/` |
| [GAP] | ACA: 에이전트 품질 객관적 측정 수단 없음 | 코드 분석 |

#### 설계

```yaml
behavioral_evals_system:
  구성요소:
    eval_runner:
      설명: "테스트 케이스 실행기"
      입력: "eval 정의 파일 (YAML/JSON)"
      출력: "PASS/FAIL + 상세 리포트"

    eval_definitions:
      severity_levels:
        ALWAYS_PASSES:
          설명: "회귀 방지 - 반드시 100% 통과"
          예시: "코드 생성 시 문법 오류 없음"
        USUALLY_PASSES:
          설명: "품질 트렌드 - 80%+ 통과 기대"
          예시: "리팩토링 시 테스트 커버리지 유지"

    eval_categories:
      - code_quality: "생성 코드 품질"
      - tool_usage: "도구 사용 적절성"
      - error_handling: "에러 처리 정확성"
      - task_completion: "태스크 완료율"
      - response_quality: "응답 일관성"

  통합:
    ci_cd: "매 릴리스 전 eval 실행"
    monitoring: "일간/주간 품질 리포트"
    regression: "새 기능 추가 시 기존 eval 확인"
```

#### 구현 위치

```
src/core/evals/                    # 🆕
├── index.ts
├── eval-runner.ts                 # Eval 실행기
├── eval-reporter.ts               # 결과 리포팅
├── definitions/                   # Eval 정의
│   ├── code-quality.eval.yaml
│   ├── tool-usage.eval.yaml
│   └── task-completion.eval.yaml
└── interfaces/
    └── eval.interface.ts
```

---

### 4.2 영역 8: Tiered Model Routing ⭐ (New P0)

#### 가설

oh-my-claudecode의 Tiered Model Routing을 적용하면, ACA의 7 Provider를 비용/성능별로 자동 선택하여 30-50% 비용 절감이 가능하다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-claudecode: 3-tier 모델 라우팅 | `agents/tiered-model-router.ts` |
| [IMPL] | oh-my-opencode: 에이전트별 모델 배정 | `AGENTS.md` |
| [GAP] | ACA: 모든 작업에 동일 모델 사용 | 코드 분석 |

#### 설계

```yaml
tiered_routing:
  tier_1_fast:
    모델: "haiku, gpt-4o-mini, gemini-flash"
    용도: "파일 읽기, 포맷팅, 간단한 수정"
    비용: "최저"
    응답속도: "최빠름"

  tier_2_balanced:
    모델: "sonnet, gpt-4o, gemini-pro"
    용도: "코드 작성, 리팩토링, 테스트 생성"
    비용: "중간"
    응답속도: "보통"

  tier_3_powerful:
    모델: "opus, o3, gemini-ultra"
    용도: "아키텍처 설계, 복잡한 디버깅, 계획 수립"
    비용: "최고"
    응답속도: "느림"

  라우팅_전략:
    기준:
      - task_complexity: "작업 복잡도 점수 (1-10)"
      - token_budget: "남은 토큰 예산"
      - quality_requirement: "품질 요구 수준"
      - latency_requirement: "응답 속도 요구"
    fallback: "tier_3 실패 → tier_2 → tier_1"
```

#### 구현 위치

```
src/shared/llm/                    # 기존 모듈 확장
├── tiered-router.ts               # 🆕 Tiered Router
├── routing-strategy.ts            # 🆕 라우팅 전략
└── cost-tracker.ts                # 🆕 비용 추적
```

---

### 4.3 영역 9: JSONL Session Persistence (New P1)

#### 가설

codex의 JSONL append-only 세션 저장을 적용하면, crash-safe한 세션 복구가 가능하다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | codex: JSONL 세션 파일 | `codex-rs/session/` |
| [IMPL] | oh-my-opencode: Boulder State | `.sisyphus/boulder.json` |
| [GAP] | ACA: session-manager.ts 존재하지만 crash-safety 미보장 | 코드 분석 |

#### 설계

```yaml
jsonl_persistence:
  파일_형식: "각 턴이 독립 JSON 라인"
  저장_위치: "data/sessions/{session-id}.jsonl"
  특성:
    - append_only: "기존 데이터 수정 불가, 추가만"
    - crash_safe: "fsync 후 쓰기 완료"
    - streamable: "대용량 세션도 라인 단위 읽기"
    - compactable: "주기적 압축 (오래된 턴 요약)"
  session_manager_통합:
    방식: "기존 session-manager.ts 내부 스토리지를 JSONL로 교체"
    하위호환: "기존 API 유지"
```

---

### 4.4 영역 10: Progressive Sandbox Escalation (New P1)

#### 가설

codex의 Progressive Sandbox + claude-code의 Progressive Disclosure를 결합하면, ACA의 보안 모듈을 신뢰 기반 에스컬레이션으로 강화할 수 있다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | codex: suggest → auto-edit → full-auto | `codex-cli/src/` |
| [IMPL] | claude-code: Permission Level 0-5 | claude-code 문서 |
| [GAP] | ACA: security/ 모듈 존재, 단계별 에스컬레이션 없음 | 코드 분석 |

#### 설계

```yaml
escalation_levels:
  level_0_readonly:
    허용: "파일 읽기, 검색"
    제한: "모든 쓰기/실행"

  level_1_suggest:
    허용: "파일 읽기 + 변경 제안"
    제한: "실제 변경, bash 실행"

  level_2_auto_edit:
    허용: "파일 읽기/쓰기"
    제한: "bash 실행 (승인 필요)"

  level_3_full_auto:
    허용: "모든 작업"
    제한: "없음 (감사 로그만)"

  에스컬레이션_기준:
    - "ConfidenceChecker 점수 > 90%"
    - "사용자 명시적 승인"
    - "에이전트 성공 이력 (ReflexionPattern)"
```

---

### 4.5 영역 11: Thin Orchestrator Pattern (New P1)

#### 가설

get-shit-done의 Thin Orchestrator 패턴을 적용하면, 오케스트레이터 모듈의 과도한 복잡성(~11K LOC, 28 files)을 줄이고 유지보수성을 높일 수 있다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | get-shit-done: 최소 조정자 패턴 | `get-shit-done/agents/` |
| [IMPL] | oh-my-opencode: Sisyphus = 라우팅만 | `oh-my-opencode/src/agents/` |
| [GAP] | ACA: 오케스트레이터 모듈에 비즈니스 로직 분산 | `orchestrator/` (~11K LOC, 28 files; ceo-orchestrator.ts 542 LOC) |

#### 설계

```yaml
thin_orchestrator_원칙:
  해야_할_것:
    - "작업 라우팅 (어느 에이전트에게 위임)"
    - "상태 관리 (작업 진행 상태 추적)"
    - "에러 에스컬레이션 (실패 시 대응 결정)"
    - "결과 집계 (완료된 작업 취합)"

  하지_말아야_할_것:
    - "코드 분석 (→ Explorer Agent)"
    - "계획 수립 (→ Planner Agent)"
    - "코드 작성 (→ Coder Agent)"
    - "테스트 실행 (→ Tester Agent)"
    - "리뷰 (→ Reviewer Agent)"

  리팩토링_방향:
    현재: "orchestrator/ (~11K LOC, 28 files across 10+ modules)"
    목표: "orchestrator/ (~5-7K LOC, 라우팅/상태/에러만; 비즈니스 로직은 에이전트로 위임)"
```

---

### 4.6 영역 12: Composable Skill Architecture (New P2)

#### 가설

oh-my-claudecode의 Composable Skills 패턴을 적용하면, ACA의 에이전트 기능을 조합 가능한 스킬 단위로 분리하여 재사용성을 높일 수 있다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-claudecode: 32개 조합 가능 스킬 | `skills/` 디렉토리 |
| [IMPL] | everything-claude-code: 30+ 도메인별 스킬 | `skills/` 디렉토리 |
| [GAP] | ACA: 에이전트 내부에 스킬 하드코딩 | 코드 분석 |

---

### 4.7 영역 13: Deep Worker / Genuine Autonomy (New P2)

#### 가설

oh-my-opencode의 Hephaestus + claude-code의 Ralph Loop를 결합하면, ACA 에이전트의 진정한 자율 실행 수준을 높일 수 있다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-opencode: Hephaestus (진정한 자율) | `src/agents/hephaestus/` |
| [IMPL] | claude-code: Ralph Loop (자율 반복) | claude-code 코드 |
| [PHILOSOPHY] | "autonomy must be genuine, not simulated" | oh-my-opencode AGENTS.md |

#### 설계

```yaml
genuine_autonomy:
  현재_ACA: "작업 단위 실행 (태스크 받으면 실행)"
  목표: "목표 단위 실행 (목표 받으면 스스로 분해, 탐색, 실행, 검증)"

  핵심_패턴:
    pre_exploration: "구현 전 2-5개 병렬 탐색"
    self_planning: "목표에서 태스크 자동 분해"
    self_verification: "GoalBackwardVerifier 자동 실행"
    retry_with_strategy_change: "실패 시 전략 변경 후 재시도"

  연동:
    confidence_checker: "탐색 결과 기반 신뢰도 평가"
    reflexion_pattern: "실패 원인 학습"
    todo_continuation: "미완료 작업 강제 완료"
```

---

### 4.8 영역 14: Multi-Frontend / ACP Protocol (New P2)

#### 가설

opencode의 Multi-Frontend 패턴을 적용하면, ACA를 CLI뿐 아니라 웹, API, 데스크톱에서 접근 가능하게 확장할 수 있다.

#### 증거

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | opencode: 5 Frontend (TUI, Web, Desktop, Mobile, API) | 코드 분석 |
| [IMPL] | ACA: Fastify + GraphQL + WebSocket API 이미 존재 | `src/api/` |
| [MARKET] | opencode 2.37M 다운로드 = 멀티 접근점 시장 검증 | npm 통계 |

#### 현황과 기회

```yaml
현재_ACA_API:
  rest: "Fastify REST API ✅"
  graphql: "Mercurius GraphQL ✅"
  websocket: "실시간 이벤트 ✅"
  cli: "Commander.js CLI ✅"

확장_기회:
  web_dashboard: "API 위에 React/Next.js 대시보드"
  desktop_app: "Tauri 기반 데스크톱 (opencode 패턴)"
  acp_integration: "Agent Communication Protocol 지원"
```

---

### 4.9 영역 15: HUD Dashboard (New P3)

- **출처**: oh-my-claudecode HUD
- **설명**: 실시간 에이전트 상태, 토큰 사용량, 작업 진행률 모니터링
- **구현**: PM2 + WebSocket + React 대시보드
- **ACA 연동**: ecosystem.config.js (이미 PM2 사용)에 모니터링 레이어 추가

### 4.10 영역 16: SWE-bench Benchmarking (New P3)

- **출처**: oh-my-claudecode SWE-bench
- **설명**: 표준화된 코딩 과제로 에이전트 성능 객관적 측정
- **활용**: 에이전트 개선의 정량적 검증, 릴리스 품질 게이트

### 4.11 영역 17: HLD/MLD/LLD 문서 자동생성 (New P3)

> **출처**: FEATURE_IMPROVEMENTS.md v1.0 (2026-01-24) 미반영 콘텐츠 복원

- **설명**: 요구사항에서 HLD(High Level Design) → MLD(Mid Level Design) → LLD(Low Level Design) 자동 생성
- **상태**: FEATURE_IMPROVEMENTS.md에 상세 스펙 존재하나, IMPROVEMENT_RECOMMENDATIONS에 미포함이었음
- **가치**: ArchitectAgent가 이미 존재하므로 Generator 모듈 추가로 구현 가능

### 4.12 영역 18: Brownfield Analysis (New P3)

- **출처**: get-shit-done Brownfield Analysis
- **설명**: 기존 코드베이스의 패턴/명명규칙/아키텍처를 자동 분석하여 일관된 코드 생성
- **가치**: 외부 프로젝트 작업 시 기존 코드와 자연스러운 통합

---

## 5. Next-Phase 우선순위 로드맵

### 5.1 우선순위 매트릭스 (v3.2 — 통합 검증 반영)

```
이전 Phase:
├── P0 🟡: validation/ 모듈 구현 완료, 파이프라인 통합 미완료
├── P1 🟡: learning/ 모듈 구현 완료, 파이프라인 통합 미완료
├── P2 ✅: Context 통합 (core/context/ 이미 구현, dx/ 정리만 잔여)
└── P3 ⏳: Agent 통합 (기존, 대기)

🔴 최우선: P0/P1 파이프라인 통합 (Integration)
├── validation/ → OrchestratorRunner/Agent 라이프사이클 연결
├── learning/ → Agent 에러 처리/워크플로우 연결
├── hooks/ → HookExecutor 파이프라인 부트스트랩 (현재 1/9만 연결)
├── context/ → hooks가 core/context/ 사용하도록 연결 (현재 dx/ 사용 중)
├── session/ → 오케스트레이터 라이프사이클 연결
├── a2a/ → AgentCommunication 레이어 연결
└── DI 컨테이너 부트스트랩 또는 직접 주입 결정

Next Phase (신규):
├── New P0: Behavioral Evals, Tiered Model Routing
├── New P1: JSONL Session, Progressive Sandbox, Thin Orchestrator
├── New P2: Composable Skills, Deep Worker, Multi-Frontend/ACP
└── New P3: HUD, SWE-bench, HLD/MLD/LLD, Brownfield Analysis
```

### 5.2 상세 로드맵

| 단계 | 영역 | 모듈 | 리스크 | 예상 기간 | 효과 |
|------|------|------|--------|----------|------|
| **New P0-a** | Behavioral Evals | `core/evals/` | Low | 2-3주 | 품질 측정 |
| **New P0-b** | Tiered Model Routing | `shared/llm/` | Low | 1-2주 | 30-50% 비용 절감 |
| **기존 P2** | Context 통합 | `core/context/` | Medium | 2-3주 | 모듈 통합 |
| **New P1-a** | JSONL Session | `core/session/` | Low | 1-2주 | crash-safety |
| **New P1-b** | Progressive Sandbox | `core/security/` | Medium | 2-3주 | 보안 강화 |
| **New P1-c** | Thin Orchestrator | `core/orchestrator/` | High | 4-6주 | 복잡성 감소 |
| **기존 P3** | Agent 통합 | `core/agents/` | High | 6주+ | 구조 개선 |
| **New P2** | Composable Skills, Deep Worker, Multi-Frontend | 다중 모듈 | Medium | 8-12주 | 확장성 |
| **New P3** | HUD, SWE-bench, HLD/MLD/LLD, Brownfield | 다중 모듈 | Low-Medium | 12-16주 | 고도화 |

### 5.3 버전 계획

```
v4.3.x - ✅ 완료: Pre-Execution Validation (ConfidenceChecker, SelfCheck, GoalBackward)
v4.4.x - ✅ 완료: Learning System (ReflexionPattern, InstinctStore, SolutionsCache)
v5.0.x - 🆕 Behavioral Evals + Tiered Model Routing (New P0)
v5.1.x - 🆕 Context 통합 + JSONL Session (기존 P2 + New P1-a)
v5.2.x - 🆕 Progressive Sandbox + Thin Orchestrator (New P1-b,c)
v6.0.x - 🆕 Composable Skills + Deep Worker (New P2)
v6.1.x - 🆕 Multi-Frontend / ACP (New P2)
v7.0.x - Agent 통합 (기존 P3)
v8.0.x - HUD + SWE-bench + HLD/MLD/LLD + Brownfield (New P3)
```

---

## 6. 불확실성 예산

### 6.1 전체 불확실성 분포 (v3.0 업데이트)

```
┌─────────────────────────────────────────────────────────────┐
│                    불확실성 예산 (100%)                      │
├─────────────────────────────────────────────────────────────┤
│  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25% (↓5%)   │
│  ▲ 기술적 불확실성                                          │
│    - Behavioral Evals 효과 (6%)                             │
│    - Tiered Routing 절감율 (5%)                             │
│    - Thin Orchestrator 리팩토링 범위 (7%)                    │
│    - Deep Worker 자율성 수준 (7%)                           │
│                                                              │
│  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25%         │
│  ▲ 일정 불확실성 (동일)                                     │
│                                                              │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 20%         │
│  ▲ 외부 의존성 불확실성 (동일)                              │
│                                                              │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15%         │
│  ▲ 비즈니스 불확실성 (동일)                                 │
│                                                              │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15% (↑5%)   │
│  ▲ 통합 불확실성                                             │
│    - 12개 신규 개선 영역 조합 복잡성                          │
│    - 기존 P2/P3와 신규 우선순위 충돌 가능                     │
│    - CEO Orchestrator 리팩토링 영향 범위                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 지식 계보

### 7.1 정보 출처 분류 (v3.0)

```yaml
1차_출처_직접_분석:
  - autonomous-coding-agents 코드베이스 (655+ 파일, 187K+ LOC)
  - UNIFIED_VISION.md v3.0
  - PROJECT_ANALYSIS_REPORT.md v1.0
  - core/validation/ 구현 (P0 완료)
  - core/learning/ 구현 (P1 완료)
  신뢰도: 95%

2차_출처_외부_프로젝트_분석 (9개 - 2차 심층):
  v2.3_분석:
    - oh-my-claudecode (101K+ lines)
    - claude-code (Anthropic 공식)
    - codex (OpenAI CLI)
    - gemini-cli (Google CLI)
    - everything-claude-code (Production config)
    - get-shit-done (Context Engineering)
    - oh-my-opencode (97K+ lines)
    - opencode (43K+ LOC)
    - SuperClaude_Framework (PM Agent)
  v3.0_심층_추가:
    - "각 프로젝트의 코드 레벨 패턴 추출"
    - "v2.3 미발견 기능 12개 신규 식별"
    - "프로젝트 간 패턴 교차 분석"
  신뢰도: 90% (v2.3 대비 +5%)

3차_출처_문서_복원:
  - FEATURE_IMPROVEMENTS.md v1.0 (2026-01-24)
  - "HLD/MLD/LLD 문서 생성 시스템 컨셉 복원"
  - "Feature Repository 컨셉 참고"
  신뢰도: 80%
```

### 7.2 v3.0 핵심 결정의 지식 계보

#### 결정: Behavioral Evals 도입 (New P0)

```yaml
지식_계보:
  출처_1:
    위치: "gemini-cli/evals/"
    유형: "[IMPL] 실제 구현"
    신뢰도: 95%
    근거: "Google이 프로덕션에서 사용하는 eval 시스템"

  출처_2:
    위치: "oh-my-claudecode/benchmark/"
    유형: "[IMPL] SWE-bench 벤치마크"
    신뢰도: 85%

  추론:
    내용: "객관적 품질 측정이 에이전트 개선의 필수 기반"
    신뢰도: 90%
```

#### 결정: Tiered Model Routing 도입 (New P0)

```yaml
지식_계보:
  출처_1:
    위치: "oh-my-claudecode/agents/tiered-model-router.ts"
    유형: "[IMPL] 실제 구현"
    신뢰도: 90%

  출처_2:
    위치: "oh-my-opencode/AGENTS.md (에이전트별 모델 배정)"
    유형: "[IMPL] 실제 구현"
    신뢰도: 85%

  추론:
    내용: "30-50% 비용 절감 + 7 Provider 최적 활용"
    신뢰도: 80%
    근거: "두 프로젝트 모두 비용 절감 보고"
```

#### 결정: Thin Orchestrator 도입 (New P1)

```yaml
지식_계보:
  출처_1:
    위치: "get-shit-done/agents/"
    유형: "[IMPL] Thin Orchestrator 패턴"
    신뢰도: 90%

  출처_2:
    위치: "oh-my-opencode/src/agents/ (Sisyphus = 라우팅만)"
    유형: "[IMPL] 유사 패턴"
    신뢰도: 85%

  출처_3:
    위치: "ACA orchestrator/ (~11K LOC, 28 files)"
    유형: "[GAP] 모듈 전체에 걸친 복잡성"
    신뢰도: 95%

  추론:
    내용: "CEO 오케스트레이터를 라우팅/상태 관리로 경량화"
    신뢰도: 75%
    근거: "High Risk - 대규모 리팩토링 필요"
```

---

## 8. 코드 구조 분석 및 개선 방안

### 8.1 현재 코드 구조 개요

```
autonomous-coding-agents/src/
├── core/                          # 핵심 프레임워크 (~146K LOC)
│   ├── kernel/                    # OS 커널 (Scheduler, ResourceManager, ~4K LOC)
│   ├── orchestrator/              # 오케스트레이션 (~11K LOC, 28 files)
│   ├── agents/                    # 에이전트 시스템 (~16K LOC; specialized 7 + teams 4)
│   ├── hooks/                     # 9개 Hook 타입 (31개 파일, ~13K LOC)
│   ├── session/                   # ❌ 미연결 — 세션 관리 (~1.7K LOC)
│   ├── memory/                    # 프로젝트 스토어 (~1.2K LOC)
│   ├── knowledge/                 # 지식 저장소 (~1.5K LOC)
│   ├── quality/                   # 품질 게이트 (5개 체커)
│   ├── workflow/                  # 워크플로우 엔진 (~8K LOC)
│   ├── a2a/                       # ❌ 미연결 — A2A 프로토콜 (~5K LOC)
│   ├── security/                  # 6개 보안 모듈
│   ├── tools/                     # 7개 도구 카테고리
│   ├── teams/                     # ✅ 작동 — 팀 기반 에이전트 (Planning, Dev, QA)
│   ├── context/                   # ❌ 미연결 — 컨텍스트 관리 (~2K LOC, hooks는 dx/ 사용)
│   ├── validation/                # 🟡 모듈 완료, 통합 미완료 (consumer 0)
│   ├── learning/                  # 🟡 모듈 완료, 통합 미완료 (consumer 0)
│   ├── di/                        # ❌ 부트스트랩 안됨 — DI 컨테이너 (~1.2K LOC)
│   └── enterprise/                # 엔터프라이즈 기능
│
├── shared/llm/                    # 7 Provider (Claude, OpenAI, Gemini + 4 CLI)
├── dx/                            # 개발자 경험 도구
├── api/                           # API 레이어 (REST, GraphQL, WebSocket)
└── agents/                        # ⚠️ 레거시 에이전트 (중복)
```

### 8.2 v3.0 신규 모듈 배치 제안

```
src/core/
├── evals/                         # 🆕 영역 7: Behavioral Evals (New P0)
│   ├── eval-runner.ts
│   ├── eval-reporter.ts
│   └── definitions/

src/shared/llm/
├── tiered-router.ts               # 🆕 영역 8: Tiered Model Routing (New P0)
├── routing-strategy.ts
└── cost-tracker.ts

src/core/session/
├── jsonl-persistence.ts           # 🆕 영역 9: JSONL Persistence (New P1)

src/core/security/
├── sandbox-escalation.ts          # 🆕 영역 10: Progressive Sandbox (New P1)

src/core/orchestrator/
├── [리팩토링]                      # 🆕 영역 11: Thin Orchestrator (New P1)

src/core/skills/                   # 🆕 영역 12: Composable Skills (New P2)
├── skill-registry.ts
├── skill-pipeline.ts
└── skills/
```

### 8.3 기존 구조적 문제점 (v2.3에서 이관)

#### 🔴 문제 1: 에이전트 정의 분산 (3곳)
- `src/agents/` (레거시), `src/core/agents/`, `src/core/agents/specialized/`
- **대응**: 기존 P3 Agent 통합

#### 🟢 문제 2: 유사 기능 분산 배치 → **대부분 해결됨**
- `core/context/` 모듈이 이미 생성되어 있으며, token-budget-manager, context-monitor, output-optimizer, quality-curve, compaction-strategy 모두 포함 (~2K LOC)
- `dx/token-budget/`, `dx/output-optimizer/`에 re-export 잔재 존재 (정리 필요)
- `core/hooks/token-optimizer/`, `core/hooks/context-monitor/`는 hook 레이어로서 별도 유지가 적절
- **대응**: 기존 P2 Context 통합 → 대부분 완료, dx/ re-export 정리 + hook 연동 강화만 필요

#### 🟡 문제 3: Orchestrator 모듈 복잡성 (~11K LOC, 28 files)
- ceo-orchestrator.ts 자체는 542 LOC이나, task-decomposer(1.2K), orchestrator-service(875), orchestrator-runner(706) 등 10개 파일에 로직 분산
- **대응**: New P1 Thin Orchestrator 리팩토링 (비즈니스 로직 → 에이전트 위임)

#### 🔴 문제 4: 구현된 모듈의 파이프라인 미연결 (v3.2 발견)

**2026-02-08 통합 검증으로 발견된 핵심 문제.** 다수의 core/ 모듈이 구현되었지만 실행 파이프라인에 연결되지 않음.

| 미연결 모듈 | LOC | 소비자 수 | 영향도 |
|------------|----:|:---------:|--------|
| `core/validation/` | 1,243 | 0 | 🔴 P0 검증이 실행 안됨 |
| `core/learning/` | 1,942 | 0 | 🔴 P1 학습이 작동 안됨 |
| `core/context/` | ~2,000 | 0 | 🟡 hooks가 dx/ 경로 사용 중 |
| `core/a2a/` | 5,052 | 0 | 🟡 에이전트 간 통신 미작동 |
| `core/session/` | 1,754 | 0 | 🟡 세션 라이프사이클 미관리 |
| `core/di/` | 1,226 | 0 | 🟡 DI 부트스트랩 안됨 |
| `core/hooks/` (8/9) | ~12,000 | 0 | 🟡 CodeQualityHook만 1곳 연결 |

**작동 중인 파이프라인** (유일):
```
OrchestratorRunner → CEOOrchestrator → TeamAgentLLMAdapter
                                      → Planning Agent (✅)
                                      → Development Agent (✅)
                                      → QA Agent (✅)
                                      → CodeQualityHook (✅, quality-executor 경유)
```

**기타 설정 이슈**:
- `src/api/auth/middlewares/rbac.middleware.ts` — 빈 파일 (type-check 실패 원인)
- `AgentType` enum 불일치 — Prisma: 3 types vs `core/interfaces/`: 10 types
- `.env.example` — PostgreSQL 포트 5432 → 실제 5434
- `ILLMClient` 이중 정의 — `core/agents/interfaces.ts` vs `shared/llm/base-client.ts` (호환 불가)

**대응**: Phase 2 시작 전 **Integration Sprint** 필요 (최우선)

---

## 부록: 프로젝트별 핵심 패턴 요약 (v3.0 통합)

> **범례**: ✅ 구현 완료 | 🔶 고도화 필요 | ❌ 미구현 | 🆕 v3.0 신규 발견

### 완료된 Gap

| 프로젝트 | 핵심 패턴 | 우선순위 | 상태 |
|---------|----------|---------|------|
| SuperClaude | ConfidenceChecker | P0 | ✅ 완료 |
| SuperClaude | SelfCheckProtocol | P0 | ✅ 완료 |
| get-shit-done | GoalBackwardVerifier | P0 | ✅ 완료 |
| SuperClaude | ReflexionPattern | P1 | ✅ 완료 |
| everything-claude-code | InstinctStore | P1 | ✅ 완료 |
| SuperClaude | SolutionsCache | P1 | ✅ 완료 |

### 신규 Gap (v3.0)

| 프로젝트 | 핵심 패턴 | 신규 우선순위 | 상태 |
|---------|----------|-------------|------|
| 🆕 **gemini-cli** | Behavioral Evals Framework | **New P0** | ❌ |
| 🆕 **oh-my-claudecode** | Tiered Model Routing | **New P0** | ❌ |
| 🆕 **codex** | JSONL Session Persistence | **New P1** | ❌ |
| 🆕 **codex + claude-code** | Progressive Sandbox Escalation | **New P1** | ❌ |
| 🆕 **get-shit-done** | Thin Orchestrator Pattern | **New P1** | ❌ |
| 🆕 **oh-my-claudecode** | Composable Skill Architecture | **New P2** | ❌ |
| 🆕 **oh-my-opencode + claude-code** | Deep Worker / Ralph Loop | **New P2** | ❌ |
| 🆕 **opencode** | Multi-Frontend / ACP | **New P2** | ❌ |
| 🆕 **oh-my-claudecode** | HUD Dashboard | **New P3** | ❌ |
| 🆕 **oh-my-claudecode** | SWE-bench Benchmarking | **New P3** | ❌ |
| 🆕 **FEATURE_IMPROVEMENTS.md** | HLD/MLD/LLD 문서 자동생성 | **New P3** | ❌ |
| 🆕 **get-shit-done** | Brownfield Analysis | **New P3** | ❌ |

### 고도화 대기

| 프로젝트 | 핵심 패턴 | 현재 구현 | 권장 조치 |
|---------|----------|----------|----------|
| get-shit-done | Context Engineering | ✅ context-monitor.hook.ts | 🔶 품질 곡선 세분화 |
| get-shit-done | Goal-Backward Verification | ✅ goal-backward-verifier.ts | 🔶 completion-detector 통합 |
| oh-my-opencode | Boulder State | ✅ session-manager.ts | 🔶 JSONL 전환 |
| opencode | Provider-Agnostic | ✅ 7 Provider 지원 | 🔶 Tiered Routing |
| oh-my-claudecode | Ecomode | ✅ token-optimizer.hook.ts | 🔶 Tiered Routing 연동 |
| everything-claude-code | 6-Phase Hook | ✅ 9개 Hook 타입 | 🔶 필요시 확장 |
| opencode | Permission System | ✅ security/ 모듈 | 🔶 Progressive Sandbox |

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 3.0
  작성일: 2026-02-08
  이전_버전: 2.3 (2026-02-06)
  작성_방법론: "AGENT.md 비권위적 분석 원칙"
  분석_프로젝트: 9개 (2차 심층 분석)

변경_이력:
  v1.0: 4개 프로젝트 분석 (oh-my-claudecode, claude-code, codex, gemini-cli)
  v2.0: 5개 프로젝트 추가 분석 (everything-claude-code, get-shit-done, oh-my-opencode, opencode, SuperClaude_Framework)
  v2.1: 팩트 체크 수정
  v2.2: 코드베이스 검토 - 이미 구현된 기능 식별, Gap 매핑 재정렬
  v2.3: 코드 구조 분석 추가 (478개 TS 파일, 149개 디렉토리 — v2.3 시점 기준)
  # 참고: 2026-02-08 현재 517개 TS 파일, 163개 디렉토리 (P0/P1 구현으로 증가)
  v3.0: |
    2차 심층 분석:
    - P0/P1 완료 상태 반영 (validation/, learning/ 모듈)
    - 9개 프로젝트 코드 레벨 심층 분석 (12개 신규 개선 영역 발견)
    - Next-Phase 우선순위 재편성 (New P0~P3)
    - FEATURE_IMPROVEMENTS.md 미반영 콘텐츠 복원 (HLD/MLD/LLD)
    - 콘텐츠 손실 검증 완료 (v1→v2.3 손실 없음 확인)

콘텐츠_보존_검증:
  v1_to_v2.3: "4개 프로젝트 분석 전체 보존 ✅"
  feature_improvements_recovery: "HLD/MLD/LLD 컨셉 복원 ✅"
  v2.3_to_v3.0: "기존 내용 100% 보존 + 신규 섹션 추가 ✅"

검토_상태:
  초안: ✅ 완료
  기술_검토: ✅ 완료 (2026-02-06 코드베이스 대조)
  구조_분석: ✅ 완료 (2026-02-06 478개 파일 분석)
  2차_심층_분석: ✅ 완료 (2026-02-08)
  팩트_체크: ✅ 완료 (2026-02-08 v3.1)
  최종_승인: ⏳ 대기

v3.1_팩트체크_수정사항:
  - "ceo-orchestrator.ts 15K+ LOC" → "orchestrator/ ~11K LOC (28 files; ceo-orchestrator.ts 542 LOC)"
  - "core/ ~48K LOC" → "core/ ~146K LOC"
  - "agents/ ~200K LOC" → "agents/ ~19K LOC (16K core + 3K legacy)"
  - "9개 Hook 타입 (18개 파일)" → "9개 Hook 타입 (31개 파일)"
  - "기존 P2 Context 통합 필요" → "core/context/ 이미 존재 (대부분 완료)"
  - "v2.3 시점 478 TS / 149 dirs" → "현재 517 TS / 163 dirs (참고 추가)"
  - IMPLEMENTATION_PRIORITY_LIST: tasks #15-20 상태 업데이트 (✅ 이미 존재)
  - task-router.ts 이미 존재 (425 LOC) 반영

다음_갱신:
  예정일: New P0 착수 시 또는 2026-03-08
  담당: 프로젝트 소유자
```

---

> **면책 조항**: 이 문서의 모든 권고사항은 가설이며, 실제 적용 전 검증이 필요합니다. 최종 결정 권한은 프로젝트 소유자에게 있습니다.
