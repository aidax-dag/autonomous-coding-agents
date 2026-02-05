# Autonomous Coding Agents - 개선 권고 문서 v2.0

> **버전**: 2.0
> **작성일**: 2026-02-06
> **문서 유형**: 비권위적 분석 (Non-Authoritative Analysis)
> **방법론**: AGENT.md 원칙 기반 비판적 사고
> **분석 대상**: 9개 외부 프로젝트 (이전 버전 4개 → 확장)

---

## ⚠️ 중요 공지

**이 문서는 비권위적입니다.** 모든 권고사항은 가설이며, 검증이 필요합니다. 최종 결정 권한은 프로젝트 소유자에게 있습니다.

---

## 목차

1. [Executive Summary](#1-executive-summary)
2. [분석 대상 프로젝트 요약](#2-분석-대상-프로젝트-요약)
3. [핵심 개선 영역 분석](#3-핵심-개선-영역-분석)
4. [버전별 개선 로드맵](#4-버전별-개선-로드맵)
5. [불확실성 예산](#5-불확실성-예산)
6. [지식 계보](#6-지식-계보)

---

## 1. Executive Summary

### 1.1 가설 (Hypothesis)

**주 가설**: 분석된 9개 외부 프로젝트의 검증된 패턴을 선택적으로 적용하면, autonomous-coding-agents의 약점을 개선하면서 프로젝트 고유의 비전("CEO 1명 + AI 에이전트 완전 자율 소프트웨어 회사")을 유지할 수 있다.

**부 가설들**:
- H1: Project Memory 시스템 도입으로 세션 간 지식 유실 문제 해결 가능
- H2: 행동 평가(Behavioral Evals) 프레임워크가 에이전트 품질 보장에 필수적
- H3: 보안 샌드박싱의 강화가 자율 실행 신뢰도를 높임
- H4: 토큰 효율화 시스템이 운영 비용을 30-50% 절감 가능
- **H5 (신규)**: 신뢰도 검사(Confidence Check)가 잘못된 방향 작업을 방지하여 25-250x ROI 달성 가능
- **H6 (신규)**: 컨텍스트 엔지니어링이 에이전트 품질 저하의 근본 원인 해결
- **H7 (신규)**: Instinct 기반 학습이 스킬보다 유연한 패턴 학습 제공
- **H8 (신규)**: Goal-Backward 검증이 Task-Completion 검증보다 신뢰성 높음
- **H9 (신규)**: Provider-Agnostic 아키텍처가 모델 종속성 리스크 완화

### 1.2 증거 요약 (Evidence Summary) - 확장됨

| 프로젝트 | 핵심 강점 | 적용 가능성 | 증거 유형 |
|---------|----------|------------|----------|
| oh-my-claudecode | Project Memory, Ultrapilot | ⭐⭐⭐⭐⭐ | [IMPL] 실제 구현 |
| claude-code | Plugin Architecture, Hooks | ⭐⭐⭐⭐ | [SPEC] 공식 명세 |
| codex | Rust Sandbox, JSON-RPC | ⭐⭐⭐ | [IMPL] 실제 구현 |
| gemini-cli | Behavioral Evals, A2A Protocol | ⭐⭐⭐⭐⭐ | [IMPL] 실제 구현 |
| **everything-claude-code** | **Instinct 학습, Iterative Retrieval** | **⭐⭐⭐⭐⭐** | **[IMPL] 실제 구현** |
| **get-shit-done** | **Context Engineering, Goal-Backward 검증** | **⭐⭐⭐⭐⭐** | **[IMPL] 실제 구현** |
| **oh-my-opencode** | **Sisyphus 오케스트레이션, Boulder State** | **⭐⭐⭐⭐** | **[IMPL] 실제 구현** |
| **opencode** | **Provider-Agnostic, Permission System** | **⭐⭐⭐⭐** | **[IMPL] 실제 구현** |
| **SuperClaude_Framework** | **PM Agent (Confidence/SelfCheck/Reflexion)** | **⭐⭐⭐⭐⭐** | **[IMPL] 실제 구현** |

### 1.3 핵심 Gap vs 해결책 매핑 - 확장됨

| autonomous-coding-agents 약점 | 외부 프로젝트 해결책 | 우선순위 |
|-------------------------------|---------------------|----------|
| Knowledge Layer 5% 구현 | oh-my-claudecode Project Memory + SuperClaude Memory | **P0** |
| 세션 간 지식 유실 | get-shit-done STATE.md + oh-my-opencode Boulder State | **P0** |
| 에이전트 품질 검증 부재 | gemini-cli Behavioral Evals + SuperClaude SelfCheckProtocol | **P0** |
| **잘못된 방향 작업 비용** | **SuperClaude ConfidenceChecker (25-250x ROI)** | **P0 (신규)** |
| **컨텍스트 품질 저하** | **get-shit-done Context Engineering** | **P0 (신규)** |
| 보안 샌드박싱 미흡 | codex Kernel-level + opencode Permission System | P1 |
| 토큰 비용 최적화 없음 | oh-my-claudecode Ecomode | P1 |
| 병렬 실행 미최적화 | oh-my-claudecode Ultrapilot + SuperClaude Parallel | P1 |
| **에러 재발 방지** | **SuperClaude ReflexionPattern (목표 <10% 재발)** | **P1 (신규)** |
| **학습 시스템 부재** | **everything-claude-code Instinct System** | **P1 (신규)** |
| Hook 시스템 미완성 | claude-code + everything-claude-code 34 Hooks | P2 |
| **Provider 종속** | **opencode Provider-Agnostic Architecture** | **P2 (신규)** |

---

## 2. 분석 대상 프로젝트 요약

### 2.1 기존 분석 프로젝트 (4개)

#### oh-my-claudecode (101K+ lines)
```yaml
핵심_강점:
  - Project Memory: 컴팩션 저항 지시어 저장
  - Ultrapilot: 3-5x 병렬 실행 속도
  - Ecomode: 30-50% 토큰 절감
  - 32 에이전트, 37 스킬, 31 훅
```

#### claude-code (Anthropic 공식 CLI)
```yaml
핵심_강점:
  - Plugin Architecture (commands/agents/skills/hooks)
  - Permission Model (Level 0-5)
  - MCP Integration
```

#### codex (OpenAI CLI - Rust + Node.js)
```yaml
핵심_강점:
  - 커널 레벨 샌드박싱 (Seatbelt/Landlock)
  - JSON-RPC 2.0 프로토콜
  - 45+ Rust 크레이트
```

#### gemini-cli (Google CLI)
```yaml
핵심_강점:
  - Behavioral Evals 프레임워크
  - Agent-to-Agent Protocol
  - 1M 토큰 컨텍스트
  - 61+ 도구, 20+ 훅
```

### 2.2 신규 분석 프로젝트 (5개) ⭐

#### everything-claude-code (Production-Ready Config)

```yaml
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
      - 스킬보다 작고 유연한 학습 단위
    저장: "~/.claude/homunculus/instincts/"

  iterative_retrieval:
    설명: "서브에이전트 컨텍스트 문제 해결"
    프로세스: "DISPATCH → EVALUATE(0-1점) → REFINE → LOOP(max 3)"
    효과: "컨텍스트 오버플로우 없이 필요한 정보만 수집"

  hook_phases:
    목록:
      - PreToolUse: 도구 실행 전 검증
      - PostToolUse: 도구 완료 후 처리 (자동 포맷팅, 타입체크)
      - PreCompact: 컴팩션 전 상태 저장
      - SessionStart: 이전 컨텍스트 로드
      - Stop: 응답 중단 시 검증
      - SessionEnd: 상태 영속화 + 패턴 추출
```

**autonomous-coding-agents 적용 가능 패턴**:
1. **Instinct 시스템**: 스킬보다 유연한 학습 단위 (신뢰도 기반)
2. **Iterative Retrieval**: 멀티 에이전트 컨텍스트 문제 해결
3. **6단계 Hook**: 라이프사이클 전체에 걸친 자동화
4. **Context Modes**: dev/review/research 동적 전환

---

#### get-shit-done (Context Engineering Master)

```yaml
핵심_구조:
  에이전트: 11개 전문 에이전트
  명령어: 27개 CLI 명령어
  워크플로우: 12개 오케스트레이션 워크플로우
  문서: 15,765 lines (Documentation-as-Code)

혁신적_기능:
  context_engineering:
    설명: "Context Rot 문제의 근본적 해결"
    품질_곡선:
      0-30%: "PEAK (포괄적, 철저함)"
      30-50%: "GOOD (확신, 견고함)"
      50-70%: "DEGRADING (효율 모드)"
      70%+: "POOR (급한, 최소한)"
    전략:
      - 계획당 2-3개 태스크 제한 (~50% 컨텍스트 사용)
      - 계획별 Fresh Context (200k 토큰)
      - @-reference로 지연 로딩
      - 태스크당 원자적 커밋

  goal_backward_verification:
    설명: "Task Completion이 아닌 Goal Achievement 검증"
    3단계_검증:
      1_exists: "파일이 예상 경로에 존재"
      2_substantive: "실제 구현, placeholder 아님"
      3_wired: "시스템에 연결됨"
    vs_wrong: "파일 존재 = 완료 (❌)"

  user_decision_fidelity:
    설명: "사용자 결정의 계획 전체 전파"
    locked_decisions: "반드시 구현 (협상 불가)"
    deferred_ideas: "반드시 구현 안 함 (범위 방지)"
    claude_discretion: "합리적 판단 위임"

  xml_task_structure:
    예시: |
      <task type="auto">
        <name>Create login endpoint</name>
        <files>src/api/auth/route.ts</files>
        <action>POST endpoint accepting {email, password}...</action>
        <verify>curl -X POST returns 200 with Set-Cookie</verify>
        <done>Valid → 200 + cookie. Invalid → 401.</done>
      </task>
```

**autonomous-coding-agents 적용 가능 패턴**:
1. **Context Engineering**: 품질 곡선 기반 컨텍스트 관리
2. **Goal-Backward Verification**: 3단계 검증 (exists→substantive→wired)
3. **User Decision Fidelity**: 결정 잠금 및 전파 메커니즘
4. **XML Task Structure**: 실행 가능한 명세 형식
5. **Atomic Commits**: 태스크당 개별 커밋 (git bisect 가능)

---

#### oh-my-opencode (97K+ lines, Sisyphus 오케스트레이션)

```yaml
핵심_구조:
  에이전트: 11개 (Sisyphus/Atlas/Prometheus 핵심)
  훅: 34개 라이프사이클 훅
  도구: 20+ 전문화 도구
  테스트: 144개 테스트 파일

혁신적_기능:
  planning_execution_separation:
    설명: "계획(Prometheus) ≠ 실행(Atlas)"
    prometheus: "순수 계획, 코드 작성 안 함"
    atlas: "실행 + Todo 상태 관리"
    sisyphus: "메인 오케스트레이터 (Opus 4.5)"

  boulder_state:
    설명: "세션 간 작업 연속성"
    저장: ".sisyphus/boulder.json"
    추적:
      - active_plan: 현재 계획 경로
      - session_ids: 세션 목록
      - started_at: 시작 시간
    효과: "컨텍스트 손실 없이 세션 복구"

  parallel_background_agents:
    설명: "비차단 병렬 탐색"
    방식:
      - background_task() 호출
      - 동시성 관리 (provider별 제한)
      - 알림 시스템
      - task_id로 비동기 결과 조회
    효과: "메인 작업 중단 없이 5+ 에이전트 병렬 탐색"

  hephaestus_deep_worker:
    설명: "진정한 자율 실행 에이전트"
    특징:
      - 단계별 안내 없이 목표 지향 실행
      - 구현 전 2-5개 병렬 탐색
      - GPT-5.2-Codex 전용
    철학: "autonomy must be genuine, not simulated"

  todo_continuation_enforcer:
    설명: "미완성 작업 방지 (~1.8K LOC)"
    동작: "에이전트가 중단하면 강제 완료"
    철학: "The boulder must keep rolling"
```

**autonomous-coding-agents 적용 가능 패턴**:
1. **Planning ≠ Execution 분리**: Prometheus(계획) / Atlas(실행) 패턴
2. **Boulder State**: 세션 간 작업 연속성
3. **Background Agents**: 비차단 병렬 탐색
4. **Todo Continuation Enforcement**: 미완성 방지
5. **Tmux Integration**: 병렬 에이전트 시각화

---

#### opencode (368K+ 다운로드, Provider-Agnostic)

```yaml
핵심_구조:
  도구: 24개 내장 도구
  에이전트: build/plan/general/explore
  테마: 15+ 내장 테마
  코드: 43K+ LOC (메인 패키지)

혁신적_기능:
  provider_agnostic:
    설명: "모델 종속 없는 아키텍처"
    지원: "Claude, OpenAI, Google, Local, Custom OpenAI-compatible"
    인터페이스: "Vercel AI SDK 표준화"
    효과: "모델 교체 무중단, Fallback 가능"

  permission_system:
    설명: "세분화된 권한 제어"
    카테고리:
      - read/write/edit: 파일 작업
      - bash: 쉘 실행
      - lsp: 언어 서버
      - webfetch/websearch: 외부 접근
    액션: "allow / ask / deny"
    패턴: "Glob 기반 경로 매칭"
    에이전트별: "개별 권한 프로파일"

  lsp_integration:
    설명: "완전한 LSP 통합 (9개 작업)"
    작업:
      - goToDefinition, findReferences
      - hover, documentSymbol, workspaceSymbol
      - goToImplementation, callHierarchy
    효과: "시맨틱 코드 이해 (regex 대비 정확)"

  agent_generation:
    설명: "LLM 기반 에이전트 자동 생성"
    방식: "스키마 기반 검증, 동적 프롬프트"
    효과: "런타임 에이전트 확장"

  performance_roadmap:
    5단계:
      - Phase 0: 베이스라인 + 피처 플래그
      - Phase 1: Jank 생성기 제거
      - Phase 2: 메모리 성장 제한 (LRU/TTL)
      - Phase 3: 대용량 세션 스크롤 최적화
      - Phase 4: 모듈화 + 중복 제거
```

**autonomous-coding-agents 적용 가능 패턴**:
1. **Provider-Agnostic Architecture**: 모델 종속성 제거
2. **Permission System**: 세분화된 권한 + 에이전트별 프로파일
3. **LSP Integration**: 시맨틱 코드 이해
4. **Agent Generation**: 동적 에이전트 생성
5. **Performance Roadmap**: 체계적 성능 최적화 계획

---

#### SuperClaude_Framework (PM Agent 시스템)

```yaml
핵심_구조:
  에이전트: 16개 전문화 에이전트
  패턴: PM Agent 3-Pattern 시스템
  모드: 7개 행동 모드
  MCP: 8개 서버 통합

혁신적_기능:
  confidence_checker:
    설명: "사전 실행 신뢰도 평가"
    투자: "100-200 토큰"
    절감: "5,000-50,000 토큰 (잘못된 방향 방지)"
    ROI: "25-250x"
    임계값:
      ≥90%: "즉시 진행"
      70-89%: "대안 제시"
      <70%: "중단 + 조사"
    체크항목:
      - duplicate_check_complete (25%)
      - architecture_check_complete (25%)
      - official_docs_verified (20%)
      - oss_reference_complete (15%)
      - root_cause_identified (15%)

  self_check_protocol:
    설명: "사후 구현 검증"
    정확도: "환각 탐지 목표 (미검증)"
    4대_질문:
      1: "모든 테스트 통과? (실제 출력 필수)"
      2: "모든 요구사항 충족? (구체적 목록)"
      3: "검증 없는 가정 없음? (문서 제시)"
      4: "증거 있음? (테스트 결과, 코드 변경, 검증)"
    7대_위험신호:
      - "should work", "probably"
      - "I believe", "I think"
      - "typically", "usually"
      - 구체적 증거 없는 주장

  reflexion_pattern:
    설명: "에러 학습 및 예방"
    재발율: "목표 <10% (미검증)"
    저장: "docs/memory/solutions_learned.jsonl"
    프로세스:
      1: "에러 발생 시 기존 해결책 조회"
      2: "Cache Hit → 0 토큰 (즉시 해결)"
      3: "Cache Miss → 1-2K 토큰 (조사 + 기록)"
    기록항목:
      - error_type, error_message
      - root_cause, solution
      - prevention (체크리스트)

  parallel_execution:
    설명: "Wave → Checkpoint → Wave 패턴"
    속도향상: "목표 3.5x (특정 시나리오)"
    예시: |
      Wave 1: [Read file1, file2, file3] (병렬)
         ↓
      Checkpoint: 분석 (순차)
         ↓
      Wave 2: [Edit file1, file2, file3] (병렬)
```

**autonomous-coding-agents 적용 가능 패턴**:
1. **ConfidenceChecker**: 잘못된 방향 작업 방지 (목표 25-250x ROI)
2. **SelfCheckProtocol**: 환각 탐지 프레임워크 (목표 지표, 미검증)
3. **ReflexionPattern**: 에러 재발 방지 (목표 지표, 미검증)
4. **Wave-based Parallel**: 병렬 실행 최적화 (특정 시나리오에서 효과적)
5. **Knowledge Evolution**: temp → patterns → mistakes 3-tier

---

## 3. 핵심 개선 영역 분석

### 3.1 영역 1: Pre-Execution Confidence System ⭐ (신규 P0)

#### 가설 (Hypothesis)

SuperClaude의 ConfidenceChecker 패턴을 도입하면, autonomous-coding-agents에서 잘못된 방향의 작업을 사전에 방지하여 25-250배의 토큰 ROI를 달성할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | SuperClaude ConfidenceChecker: 25-250x ROI | `/SuperClaude_Framework/src/superclaude/pm_agent/confidence.py` |
| [SPEC] | UNIFIED_VISION.md: "계약 > 지능" 원칙 | `UNIFIED_VISION.md §1.4` |
| [GAP] | autonomous-coding-agents: 사전 검증 시스템 부재 | 코드 분석 |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-CC1] ⚠️ 100-200 토큰 투자로 5,000-50,000 토큰 절감 가능
- [A-CC2] ⚠️ 5개 체크항목이 대부분의 잘못된 방향 작업 탐지 가능
- [A-CC3] ⚠️ 90%/70% 임계값이 autonomous-coding-agents에 적합

#### 반례/실패 모드 (Counterexamples)

1. **과도한 체크 오버헤드**: 단순 작업에도 신뢰도 체크 적용 시 불필요한 지연. **대응**: 복잡도 기반 체크 활성화 (simple 작업 제외).

2. **False Negative**: 신뢰도 높지만 실제로는 잘못된 방향. **대응**: SelfCheckProtocol과 결합하여 이중 검증.

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | 복잡한 작업에만 Confidence Check | 오버헤드 최소화 | 일부 문제 누락 가능 | 낮음 |
| **B: 균형** | 모든 작업 + 복잡도별 임계값 차등 | 포괄적 커버리지 | 중간 복잡도 | 중간 |
| **C: 적극적** | 전체 적용 + 지속적 학습 | 최대 효과 | 구현 복잡 | 높음 |

**권장**: **옵션 B**

#### 검증 계획 (Verification Plan)

```yaml
검증_단계:
  1_구현_검증:
    방법: "ConfidenceChecker 패턴 적용 후 샘플 태스크 실행"
    성공_기준:
      - "신뢰도 <70% 시 중단 동작"
      - "체크 소요 토큰 < 200"
    예상_기간: "1주"

  2_ROI_검증:
    방법: "A/B 테스트 - 체크 있음 vs 없음"
    성공_기준:
      - "잘못된 방향 작업 50%+ 감소"
      - "총 토큰 사용량 20%+ 감소"
    예상_기간: "2주"
```

---

### 3.2 영역 2: Context Engineering ⭐ (신규 P0)

#### 가설 (Hypothesis)

get-shit-done의 Context Engineering 원칙을 적용하면, autonomous-coding-agents의 에이전트 품질 저하 문제를 근본적으로 해결할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | get-shit-done: Context Rot 해결 | `/get-shit-done/GSD-STYLE.md` |
| [IMPL] | oh-my-opencode: Fresh Context per Plan | `/oh-my-opencode/AGENTS.md` |
| [THEORY] | 품질 곡선: 0-30% PEAK, 70%+ POOR | get-shit-done 문서 |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-CE1] ⚠️ 계획당 2-3 태스크 제한이 품질 유지에 효과적
- [A-CE2] ⚠️ Fresh Context 패턴이 autonomous-coding-agents에 적용 가능
- [A-CE3] ⚠️ 컨텍스트 50% 이하 유지가 항상 가능

#### 반례/실패 모드 (Counterexamples)

1. **대규모 분석 작업**: 전체 코드베이스 분석 시 50% 이하 불가능. **대응**: 분할 정복 전략, 에이전트 위임.

2. **컨텍스트 단편화**: 과도한 분할로 전체 그림 손실. **대응**: 요약 체크포인트, STATE.md 유지.

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | 태스크 크기 제한만 적용 | 단순 구현 | 근본 해결 아님 | 낮음 |
| **B: 균형** | 크기 제한 + Fresh Context + STATE.md | 품질 개선 | 워크플로우 변경 필요 | 중간 |
| **C: 적극적** | 완전한 GSD 워크플로우 이식 | 최대 효과 | 큰 변화, 학습 비용 | 높음 |

**권장**: **옵션 B**

---

### 3.3 영역 3: Post-Execution Validation (SelfCheck + Goal-Backward)

#### 가설 (Hypothesis)

SuperClaude의 SelfCheckProtocol과 get-shit-done의 Goal-Backward Verification을 결합하면, 높은 정확도의 완료 검증 시스템을 구축할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | SuperClaude SelfCheck: 환각 탐지 프레임워크 | `/SuperClaude_Framework/src/superclaude/pm_agent/self_check.py` |
| [IMPL] | get-shit-done: 3단계 Goal-Backward | `/get-shit-done/workflows/` |
| [GAP] | autonomous-coding-agents: Task-Completion 검증만 | 코드 분석 |

#### 검증 로직

```yaml
3단계_검증:
  1_exists:
    질문: "파일이 예상 경로에 있는가?"
    검증: "fs.existsSync(path)"

  2_substantive:
    질문: "실제 구현인가, placeholder인가?"
    검증: "코드 분석, TODO/placeholder 탐지"

  3_wired:
    질문: "시스템에 연결되어 있는가?"
    검증: "import 추적, 라우팅 확인"

SelfCheck_4대_질문:
  1: "모든 테스트 통과? (실제 출력 첨부)"
  2: "모든 요구사항 충족? (체크리스트)"
  3: "검증 없는 가정 없음? (문서 링크)"
  4: "증거 있음? (테스트 결과, diff)"
```

**권장**: 두 시스템 결합 - 3단계 검증 + SelfCheck 4대 질문

---

### 3.4 영역 4: Error Learning System (Reflexion + Instinct)

#### 가설 (Hypothesis)

SuperClaude의 ReflexionPattern과 everything-claude-code의 Instinct System을 결합하면, 에러 재발 방지와 지속적 학습 시스템을 구축할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | SuperClaude Reflexion: 에러 재발 방지 프레임워크 | `/SuperClaude_Framework/src/superclaude/pm_agent/reflexion.py` |
| [IMPL] | everything-claude-code Instinct: 신뢰도 기반 학습 | `/everything-claude-code/skills/continuous-learning-v2/` |

#### 통합 설계

```yaml
학습_계층:
  layer_1_reflexion:
    대상: "에러 및 해결책"
    저장: "solutions_learned.jsonl"
    조회: "0 토큰 (캐시 히트)"
    학습: "1-2K 토큰 (캐시 미스)"

  layer_2_instinct:
    대상: "패턴 및 선호도"
    저장: "~/.claude/homunculus/instincts/"
    신뢰도: "0.3-0.9 스케일"
    진화: "클러스터링 → 스킬/명령어/에이전트"

  layer_3_knowledge:
    대상: "검증된 지식"
    저장: "docs/patterns/, docs/mistakes/"
    승격: "temp → patterns (성공 시)"
    방지: "temp → mistakes (실패 시)"
```

---

### 3.5 영역 5: Planning/Execution Separation

#### 가설 (Hypothesis)

oh-my-opencode의 Prometheus(계획)/Atlas(실행) 분리 패턴을 적용하면, autonomous-coding-agents의 에이전트 역할 혼란과 품질 저하를 해결할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-opencode: Prometheus ≠ Atlas | `/oh-my-opencode/src/agents/` |
| [IMPL] | get-shit-done: Planner ≠ Executor | `/get-shit-done/agents/` |
| [SPEC] | UNIFIED_VISION: 역할 기반 에이전트 | `UNIFIED_VISION.md §5` |

#### 분리 설계

```yaml
계획_에이전트:
  역할: "순수 계획, 코드 작성 안 함"
  산출물: "PLAN.md (XML 태스크 구조)"
  도구: "Read, Glob, Grep (읽기 전용)"

실행_에이전트:
  역할: "계획 실행, 원자적 커밋"
  입력: "PLAN.md"
  산출물: "코드, 테스트, SUMMARY.md"
  도구: "전체 도구 접근"

검증_에이전트:
  역할: "Goal-Backward 검증"
  입력: "실행 결과"
  산출물: "검증 결과, 수정 계획"
  도구: "Read, Test, Analyze"
```

---

### 3.6 영역 6: Provider-Agnostic Architecture

#### 가설 (Hypothesis)

opencode의 Provider-Agnostic 아키텍처를 적용하면, autonomous-coding-agents의 모델 종속성 리스크를 완화하고 비용 최적화가 가능해진다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | opencode: Vercel AI SDK 추상화 | `/opencode/packages/opencode/src/provider/` |
| [IMPL] | oh-my-opencode: Fallback 체인 | `/oh-my-opencode/src/agents/` |
| [GAP] | autonomous-coding-agents: Claude 중심 | 코드 분석 |

#### 추상화 설계

```yaml
provider_interface:
  methods:
    - generateText(prompt, options)
    - generateStream(prompt, options)
    - generateObject(prompt, schema)

fallback_chain:
  예시:
    primary: "claude-opus-4.5"
    secondary: "gpt-5.2"
    tertiary: "gemini-3-pro"
    fallback: "local-llm"

model_selection:
  전략:
    planning: "opus (정확도 우선)"
    execution: "sonnet (비용 효율)"
    exploration: "haiku (속도)"
    background: "haiku (비용)"
```

---

## 4. 버전별 개선 로드맵 (업데이트)

### 4.1 버전 체계 (확장)

```
v4.3.x - Foundation (Pre-Execution Validation)
v4.4.x - Context Engineering
v5.0.x - Learning System (Reflexion + Instinct)
v5.1.x - Planning/Execution Separation
v6.0.x - Provider-Agnostic + Performance
v7.0.x - Enterprise (Agent Manager)
```

### 4.2 v4.3.0 - Pre-Execution Validation ⭐

**목표**: ConfidenceChecker + SelfCheckProtocol 도입
**예상 기간**: 3주
**신규 추가**

```yaml
v4.3.0_개선사항:
  confidence_checker:
    출처: "SuperClaude ConfidenceChecker"
    변경:
      - 5개 체크항목 구현
      - 90%/70% 임계값 로직
      - 복잡도 기반 활성화
    검증:
      - "ROI 10x+ 달성"

  self_check_protocol:
    출처: "SuperClaude SelfCheckProtocol"
    변경:
      - 4대 질문 프레임워크
      - 7대 위험신호 탐지
      - 증거 수집 자동화
    검증:
      - "환각 탐지율 향상"
```

### 4.3 v4.4.0 - Context Engineering ⭐

**목표**: Context Rot 해결 + State 관리
**예상 기간**: 4주
**신규 추가**

```yaml
v4.4.0_개선사항:
  context_management:
    출처: "get-shit-done Context Engineering"
    변경:
      - 태스크당 컨텍스트 제한 (50%)
      - Fresh Context per Plan
      - 품질 곡선 모니터링
    검증:
      - "컨텍스트 70% 초과 경고"

  state_persistence:
    출처: "oh-my-opencode Boulder State"
    변경:
      - STATE.md 자동 관리
      - 세션 복구 메커니즘
      - 체크포인트 시스템
    검증:
      - "세션 간 연속성 95%+"
```

### 4.4 v5.0.0 - Learning System

**목표**: Reflexion + Instinct 통합 학습
**예상 기간**: 6주

```yaml
v5.0.0_개선사항:
  reflexion_pattern:
    출처: "SuperClaude ReflexionPattern"
    변경:
      - 에러 학습 시스템
      - solutions_learned.jsonl 저장
      - 캐시 기반 조회 (0 토큰)
    검증:
      - "에러 재발률 감소"

  instinct_system:
    출처: "everything-claude-code Instinct"
    변경:
      - 신뢰도 기반 패턴 학습
      - 자동 클러스터링
      - 스킬 진화
    검증:
      - "학습 패턴 재사용률 30%+"
```

### 4.5 v5.1.0 - Planning/Execution Separation

**목표**: 역할 분리 + 검증 강화
**예상 기간**: 4주

```yaml
v5.1.0_개선사항:
  role_separation:
    출처: "oh-my-opencode Prometheus/Atlas"
    변경:
      - PlannerAgent (읽기 전용)
      - ExecutorAgent (전체 접근)
      - VerifierAgent (Goal-Backward)
    검증:
      - "역할 혼란 에러 0건"

  goal_backward_verification:
    출처: "get-shit-done 3단계 검증"
    변경:
      - exists → substantive → wired
      - 단계별 검증 자동화
    검증:
      - "완료 검증 정확도 향상"
```

### 4.6 v6.0.0 - Provider-Agnostic + Performance

**목표**: 모델 독립성 + 성능 최적화
**예상 기간**: 8주

```yaml
v6.0.0_개선사항:
  provider_abstraction:
    출처: "opencode Provider-Agnostic"
    변경:
      - Vercel AI SDK 통합
      - Fallback Chain 구현
      - 모델 선택 전략
    검증:
      - "모델 전환 무중단"

  parallel_execution:
    출처: "SuperClaude + oh-my-claudecode"
    변경:
      - Wave-based 병렬 실행
      - 의존성 자동 분석
      - Background Agent
    검증:
      - "3x 속도 향상"

  ecomode:
    출처: "oh-my-claudecode Ecomode"
    변경:
      - 토큰 사용량 모니터링
      - 응답 압축
      - 점진적 컨텍스트
    검증:
      - "30% 토큰 절감"
```

---

## 5. 불확실성 예산 (업데이트)

### 5.1 전체 불확실성 분포 (업데이트)

```
┌─────────────────────────────────────────────────────────────┐
│                    불확실성 예산 (100%)                      │
├─────────────────────────────────────────────────────────────┤
│  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 30% (↓5%)   │
│  ▲ 기술적 불확실성                                          │
│    - ConfidenceChecker 임계값 조정 (8%)                     │
│    - Context Engineering 통합 (8%)                          │
│    - Learning System 복잡성 (7%)                            │
│    - Provider 추상화 (7%)                                   │
│                                                              │
│  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25%         │
│  ▲ 일정 불확실성 (동일)                                     │
│                                                              │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 20%         │
│  ▲ 외부 의존성 불확실성 (동일)                              │
│                                                              │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15%         │
│  ▲ 비즈니스 불확실성 (동일)                                 │
│                                                              │
│  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 10% (↑5%)   │
│  ▲ 통합 불확실성 (신규)                                     │
│    - 9개 프로젝트 패턴 조합 복잡성                          │
│    - 우선순위 충돌 가능성                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 지식 계보 (업데이트)

### 6.1 정보 출처 분류 (확장)

```yaml
1차_출처_직접_분석:
  - autonomous-coding-agents 코드베이스 (655+ 파일)
  - UNIFIED_VISION.md v3.0
  - PROJECT_ANALYSIS_REPORT.md v1.0
  신뢰도: 95%

2차_출처_외부_프로젝트_분석 (9개):
  - oh-my-claudecode (101K+ lines 직접 분석)
  - claude-code (공식 Anthropic CLI 분석)
  - codex (OpenAI CLI Rust 코드 분석)
  - gemini-cli (Google CLI 코드 분석)
  - everything-claude-code (Production config 분석) # 신규
  - get-shit-done (15K+ lines 문서 분석) # 신규
  - oh-my-opencode (97K+ lines 직접 분석) # 신규
  - opencode (43K+ lines 직접 분석) # 신규
  - SuperClaude_Framework (PM Agent 분석) # 신규
  신뢰도: 85%
```

### 6.2 핵심 신규 결정의 지식 계보

#### 결정: ConfidenceChecker 도입

```yaml
지식_계보:
  출처_1:
    위치: "/SuperClaude_Framework/src/superclaude/pm_agent/confidence.py"
    유형: "[IMPL] 실제 구현"
    신뢰도: 90%

  출처_2:
    위치: "/SuperClaude_Framework/PLANNING.md"
    유형: "[SPEC] 설계 원칙"
    신뢰도: 95%

  추론:
    내용: "25-250x ROI 달성 가능"
    신뢰도: 75%
    근거: "SuperClaude 문서화된 수치 + 유사 패턴 성공 사례"
```

#### 결정: Context Engineering 도입

```yaml
지식_계보:
  출처_1:
    위치: "/get-shit-done/GSD-STYLE.md"
    유형: "[IMPL] 실제 구현"
    신뢰도: 90%

  출처_2:
    위치: "/oh-my-opencode/AGENTS.md"
    유형: "[IMPL] 유사 구현"
    신뢰도: 85%

  출처_3:
    위치: "Claude 컨텍스트 윈도우 동작 관찰"
    유형: "[OBS] 관찰 기반"
    신뢰도: 80%

  추론:
    내용: "컨텍스트 50% 이하 유지가 품질에 중요"
    신뢰도: 80%
    근거: "get-shit-done 품질 곡선 + 다수 프로젝트 유사 접근"
```

---

## 부록: 프로젝트별 핵심 패턴 요약

| 프로젝트 | 핵심 패턴 | autonomous-coding-agents 적용 우선순위 |
|---------|----------|---------------------------------------|
| **SuperClaude** | ConfidenceChecker (목표 25-250x ROI) | **P0** |
| **SuperClaude** | SelfCheckProtocol (환각 탐지 프레임워크) | **P0** |
| **get-shit-done** | Context Engineering (품질 곡선) | **P0** |
| **get-shit-done** | Goal-Backward Verification (3단계) | **P0** |
| **oh-my-opencode** | Boulder State (세션 연속성) | **P0** |
| SuperClaude | ReflexionPattern (에러 재발 방지) | P1 |
| everything-claude-code | Instinct System (신뢰도 학습) | P1 |
| oh-my-opencode | Planning/Execution 분리 | P1 |
| opencode | Provider-Agnostic Architecture | P1 |
| oh-my-claudecode | Ultrapilot (3-5x 병렬) | P1 |
| oh-my-claudecode | Ecomode (30-50% 토큰 절감) | P1 |
| everything-claude-code | Iterative Retrieval | P2 |
| everything-claude-code | 6-Phase Hook System | P2 |
| opencode | Permission System | P2 |
| codex | Kernel-level Sandbox | P2 |

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 2.0
  작성일: 2026-02-06
  작성_방법론: "AGENT.md 비권위적 분석 원칙"
  분석_프로젝트: 9개 (이전 4개에서 확장)

변경_이력:
  v1.0: 4개 프로젝트 분석 (oh-my-claudecode, claude-code, codex, gemini-cli)
  v2.0: 5개 프로젝트 추가 분석 (everything-claude-code, get-shit-done, oh-my-opencode, opencode, SuperClaude_Framework)
  v2.1: 팩트 체크 수정 - SuperClaude 미검증 수치 명시, get-shit-done 3단계 검증으로 수정, oh-my-opencode LOC 수정(~1.8K), opencode 다운로드 수 수정(368K+)

검토_상태:
  초안: ✅ 완료
  기술_검토: ⏳ 대기
  최종_승인: ⏳ 대기

다음_갱신:
  예정일: 2026-03-06 (또는 메이저 변경 시)
  담당: 프로젝트 소유자
```

---

> **면책 조항**: 이 문서의 모든 권고사항은 가설이며, 실제 적용 전 검증이 필요합니다. 최종 결정 권한은 프로젝트 소유자에게 있습니다.
