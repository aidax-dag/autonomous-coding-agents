# Autonomous Coding Agents - 개선 권고 문서

> **버전**: 1.0
> **작성일**: 2026-02-06
> **문서 유형**: 비권위적 분석 (Non-Authoritative Analysis)
> **방법론**: AGENT.md 원칙 기반 비판적 사고

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

**주 가설**: 분석된 4개 외부 프로젝트(oh-my-claudecode, claude-code, codex, gemini-cli)의 검증된 패턴을 선택적으로 적용하면, autonomous-coding-agents의 약점을 개선하면서 프로젝트 고유의 비전("CEO 1명 + AI 에이전트 완전 자율 소프트웨어 회사")을 유지할 수 있다.

**부 가설들**:
- H1: Project Memory 시스템 도입으로 세션 간 지식 유실 문제 해결 가능
- H2: 행동 평가(Behavioral Evals) 프레임워크가 에이전트 품질 보장에 필수적
- H3: 보안 샌드박싱의 강화가 자율 실행 신뢰도를 높임
- H4: 토큰 효율화 시스템이 운영 비용을 30-50% 절감 가능

### 1.2 증거 요약 (Evidence Summary)

| 프로젝트 | 핵심 강점 | 적용 가능성 | 증거 유형 |
|---------|----------|------------|----------|
| oh-my-claudecode | Project Memory, Parallel Execution | ⭐⭐⭐⭐⭐ | [IMPL] 실제 구현 |
| claude-code | Plugin Architecture, Hooks | ⭐⭐⭐⭐ | [SPEC] 공식 명세 |
| codex | Rust Sandbox, JSON-RPC | ⭐⭐⭐ | [IMPL] 실제 구현 |
| gemini-cli | Behavioral Evals, A2A Protocol | ⭐⭐⭐⭐⭐ | [IMPL] 실제 구현 |

### 1.3 핵심 Gap vs 해결책 매핑

| autonomous-coding-agents 약점 | 외부 프로젝트 해결책 | 우선순위 |
|-------------------------------|---------------------|----------|
| Knowledge Layer 5% 구현 | oh-my-claudecode Project Memory | P0 |
| 세션 간 지식 유실 | gemini-cli Session State | P0 |
| 에이전트 품질 검증 부재 | gemini-cli Behavioral Evals | P0 |
| 보안 샌드박싱 미흡 | codex Kernel-level Sandbox | P1 |
| 토큰 비용 최적화 없음 | oh-my-claudecode Ecomode | P1 |
| 병렬 실행 미최적화 | oh-my-claudecode Ultrapilot | P1 |
| Hook 시스템 미완성 | claude-code Hooks Architecture | P2 |

---

## 2. 분석 대상 프로젝트 요약

### 2.1 oh-my-claudecode (101K+ lines TypeScript)

#### 증거 [IMPL] 구현 기반

```yaml
핵심_구조:
  에이전트: 32개 전문화 에이전트
  스킬: 37개 스킬 모듈
  훅: 31개 훅
  총_코드량: 101,000+ lines

혁신적_기능:
  project_memory:
    설명: "컴팩션에 저항하는 지시어 저장"
    위치: "/oh-my-claudecode/prompts/project-memory.md"
    특징:
      - AI 네이티브 검색 구조
      - 정규화된 링크 형식
      - 증분 업데이트 지원

  ultrapilot:
    설명: "3-5x 빠른 병렬 에이전트 실행"
    방식: "Wave 기반 병렬 처리"
    효과: "300-500% 속도 향상"

  ecomode:
    설명: "토큰 효율화 시스템"
    효과: "30-50% 토큰 절감"
    방식:
      - 응답 압축
      - 점진적 컨텍스트 로딩
      - 스마트 캐싱
```

#### 가정 [ASSUMPTION] - 편집/거부 가능

- [A1] TypeScript 기반이므로 autonomous-coding-agents에 직접 통합 가능
- [A2] Project Memory 패턴이 Neo4j 기반 Knowledge Layer보다 빠르게 구현 가능
- [A3] Ultrapilot 패턴이 현재 TaskRouter와 호환됨

#### 반례/실패 모드 [COUNTER]

1. **과도한 복잡성**: oh-my-claudecode의 32 에이전트 구조는 autonomous-coding-agents의 "역할 기반 에이전트 팀" 비전과 충돌할 수 있음. autonomous-coding-agents는 조직 시뮬레이션에 집중하므로 기능 기반 에이전트 수 증가는 부적합할 수 있음.

2. **유지보수 부담**: 101K+ lines 규모의 시스템에서 영감을 받는 것은 현재 autonomous-coding-agents 규모(~655 파일)에 과부하를 줄 수 있음.

### 2.2 claude-code (Anthropic 공식 CLI)

#### 증거 [SPEC] 공식 명세 기반

```yaml
핵심_아키텍처:
  plugin_system:
    commands: "슬래시 명령어 확장"
    agents: "전문화 에이전트 위임"
    skills: "재사용 가능 스킬 모듈"
    hooks: "이벤트 기반 확장점"

  permission_model:
    levels:
      - Level 0: "읽기 전용"
      - Level 1: "제한된 쓰기"
      - Level 2: "전체 쓰기"
      - Level 3: "시스템 명령"
      - Level 4: "네트워크 접근"
      - Level 5: "완전 자율"

  mcp_integration:
    protocol: "Model Context Protocol"
    서버: "다중 MCP 서버 지원"
    도구: "동적 도구 로딩"
```

#### 가정 [ASSUMPTION] - 편집/거부 가능

- [A4] Plugin 아키텍처가 현재 Teams 시스템과 보완적
- [A5] Permission 모델이 Safety Fuse 설계와 통합 가능
- [A6] MCP 통합이 외부 도구 확장에 필수적

#### 반례/실패 모드 [COUNTER]

1. **아키텍처 불일치**: claude-code는 단일 사용자 CLI 도구이고, autonomous-coding-agents는 멀티 에이전트 조직 시뮬레이션. Permission 모델이 "조직 내 권한"이 아닌 "사용자-AI 권한"에 최적화되어 있음.

2. **MCP 의존성**: MCP 프로토콜에 과도하게 의존하면 독립적 실행 능력이 저하될 수 있음.

### 2.3 codex (OpenAI CLI - Rust + Node.js 하이브리드)

#### 증거 [IMPL] 구현 기반

```yaml
핵심_구조:
  rust_crates: 45+ 개별 크레이트
  통신_프로토콜: JSON-RPC 2.0

보안_샌드박싱:
  mac_os:
    기술: "Seatbelt (sandbox-exec)"
    수준: "커널 레벨 격리"
  linux:
    기술: "Landlock LSM"
    수준: "커널 레벨 격리"

특징:
  다중_제공자: "OpenAI, Anthropic, Azure, Custom"
  정적_타입: "완전한 Rust 타입 시스템"
  메모리_안전: "Rust 소유권 모델"
```

#### 가정 [ASSUMPTION] - 편집/거부 가능

- [A7] 커널 레벨 샌드박싱이 자율 실행 신뢰도의 핵심
- [A8] JSON-RPC 2.0이 NATS보다 표준화된 통신 방식
- [A9] Rust 바이너리가 성능 크리티컬 컴포넌트에 적합

#### 반례/실패 모드 [COUNTER]

1. **기술 스택 불일치**: autonomous-coding-agents는 TypeScript 기반. Rust 도입은 팀 역량, 빌드 파이프라인, 디버깅 복잡도를 크게 증가시킴.

2. **과도한 보안**: 커널 레벨 샌드박싱은 개발 환경에서 불필요하게 제한적일 수 있음. autonomous-coding-agents의 목표는 "자율 개발"이므로 적절한 권한이 필요.

### 2.4 gemini-cli (Google CLI)

#### 증거 [IMPL] 구현 기반

```yaml
핵심_구조:
  패키지: 5개 monorepo 패키지
  도구: 61+ 내장 도구
  훅: 20+ 훅

혁신적_기능:
  behavioral_evals:
    설명: "에이전트 의사결정 품질 평가"
    테스트_유형:
      - "도구 선택 정확도"
      - "안전 동작 준수"
      - "작업 완료 품질"
    위치: "/gemini-cli/packages/core/src/evals/"

  a2a_protocol:
    설명: "Agent-to-Agent 통신 프로토콜"
    특징:
      - "타입 안전 메시지 전달"
      - "상태 동기화"
      - "작업 위임"

  context_window:
    크기: "1M 토큰"
    활용: "대규모 코드베이스 분석"
```

#### 가정 [ASSUMPTION] - 편집/거부 가능

- [A10] Behavioral Evals가 에이전트 품질 보장의 표준이 될 것
- [A11] A2A Protocol이 멀티 에이전트 협업의 핵심
- [A12] 1M 토큰 컨텍스트가 미래 LLM의 표준이 될 것

#### 반례/실패 모드 [COUNTER]

1. **Google 생태계 종속**: gemini-cli의 일부 기능은 Gemini 모델 전용. autonomous-coding-agents는 멀티 모델(Claude/GPT/Gemini)을 지원하므로 이식성 문제.

2. **Evals 오버헤드**: 모든 에이전트 동작에 Behavioral Evals를 적용하면 실행 속도가 저하될 수 있음.

---

## 3. 핵심 개선 영역 분석

### 3.1 영역 1: Knowledge Layer 강화

#### 가설 (Hypothesis)

oh-my-claudecode의 Project Memory 패턴과 gemini-cli의 Session State를 결합하면, 현재 5% 수준의 Knowledge Layer를 실용적 수준(MVP 70%+)으로 빠르게 끌어올릴 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-claudecode Project Memory: 단일 마크다운 파일로 컴팩션 저항 | `/oh-my-claudecode/prompts/` |
| [IMPL] | gemini-cli Session State: 타입 안전 상태 관리 | `/gemini-cli/packages/core/src/core/` |
| [SPEC] | autonomous-coding-agents Neo4j 설계: 완전한 온톨로지 스키마 | `UNIFIED_VISION.md §6-7` |
| [GAP] | 현재 구현: 5% (설계만 완료) | `PROJECT_ANALYSIS_REPORT.md` |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-KL1] ⚠️ **편집 가능**: Project Memory 패턴이 Neo4j 없이도 MVP 기능의 70%를 달성할 수 있음
- [A-KL2] ⚠️ **거부 가능**: 마크다운 기반 메모리가 Graph DB만큼 관계 추적이 가능함
- [A-KL3] ⚠️ **편집 가능**: 점진적 마이그레이션(Markdown → Neo4j)이 기술적으로 가능함

#### 반례/실패 모드 (Counterexamples)

1. **관계 추적 한계**: Project Memory는 단순 키-값 저장에 가까움. "PRD → Feature → Code → Test" 체인 추적에는 Graph DB가 필수일 수 있음. **대응**: 마크다운 내 링크 체계로 기본 관계 표현, 복잡한 쿼리는 Phase 2에서 Neo4j로.

2. **검색 성능**: 텍스트 기반 검색은 시맨틱 검색보다 정확도가 낮음. **대응**: Embedding 기반 검색을 별도 레이어로 추가.

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | Project Memory 패턴만 도입 | 빠른 구현 (2주), 검증된 패턴 | 관계 추적 제한 | 낮음 |
| **B: 균형** | Project Memory + SQLite 관계 | 중간 복잡도, 관계 쿼리 가능 | 동기화 필요 | 중간 |
| **C: 적극적** | 설계된 Neo4j + Vector DB 완전 구현 | 비전 완전 달성 | 6주+ 소요 | 높음 |

**권장**: **옵션 B** - 균형 접근. 이유: autonomous-coding-agents의 비전(온톨로지 기반 연결)을 유지하면서 빠른 MVP 출시 가능.

#### 검증 계획 (Verification Plan)

```yaml
검증_단계:
  1_구현_검증:
    방법: "Project Memory 패턴 적용 후 기능 테스트"
    성공_기준:
      - "세션 간 컨텍스트 유지율 90%+"
      - "기본 관계 쿼리 응답 시간 < 100ms"
    예상_기간: "1주"

  2_비교_검증:
    방법: "A/B 테스트 - 기존 vs 새 시스템"
    성공_기준:
      - "태스크 완료율 20% 향상"
      - "컨텍스트 손실 에러 80% 감소"
    예상_기간: "2주"

  3_스케일_검증:
    방법: "100개 Feature 시나리오 테스트"
    성공_기준:
      - "검색 정확도 85%+"
      - "메모리 사용량 < 500MB"
    예상_기간: "1주"
```

---

### 3.2 영역 2: 행동 평가 시스템 (Behavioral Evals)

#### 가설 (Hypothesis)

gemini-cli의 Behavioral Evals 프레임워크를 도입하면, autonomous-coding-agents의 에이전트 품질을 객관적으로 측정하고 개선할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | gemini-cli evals: 도구 선택, 안전 동작, 작업 품질 평가 | `/gemini-cli/packages/core/src/evals/` |
| [GAP] | autonomous-coding-agents: 단위 테스트만 존재, 에이전트 행동 테스트 없음 | `tests/` |
| [SPEC] | UNIFIED_VISION.md: "측정 가능한 운영 루프" 요구 | `UNIFIED_VISION.md §1.4` |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-BE1] ⚠️ **편집 가능**: Behavioral Evals가 기존 Jest 테스트 프레임워크에 통합 가능
- [A-BE2] ⚠️ **거부 가능**: 모든 에이전트 동작을 평가해야 함 (오버헤드 수용 가능)
- [A-BE3] ⚠️ **편집 가능**: Evals 결과가 에이전트 신뢰도 점수에 직접 반영됨

#### 반례/실패 모드 (Counterexamples)

1. **평가 오버헤드**: 모든 에이전트 호출에 Evals를 적용하면 50%+ 성능 저하 예상. **대응**: 샘플링 기반 평가 (10% 호출만 평가) 또는 비동기 평가.

2. **평가 기준 주관성**: "좋은 코드 리뷰"의 기준이 주관적. **대응**: 구체적이고 측정 가능한 메트릭 정의 (예: "보안 취약점 탐지율", "스타일 가이드 준수율").

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | 핵심 에이전트(Coder, Reviewer)만 Evals | 빠른 구현, 낮은 오버헤드 | 제한된 커버리지 | 낮음 |
| **B: 균형** | 모든 에이전트 + 샘플링 평가 | 전체 커버리지, 관리 가능한 오버헤드 | 구현 복잡도 | 중간 |
| **C: 적극적** | 실시간 전체 평가 + 자동 개선 루프 | 최고 품질 보장 | 높은 오버헤드, 복잡성 | 높음 |

**권장**: **옵션 B** - 균형 접근. 이유: UNIFIED_VISION의 "측정 가능한 운영 루프" 원칙과 일치.

#### 검증 계획 (Verification Plan)

```yaml
검증_단계:
  1_프레임워크_검증:
    방법: "gemini-cli evals 패턴 이식 후 CoderAgent 평가"
    성공_기준:
      - "테스트 작성 가능"
      - "평가 결과 재현 가능"
    예상_기간: "1주"

  2_메트릭_검증:
    방법: "정의된 메트릭의 의미 있음 검증"
    성공_기준:
      - "메트릭과 실제 품질 상관계수 > 0.7"
      - "false positive rate < 10%"
    예상_기간: "2주"

  3_운영_검증:
    방법: "프로덕션 환경 10% 트래픽으로 평가"
    성공_기준:
      - "성능 오버헤드 < 15%"
      - "품질 이슈 사전 탐지율 > 80%"
    예상_기간: "2주"
```

---

### 3.3 영역 3: 병렬 실행 최적화

#### 가설 (Hypothesis)

oh-my-claudecode의 Ultrapilot 패턴을 적용하면, autonomous-coding-agents의 멀티 에이전트 실행 속도를 3-5배 향상시킬 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-claudecode Ultrapilot: Wave 기반 병렬 처리 | `/oh-my-claudecode/src/execution/` |
| [IMPL] | autonomous-coding-agents TaskRouter: 4가지 라우팅 전략 존재 | `src/core/orchestrator/task-router.ts` |
| [BENCH] | Ultrapilot 벤치마크: 300-500% 속도 향상 | oh-my-claudecode 문서 |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-PE1] ⚠️ **편집 가능**: 현재 TaskRouter가 Wave 패턴과 호환됨
- [A-PE2] ⚠️ **거부 가능**: 병렬 실행이 항상 순차 실행보다 효율적임
- [A-PE3] ⚠️ **편집 가능**: LLM API rate limit이 병렬화의 병목이 아님

#### 반례/실패 모드 (Counterexamples)

1. **의존성 병목**: 에이전트 간 강한 의존성이 있으면 병렬화 효과 제한. autonomous-coding-agents의 "Coder → Reviewer → RepoManager" 체인은 순차적. **대응**: 의존성 분석 후 병렬화 가능한 부분만 최적화.

2. **API Rate Limit**: Claude API rate limit (기본 60 RPM)이 병렬 실행 병목. **대응**: 적응형 동시성 제어, 여러 API 키 로드밸런싱.

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | 독립 작업만 병렬화 (파일 읽기, 린팅) | 안전, 빠른 구현 | 제한된 효과 (50% 향상) | 낮음 |
| **B: 균형** | Wave 패턴 + 적응형 동시성 | 좋은 효과 (200% 향상) | 중간 복잡도 | 중간 |
| **C: 적극적** | 완전 Ultrapilot 이식 | 최대 효과 (300-500%) | 높은 복잡도, 디버깅 어려움 | 높음 |

**권장**: **옵션 B** - 균형 접근. 이유: autonomous-coding-agents의 현재 아키텍처와 호환성 유지.

#### 검증 계획 (Verification Plan)

```yaml
검증_단계:
  1_벤치마크_수립:
    방법: "현재 시스템 베이스라인 측정"
    메트릭:
      - "단일 태스크 완료 시간"
      - "10개 태스크 배치 완료 시간"
      - "API 호출 횟수"
    예상_기간: "3일"

  2_병렬화_검증:
    방법: "Wave 패턴 적용 후 동일 태스크 실행"
    성공_기준:
      - "배치 완료 시간 50%+ 단축"
      - "에러율 증가 없음"
    예상_기간: "1주"

  3_스케일_검증:
    방법: "동시 50개 태스크 시나리오"
    성공_기준:
      - "처리량 3x 향상"
      - "메모리 사용량 < 2GB"
    예상_기간: "1주"
```

---

### 3.4 영역 4: 토큰 효율화 (Ecomode)

#### 가설 (Hypothesis)

oh-my-claudecode의 Ecomode 패턴을 적용하면, autonomous-coding-agents의 LLM API 비용을 30-50% 절감할 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | oh-my-claudecode Ecomode: 응답 압축, 점진적 컨텍스트 | `/oh-my-claudecode/src/efficiency/` |
| [SPEC] | autonomous-coding-agents 비용 목표: "$5K-20K/년" | `UNIFIED_VISION.md §1.2` |
| [GAP] | 현재 시스템: 토큰 최적화 없음 | 코드 분석 |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-TE1] ⚠️ **편집 가능**: 응답 압축이 품질 저하 없이 가능함
- [A-TE2] ⚠️ **거부 가능**: 점진적 컨텍스트 로딩이 태스크 완료율에 영향 없음
- [A-TE3] ⚠️ **편집 가능**: 30-50% 절감이 실제 사용 패턴에서 달성 가능

#### 반례/실패 모드 (Counterexamples)

1. **품질 저하**: 컨텍스트 압축이 과도하면 에이전트 이해도 저하. **대응**: 품질 메트릭 모니터링, 임계값 기반 자동 조절.

2. **복잡한 태스크 실패**: 점진적 로딩이 전체 컨텍스트가 필요한 아키텍처 분석에 부적합. **대응**: 태스크 유형별 전략 분기.

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | 캐싱만 적용 | 안전, 빠른 구현 | 10-20% 절감만 | 낮음 |
| **B: 균형** | 캐싱 + 점진적 컨텍스트 | 30% 절감 | 중간 복잡도 | 중간 |
| **C: 적극적** | 완전 Ecomode (압축, 캐싱, 점진적) | 50% 절감 | 품질 리스크 | 높음 |

**권장**: **옵션 B** - 균형 접근. 이유: 비용 목표 달성과 품질 유지의 균형.

#### 검증 계획 (Verification Plan)

```yaml
검증_단계:
  1_비용_베이스라인:
    방법: "현재 토큰 사용량 측정 (1주)"
    메트릭:
      - "태스크당 평균 토큰"
      - "일일 총 토큰 사용량"
      - "API 비용"
    예상_기간: "1주"

  2_최적화_검증:
    방법: "Ecomode 적용 후 동일 태스크 실행"
    성공_기준:
      - "토큰 사용량 30%+ 감소"
      - "태스크 완료율 유지 (±5%)"
    예상_기간: "2주"

  3_품질_검증:
    방법: "Behavioral Evals로 품질 비교"
    성공_기준:
      - "품질 점수 변화 < 5%"
      - "사용자 만족도 유지"
    예상_기간: "1주"
```

---

### 3.5 영역 5: 보안 샌드박싱 강화

#### 가설 (Hypothesis)

codex의 커널 레벨 샌드박싱 개념을 Node.js 환경에 적용하면, autonomous-coding-agents의 자율 실행 신뢰도를 높일 수 있다.

#### 증거 (Evidence)

| 유형 | 설명 | 출처 |
|------|------|------|
| [IMPL] | codex Seatbelt/Landlock: 커널 레벨 격리 | `/codex/packages/sandbox/` |
| [IMPL] | autonomous-coding-agents Security: 기본 보안 시스템 | `src/core/security/` |
| [SPEC] | Safety Fuse 설계: 보안 신호 포함 | `UNIFIED_VISION.md §20` |

#### 가정 (Assumptions) - 편집/거부 가능

- [A-SS1] ⚠️ **편집 가능**: Node.js 환경에서 충분한 샌드박싱이 가능함
- [A-SS2] ⚠️ **거부 가능**: 커널 레벨 보안이 autonomous-coding-agents에 필수적임
- [A-SS3] ⚠️ **편집 가능**: Docker 기반 격리가 Seatbelt/Landlock의 대안이 됨

#### 반례/실패 모드 (Counterexamples)

1. **과도한 제한**: 강한 샌드박싱이 정상적인 개발 작업(파일 생성, 빌드 실행)을 방해. **대응**: 작업 유형별 권한 프로파일 정의.

2. **플랫폼 의존성**: Seatbelt은 macOS, Landlock은 Linux 전용. **대응**: 추상화 레이어로 플랫폼별 구현.

#### 대안 (Alternatives)

| 옵션 | 접근 | 장점 | 단점 | 예상 비용 |
|------|------|------|------|----------|
| **A: 보수적** | Docker 컨테이너 기반 격리 | 크로스 플랫폼 | 성능 오버헤드 | 낮음 |
| **B: 균형** | Docker + 정책 기반 권한 | 유연성, 감사 가능 | 중간 복잡도 | 중간 |
| **C: 적극적** | Native 샌드박싱 (Seatbelt/Landlock) | 최고 보안 | Rust 의존성, 유지보수 부담 | 높음 |

**권장**: **옵션 B** - 균형 접근. 이유: autonomous-coding-agents의 TypeScript 스택과 호환, Safety Fuse 설계와 통합 용이.

#### 검증 계획 (Verification Plan)

```yaml
검증_단계:
  1_위협_모델링:
    방법: "autonomous-coding-agents 특화 위협 분석"
    산출물:
      - "위협 목록"
      - "우선순위화된 완화 전략"
    예상_기간: "3일"

  2_격리_검증:
    방법: "악의적 태스크 시뮬레이션"
    성공_기준:
      - "파일 시스템 탈출 0건"
      - "네트워크 무단 접근 0건"
    예상_기간: "1주"

  3_운영_검증:
    방법: "정상 워크플로우에서 격리 테스트"
    성공_기준:
      - "정상 작업 성공률 99%+"
      - "성능 오버헤드 < 10%"
    예상_기간: "1주"
```

---

## 4. 버전별 개선 로드맵

### 4.1 버전 체계

```
v4.x.x - 현재 (Foundation Stabilization)
v5.x.x - Knowledge + Evals (Core Enhancement)
v6.x.x - Performance + Security (Production Ready)
v7.x.x - Enterprise Features (Scale)
```

### 4.2 v4.3.0 - Foundation Stabilization

**목표**: 기존 Gap 해소 + 빠른 가치 제공
**예상 기간**: 4주
**리스크 수준**: 낮음

```yaml
v4.3.0_개선사항:
  feature_store_v1:
    출처: "UNIFIED_VISION.md 설계"
    변경:
      - PostgreSQL 스키마 마이그레이션
      - CRUD API 구현
      - 기본 검색 기능
    검증:
      - "Feature 저장/조회 테스트"
      - "검색 정확도 80%+"

  project_memory_v1:
    출처: "oh-my-claudecode 패턴"
    변경:
      - 마크다운 기반 메모리 시스템
      - 세션 간 컨텍스트 유지
      - 기본 링크 체계
    검증:
      - "세션 간 컨텍스트 유지율 90%+"

  basic_evals:
    출처: "gemini-cli 패턴"
    변경:
      - CoderAgent 품질 평가
      - ReviewerAgent 품질 평가
      - 기본 메트릭 대시보드
    검증:
      - "평가 결과 재현성 95%+"
```

#### v4.3.0 가정 (Assumptions)

- [A-430-1] ⚠️ 4주 내 완료 가능 (현재 팀 역량 기준)
- [A-430-2] ⚠️ 기존 코드 변경 최소화 가능
- [A-430-3] ⚠️ Project Memory가 Knowledge Layer MVP 역할 수행 가능

#### v4.3.0 반례/실패 모드

1. **일정 초과**: Feature Store 스키마가 예상보다 복잡. **대응**: 필수 필드만 v1에 포함, 나머지는 v4.4로 연기.
2. **통합 이슈**: Project Memory와 기존 시스템 충돌. **대응**: 어댑터 패턴으로 격리.

---

### 4.3 v5.0.0 - Knowledge + Evals

**목표**: Knowledge Layer 완성 + 품질 보장 체계
**예상 기간**: 8주
**리스크 수준**: 중간

```yaml
v5.0.0_개선사항:
  knowledge_layer_complete:
    출처: "UNIFIED_VISION.md §6-7 + oh-my-claudecode 영감"
    변경:
      - Neo4j 온톨로지 구현
      - Vector DB 통합 (Pinecone/Weaviate)
      - Feature Reuse Pipeline
      - Impact Analysis 쿼리
    검증:
      - "관계 쿼리 응답 시간 < 100ms"
      - "유사 Feature 검색 정확도 85%+"

  behavioral_evals_complete:
    출처: "gemini-cli 패턴"
    변경:
      - 전체 에이전트 평가 커버리지
      - 샘플링 기반 평가 (10%)
      - 자동 품질 리포트
      - 에이전트 신뢰도 점수 연동
    검증:
      - "품질 이슈 사전 탐지율 80%+"
      - "성능 오버헤드 < 15%"

  a2a_protocol_v1:
    출처: "gemini-cli A2A Protocol"
    변경:
      - 타입 안전 에이전트 간 메시지
      - 상태 동기화 프로토콜
      - 작업 위임 체계
    검증:
      - "메시지 전달 신뢰도 99%+"
```

#### v5.0.0 가정 (Assumptions)

- [A-500-1] ⚠️ Neo4j 학습 곡선이 관리 가능 (1-2주)
- [A-500-2] ⚠️ A2A Protocol이 현재 NATS 메시징과 공존 가능
- [A-500-3] ⚠️ Behavioral Evals 오버헤드가 허용 범위 내

#### v5.0.0 반례/실패 모드

1. **Neo4j 복잡성**: 온톨로지 쿼리 최적화가 예상보다 어려움. **대응**: 읽기 전용 복제본 사용, 캐싱 레이어 추가.
2. **A2A/NATS 충돌**: 두 메시징 시스템 간 일관성 문제. **대응**: NATS 위에 A2A 추상화 레이어 구현.

---

### 4.4 v6.0.0 - Performance + Security

**목표**: 프로덕션 레디 성능 및 보안
**예상 기간**: 6주
**리스크 수준**: 중간-높음

```yaml
v6.0.0_개선사항:
  parallel_execution:
    출처: "oh-my-claudecode Ultrapilot"
    변경:
      - Wave 기반 병렬 처리
      - 적응형 동시성 제어
      - API Rate Limit 관리
      - 의존성 분석 자동화
    검증:
      - "배치 처리 속도 200%+ 향상"
      - "에러율 유지"

  ecomode:
    출처: "oh-my-claudecode Ecomode"
    변경:
      - 응답 캐싱 시스템
      - 점진적 컨텍스트 로딩
      - 토큰 사용량 모니터링
    검증:
      - "토큰 비용 30%+ 절감"
      - "품질 저하 < 5%"

  enhanced_sandboxing:
    출처: "codex 영감 + Docker 기반"
    변경:
      - Docker 기반 작업 격리
      - 정책 기반 권한 관리
      - Safety Fuse 통합
      - 감사 로깅
    검증:
      - "보안 테스트 통과율 100%"
      - "정상 작업 성공률 99%+"
```

#### v6.0.0 가정 (Assumptions)

- [A-600-1] ⚠️ 병렬 실행이 기존 워크플로우와 호환
- [A-600-2] ⚠️ Docker 오버헤드가 허용 가능 (< 10%)
- [A-600-3] ⚠️ Ecomode 품질 저하가 허용 범위 내

#### v6.0.0 반례/실패 모드

1. **병렬화 버그**: 레이스 컨디션, 데드락 발생. **대응**: 광범위한 통합 테스트, 롤백 메커니즘.
2. **보안-기능 충돌**: 샌드박싱이 정상 작업 방해. **대응**: 화이트리스트 기반 권한 관리.

---

### 4.5 v7.0.0 - Enterprise Features

**목표**: 대규모 조직 지원
**예상 기간**: 10주
**리스크 수준**: 높음

```yaml
v7.0.0_개선사항:
  agent_manager_v1:
    출처: "UNIFIED_VISION.md §21"
    변경:
      - Executive Agents (CTO, COO, CFO)
      - 전략 계획 자동화
      - 리소스 최적화 자동화
      - ROI 분석 대시보드
    검증:
      - "전략 권고 품질 평가"
      - "비용 최적화 효과 20%+"

  multi_project:
    출처: "Enterprise 요구사항"
    변경:
      - 다중 프로젝트 동시 관리
      - 프로젝트 간 Feature 공유
      - 통합 대시보드
    검증:
      - "10개 프로젝트 동시 운영"
      - "Feature 재사용률 30%+"

  compliance:
    출처: "Enterprise 보안 요구"
    변경:
      - SOC2 준수
      - 감사 로그 완전성
      - 데이터 암호화
    검증:
      - "보안 감사 통과"
```

#### v7.0.0 가정 (Assumptions)

- [A-700-1] ⚠️ Executive Agents가 유의미한 가치 제공
- [A-700-2] ⚠️ Multi-project 아키텍처가 현재 설계와 호환
- [A-700-3] ⚠️ Compliance 요구사항이 명확히 정의됨

#### v7.0.0 반례/실패 모드

1. **Executive Agents 품질**: AI가 전략적 의사결정을 신뢰할 수 있게 수행하지 못함. **대응**: Human-in-the-loop 강화, 권고만 제공.
2. **Multi-project 복잡성**: 프로젝트 간 종속성 관리 어려움. **대응**: 엄격한 격리 정책, 명시적 공유만 허용.

---

## 5. 불확실성 예산 (Uncertainty Budget)

### 5.1 전체 불확실성 분포

```
┌─────────────────────────────────────────────────────────────┐
│                    불확실성 예산 (100%)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 35%     │
│  ▲ 기술적 불확실성                                          │
│    - Neo4j 학습 곡선 (10%)                                  │
│    - 병렬 실행 버그 (10%)                                   │
│    - Ecomode 품질 영향 (8%)                                 │
│    - 보안/기능 균형 (7%)                                    │
│                                                              │
│  ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 25%     │
│  ▲ 일정 불확실성                                            │
│    - Feature Store 복잡성 (8%)                              │
│    - A2A Protocol 통합 (7%)                                 │
│    - Enterprise 요구사항 변경 (10%)                         │
│                                                              │
│  ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 20%     │
│  ▲ 외부 의존성 불확실성                                     │
│    - LLM API 가격 변동 (8%)                                 │
│    - LLM 성능 변화 (7%)                                     │
│    - 외부 서비스 가용성 (5%)                                │
│                                                              │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 15%     │
│  ▲ 비즈니스 불확실성                                        │
│    - 시장 수요 변화 (8%)                                    │
│    - 경쟁 환경 변화 (7%)                                    │
│                                                              │
│  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 5%      │
│  ▲ 알려지지 않은 불확실성 (Unknown Unknowns)                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 핵심 불확실성 상세

| 불확실성 | 확률 | 영향 | 완화 전략 |
|---------|------|------|----------|
| Neo4j 성능 이슈 | 30% | 높음 | 캐싱, 읽기 복제본 |
| Ecomode 품질 저하 | 25% | 중간 | 품질 모니터링, 자동 조절 |
| 병렬 실행 레이스 컨디션 | 20% | 높음 | 광범위 테스트, 롤백 |
| A2A/NATS 통합 문제 | 25% | 중간 | 추상화 레이어 |
| Executive Agents 품질 | 40% | 높음 | Human-in-the-loop |

### 5.3 불확실성 관리 전략

```yaml
관리_전략:
  조기_검증:
    원칙: "가장 불확실한 부분 먼저 검증"
    적용: "Neo4j POC를 v5.0 시작 전 2주간 수행"

  점진적_롤아웃:
    원칙: "작은 범위에서 검증 후 확대"
    적용: "Ecomode를 10% 트래픽으로 시작"

  롤백_준비:
    원칙: "모든 변경은 되돌릴 수 있어야 함"
    적용: "Feature Flag 기반 점진적 활성화"

  측정_기반_결정:
    원칙: "감이 아닌 데이터로 결정"
    적용: "모든 변경에 A/B 테스트 적용"
```

---

## 6. 지식 계보 (Knowledge Lineage)

### 6.1 정보 출처 분류

```yaml
1차_출처_직접_분석:
  - autonomous-coding-agents 코드베이스 (655+ 파일)
  - UNIFIED_VISION.md v3.0
  - PROJECT_ANALYSIS_REPORT.md v1.0
  신뢰도: 95%

2차_출처_외부_프로젝트_분석:
  - oh-my-claudecode (101K+ lines 직접 분석)
  - claude-code (공식 Anthropic CLI 분석)
  - codex (OpenAI CLI Rust 코드 분석)
  - gemini-cli (Google CLI 코드 분석)
  신뢰도: 85%

3차_출처_문서_참조:
  - 각 프로젝트 README 및 문서
  - 공식 API 문서
  신뢰도: 75%

4차_출처_추론:
  - 패턴 유추
  - 경험 기반 추정
  신뢰도: 60%
```

### 6.2 핵심 결정의 지식 계보

#### 결정 1: Project Memory 도입

```yaml
결정: "oh-my-claudecode의 Project Memory 패턴 도입"

지식_계보:
  출처_1:
    위치: "/oh-my-claudecode/prompts/project-memory.md"
    유형: "[IMPL] 실제 구현"
    신뢰도: 90%

  출처_2:
    위치: "UNIFIED_VISION.md §7 Knowledge Layer"
    유형: "[SPEC] 설계 명세"
    신뢰도: 95%

  출처_3:
    위치: "PROJECT_ANALYSIS_REPORT.md §2.3"
    유형: "[GAP] Gap 분석"
    신뢰도: 90%

  추론:
    내용: "Project Memory가 Neo4j 없이 MVP 기능 달성 가능"
    신뢰도: 65%
    근거: "oh-my-claudecode가 Graph DB 없이 유사 기능 제공"
```

#### 결정 2: Behavioral Evals 도입

```yaml
결정: "gemini-cli의 Behavioral Evals 프레임워크 도입"

지식_계보:
  출처_1:
    위치: "/gemini-cli/packages/core/src/evals/"
    유형: "[IMPL] 실제 구현"
    신뢰도: 85%

  출처_2:
    위치: "UNIFIED_VISION.md §1.4 승리 조건"
    유형: "[SPEC] 요구사항"
    신뢰도: 95%

  출처_3:
    위치: "autonomous-coding-agents/tests/"
    유형: "[GAP] 현재 상태"
    신뢰도: 90%

  추론:
    내용: "Behavioral Evals가 에이전트 품질의 표준이 될 것"
    신뢰도: 70%
    근거: "Google의 gemini-cli가 이 패턴 채택"
```

#### 결정 3: 균형 접근 (옵션 B) 선호

```yaml
결정: "대부분의 영역에서 균형 접근(옵션 B) 선택"

지식_계보:
  출처_1:
    위치: "UNIFIED_VISION.md 전체"
    유형: "[SPEC] 프로젝트 비전"
    신뢰도: 95%
    핵심: "autonomous-coding-agents의 고유 비전 유지 필요"

  출처_2:
    위치: "PROJECT_ANALYSIS_REPORT.md §1.2"
    유형: "[GAP] 현재 완성도 87%"
    신뢰도: 90%
    핵심: "빠른 MVP 출시 필요"

  출처_3:
    위치: "외부 프로젝트 분석 결과"
    유형: "[IMPL] 검증된 패턴"
    신뢰도: 85%
    핵심: "적극적 접근은 복잡성 높음"

  추론:
    내용: "균형 접근이 리스크-보상 최적"
    신뢰도: 75%
    근거: "비전 유지 + 빠른 가치 제공 + 검증된 패턴 활용"
```

### 6.3 지식 갱신 요구사항

```yaml
갱신_필요_시점:
  - 외부 프로젝트 메이저 업데이트 시
  - autonomous-coding-agents 아키텍처 변경 시
  - LLM 기술 패러다임 변화 시
  - 검증 결과가 가정과 크게 다를 시

갱신_담당:
  - 프로젝트 소유자 또는 지정된 검토자

갱신_주기:
  - 분기별 정기 검토
  - 메이저 버전 출시 전 필수 검토
```

---

## 부록: 의사결정 체크리스트

### 각 개선 영역 적용 전 확인사항

```yaml
사전_체크리스트:
  □ 가설을 팀과 검토했는가?
  □ 가정을 명시적으로 수락/거부했는가?
  □ 반례/실패 모드에 대한 대응 계획이 있는가?
  □ 검증 계획의 성공 기준이 측정 가능한가?
  □ 롤백 계획이 준비되어 있는가?
  □ 불확실성 예산이 허용 범위 내인가?
  □ 지식 계보가 충분히 신뢰할 만한가?

의사결정_게이트:
  □ 기술 리더 승인
  □ 비용 영향 분석 완료
  □ 보안 검토 완료 (해당 시)
  □ 사용자 영향 분석 완료
```

---

## 문서 메타데이터

```yaml
문서_정보:
  버전: 1.0
  작성일: 2026-02-06
  작성_방법론: "AGENT.md 비권위적 분석 원칙"

검토_상태:
  초안: ✅ 완료
  기술_검토: ⏳ 대기
  최종_승인: ⏳ 대기

다음_갱신:
  예정일: 2026-03-06 (또는 메이저 변경 시)
  담당: 프로젝트 소유자
```

---

> **면책 조항**: 이 문서의 모든 권고사항은 가설이며, 실제 적용 전 검증이 필요합니다. 최종 결정 권한은 프로젝트 소유자에게 있습니다. 불확실성이 높은 영역(빨간색 표시)은 특히 신중한 검토가 필요합니다.
