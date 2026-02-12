# Competitive Analysis & Enhancement Strategy

> ACA(Autonomous Coding Agents) 강화를 위한 경쟁 프로젝트 분석 및 전략 수립 문서
>
> **작성일**: 2026-02-13
> **버전**: 1.0
> **분석 대상**: 7개 AI CLI 프로젝트 + ACA

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [분석 대상 프로젝트 개요](#2-분석-대상-프로젝트-개요)
3. [프로젝트별 상세 분석](#3-프로젝트별-상세-분석)
   - 3.1 [Claude Code](#31-claude-code)
   - 3.2 [Codex (OpenAI)](#32-codex-openai)
   - 3.3 [Gemini CLI](#33-gemini-cli)
   - 3.4 [Everything Claude Code](#34-everything-claude-code)
   - 3.5 [Get Shit Done](#35-get-shit-done)
   - 3.6 [Oh My OpenCode](#36-oh-my-opencode)
   - 3.7 [OpenCode](#37-opencode)
4. [ACA 현재 상태 분석](#4-aca-현재-상태-분석)
5. [비교 매트릭스](#5-비교-매트릭스)
6. [Gap Analysis: ACA vs 경쟁 프로젝트](#6-gap-analysis-aca-vs-경쟁-프로젝트)
7. [Enhancement Strategy: 프로젝트별 차용 기능](#7-enhancement-strategy-프로젝트별-차용-기능)
8. [구현 로드맵](#8-구현-로드맵)
9. [ACA 고유 경쟁 우위](#9-aca-고유-경쟁-우위)
10. [결론](#10-결론)

---

## 1. Executive Summary

본 문서는 AI 코딩 에이전트 생태계의 주요 7개 프로젝트를 체계적으로 분석하고, ACA(Autonomous Coding Agents) 프로젝트에 적용할 수 있는 개선 전략을 도출한다.

### 핵심 발견

- **ACA의 강점**: 21개 모듈의 체계적 아키텍처, 3계층 학습 시스템, 2,315+ 테스트, 컨텍스트 품질 곡선
- **보완 필요 영역**: MCP 프로토콜, 멀티모델 라우팅, 플러그인 시스템, 병렬 에이전트 실행, OS 네이티브 샌드박스
- **전략 방향**: 각 프로젝트의 입증된 패턴을 ACA의 강력한 아키텍처 위에 통합

### 분석 프로젝트 매핑

| 프로젝트 | 개발사/커뮤니티 | 핵심 가치 | ACA 차용 포인트 |
|----------|----------------|-----------|----------------|
| Claude Code | Anthropic | 플러그인 생태계 | 플러그인 아키텍처, 워크플로우 |
| Codex | OpenAI | 네이티브 성능 & 보안 | OS 샌드박스, 관측성 |
| Gemini CLI | Google | TUI & 모델 라우팅 | 라우팅 전략, OpenTelemetry |
| Everything Claude Code | 커뮤니티 | 인스틴트 학습 | 팀 학습, 스킬 생태계 |
| Get Shit Done | 커뮤니티 | 컨텍스트 엔지니어링 | .planning/, 검증 시스템 |
| Oh My OpenCode | 커뮤니티 | 멀티모델 오케스트레이션 | 병렬 에이전트, LSP 통합 |
| OpenCode | 커뮤니티 | 프로토콜 표준 | MCP, 퍼미션, 멀티 인터페이스 |

---

## 2. 분석 대상 프로젝트 개요

### 프로젝트 스펙 비교표

| 항목 | Claude Code | Codex | Gemini CLI | ECC | GSD | OMO | OpenCode | **ACA** |
|------|------------|-------|-----------|-----|-----|-----|----------|---------|
| **언어** | TS/JS/Python | Rust | TypeScript | TS/MD | JS/MD | TypeScript | TypeScript | TypeScript |
| **런타임** | Node.js | Native | Node.js 20+ | Node.js 18+ | Node.js 16.7+ | Bun | Bun | Node.js 20+ |
| **라이선스** | MIT | Apache 2.0 | Apache 2.0 | MIT | MIT | MIT | MIT | MIT |
| **에이전트 수** | 다수(플러그인) | 1(코어) | 서브에이전트 | 13 | 11 | 11 | 3(build/plan/general) | 4 |
| **스킬 수** | 플러그인별 | - | 확장가능 | 40+ | - | 25+ 도구 | 확장가능 | 4 |
| **테스트** | 제한적 | 포괄적 | 674+ | 통합 테스트 | 22 | 195 | 구조화 | **2,315+** |
| **LLM 지원** | Claude + 멀티 | GPT/o3/o4 | Gemini 전용 | Claude 중심 | Claude 중심 | Claude+GPT+Gemini+GLM+Grok | 15+ 프로바이더 | Claude+GPT+Gemini |
| **MCP 지원** | O | O(실험적) | O | O(설정) | X | O(내장) | O | **X** |
| **샌드박스** | 다중 모드 | OS-Native | Docker/Podman | - | - | - | - | 4레벨 구현 |
| **IDE 통합** | VS Code | JSON-RPC | VS Code 확장 | - | - | - | 멀티 | - |

---

## 3. 프로젝트별 상세 분석

### 3.1 Claude Code

**개요**: Anthropic의 공식 터미널 기반 AI 코딩 도구. 플러그인 생태계를 통한 확장성이 핵심.

**아키텍처**:
```
claude-code/
├── plugins/              # 12+ 공식 플러그인
│   ├── code-review/      # 멀티에이전트 PR 리뷰
│   ├── feature-dev/      # 7-phase 기능 개발
│   ├── plugin-dev/       # 플러그인 개발 툴킷
│   ├── pr-review-toolkit/# PR 리뷰 전문 에이전트
│   ├── hookify/          # 마크다운 기반 후크 생성
│   ├── security-guidance/# 보안 패턴 감지
│   └── ...
├── examples/             # 설정 예시 (strict, lax, bash-sandbox)
└── .devcontainer/        # Docker 개발 환경
```

**플러그인 구조 표준**:
```
plugin-name/
├── .claude-plugin/plugin.json  # 메타데이터
├── commands/                    # 슬래시 커맨드 (*.md)
├── agents/                      # AI 에이전트 (*.md)
├── skills/                      # 점진적 공개 스킬
├── hooks/                       # 이벤트 핸들러 (hooks.json + 스크립트)
└── .mcp.json                   # MCP 서버 설정 (선택)
```

**핵심 기능**:

1. **7-Phase Feature Development Workflow**:
   - Discovery (요구사항 명확화)
   - Codebase Exploration (병렬 code-explorer 에이전트)
   - Clarifying Questions (모호함 해소)
   - Architecture Design (다중 접근법, code-architect 에이전트)
   - Implementation (승인 게이트 포함)
   - Quality Review (병렬 code-reviewer 에이전트)
   - Summary (문서화)

2. **Confidence-Based Code Review**: 80+ 신뢰도 필터로 오탐 제거

3. **Advanced Hook System**: 9+ 이벤트 (PreToolUse, PostToolUse, SessionStart, Stop 등)

4. **Multi-Provider LLM**: Anthropic API, AWS Bedrock, Google Vertex, Foundry

**강점**:
- 성숙한 플러그인 생태계 (12+ 공식 플러그인)
- 구조적 워크플로우 (7-phase)
- 엔터프라이즈급 멀티 프로바이더
- 보안 우선 설계 (다중 샌드박스 모드)
- 풍부한 후크 시스템

**약점**:
- 플러그인 내부 구현 불투명
- 문서 분산 (JSON5, YAML, Markdown 혼재)
- Anthropic 벤더 종속
- 복잡한 설정 (settings.json, plugin.json, hooks.json, .mcp.json)

**ACA 적용 포인트**:
- 플러그인 아키텍처 표준 (commands/ + agents/ + skills/ + hooks/)
- 7-Phase 워크플로우 패턴
- Confidence-Based 필터링 메커니즘

---

### 3.2 Codex (OpenAI)

**개요**: OpenAI의 로컬 네이티브 코딩 에이전트. Rust로 구현된 고성능 CLI 도구.

**아키텍처**:
```
codex/
├── codex-rs/                # Rust 구현 (Active)
│   ├── core/                # 비즈니스 로직 라이브러리
│   ├── tui/                 # Ratatui 기반 터미널 UI
│   ├── cli/                 # CLI 멀티툴 진입점
│   ├── exec/                # 헤드리스 실행 모드
│   ├── app-server/          # JSON-RPC 2.0 서버 (IDE 확장)
│   ├── execpolicy/          # 실행 정책 관리
│   ├── linux-sandbox/       # Landlock 기반 샌드박싱
│   ├── network-proxy/       # 네트워크 격리/프록시
│   ├── process-hardening/   # 크로스 플랫폼 프로세스 하드닝
│   ├── otel/                # OpenTelemetry 관측성
│   └── [50+ supporting crates]
└── codex-cli/               # TypeScript 구현 (Legacy)
```

**핵심 기능**:

1. **OS-Native 샌드박싱**:

   | 플랫폼 | 기술 | 기능 |
   |--------|------|------|
   | macOS | Apple Seatbelt | 읽기전용 감옥, 네트워크 차단, 선택적 쓰기 경로 |
   | Linux | Landlock LSM + seccomp | 파일 접근 제어, 시스콜 필터링 |
   | Windows | AppContainer | 프로세스 격리, 기능 제한 |

2. **3-Mode 승인 워크플로우**:
   - **Suggest** (기본): 모든 액션 사용자 승인
   - **Auto Edit**: 파일 편집 자동, 셸 명령 승인
   - **Full Auto**: 샌드박스 내 완전 자율

3. **IDE 통합 프로토콜**: JSON-RPC 2.0 (VSCode, Cursor, Windsurf 지원)

4. **OpenTelemetry 통합**: 트레이스, 메트릭, 로그 계측

**강점**:
- Rust 네이티브 성능 (VM 오버헤드 없음)
- 플랫폼별 최적화 샌드박스
- 세분화된 승인 워크플로우
- 포괄적 IDE 통합 프로토콜
- 강력한 관측성 (OpenTelemetry)

**약점**:
- Rust 컴파일 복잡성 (긴 빌드 시간, 50+ crate)
- Windows WSL2 필요
- MCP 서버 미성숙 (실험적)
- BM25 기반 파일 검색 (시맨틱 이해 없음)

**ACA 적용 포인트**:
- OS-Native 샌드박스 설계 패턴
- 3-Mode 승인 워크플로우
- OpenTelemetry 관측성 아키텍처
- JSON-RPC IDE 통합 프로토콜

---

### 3.3 Gemini CLI

**개요**: Google의 오픈소스 터미널 AI 에이전트. Gemini 모델을 터미널에서 직접 사용.

**아키텍처**:
```
packages/
├── cli/                  # React/Ink 기반 터미널 UI
│   ├── src/ui/           # 컴포넌트, 훅, 컨텍스트, 테마
│   ├── src/commands/     # 슬래시 커맨드 핸들러
│   └── src/config/       # MCP 설정, 확장
├── core/                 # 백엔드: API 오케스트레이션, 도구, 상태
│   ├── src/tools/        # 25+ 빌트인 도구
│   ├── src/routing/      # 모델 선택 전략 (composite, classifier, fallback)
│   ├── src/agents/       # 에이전트 프레임워크 (로컬/원격, A2A)
│   ├── src/skills/       # 스킬 로더 & 매니저
│   ├── src/safety/       # 콘텐츠 안전, 샌드박싱, 정책
│   └── src/telemetry/    # OpenTelemetry
├── a2a-server/           # Agent-to-Agent 통신 (실험적)
└── vscode-ide-companion/ # VS Code 확장
```

**핵심 기능**:

1. **지능형 모델 라우팅**:
   - Composite Strategy: 여러 라우팅 전략 결합
   - Classifier-Based: 쿼리 복잡도 기반 모델 선택
   - Fallback: 실패 시 대체 모델 자동 전환

2. **Loop Detection**: 무한 도구 사용 루프 방지

3. **Context Compression**: 토큰 사용량 감소, 정보 보존

4. **Conversation Checkpointing**: 복잡한 세션 저장/재개

5. **평가 시스템**: 17개 eval (generalist, plan_mode, subagents, automated-tool-use 등)

**강점**:
- 풍부한 React/Ink TUI
- 지능형 모델 라우팅 (3가지 전략)
- 674+ 테스트 + 17 eval
- OpenTelemetry 완전 통합
- 무료 티어 (60 req/min, 1000 req/day)

**약점**:
- Gemini 전용 (다른 모델 미지원)
- 복잡한 설정 표면
- Node.js 콜드 스타트
- MCP 통합 발전 중

**ACA 적용 포인트**:
- Composite/Classifier 모델 라우팅 전략
- Loop Detection 메커니즘
- 평가 시스템 (eval) 프레임워크
- Conversation Checkpointing 패턴

---

### 3.4 Everything Claude Code (ECC)

**개요**: Claude Code를 위한 포괄적 설정/플러그인 시스템. 10+ 개월간 실제 제품 개발에 사용된 전투 검증 도구킷.

**아키텍처**:
```
everything-claude-code/
├── agents/              # 13 전문 서브에이전트
├── commands/            # 31 슬래시 커맨드
├── skills/              # 40+ 스킬 (지식 모듈 & 워크플로우)
├── rules/               # 상시 적용 가이드라인 (멀티언어)
│   ├── common/          # 언어 무관 원칙
│   ├── typescript/      # TS/JS 전용
│   ├── python/          # Python 전용
│   └── golang/          # Go 전용
├── hooks/               # 트리거 기반 자동화
├── contexts/            # 동적 시스템 프롬프트 주입
├── mcp-configs/         # MCP 서버 정의
└── scripts/             # Node.js 크로스 플랫폼 유틸리티
```

**핵심 기능**:

1. **인스틴트 기반 학습 시스템**:
   - `/learn` — 세션 중 패턴 추출
   - `/instinct-status` — 신뢰도별 학습된 인스틴트 조회
   - `/instinct-import` / `/instinct-export` — 팀 간 인스틴트 공유
   - `/evolve` — 인스틴트 클러스터링 → 스킬 변환

2. **검증 루프**:
   - `/checkpoint` — 검증 상태 저장
   - `/verify` — 검증 루프 실행
   - `/eval` — 평가 하네스

3. **멀티 서비스 오케스트레이션**:
   - `/pm2` — PM2 서비스 생명주기 관리
   - `/multi-plan`, `/multi-execute` — 멀티에이전트 작업 분해/실행

4. **전략적 컴팩션**: 자동 컨텍스트 사용량 최적화 제안

5. **AgentShield 보안**: Claude Code 설정 보안 감사

**에이전트 목록 (13개)**:
| 에이전트 | 역할 |
|---------|------|
| planner | 기능 계획 & 단계 분해 |
| architect | 시스템 설계 & 확장성 |
| code-reviewer | 품질, 유지보수성 리뷰 |
| security-reviewer | 취약점 분석 |
| tdd-guide | 테스트 주도 개발 |
| build-error-resolver | 빌드 실패 진단 |
| e2e-runner | E2E 테스트 생성 |
| refactor-cleaner | 데드 코드 제거 |
| doc-updater | 문서 동기화 |
| go-reviewer | Go 전용 코드 리뷰 |
| go-build-resolver | Go 빌드 오류 수정 |
| python-reviewer | Python 코드 리뷰 |
| database-reviewer | DB/Supabase 리뷰 |

**강점**:
- 실전 검증 (10+ 개월, 42K+ GitHub 스타)
- 인스틴트 학습 (confidence 기반 패턴 추출 & 공유)
- 포괄적 커버리지 (계획 → 구현 → 테스트 → 리뷰 → 배포)
- 멀티언어 지원 (TS, Python, Go, Java, C++)
- 풍부한 후크 자동화

**약점**:
- 설치 복잡성 (rules 수동 복사 필요)
- 지식 중복 (스킬/에이전트/규칙 간 중복)
- Claude Code 의존
- 스킬 활성화 메커니즘 불명확

**ACA 적용 포인트**:
- 인스틴트 공유/내보내기/가져오기 시스템
- 인스틴트 → 스킬 변환 (`/evolve`)
- 언어별 전문 에이전트 패턴
- 프레임워크별 검증 루프
- 전략적 컴팩션 후크

---

### 3.5 Get Shit Done (GSD)

**개요**: Claude Code/OpenCode/Gemini CLI를 위한 메타-프롬프팅 & 컨텍스트 엔지니어링 시스템. 컨텍스트 품질 저하(Context Rot) 문제를 해결.

**아키텍처**:
```
get-shit-done/
├── agents/              # 11 전문 에이전트 프롬프트
│   ├── gsd-planner.md
│   ├── gsd-executor.md
│   ├── gsd-phase-researcher.md
│   ├── gsd-verifier.md
│   ├── gsd-debugger.md
│   ├── gsd-codebase-mapper.md
│   ├── gsd-integration-checker.md
│   └── ...
├── commands/gsd/        # 30 CLI 커맨드
├── get-shit-done/
│   ├── bin/gsd-tools.js # 중앙 CLI 유틸리티 (150+ 명령)
│   ├── workflows/       # 30 워크플로우 오케스트레이터
│   ├── templates/       # 26 문서 템플릿
│   └── references/      # 15 참조 가이드
└── hooks/               # Claude Code 상태 후크
```

**핵심 기능**:

1. **컨텍스트 엔지니어링 (.planning/ 구조)**:
   ```
   .planning/
   ├── config.json          # 모델 프로필, 워크플로우 설정
   ├── PROJECT.md           # 프로젝트 비전 (항상 로드)
   ├── REQUIREMENTS.md      # 범위 정의 (v1/v2/제외)
   ├── ROADMAP.md           # 페이즈 정의 + 목표
   ├── STATE.md             # 의사결정, 블로커, 현재 위치 (세션 간 메모리)
   ├── phases/
   │   └── 01-foundation/
   │       ├── 01-CONTEXT.md         # 구현 선호도
   │       ├── 01-RESEARCH.md        # 생태계 조사 결과
   │       ├── 01-01-PLAN.md         # 원자적 태스크 1
   │       ├── 01-01-SUMMARY.md      # 실행 로그 + 커밋
   │       └── 01-VERIFICATION.md    # 목표 역추적 검증
   ├── research/             # 페이즈별 연구 스냅샷
   └── todos/                # 미래 작업 아이디어
   ```

2. **50% 컨텍스트 규칙** (품질 곡선 강제):
   - 0-30% 컨텍스트: 최고 품질
   - 30-50% 컨텍스트: 양호 (계획 완료 경계)
   - 50-70%: 저하 시작
   - 70%+: 품질 불량 (회피)
   - 계획은 50% 내에서 완료 → 초과 시 새 에이전트 스폰

3. **Goal-Backward 검증**:
   - 태스크 완료 확인 대신: "목표 달성에 무엇이 TRUE여야 하나?"
   - → "무엇이 EXIST해야 하나?" → "무엇이 WIRED여야 하나?"
   - 스텁/플레이스홀더 구현 탐지

4. **XML 구조화 계획**:
   ```xml
   <task type="auto">
     <name>로그인 엔드포인트 생성</name>
     <files>src/app/api/auth/login/route.ts</files>
     <action>
       jose로 JWT 구현 (jsonwebtoken 아닌 - CommonJS 이슈).
       users 테이블 기반 자격증명 검증.
       성공 시 httpOnly 쿠키 반환.
     </action>
     <verify>curl -X POST localhost:3000/api/auth/login → 200 + Set-Cookie</verify>
     <done>유효한 자격증명은 쿠키 반환, 무효는 401</done>
   </task>
   ```

5. **모델 프로필 시스템**:

   | 프로필 | Planner | Executor | Researcher | Verifier |
   |--------|---------|----------|------------|----------|
   | quality | Opus | Opus | Opus | Sonnet |
   | balanced (기본) | Opus | Sonnet | Sonnet | Sonnet |
   | budget | Sonnet | Sonnet | Haiku | Haiku |

6. **원자적 Git 커밋**: 태스크당 개별 커밋 → `git bisect` 가능

**강점**:
- 컨텍스트 품질 저하 문제를 구조적으로 해결
- 제로 의존성 (순수 Node.js)
- 원자적 검증 (계획 → 실행 → 커밋 각 단계)
- 멀티 런타임 (Claude Code + OpenCode + Gemini CLI)
- 투명한 추론 (에이전트 프롬프트 공개)

**약점**:
- UI 없음 (CLI + 마크다운만)
- 빌트인 테스트 프레임워크 선택 없음
- 자동 롤백 없음
- 브라운필드 지원 제한적
- 계획 크기 제한이 경험적 (자동 분할 없음)

**ACA 적용 포인트**:
- `.planning/` 컨텍스트 엔지니어링 구조 전체
- 50% 컨텍스트 규칙 (QualityCurve 확장)
- Goal-Backward 검증 시스템
- XML 구조화 계획 포맷
- 모델 프로필 시스템 (quality/balanced/budget)
- 원자적 커밋 패턴
- STATE.md 세션 간 의사결정 보존

---

### 3.6 Oh My OpenCode (OMO)

**개요**: OpenCode 플러그인으로, 멀티모델 오케스트레이션 & 병렬 에이전트 실행 플랫폼. "oh-my-zsh for OpenCode".

**아키텍처**:
```
oh-my-opencode/
├── src/
│   ├── agents/              # 11 전문 AI 에이전트
│   ├── hooks/               # 41 생명주기 후크 (7 이벤트 유형)
│   ├── tools/               # 25+ 도구 (LSP, AST-Grep, delegation)
│   ├── features/            # 백그라운드 에이전트, 스킬, Claude Code 호환
│   ├── shared/              # 84 교차 유틸리티
│   ├── mcp/                 # 내장 MCP (Exa, Context7, Grep.app)
│   └── config/              # Zod 스키마 설정
├── packages/                # 7 플랫폼별 바이너리
└── dist/                    # 빌드 출력 (ESM)
```

**핵심 기능**:

1. **에이전트 시스템 (11개)**:

   | 에이전트 | 역할 | 모델 |
   |---------|------|------|
   | **Sisyphus** | 메인 오케스트레이터 | Claude Opus 4.5 High |
   | **Hephaestus** | 자율 딥 워커 | GPT 5.2 Codex Medium |
   | **Oracle** | 아키텍처 & 디버깅 | GPT 5.2 Medium |
   | **Librarian** | 문서 & 코드 검색 | Claude Sonnet 4.5 |
   | **Explore** | 빠른 코드베이스 grep | Claude Haiku 4.5 |
   | **Metis** | 계획 컨설턴트 | - |
   | **Momus** | 비평가 | - |
   | **Atlas** | 오케스트레이터 컨텍스트 | - |
   | **Prometheus** | 플래너 | - |

2. **진정한 병렬 에이전트 실행**:
   - 시뮬레이션이 아닌 실제 별도 에이전트 세션 스폰
   - tmux 시각화 (에이전트 동시 작업 모니터링)
   - 프로바이더/모델별 동시 실행 수 제한
   - 진정한 속도 향상 (1시간 vs 3개월 주장)

3. **"Ultrawork" 매직 키워드**: `ulw` 입력만으로 모든 기능 자동 활성화

4. **LSP/AST-Grep 통합**:
   - LSP 기반 결정론적 리팩토링 (LLM보다 안전)
   - AST-aware 코드 검색 (정규식보다 정확)
   - rename, diagnostics, document symbols

5. **Todo Continuation Enforcer**: 에이전트가 작업 중간에 중단하면 강제 재개

6. **멀티모델 오케스트레이션**: Claude + GPT + Gemini + GLM + Grok 동시 사용, 태스크에 최적 모델 자동 선택

**강점**:
- 진정한 멀티모델 동시 실행
- 정교한 에이전트 아키텍처 (11개, 역할별 최적 모델)
- Zero Setup ("ultrawork" 한 단어로 전체 활성화)
- 완전한 Claude Code 호환성 (41 후크)
- LSP/AST-Grep 결정론적 코드 조작
- 프로덕션 안정성 (195 테스트)

**약점**:
- OpenCode 의존
- 높은 토큰 비용 (병렬 에이전트)
- Anthropic ToS 불확실성
- 복잡한 프롬프트 빌더 (13K+ 라인)
- tmux 의존 (유닉스/리눅스 특화)

**ACA 적용 포인트**:
- 병렬 에이전트 실행 시스템 (BackgroundManager)
- 에이전트별 최적 모델/온도 할당
- LSP 통합 (결정론적 리팩토링)
- AST-Grep 통합 (구문 인식 검색)
- TodoContinuationEnforcer 패턴
- 에이전트 풀 & 동시 실행 수 제한

---

### 3.7 OpenCode

**개요**: 100% 오픈소스 AI 코딩 에이전트. Claude Code의 OSS 대안으로, 프로바이더 무관, 멀티 인터페이스 지원.

**아키텍처**:
```
opencode (monorepo via Bun workspaces)
├── packages/opencode/        # 코어 에이전트 + 서버 (~35 모듈)
│   ├── src/agent/            # 에이전트 정의 (build/plan/general)
│   ├── src/acp/              # Agent Client Protocol
│   ├── src/mcp/              # Model Context Protocol
│   ├── src/tool/             # 20+ 빌트인 도구
│   ├── src/permission/       # 세밀한 퍼미션 시스템
│   ├── src/skill/            # 마크다운 기반 스킬
│   ├── src/provider/         # 15+ LLM 프로바이더
│   ├── src/lsp/              # Language Server Protocol
│   ├── src/server/           # Hono 기반 HTTP 서버
│   └── src/session/          # 세션 관리
├── packages/app/             # SolidJS 웹 UI
├── packages/desktop/         # Tauri 데스크톱 앱
├── packages/sdk/js/          # JavaScript SDK
├── packages/plugin/          # 플러그인 SDK
└── packages/web/             # Astro 웹사이트
```

**핵심 기능**:

1. **3대 프로토콜 통합**:
   - **ACP** (Agent Client Protocol): OpenCode ↔ SDK 클라이언트
   - **MCP** (Model Context Protocol): 외부 도구/리소스 통합 (auto-OAuth, SSE, stdio)
   - **LSP** (Language Server Protocol): 코드 인텔리전스

2. **퍼미션 시스템 (PermissionNext)**:
   - 규칙 기반: `allow`, `deny`, `ask`
   - 와일드카드 패턴 매칭 (`*.env` → ask)
   - 계층적 병합: defaults → user → project
   - 구체적 권한: read, write, execute, question, doom_loop

3. **15+ LLM 프로바이더**: Anthropic, OpenAI, Google, Mistral, xAI, Groq, Together, Fireworks, DeepSeek, Ollama 등

4. **멀티 인터페이스**:
   - TUI (neovim 스타일, opentui)
   - Web UI (SolidJS)
   - Desktop App (Tauri)
   - Headless API (`opencode serve`)

5. **6단계 설정 계층**:
   1. Remote `.well-known/opencode` (조직 기본값)
   2. Global config (`~/.config/opencode/opencode.json`)
   3. Custom config (OPENCODE_CONFIG 환경변수)
   4. Project config (프로젝트 루트)
   5. `.opencode/` 디렉토리 설정
   6. Inline config (OPENCODE_CONFIG_CONTENT)

**강점**:
- 100% 오픈소스 (MIT), 벤더 종속 없음
- 15+ 프로바이더 통합 (업계 최다)
- 3대 프로토콜 표준 준수 (ACP + MCP + LSP)
- 멀티 인터페이스 (TUI + Web + Desktop + API)
- 세밀한 퍼미션 시스템
- 프로덕션 준비 (1.5M+ 다운로드)

**약점**:
- 스킬/플러그인 생태계 미성숙
- 성능 최적화 부족 (대용량 세션)
- 6단계 설정 계층 복잡도
- 퍼미션 디버깅 어려움
- 비용 모니터링 없음

**ACA 적용 포인트**:
- MCP 프로토콜 통합 패턴 (auto-OAuth, SSE, stdio)
- 퍼미션 시스템 (allow/deny/ask + 패턴 매칭)
- 멀티 인터페이스 아키텍처 (TUI + Web + API)
- 프로바이더 무관 LLM 추상화
- 마크다운 기반 스킬 정의

---

## 4. ACA 현재 상태 분석

### 4.1 아키텍처 개요

ACA는 21개 코어 모듈로 구성된 멀티에이전트 자율 코딩 시스템이다.

```
src/
├── core/                   # 21 코어 모듈
│   ├── orchestrator/       # CEO + 4 Team Agents + 라우팅
│   ├── skills/             # SkillRegistry + Pipeline + 4 스킬
│   ├── deep-worker/        # PreExploration + SelfPlanning + Retry + TodoEnforcer
│   ├── protocols/          # ACP Message Bus
│   ├── hooks/              # BaseHook → Registry → Executor
│   ├── context/            # 6개 컴포넌트 (Manager, Monitor, Budget, Curve, Optimizer, Compaction)
│   ├── learning/           # Reflexion + InstinctStore + SolutionsCache
│   ├── session/            # JSONL 영속성
│   ├── checkpoint/         # 원자적 상태 스냅샷
│   ├── workspace/          # 태스크 문서 관리
│   ├── security/           # 샌드박스 에스컬레이션 (4 레벨)
│   ├── dynamic-prompts/    # PromptRegistry + PromptRenderer
│   ├── hud/                # MetricsCollector + HUDDashboard
│   ├── benchmark/          # BenchmarkRunner (SWE-bench 스타일)
│   ├── brownfield/         # BrownfieldAnalyzer
│   ├── docs-generator/     # DocsGenerator (HLD/MLD/LLD)
│   ├── instinct-transfer/  # InstinctTransfer
│   ├── evals/              # EvalRunner + 3 평가자
│   ├── validation/         # 스키마 검증
│   └── di/                 # IoC 컨테이너 인터페이스
├── shared/                 # LLM 클라이언트, 에러, 설정, 로깅
├── api/                    # APIGateway (HTTP → ACP)
├── cli/                    # Commander 기반 CLI
└── dx/                     # 에러 복구 유틸리티
```

### 4.2 현재 강점

| 영역 | 상세 | 평가 |
|------|------|------|
| **아키텍처** | 21개 모듈, SOLID 원칙, 인터페이스 기반 | ⭐⭐⭐⭐⭐ |
| **학습 시스템** | Reflexion + InstinctStore + SolutionsCache (3계층) | ⭐⭐⭐⭐⭐ |
| **테스트** | 2,315+ 테스트, 97 파일, 70% 커버리지 임계값 | ⭐⭐⭐⭐⭐ |
| **컨텍스트 관리** | QualityCurve + TokenBudget + Compaction (6 컴포넌트) | ⭐⭐⭐⭐ |
| **ACP 프로토콜** | 자체 메시지 버스 (correlationId 무한루프 방지) | ⭐⭐⭐⭐ |
| **스킬 파이프라인** | 순차적 스킬 체이닝, 검증, 에러 처리 | ⭐⭐⭐⭐ |
| **딥 워커** | PreExploration → SelfPlanning → Retry → TodoEnforcer | ⭐⭐⭐⭐ |
| **후크 시스템** | 27 이벤트 유형, 비침입적 크로스컷팅 | ⭐⭐⭐⭐⭐ |

### 4.3 현재 약점

| 영역 | 상세 | 평가 |
|------|------|------|
| **MCP 프로토콜** | 미구현 — 외부 도구 통합 불가 | ⭐ |
| **멀티모델 라우팅** | 클라이언트 있으나 지능형 라우팅 없음 | ⭐⭐ |
| **실제 샌드박스** | 4 레벨 에스컬레이션 구현, OS 네이티브 격리 없음 | ⭐⭐ |
| **플러그인 시스템** | 없음 — 모든 확장은 소스 수정 필요 | ⭐ |
| **TUI/Web UI** | Commander CLI만 존재 | ⭐ |
| **병렬 에이전트** | 순차적 실행만 가능 | ⭐⭐ |
| **LSP 통합** | 없음 | ⭐ |
| **퍼미션 시스템** | 없음 | ⭐ |
| **에이전트 수** | 4개 (경쟁 대비 부족) | ⭐⭐ |
| **스킬 수** | 4개 (ECC 40+ 대비 부족) | ⭐⭐ |
| **실제 GitHub 연동** | 모킹 상태 | ⭐ |
| **DB 영속성** | JSONL만 (PostgreSQL 미구현) | ⭐ |
| **관측성** | HUD 인메모리만 | ⭐⭐ |

---

## 5. 비교 매트릭스

### 5.1 기능 비교 매트릭스

| 기능 | Claude Code | Codex | Gemini | ECC | GSD | OMO | OpenCode | **ACA** |
|------|:---------:|:-----:|:------:|:---:|:---:|:---:|:--------:|:-------:|
| 멀티에이전트 오케스트레이션 | O | - | O | O | O | **O+** | O | O |
| 에이전트 병렬 실행 | O | - | O | O | O | **O+** | - | **X** |
| 멀티모델 라우팅 | - | O | **O+** | - | O | **O+** | O | **X** |
| MCP 프로토콜 | O | O(실험) | O | O(설정) | - | O | **O+** | **X** |
| LSP 통합 | - | - | - | - | - | **O+** | O | **X** |
| 플러그인 시스템 | **O+** | - | O | O | - | O | O | **X** |
| 퍼미션/승인 | O | **O+** | O | - | - | - | **O+** | **X** |
| OS 샌드박스 | O | **O+** | O | - | - | - | - | 기본 구현 |
| 컨텍스트 엔지니어링 | - | - | O | O | **O+** | O | O | O |
| 학습 시스템 | - | - | - | **O+** | - | - | - | **O+** |
| Goal-Backward 검증 | - | - | - | O | **O+** | - | - | **X** |
| OpenTelemetry | - | **O+** | **O+** | - | - | - | - | **X** |
| TUI/Web UI | O | O | **O+** | - | - | - | **O+** | **X** |
| 구조화 계획 (XML) | - | - | - | - | **O+** | - | - | **X** |
| 인스틴트 공유 | - | - | - | **O+** | - | - | - | **X** |
| 팀 학습 | - | - | - | **O+** | - | - | - | 부분적 |

> **O+** = 업계 최고 수준, **O** = 지원, **X** = 미지원, **-** = 해당 없음

### 5.2 아키텍처 품질 비교

| 품질 지표 | Claude Code | Codex | Gemini | ECC | GSD | OMO | OpenCode | **ACA** |
|----------|:----------:|:-----:|:------:|:---:|:---:|:---:|:--------:|:-------:|
| 모듈 분리 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| 타입 안전성 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| 테스트 커버리지 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| 확장성 설계 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐** |
| 문서화 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| 프로덕션 준비 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

---

## 6. Gap Analysis: ACA vs 경쟁 프로젝트

### 6.1 Critical Gaps (반드시 해결 필요)

| Gap | 현재 | 목표 | 참고 프로젝트 | 영향도 |
|-----|------|------|--------------|--------|
| MCP 프로토콜 | 미구현 | 완전 통합 | OpenCode, Gemini | 🔴 외부 도구 통합 불가 |
| 멀티모델 라우팅 | 클라이언트만 | 지능형 라우팅 | OMO, Gemini | 🔴 비용/품질 최적화 불가 |
| 병렬 에이전트 실행 | 순차적 | 진정한 병렬 | Oh My OpenCode | 🔴 속도 3-5x 손실 |
| 퍼미션 시스템 | 없음 | allow/deny/ask | OpenCode, Codex | 🔴 안전성 부재 |

### 6.2 Important Gaps (강력 추천)

| Gap | 현재 | 목표 | 참고 프로젝트 | 영향도 |
|-----|------|------|--------------|--------|
| 컨텍스트 엔지니어링 | QualityCurve만 | .planning/ 구조 | Get Shit Done | 🟡 품질 안정화 |
| Goal-Backward 검증 | 없음 | 목표 역추적 | Get Shit Done | 🟡 완성도 보장 |
| 에이전트 확장 | 4개 | 10+ | ECC, OMO | 🟡 전문성 확대 |
| 스킬 생태계 | 5개 | 20+ | ECC | 🟡 기능성 확대 |
| 플러그인 시스템 | 없음 | 표준 구조 | Claude Code, OpenCode | 🟡 확장성 |
| 인스틴트 공유 | 없음 | import/export | ECC | 🟡 팀 학습 |

### 6.3 Recommended Gaps (향후 개선)

| Gap | 현재 | 목표 | 참고 프로젝트 | 영향도 |
|-----|------|------|--------------|--------|
| OS 샌드박스 | 4레벨 에스컬레이션 | OS 네이티브 격리 추가 | Codex | 🟢 보안 |
| OpenTelemetry | HUD만 | 완전 계측 | Codex, Gemini | 🟢 관측성 |
| LSP 통합 | 없음 | 결정론적 리팩토링 | OMO | 🟢 정확성 |
| TUI/Web UI | CLI만 | React/Ink TUI | Gemini, OpenCode | 🟢 UX |
| XML 구조화 계획 | 없음 | 태스크 포맷 | GSD | 🟢 명확성 |

---

## 7. Enhancement Strategy: 프로젝트별 차용 기능

### Phase 1: 핵심 인프라 보강 (Foundation)

#### 1-1. MCP 프로토콜 통합 ← OpenCode, Gemini CLI

**목적**: 외부 도구 (GitHub, Slack, DB 등) 표준 통합

**구현 구조**:
```
src/core/mcp/
├── mcp-client.ts              # MCP 클라이언트 (외부 도구 연결)
├── mcp-server.ts              # ACA를 MCP 서버로 노출
├── mcp-tool-registry.ts       # MCP 도구 자동 발견 & 등록
├── mcp-transport/
│   ├── stdio-transport.ts     # 표준 입출력 전송
│   ├── sse-transport.ts       # Server-Sent Events 전송
│   └── http-transport.ts      # HTTP 스트리밍 전송
└── interfaces/mcp.interface.ts
```

**핵심 차용점**:
- OpenCode의 auto-OAuth, SSE, stdio 전송 패턴
- Gemini CLI의 MCP 도구 발견 & 토큰 스토리지
- Claude Code의 `.mcp.json` 설정 표준

**연동**: ACA의 SkillRegistry와 MCP 도구를 통합하여, MCP 도구를 네이티브 스킬처럼 사용 가능하게 함.

#### 1-2. 멀티모델 지능형 라우팅 ← Oh My OpenCode, Gemini CLI

**목적**: 태스크 복잡도/유형에 따른 최적 모델 자동 선택

**구현 구조**:
```
src/shared/llm/
├── model-router.ts            # 지능형 모델 선택기
├── routing-strategies/
│   ├── complexity-based.ts    # 복잡도 기반 (Gemini CLI 패턴)
│   ├── cost-optimized.ts      # 비용 최적화 (GSD budget 프로필)
│   ├── capability-based.ts    # 기능 기반 (OMO 에이전트별 모델)
│   └── composite.ts           # 복합 전략 (Gemini CLI 패턴)
├── model-profiles.ts          # 프로필 시스템 (quality/balanced/budget)
└── cost-tracker.ts            # 신규 구현: 실시간 비용 추적
```

**모델 프로필 시스템** (GSD 차용):

| 프로필 | Planning Agent | Dev Agent | QA Agent | CodeQuality Agent |
|--------|---------------|-----------|----------|-------------------|
| **quality** | Opus | Opus | Sonnet | Opus |
| **balanced** | Opus | Sonnet | Sonnet | Sonnet |
| **budget** | Sonnet | Haiku | Haiku | Sonnet |

**라우팅 전략** (Gemini CLI + OMO 결합):
- Complexity Classifier: 쿼리 분석 → 복잡도 점수 → 모델 매핑
- Cost Optimizer: 비용 임계값 기반 모델 다운그레이드
- Capability Matcher: 에이전트 역할 → 최적 모델 (OMO 패턴)
- Composite: 위 전략들을 가중치로 결합

#### 1-3. 퍼미션 & 승인 워크플로우 ← OpenCode, Codex

**목적**: 에이전트 액션에 대한 세밀한 권한 제어

**구현 구조**:
```
src/core/permission/
├── permission-manager.ts      # 규칙 기반 퍼미션 엔진
├── approval-workflow.ts       # 3단계 승인 모드
├── permission-rules.ts        # 패턴 매칭 규칙
├── permission-resolver.ts     # 규칙 우선순위 해석
└── interfaces/permission.interface.ts
```

**승인 모드** (Codex 차용):
- **Suggest** (기본): 모든 파일 변경/셸 명령 사용자 승인 필요
- **Auto Edit**: 파일 편집 자동 허용, 셸 명령만 승인
- **Full Auto**: 샌드박스 내 완전 자율 (위험 액션만 차단)

**퍼미션 규칙** (OpenCode 차용):
```typescript
interface PermissionRule {
  pattern: string;    // "*.env", "src/**/*.ts", "rm -rf *"
  action: 'allow' | 'deny' | 'ask';
  scope: 'read' | 'write' | 'execute' | 'all';
}
```

---

### Phase 2: 에이전트 & 스킬 확장 (Capability)

#### 2-1. 에이전트 확장 (4 → 10+) ← ECC, Oh My OpenCode

**목적**: 전문화된 에이전트로 태스크 처리 품질 향상

**추가 에이전트**:

| 에이전트 | 차용원 | 역할 | 최적 모델 |
|---------|--------|------|-----------|
| ArchitectureAgent | OMO (Oracle) | 시스템 설계, 의존성 분석 | Opus |
| SecurityAgent | ECC (security-reviewer) | 보안 취약점 분석, OWASP 검사 | Opus |
| DebuggingAgent | GSD (gsd-debugger) | 체계적 디버깅, 루트 원인 분석 | Sonnet |
| DocumentationAgent | ECC (doc-updater) | API 문서, 코드 주석, README | Sonnet |
| ExplorationAgent | OMO (Explore) | 빠른 코드베이스 탐색, grep | Haiku |
| IntegrationAgent | GSD (integration-checker) | 통합 테스트, 모듈 간 연결 검증 | Sonnet |

**구현 패턴**: 기존 `BaseTeamAgent` 상속, SkillPipeline 활용

```
src/core/orchestrator/agents/
├── planning-agent.ts          # 기존
├── development-agent.ts       # 기존
├── code-quality-agent.ts      # 기존
├── qa-agent.ts                # 기존
├── architecture-agent.ts      # 새로: 시스템 설계
├── security-agent.ts          # 새로: 보안 전문
├── debugging-agent.ts         # 새로: 체계적 디버깅
├── documentation-agent.ts     # 새로: 문서 전문
├── exploration-agent.ts       # 새로: 코드 탐색
└── integration-agent.ts       # 새로: 통합 검증
```

#### 2-2. 스킬 생태계 확장 (5 → 20+) ← ECC, Oh My OpenCode

**목적**: 재사용 가능한 전문 스킬로 에이전트 기능 강화

**추가 스킬**:

| 스킬 | 차용원 | 기능 |
|------|--------|------|
| SecurityScanSkill | ECC (AgentShield) | OWASP 취약점 스캔, 인젝션 탐지 |
| GitWorkflowSkill | ECC (git-master) | 원자적 커밋, PR 생성, 브랜치 관리 |
| DocumentationSkill | ECC (doc-updater) | API 문서, 코드 주석 생성 |
| DebuggingSkill | GSD (gsd-debugger) | 체계적 디버깅, 스택 트레이스 분석 |
| PerformanceSkill | ECC (perf analysis) | 성능 프로파일링, 병목 탐지 |
| MigrationSkill | Claude Code (migration) | 프레임워크/라이브러리 마이그레이션 |
| ApiDesignSkill | 새로 | REST/GraphQL API 설계 |
| TddWorkflowSkill | ECC (tdd-guide) | Red-Green-Refactor 워크플로우 |
| DatabaseSkill | ECC (database-reviewer) | 스키마 설계, 쿼리 최적화 |
| CiCdSkill | 새로 | CI/CD 파이프라인 구성 |

**마크다운 기반 스킬 정의** (OpenCode 패턴 차용):
```markdown
---
name: security-scan
description: OWASP Top 10 보안 취약점 스캔
triggers: ["security", "vulnerability", "injection", "xss"]
tools: [read, grep, glob]
---

# Security Scan Skill

## 검사 항목
1. SQL Injection 패턴 탐지
2. XSS 취약점 확인
3. 인증/인가 검증
...
```

#### 2-3. 백그라운드 에이전트 시스템 ← Oh My OpenCode

**목적**: 진정한 병렬 에이전트 실행으로 처리 속도 향상

**구현 구조**:
```
src/core/orchestrator/
├── background-manager.ts     # 병렬 에이전트 라이프사이클 관리
├── agent-pool.ts             # 에이전트 풀 (동시 실행 수 제한)
├── parallel-executor.ts      # 병렬 태스크 실행기
└── interfaces/parallel.interface.ts
```

**핵심 설계**:
```typescript
interface ParallelExecutionConfig {
  maxConcurrent: number;           // 최대 동시 에이전트 수 (기본: 3)
  perProviderLimits: {             // 프로바이더별 동시 제한
    anthropic: number;             // Claude: 3
    openai: number;                // GPT: 2
    google: number;                // Gemini: 2
  };
  isolateContext: boolean;         // 에이전트별 독립 컨텍스트 (GSD 패턴)
  timeoutMs: number;               // 에이전트 타임아웃
}
```

**실행 패턴** (OMO + GSD 결합):
1. CEO Orchestrator가 태스크 분해
2. 독립적 서브태스크 식별 → 병렬 실행 후보
3. AgentPool에서 에이전트 할당 (모델/프로바이더별 제한 준수)
4. 각 에이전트는 **독립 컨텍스트**에서 실행 (GSD의 fresh context)
5. 완료 시 결과를 ACP 메시지 버스로 수집
6. CEO가 결과 통합 & 다음 단계 라우팅

---

### Phase 3: 컨텍스트 & 워크플로우 고도화 (Quality)

#### 3-1. 컨텍스트 엔지니어링 시스템 ← Get Shit Done

**목적**: 컨텍스트 품질 저하를 구조적으로 방지

**구현 구조**:
```
src/core/context/
├── planning-context/
│   ├── planning-directory.ts  # .planning/ 구조 생성/관리
│   ├── state-tracker.ts       # STATE.md: 의사결정, 블로커, 현재 위치 추적
│   ├── phase-manager.ts       # 페이즈 생명주기 (추가/삽입/삭제/완료)
│   ├── context-budget.ts      # 50% 규칙 강제
│   └── research-snapshot.ts   # 페이즈별 연구 결과 보존
├── context-manager.ts         # 기존 확장
├── quality-curve.ts           # 기존 (GSD 50% 규칙 통합)
└── compaction-strategy.ts     # 기존 확장
```

**핵심 규칙 (GSD 차용)**:
- 모든 계획은 50% 컨텍스트 윈도우 내에서 완료되어야 함
- 초과 시 자동으로 새 에이전트 스폰 (fresh context)
- STATE.md로 세션 간 의사결정 보존
- CONTEXT.md로 사용자의 구현 선호도 추적

#### 3-2. Goal-Backward 검증 시스템 ← Get Shit Done

**목적**: 태스크 완료가 아닌 목표 달성을 검증

**구현 구조**:
```
src/core/validation/
├── goal-backward-verifier.ts  # 3단계 목표 역추적 검증
├── verification-report.ts     # 구조화된 검증 리포트
├── stub-detector.ts           # 스텁/플레이스홀더 탐지
└── interfaces/validation.interface.ts  # 기존 확장
```

**3단계 검증**:
```
Level 1: Must be TRUE
  → "이 기능이 작동하려면 어떤 조건이 참이어야 하는가?"
  → 예: "인증 토큰이 유효해야 한다", "DB 연결이 활성이어야 한다"

Level 2: Must EXIST
  → "어떤 파일/함수/설정이 존재해야 하는가?"
  → 예: "auth/middleware.ts가 존재해야 한다", "JWT_SECRET 환경변수"

Level 3: Must be WIRED
  → "어떤 연결/통합이 완료되어야 하는가?"
  → 예: "미들웨어가 라우터에 등록", "에러 핸들러 연결"
```

**스텁 탐지기**: `throw new Error("Not implemented")`, `// TODO`, 빈 함수 본문 등 감지

#### 3-3. XML 구조화 계획 ← Get Shit Done

**목적**: 모호함을 제거하고 검증 기준이 내장된 태스크 포맷

**구현 구조**:
```
src/core/workspace/
├── task-document.ts           # 기존 확장
├── task-document-parser.ts    # 기존 확장 (XML 파싱 추가)
├── xml-plan-format.ts         # XML 계획 포맷터
└── plan-validator.ts          # 계획 구조 검증
```

**XML 태스크 포맷**:
```xml
<task type="auto" priority="high">
  <name>사용자 인증 미들웨어 구현</name>
  <files>
    src/api/middleware/auth.ts
    src/shared/config/jwt.ts
  </files>
  <dependencies>
    <dep>JWT 라이브러리 설치</dep>
    <dep>User 모델 정의</dep>
  </dependencies>
  <action>
    jose 라이브러리로 JWT 검증 미들웨어 구현.
    Bearer 토큰 추출 → 서명 검증 → req.user 설정.
    만료된 토큰은 401, 유효하지 않은 토큰은 403 반환.
  </action>
  <verify>
    유효한 토큰으로 보호된 엔드포인트 접근 → 200
    만료된 토큰 → 401 + "Token expired" 메시지
    토큰 없음 → 401 + "No token provided" 메시지
  </verify>
  <done>
    인증 미들웨어가 라우터에 등록되고,
    모든 보호된 엔드포인트에서 토큰 검증이 작동함
  </done>
</task>
```

---

### Phase 4: 인터페이스 & 관측성 (Experience)

#### 4-1. 플러그인 시스템 ← Claude Code, OpenCode

**목적**: 소스 수정 없이 기능 확장 가능한 플러그인 아키텍처

**구현 구조**:
```
src/core/plugins/
├── plugin-loader.ts          # 플러그인 발견 & 동적 로딩
├── plugin-registry.ts        # 플러그인 등록 & 의존성 관리
├── plugin-lifecycle.ts       # 플러그인 초기화/종료 생명주기
├── plugin-api.ts             # 플러그인에 노출되는 API
└── interfaces/plugin.interface.ts
```

**플러그인 구조 표준** (Claude Code 패턴):
```
my-plugin/
├── plugin.json               # 메타데이터 (이름, 버전, 의존성)
├── agents/                    # 추가 에이전트 정의 (*.md 또는 *.ts)
├── skills/                    # 추가 스킬 정의
├── hooks/                     # 추가 후크 (hooks.json + 스크립트)
├── commands/                  # 추가 CLI 커맨드
└── README.md
```

#### 4-2. OpenTelemetry 관측성 ← Codex, Gemini CLI

**목적**: 프로덕션 수준의 추적, 메트릭, 로깅

**구현 구조**:
```
src/shared/telemetry/
├── otel-provider.ts          # OpenTelemetry 초기화 & 설정
├── trace-manager.ts          # 분산 추적 (에이전트 간 태스크 추적)
├── metrics-exporter.ts       # Prometheus/OTLP 메트릭 내보내기
├── cost-analytics.ts         # LLM 비용 분석 대시보드
└── interfaces/telemetry.interface.ts
```

**추적 대상**:
- 에이전트별 태스크 처리 시간 & 토큰 사용량
- 모델별 비용 분석 (Codex 패턴)
- 스킬 파이프라인 실행 추적
- ACP 메시지 전파 추적
- 에러율 & 복구 시간

#### 4-3. LSP 통합 ← Oh My OpenCode

**목적**: 결정론적 코드 조작 (LLM보다 안전한 리팩토링)

**구현 구조**:
```
src/core/lsp/
├── lsp-client.ts             # Language Server 연결 관리
├── symbol-resolver.ts        # 심볼 조회 (정의, 참조, 호출)
├── refactor-engine.ts        # LSP 기반 리팩토링 (rename, extract)
├── diagnostics-collector.ts  # 컴파일 오류/경고 수집
└── interfaces/lsp.interface.ts
```

**LSP 기반 스킬 통합**:
- RefactoringSkill이 LSP refactor-engine 사용
- CodeQualityAgent가 diagnostics 활용
- ExplorationAgent가 symbol-resolver 사용

#### 4-4. TUI 인터페이스 ← Gemini CLI, OpenCode

**목적**: 풍부한 터미널 인터페이스로 에이전트 실행 시각화

**구현 구조**:
```
src/ui/
├── tui/
│   ├── app.tsx               # React/Ink 기반 TUI 메인
│   ├── components/
│   │   ├── agent-panel.tsx   # 에이전트 상태 모니터링
│   │   ├── task-tracker.tsx  # 태스크 진행률 추적
│   │   ├── cost-display.tsx  # 실시간 비용 표시
│   │   ├── log-viewer.tsx    # 로그 스트림
│   │   └── diff-viewer.tsx   # 코드 변경 diff
│   └── hooks/
│       ├── use-agent-status.ts
│       └── use-task-progress.ts
└── web/
    ├── server.ts             # Hono API 서버
    └── dashboard/            # 웹 대시보드
```

---

### Phase 5: 안전성 & 프로덕션 (Hardening)

#### 5-1. OS-Native 샌드박스 ← Codex

**목적**: 에이전트의 코드 실행을 OS 수준에서 격리

**구현 구조**:
```
src/core/security/
├── sandbox-escalation.ts     # 기존 확장: 4 레벨 → OS 통합
├── seatbelt-sandbox.ts       # macOS Apple Seatbelt
├── landlock-sandbox.ts       # Linux Landlock LSM
├── network-isolation.ts      # 네트워크 격리
├── resource-limiter.ts       # CPU/메모리/시간 제한
└── interfaces/escalation.interface.ts
```

**Codex 패턴 차용**:
- Level 0 (None): 제한 없음
- Level 1 (Basic): 읽기전용 파일시스템, 네트워크 허용
- Level 2 (Standard): 선택적 쓰기 경로, 네트워크 프록시
- Level 3 (Strict): 최소 쓰기 경로, 네트워크 차단

#### 5-2. 인스틴트 공유 & 팀 학습 ← Everything Claude Code

**목적**: 에이전트 간, 프로젝트 간 학습 전이

**구현 구조**:
```
src/core/learning/
├── instinct-store.ts         # 기존
├── instinct-export.ts        # 새로: 인스틴트 → JSON/YAML 내보내기
├── instinct-import.ts        # 새로: 외부 인스틴트 가져오기 (검증 포함)
├── instinct-clustering.ts    # 새로: 유사 인스틴트 → 스킬 변환
└── team-learning-hub.ts      # 새로: 팀 전체 인스틴트 동기화
```

**ECC 패턴 차용**:
- `/instinct-export`: 현재 프로젝트의 검증된 인스틴트를 이식 가능한 형태로 내보내기
- `/instinct-import`: 다른 프로젝트/팀의 인스틴트를 가져와 초기 신뢰도로 적용
- `/evolve`: 유사한 인스틴트들을 클러스터링하여 자동으로 새 스킬 생성

---

## 8. 구현 로드맵

### 8.1 우선순위 매트릭스

| 우선순위 | Phase | 기능 | 영향도 | 복잡도 | 예상 테스트 |
|---------|-------|------|--------|--------|------------|
| **P0** | 1-2 | 멀티모델 라우팅 | 🔥🔥🔥 | 중 | ~40 |
| **P0** | 2-3 | 병렬 에이전트 실행 | 🔥🔥🔥 | 고 | ~30 |
| **P1** | 3-1 | 컨텍스트 엔지니어링 | 🔥🔥🔥 | 중 | ~25 |
| **P1** | 3-2 | Goal-Backward 검증 | 🔥🔥 | 중 | ~20 |
| **P1** | 1-1 | MCP 프로토콜 | 🔥🔥 | 고 | ~35 |
| **P2** | 2-1 | 에이전트 확장 (→10+) | 🔥🔥 | 중 | ~50 |
| **P2** | 1-3 | 퍼미션 & 승인 | 🔥🔥 | 중 | ~30 |
| **P2** | 2-2 | 스킬 확장 (→20+) | 🔥🔥 | 중 | ~60 |
| **P3** | 4-2 | OpenTelemetry | 🔥 | 중 | ~20 |
| **P3** | 4-3 | LSP 통합 | 🔥 | 고 | ~25 |
| **P3** | 4-1 | 플러그인 시스템 | 🔥 | 고 | ~30 |
| **P3** | 5-1 | OS 샌드박스 | 🔥 | 고 | ~25 |
| **P3** | 3-3 | XML 구조화 계획 | 🔥 | 저 | ~15 |
| **P3** | 5-2 | 인스틴트 공유 | 🔥 | 중 | ~15 |
| **P4** | 4-4 | TUI/Web UI | 🔥 | 고 | ~30 |

### 8.2 Phase별 예상 결과

| Phase 완료 후 | 새 테스트 | 누적 테스트 | 새 모듈 | 핵심 개선 |
|--------------|----------|-----------|--------|-----------|
| Phase 1 (Foundation) | ~105 | ~2,420 | 3 | 멀티모델 + MCP + 퍼미션 |
| Phase 2 (Capability) | ~140 | ~2,560 | 3 | 10+ 에이전트 + 20+ 스킬 + 병렬 실행 |
| Phase 3 (Quality) | ~60 | ~2,620 | 3 | 컨텍스트 엔지니어링 + 검증 + XML |
| Phase 4 (Experience) | ~105 | ~2,725 | 4 | 관측성 + LSP + 플러그인 + TUI |
| Phase 5 (Hardening) | ~40 | ~2,765 | 2 | OS 샌드박스 + 팀 학습 |

---

## 9. ACA 고유 경쟁 우위

### 9.1 현재 고유 강점 (유지 & 강화)

1. **가장 정교한 학습 시스템** (3계층):
   - ReflexionPattern (에러 기반)
   - InstinctStore (행동 기반, 신뢰도 0.3-0.9)
   - SolutionsCache (LRU + 퍼지 매칭)
   - → 어떤 경쟁 프로젝트보다 깊은 학습 메커니즘

2. **최고 수준의 아키텍처 설계** (21 모듈):
   - 인터페이스 기반 SOLID 원칙
   - Registry 패턴으로 런타임 확장
   - ACP 메시지 버스로 느슨한 결합
   - → 가장 체계적이고 확장 가능한 구조

3. **업계 최고 테스트 커버리지** (2,315+):
   - 단위 + 통합 + E2E
   - 70% 커버리지 임계값
   - → 신뢰성 보장

4. **컨텍스트 품질의 과학적 모델링**:
   - QualityCurve: 컨텍스트 성장 → 품질 저하 수학적 매핑
   - TokenBudgetManager: 실시간 토큰 예산 추적
   - CompactionStrategy: 지능형 컨텍스트 압축
   - → 다른 프로젝트들은 경험적 규칙만 사용

5. **독자적 ACP 프로토콜**:
   - correlationId 기반 무한루프 방지
   - 분산 확장 가능한 메시지 버스 기반
   - → 미래 클러스터 배포 기반

### 9.2 Enhancement 후 최종 경쟁 포지션

| 영역 | Enhancement 전 | Enhancement 후 | 경쟁 대비 |
|------|---------------|---------------|----------|
| 학습 시스템 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐+ (팀 공유) | **업계 유일** |
| 아키텍처 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **업계 최고** |
| 에이전트 | ⭐⭐ (4개) | ⭐⭐⭐⭐ (10+) | 경쟁 수준 |
| 모델 라우팅 | ⭐ | ⭐⭐⭐⭐⭐ | **업계 최고** |
| 병렬 실행 | ⭐ | ⭐⭐⭐⭐ | 경쟁 수준 |
| 컨텍스트 관리 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐+ (.planning/) | **업계 최고** |
| 프로토콜 | ⭐⭐⭐ (ACP만) | ⭐⭐⭐⭐⭐ (ACP+MCP) | 경쟁 수준 |
| 보안 | ⭐ | ⭐⭐⭐⭐ (OS 샌드박스) | 경쟁 수준 |
| 관측성 | ⭐⭐ | ⭐⭐⭐⭐ (OTel) | 경쟁 수준 |
| 테스트 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐+ (~2,765) | **업계 최고** |

---

## 10. 결론

### 핵심 메시지

ACA는 이미 **아키텍처 설계, 학습 시스템, 테스트 커버리지** 면에서 업계 최고 수준이다. 그러나 **실용적 기능** (MCP, 멀티모델, 병렬 실행, UI) 면에서 경쟁 프로젝트 대비 격차가 존재한다.

본 Enhancement Strategy는 각 경쟁 프로젝트의 **입증된 패턴**만을 선별하여 ACA의 강력한 아키텍처 위에 통합한다:

- **OpenCode** → MCP 프로토콜, 퍼미션 시스템
- **Oh My OpenCode** → 멀티모델 라우팅, 병렬 에이전트, LSP 통합
- **Get Shit Done** → 컨텍스트 엔지니어링, Goal-Backward 검증, XML 계획
- **Everything Claude Code** → 인스틴트 공유, 스킬 생태계, 에이전트 전문화
- **Codex** → OS 샌드박스, OpenTelemetry 관측성
- **Gemini CLI** → 모델 라우팅 전략, 평가 시스템
- **Claude Code** → 플러그인 아키텍처, 구조적 워크플로우

### 최종 비전

Enhancement 완료 시, ACA는:
- **가장 지능적인 학습 시스템** (3계층 학습 + 팀 공유)
- **가장 효율적인 모델 활용** (지능형 멀티모델 라우팅)
- **가장 안정적인 품질** (컨텍스트 엔지니어링 + Goal-Backward 검증)
- **가장 확장 가능한 구조** (MCP + 플러그인 + 10+ 에이전트)
- **가장 높은 신뢰성** (~2,765+ 테스트)

을 갖춘, 현존하는 AI 코딩 에이전트 중 가장 포괄적이고 완성도 높은 시스템이 된다.

---

## Appendix

### A. 분석 프로젝트 저장소

| 프로젝트 | 로컬 경로 |
|---------|----------|
| Claude Code | `/Users/kevin/work/github/ai-cli/claude-code/` |
| Codex | `/Users/kevin/work/github/ai-cli/codex/` |
| Gemini CLI | `/Users/kevin/work/github/ai-cli/gemini-cli/` |
| Everything Claude Code | `/Users/kevin/work/github/ai-cli/everything-claude-code/` |
| Get Shit Done | `/Users/kevin/work/github/ai-cli/get-shit-done/` |
| Oh My OpenCode | `/Users/kevin/work/github/ai-cli/oh-my-opencode/` |
| OpenCode | `/Users/kevin/work/github/ai-cli/opencode/` |
| ACA | `/Users/kevin/work/github/ai-cli/autonomous-coding-agents/` |

### B. 분석 방법론

- 각 프로젝트에 대해 독립된 Explore 에이전트를 병렬로 실행
- README, package.json, 소스 코드, 테스트, 문서를 체계적으로 탐색
- 디렉토리 구조, 아키텍처 패턴, 기능 목록, 기술 스택을 추출
- ACA와의 Gap Analysis를 통해 구체적 차용 포인트 도출

### C. 관련 문서

- [IMPLEMENTATION_PRIORITY_LIST.md](./IMPLEMENTATION_PRIORITY_LIST.md) — 기존 구현 우선순위
- [FEATURE_IMPROVEMENTS.md](./FEATURE_IMPROVEMENTS.md) — 기능 개선 목록
- [CODE_STRUCTURE_IMPROVEMENT_PLAN.md](./CODE_STRUCTURE_IMPROVEMENT_PLAN.md) — 코드 구조 개선 계획

---

## Appendix D. 코드베이스 검증 결과 (2026-02-13)

### D.1 검증된 불일치 항목 및 교정

| # | 항목 | 문서 원본 | 실제 코드베이스 | 교정 내용 |
|---|------|-----------|----------------|-----------|
| 1 | 코어 모듈 수 | 23개 | 21개 (`src/core/` 하위 디렉토리) | 21개로 수정 |
| 2 | 스킬 수 | 5개 | 4개 (planning, code-review, refactoring, test-generation) | 4개로 수정 |
| 3 | cost-tracker.ts | "기존 확장" | 코드베이스에 존재하지 않음 | "신규 구현" 으로 수정 |
| 4 | tiered-router.ts | MEMORY.md에 기록됨 | 코드베이스에 존재하지 않음 | 별도 확인 필요 (커밋 이력 또는 브랜치 누락 가능) |
| 5 | 후크 이벤트 수 | 11+ | 27개 (AGENT_*, TASK_*, TOOL_*, WORKFLOW_*, GIT_*, CONTEXT_*, SESSION_*) | 27개로 수정 + 평가 ⭐⭐⭐⭐⭐ 상향 |
| 6 | 샌드박스 상태 | "스텁" | SandboxEscalation 완전 구현 (4레벨) | "4레벨 에스컬레이션 구현"으로 수정 |
| 7 | 테스트 파일 수 | 98 | 97 | 본문 "97 파일" 기재 (이미 정확) |

### D.2 코드베이스 확인된 21개 코어 모듈

```
src/core/
├── benchmark/          # BenchmarkRunner (SWE-bench 스타일)
├── brownfield/         # BrownfieldAnalyzer
├── checkpoint/         # CheckpointManager
├── context/            # 6 컴포넌트 (Manager, Monitor, Budget, Curve, Optimizer, Compaction)
├── deep-worker/        # PreExploration + SelfPlanning + RetryStrategy + TodoEnforcer
├── di/                 # IoC 컨테이너 인터페이스
├── docs-generator/     # DocsGenerator (HLD/MLD/LLD)
├── dynamic-prompts/    # PromptRegistry + PromptRenderer
├── hooks/              # BaseHook → Registry → Executor (27 이벤트)
├── hud/                # MetricsCollector + HUDDashboard
├── instinct-transfer/  # InstinctTransfer
├── interfaces/         # 공통 인터페이스 정의
├── learning/           # ReflexionPattern + InstinctStore + SolutionsCache
├── orchestrator/       # CEO + 4 Team Agents + TaskRouter
├── protocols/          # ACPMessageBus
├── security/           # SandboxEscalation (4 레벨 완전 구현)
├── services/           # ServiceRegistry
├── session/            # JSONL 영속성 + SessionManager + Recovery
├── skills/             # SkillRegistry + Pipeline + 4 스킬
├── validation/         # 스키마 검증
└── workspace/          # WorkspaceManager + DocumentQueue
```

> **참고**: `evals/` 모듈은 MEMORY.md에 기록되어 있으나 현 코드베이스에서는 `core/` 하위에 포함되지 않음. `tiered-router.ts`와 `cost-tracker.ts`도 동일하게 코드베이스에서 확인 불가 — 별도 브랜치 또는 이전 리팩토링에서 제거된 것으로 추정.

---

## Appendix E. 전체 기능 적용 시 사용 시나리오 분석

> Enhancement Strategy의 5개 Phase 기능이 모두 ACA에 적용되었을 때, 실제로 어떤 시나리오에서 어떻게 동작하는지에 대한 추론.

### E.1 시나리오 전체 흐름도 (Enhancement 적용 후)

```
사용자 입력
    │
    ▼
┌─────────────────────────────────────────┐
│ ENTRY LAYER                             │
│ ├── CLI (Commander)                     │
│ ├── TUI (Ink/React)        [Phase 5]    │
│ ├── API Gateway (HTTP→ACP) [기존]       │
│ └── MCP Server (노출)      [Phase 1]    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ PERMISSION LAYER              [Phase 1] │
│ ├── PermissionManager                   │
│ ├── allow/deny/ask 패턴 매칭            │
│ └── 도구별 위험도 분류                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ ROUTING LAYER                 [Phase 1] │
│ ├── ModelRouter (지능형 라우팅)          │
│ │   ├── ComplexityBased 전략             │
│ │   ├── CostOptimized 전략              │
│ │   └── CapabilityBased 전략            │
│ ├── 프로필: quality/balanced/budget      │
│ └── CostTracker (실시간 비용 추적)       │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ ORCHESTRATION LAYER                     │
│ ├── CEOOrchestrator           [기존]    │
│ │   └── TaskRouter + TaskQueue          │
│ ├── ParallelExecutor          [Phase 2] │
│ │   └── 에이전트 동시 실행               │
│ └── .planning/ 디렉토리       [Phase 2] │
│     └── 컨텍스트 엔지니어링              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ AGENT LAYER (10+ 에이전트)    [Phase 3] │
│ ├── PlanningAgent → XML 구조화 계획     │
│ ├── DevelopmentAgent → DeepWorker       │
│ ├── QAAgent → 테스트 실행               │
│ ├── CodeQualityAgent → 정적 분석        │
│ ├── SecurityAgent → 보안 감사  [신규]   │
│ ├── PerformanceAgent → 벤치마크 [신규]  │
│ ├── DocumentationAgent → HLD/MLD/LLD   │
│ ├── RefactoringAgent → LSP 기반 [신규]  │
│ ├── DeploymentAgent → CI/CD    [신규]   │
│ └── ArchitectureAgent → 설계   [신규]   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ TOOL LAYER                              │
│ ├── Native Skills (4개)       [기존]    │
│ ├── MCP Tools (외부 도구)     [Phase 1] │
│ │   ├── GitHub MCP Server               │
│ │   ├── Slack MCP Server                │
│ │   ├── DB MCP Server                   │
│ │   └── 사용자 정의 MCP                  │
│ ├── LSP Client (리팩토링)     [Phase 4] │
│ ├── Plugin System             [Phase 3] │
│ └── OS Sandbox (격리 실행)    [Phase 4] │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ CROSS-CUTTING CONCERNS                  │
│ ├── HookSystem (27 이벤트)    [기존]    │
│ ├── Learning (3계층+팀공유)   [Phase 3] │
│ ├── Context Engineering       [Phase 2] │
│ ├── GoalBackward Verification [Phase 2] │
│ ├── OpenTelemetry 관측성      [Phase 4] │
│ └── Session Persistence       [기존]    │
└─────────────────────────────────────────┘
```

---

### E.2 시나리오 1: 복잡한 기능 개발 요청

**입력**: `aca run "사용자 인증 시스템을 JWT 기반으로 구현해줘. Google OAuth도 지원해야 해"`

#### 단계별 흐름:

```
1. CLI 진입 → OrchestratorRunner.start()
   └── 모든 에이전트 및 통합 모듈 초기화

2. PERMISSION CHECK [Phase 1: 퍼미션 시스템]
   ├── 파일 시스템 쓰기 → allow (프로젝트 디렉토리)
   ├── npm install → ask (의존성 설치 확인)
   └── 환경변수 읽기 → allow (.env)

3. MODEL ROUTING [Phase 1: 멀티모델 라우팅]
   ├── ComplexityClassifier: 복잡도 HIGH (OAuth + JWT + 다중 파일)
   ├── CostOptimizer: 현재 세션 비용 $0.12 / 제한 $5.00 → 여유
   └── 결정: quality 프로필
       ├── Planning: Opus (복잡한 설계 필요)
       ├── Development: Opus (보안 관련 코드)
       └── QA: Sonnet (테스트 실행)

4. CONTEXT ENGINEERING [Phase 2: .planning/ 구조]
   ├── .planning/goal.md 생성:
   │   "JWT 인증 + Google OAuth 구현"
   ├── .planning/context.md 생성:
   │   프로젝트 구조, 기존 인증 코드, package.json 분석
   ├── .planning/constraints.md 생성:
   │   "50% 컨텍스트 규칙: 핵심 파일만 로드"
   └── .planning/verification.md 생성:
       Must be TRUE → Must EXIST → Must be WIRED 체크리스트

5. CEO ORCHESTRATOR → 태스크 분해
   └── TaskRouter 결과:
       ├── Task#1: [Planning] 인증 아키텍처 설계
       ├── Task#2: [Development] JWT 미들웨어 구현
       ├── Task#3: [Development] Google OAuth 통합
       ├── Task#4: [QA] 인증 흐름 테스트 작성
       └── Task#5: [Security] 보안 감사

6. PARALLEL EXECUTION [Phase 2: 병렬 에이전트]
   ├── 단계 1 (순차): Task#1 Planning
   │   └── PlanningAgent → XML 구조화 계획 [Phase 2: GSD 패턴]
   │       <plan>
   │         <step id="1" type="create">JWT 미들웨어</step>
   │         <step id="2" type="create">OAuth 핸들러</step>
   │         <step id="3" type="modify">라우터 연결</step>
   │       </plan>
   │
   ├── 단계 2 (병렬): Task#2 + Task#3 동시 실행!
   │   ├── [Worker A] DevelopmentAgent → JWT 미들웨어
   │   │   └── DeepWorker 사이클:
   │   │       ├── PreExploration: 기존 Express 구조 분석
   │   │       ├── SelfPlanning: 3단계 계획
   │   │       ├── Execute Step 1: auth/jwt.ts 생성
   │   │       ├── Execute Step 2: auth/middleware.ts 생성
   │   │       └── Execute Step 3: routes/index.ts 연결
   │   │
   │   └── [Worker B] DevelopmentAgent → Google OAuth
   │       └── DeepWorker 사이클:
   │           ├── PreExploration: OAuth 라이브러리 확인
   │           ├── SelfPlanning: 4단계 계획
   │           ├── MCP Tool 호출 [Phase 1]:
   │           │   └── npm-registry MCP → passport-google-oauth20 최신 버전 확인
   │           ├── Execute: auth/oauth-google.ts 생성
   │           └── Execute: auth/strategies.ts 통합
   │
   ├── 단계 3 (순차): Task#4 QA
   │   └── QAAgent → 테스트 생성 + 실행
   │       ├── 테스트: JWT 토큰 생성/검증
   │       ├── 테스트: OAuth 콜백 처리
   │       └── 결과: 8/8 통과
   │
   └── 단계 4 (순차): Task#5 Security [Phase 3: 전문 에이전트]
       └── SecurityAgent → 보안 감사
           ├── JWT 시크릿 키 관리 검증
           ├── CSRF 보호 확인
           └── 토큰 만료 정책 검증

7. HOOK LIFECYCLE (각 태스크마다)
   ├── TASK_BEFORE: 검증 훅 → 입력 유효성 확인
   ├── TASK_AFTER:
   │   ├── 학습 훅 → InstinctStore에 "JWT+OAuth 패턴" 저장
   │   │   confidence: 0.5 (초기)
   │   ├── 메트릭 훅 → HUD 대시보드 업데이트
   │   └── 관측성 훅 [Phase 4: OpenTelemetry]
   │       └── span: auth-implementation, duration: 45s
   └── TASK_ERROR: (실패 시) 에러 학습 + 재시도 전략

8. GOAL-BACKWARD VERIFICATION [Phase 2: GSD 패턴]
   └── GoalBackwardVerifier.verify()
       ├── Must be TRUE: JWT 토큰이 유효한 사용자만 인증하는가? ✓
       ├── Must EXIST: auth/jwt.ts, auth/oauth-google.ts 파일 존재? ✓
       ├── Must be WIRED: 라우터에 미들웨어 연결됨? ✓
       └── 결과: PASS (3/3 검증 통과)

9. INSTINCT EVOLUTION [Phase 3: 팀 학습 공유]
   └── InstinctTransfer.export("auth-patterns")
       → 팀 내 다른 세션에서도 OAuth 패턴 재활용 가능

10. 결과 출력
    ├── GoalResult: success=true, 5 tasks completed
    ├── 생성된 파일: 6개
    ├── 테스트: 8/8 통과
    ├── 보안 감사: PASS
    ├── 비용: $0.87 (Opus Planning + Opus Dev×2 + Sonnet QA)
    └── OpenTelemetry trace: auth-feature-implementation [Phase 4]
```

---

### E.3 시나리오 2: 레거시 코드 리팩토링

**입력**: `aca run "utils/ 디렉토리를 모듈별로 분리하고, 타입 안전성을 강화해줘"`

#### 단계별 흐름:

```
1. MODEL ROUTING
   ├── ComplexityClassifier: MEDIUM (리팩토링, 기존 코드 변환)
   └── 결정: balanced 프로필
       ├── Planning: Opus, Dev: Sonnet, QA: Sonnet

2. CONTEXT ENGINEERING (.planning/)
   ├── BrownfieldAnalyzer [기존] 실행:
   │   ├── utils/ 디렉토리 분석: 15개 파일, 2,300 LOC
   │   ├── 의존성 그래프 생성
   │   ├── healthScore: 45/100 (타입 부족, 높은 결합도)
   │   └── 권장 모듈 분리안 생성
   │
   └── .planning/context.md:
       "대상: 15파일, 의존 함수 42개, 외부 참조 28개"

3. LSP INTEGRATION [Phase 4: OMO 패턴]
   ├── LSP Client 연결 (tsserver)
   ├── 모든 심볼 참조 수집 (find-all-references)
   └── 안전한 리네임/이동 후보 목록 생성

4. ORCHESTRATION → 태스크 분해 (병렬 가능 분석)
   ├── Task#1: [Planning] 모듈 분리 계획
   ├── Task#2-4: [Development] 모듈별 분리 (병렬 3개)
   │   ├── Task#2: string-utils → src/utils/string/
   │   ├── Task#3: date-utils → src/utils/date/
   │   └── Task#4: validation-utils → src/utils/validation/
   ├── Task#5: [RefactoringAgent] 의존성 업데이트 [Phase 3: LSP 기반]
   └── Task#6: [QA] 기존 테스트 통과 확인

5. REFACTORING AGENT [Phase 3 + Phase 4]
   ├── LSP 기반 심볼 이동:
   │   └── formatDate() → date/formatDate.ts (모든 참조 자동 업데이트)
   ├── 타입 강화:
   │   └── any → 구체적 타입으로 변환 (LSP 추론 활용)
   └── import 경로 자동 수정

6. OS SANDBOX [Phase 4: Codex 패턴]
   └── 리팩토링은 STANDARD 레벨 샌드박스에서 실행
       ├── 파일 시스템: 프로젝트 디렉토리만 접근
       ├── 네트워크: 차단 (외부 호출 불필요)
       └── 프로세스: npm test 허용

7. GOAL-BACKWARD VERIFICATION
   ├── Must be TRUE: 모든 기존 테스트가 통과하는가? ✓
   ├── Must EXIST: 새 모듈 디렉토리가 생성되었는가? ✓
   ├── Must be WIRED: import 경로가 모두 업데이트되었는가? ✓
   └── 추가: 타입 에러 0개? → npx tsc --noEmit ✓

8. LEARNING
   └── InstinctStore: "utils-refactoring" 패턴 저장
       ├── 패턴: "단일 utils/ → 도메인별 하위 모듈"
       ├── confidence: 0.6
       └── 다음 유사 요청 시 자동 제안
```

---

### E.4 시나리오 3: 외부 서비스 연동 (MCP 활용)

**입력**: `aca run "GitHub 이슈 #42의 버그를 분석하고 수정해줘"`

#### 단계별 흐름:

```
1. MCP TOOL DISCOVERY [Phase 1]
   ├── MCPToolRegistry 자동 발견:
   │   ├── github-mcp-server → issue.read, pr.create, file.read
   │   ├── slack-mcp-server → message.send (알림용)
   │   └── ACA 네이티브 스킬 + MCP 도구 통합 SkillRegistry
   │
   └── MCP → Skill 브릿지:
       github.issue.read → SkillRegistry에 "github-issue-read" 스킬로 등록

2. PERMISSION CHECK [Phase 1]
   ├── GitHub API 읽기 → allow (issue 조회)
   ├── GitHub PR 생성 → ask (사용자 확인 필요)
   └── Slack 알림 → ask (사용자 확인 필요)

3. CONTEXT ENGINEERING
   ├── MCP 호출: github.issue.read(#42) → 이슈 내용 로드
   │   제목: "로그인 후 세션 만료 에러"
   │   본문: 재현 경로, 에러 로그, 스크린샷
   │
   └── .planning/context.md:
       이슈 #42 컨텍스트 + 관련 코드 파일 매핑

4. ORCHESTRATION
   ├── Task#1: [Planning] 버그 원인 분석
   ├── Task#2: [Development] 수정 코드 작성
   ├── Task#3: [QA] 재현 테스트 + 수정 검증
   └── Task#4: [Development] PR 생성

5. DEEP WORKER (버그 수정)
   ├── PreExploration:
   │   ├── 에러 로그 분석 → session.ts:145 의심
   │   └── 관련 파일 3개 식별
   ├── SelfPlanning:
   │   ├── Step 1: 세션 만료 로직 분석
   │   ├── Step 2: 토큰 갱신 코드 수정
   │   └── Step 3: 엣지 케이스 처리
   └── Execute:
       ├── Step 1: ✓ (세션 타이머 race condition 발견)
       ├── Step 2: ✓ (토큰 갱신 로직 수정)
       └── Step 3: ✓ (동시 요청 시 중복 갱신 방지)

6. MCP TOOL 활용 (PR 생성)
   └── github.pr.create({
       title: "fix: 세션 만료 시 토큰 갱신 race condition 수정",
       body: "Fixes #42\n\n...",
       base: "main",
       head: "fix/session-expiry-42"
   })

7. INSTINCT LEARNING
   └── 패턴 저장: "session-race-condition" → confidence 0.5
       "동시 요청 시 토큰 갱신은 mutex/lock 패턴 사용"

8. OPENTELEMETRY [Phase 4]
   └── Trace: bug-fix-42
       ├── span: issue-analysis (200ms)
       ├── span: code-exploration (1.2s)
       ├── span: code-fix (3.5s)
       ├── span: test-execution (2.1s)
       └── span: pr-creation (800ms)
```

---

### E.5 시나리오 4: 팀 학습 기반 프로젝트 온보딩

**입력**: `aca run "이 프로젝트를 분석하고, 코드 스타일과 아키텍처 패턴을 학습해줘"`

#### 단계별 흐름:

```
1. MODEL ROUTING
   └── balanced 프로필 (분석 작업은 비용 효율적으로)

2. BROWNFIELD ANALYZER [기존] + CONTEXT ENGINEERING [Phase 2]
   ├── 프로젝트 구조 분석:
   │   ├── 언어: TypeScript
   │   ├── 프레임워크: Express + React
   │   ├── 테스트: Jest (커버리지 62%)
   │   ├── 패턴: Repository 패턴, Service Layer
   │   └── healthScore: 72/100
   │
   └── .planning/ 생성:
       ├── goal.md: "프로젝트 학습 및 패턴 추출"
       ├── context.md: 프로젝트 메타데이터
       └── patterns.md: 발견된 패턴 목록

3. MULTI-AGENT PARALLEL ANALYSIS [Phase 2 + Phase 3]
   ├── [Parallel A] ArchitectureAgent:
   │   └── 아키텍처 패턴 분석 → "3-tier + Repository"
   ├── [Parallel B] CodeQualityAgent:
   │   └── 코드 스타일 분석 → ESLint 규칙, 네이밍 컨벤션
   ├── [Parallel C] SecurityAgent:
   │   └── 보안 패턴 분석 → 인증 방식, 입력 검증 스타일
   └── [Parallel D] DocumentationAgent:
       └── 기존 문서 분석 → README, JSDoc 패턴

4. INSTINCT EXTRACTION [Phase 3: ECC 패턴]
   └── 팀 인스틴트로 저장:
       ├── "naming-convention" → camelCase (서비스), PascalCase (컴포넌트)
       │   confidence: 0.9 (일관성 높음)
       ├── "error-handling" → try-catch + custom AppError 클래스
       │   confidence: 0.85
       ├── "test-pattern" → describe/it + factory 함수
       │   confidence: 0.8
       ├── "import-style" → absolute paths with @/ alias
       │   confidence: 0.95
       └── "api-pattern" → controller → service → repository
           confidence: 0.9

5. INSTINCT SHARING [Phase 3: 팀 공유]
   └── InstinctTransfer.export("project-onboarding-[hash]")
       → 다른 팀원의 ACA 세션에서도 동일 패턴 적용
       → 새 코드 생성 시 자동으로 프로젝트 컨벤션 준수

6. DOCS GENERATION [기존]
   └── DocsGenerator 실행:
       ├── HLD: 시스템 아키텍처 다이어그램
       ├── MLD: 모듈 간 의존성 맵
       └── LLD: 핵심 클래스 상세 설명

7. 결과: 프로젝트 학습 완료
   ├── 5개 핵심 인스틴트 저장
   ├── 이후 모든 코드 생성에 자동 적용
   └── 팀원 간 패턴 공유 가능
```

---

### E.6 시나리오 5: 비용 제약 하의 대규모 작업

**입력**: `aca run --profile budget "전체 프로젝트에 타입스크립트 strict 모드를 적용하고 모든 에러를 수정해줘"`

#### 단계별 흐름:

```
1. MODEL ROUTING (budget 프로필 강제)
   ├── Planning: Sonnet (비용 절감)
   ├── Development: Haiku (반복적 타입 수정)
   ├── QA: Haiku (타입 체크 실행)
   └── CostTracker: 예산 $2.00 설정

2. CONTEXT ENGINEERING
   ├── BrownfieldAnalyzer: 파일 목록 + 타입 에러 목록 수집
   ├── 50% 컨텍스트 규칙:
   │   └── 전체 200파일 중 에러 있는 45파일만 로드
   └── .planning/:
       ├── tsconfig.json 변경 계획
       └── 파일별 예상 수정 사항

3. PARALLEL EXECUTION (최대 활용)
   ├── 파일 그룹별 병렬 처리:
   │   ├── Worker A: src/services/ (12파일)
   │   ├── Worker B: src/controllers/ (8파일)
   │   ├── Worker C: src/utils/ (10파일)
   │   └── Worker D: src/models/ (15파일)
   │
   └── 각 Worker는 Haiku 모델 사용 (비용 효율)

4. COST TRACKING [Phase 1]
   ├── 실시간 모니터링:
   │   T=0s:   $0.00 / $2.00
   │   T=30s:  $0.45 / $2.00 (Worker A-D 동시 실행)
   │   T=60s:  $0.89 / $2.00
   │   T=90s:  $1.23 / $2.00
   │   T=100s: $1.45 / $2.00 ⚠️ 75% 경고
   │
   └── 자동 조정:
       ├── 남은 파일 → 더 간단한 수정만 자동 적용
       └── 복잡한 수정 → 사용자에게 보고 + 수동 처리 제안

5. CONTEXT QUALITY CURVE [기존]
   ├── 토큰 사용률 85% 도달 시:
   │   ├── QualityCurve → REDUCED 모드
   │   ├── OutputOptimizer → 출력 압축
   │   └── CompactionStrategy → 이전 컨텍스트 정리
   └── 대규모 작업이므로 세션 분할 제안 가능

6. LSP INTEGRATION [Phase 4]
   └── tsserver를 통한 정확한 타입 에러 수정:
       ├── 타입 추론 활용 (any → 구체적 타입)
       ├── import 타입 자동 추가
       └── 제네릭 파라미터 올바른 적용

7. VERIFICATION
   ├── npx tsc --noEmit --strict → 0 errors ✓
   ├── 기존 테스트 실행 → 모두 통과 ✓
   └── 총 비용: $1.78 / $2.00 (예산 내)

8. OPENTELEMETRY REPORT [Phase 4]
   └── 요약:
       ├── 총 45파일 수정, 312개 타입 에러 해결
       ├── 병렬 실행으로 4x 속도 향상
       ├── 모델 비용: Haiku $1.23 + Sonnet $0.55
       └── 평균 파일당 처리 시간: 2.1초
```

---

### E.7 시나리오 6: 플러그인을 통한 커스텀 워크플로우

**입력**: `aca run "release-workflow 플러그인을 사용해서 v2.0.0 릴리즈 준비해줘"`

#### 단계별 흐름:

```
1. PLUGIN SYSTEM [Phase 3: Claude Code 패턴]
   ├── PluginRegistry 조회:
   │   └── "release-workflow" 플러그인 발견
   │       ├── hooks: ["TASK_BEFORE:release-check", "TASK_AFTER:changelog"]
   │       ├── skills: ["version-bump", "changelog-gen", "tag-create"]
   │       └── agents: ["ReleaseAgent"]
   │
   └── 플러그인 활성화:
       ├── 커스텀 훅 등록 (27 기존 + 플러그인 훅)
       ├── 커스텀 스킬 등록 (4 기존 + 3 플러그인 스킬)
       └── ReleaseAgent를 CEOOrchestrator에 등록

2. RELEASE AGENT 실행
   ├── SkillPipeline 구성:
   │   Step 1: "version-bump" 스킬 → package.json 업데이트
   │   Step 2: "changelog-gen" 스킬 → CHANGELOG.md 자동 생성
   │   Step 3: "tag-create" 스킬 → git tag v2.0.0
   │
   └── MCP TOOL 활용 [Phase 1]:
       ├── github.release.create → GitHub Release 생성
       ├── github.pr.create → Release PR 생성
       └── slack.message.send → #releases 채널 알림

3. HOOK LIFECYCLE
   ├── TASK_BEFORE:release-check (플러그인 커스텀 훅):
   │   ├── 모든 테스트 통과 확인 ✓
   │   ├── 린트 에러 0개 확인 ✓
   │   └── main 브랜치 최신 상태 확인 ✓
   │
   └── TASK_AFTER:changelog (플러그인 커스텀 훅):
       └── CHANGELOG.md 생성 검증 ✓

4. 결과
   ├── package.json: 2.0.0
   ├── CHANGELOG.md: 자동 생성
   ├── git tag: v2.0.0
   ├── GitHub Release: 생성 완료
   └── Slack 알림: #releases 전송 완료
```

---

### E.8 기능 간 시너지 매트릭스

각 Enhancement 기능이 다른 기능과 어떻게 시너지를 일으키는지:

| 기능 A ↓ / 기능 B → | MCP | 모델라우팅 | 병렬실행 | 컨텍스트Eng | Goal검증 | 학습공유 | 플러그인 | LSP | 샌드박스 | OTel |
|---------------------|:---:|:---------:|:-------:|:----------:|:-------:|:-------:|:-------:|:---:|:-------:|:----:|
| **MCP** | - | 도구별 모델 | MCP 병렬호출 | MCP 컨텍스트 | 외부검증 | MCP 패턴학습 | MCP 플러그인 | - | MCP 격리 | MCP 추적 |
| **모델라우팅** | | - | 워커별 모델 | 예산 기반 | 검증 모델 | 비용 패턴 | 프로필 설정 | - | - | 비용 메트릭 |
| **병렬실행** | | | - | 워커별 컨텍스트 | 병렬 검증 | 병렬 학습 | 병렬 플러그인 | 병렬 LSP | 워커별 샌드박스 | 병렬 span |
| **컨텍스트Eng** | | | | - | 검증 맥락 | 컨텍스트 패턴 | .planning/ | LSP 컨텍스트 | - | 컨텍스트 메트릭 |
| **Goal검증** | | | | | - | 검증 패턴 | 검증 훅 | LSP 검증 | - | 검증 추적 |
| **학습공유** | | | | | | - | 플러그인 인스틴트 | LSP 패턴 | - | 학습 메트릭 |
| **플러그인** | | | | | | | - | LSP 플러그인 | 플러그인 격리 | 플러그인 추적 |
| **LSP** | | | | | | | | - | LSP 격리 | LSP 메트릭 |
| **샌드박스** | | | | | | | | | - | 보안 이벤트 |
| **OTel** | | | | | | | | | | - |

### E.9 결론: Enhancement 후 ACA의 차별화 포인트

Enhancement 전략의 5개 Phase가 모두 적용되면, ACA는 다음과 같은 **유일무이한 조합**을 제공한다:

1. **학습하는 에이전트**: 3계층 학습 (Reflexion + Instinct + Solutions) + 팀 공유 → 사용할수록 프로젝트에 최적화
2. **비용 인식 실행**: 모델 라우팅 + CostTracker + QualityCurve → 예산 내에서 최적의 품질
3. **안전한 자율성**: 퍼미션 시스템 + OS 샌드박스 + Goal-Backward 검증 → 사용자 신뢰 기반 자동화
4. **무한 확장**: MCP + 플러그인 + 10+ 에이전트 → 어떤 도구/서비스와도 통합 가능
5. **과학적 컨텍스트**: .planning/ + 50% 규칙 + QualityCurve → 대규모 프로젝트에서도 품질 유지
6. **완전한 관측성**: OpenTelemetry + HUD + 비용 추적 → 에이전트 행동의 투명한 모니터링

이는 현존하는 어떤 AI 코딩 에이전트도 제공하지 않는 조합이며, ACA만의 경쟁 우위이다.
