# AI 코딩 에이전트 도구 비교 분석

> **작성일**: 2026-02-08
> **버전**: 2.2 (통합 검증 반영; 이전: 2.1, 2.0, 1.0)
> **목적**: 현존하는 AI 코딩 에이전트 도구들의 특징, 강점, 단점을 비교 분석하여 autonomous-coding-agents 프로젝트의 차별화 전략 수립
> **분석 방법**: 9개 프로젝트 소스 코드 직접 분석 (2차 심층) + ACA 파이프라인 통합 검증
>
> **⚠️ v2.2 주요 변경**: ACA의 P0/P1 모듈(validation/, learning/, context/)은 구현되었으나 실행 파이프라인에 연결되지 않은 상태(Dead Code). 기능 비교표에서 `🟡`은 "모듈 구현됨, 파이프라인 미연결"을 의미함.

---

## 목차

1. [개요](#1-개요)
2. [비교 대상 도구 목록](#2-비교-대상-도구-목록)
3. [기능 비교표](#3-기능-비교표)
4. [각 도구 상세 분석](#4-각-도구-상세-분석)
5. [아키텍처 비교](#5-아키텍처-비교)
6. [v2.0 심층 패턴 비교](#6-v20-심층-패턴-비교)
7. [autonomous-coding-agents 포지셔닝](#7-autonomous-coding-agents-포지셔닝)
8. [결론](#8-결론)

---

## 1. 개요

AI 코딩 에이전트 시장은 빠르게 성장하고 있으며, 주요 AI 기업들(Anthropic, OpenAI, Google)과 오픈소스 커뮤니티에서 다양한 도구를 출시하고 있다. 본 문서는 이러한 도구들을 체계적으로 분석하여 autonomous-coding-agents 프로젝트의 전략적 방향을 수립하는 데 활용한다.

### 분석 기준

- **자율성 수준**: 인간 개입 필요 정도
- **확장성**: 멀티 프로젝트, 멀티 에이전트 지원
- **통합성**: 기존 개발 워크플로우 통합
- **학습 능력**: 지속적 개선 메커니즘
- **비용 효율성**: LLM API 비용 대비 생산성
- **v2.0 추가**: 품질 보증, 세션 안정성, 보안 모델

---

## 2. 비교 대상 도구 목록

### 2.1 공식 도구 (벤더 제공)

| 도구 | 제공사 | 핵심 특징 | 상태 |
|------|--------|----------|------|
| Claude Code | Anthropic | 7-Phase Workflow, Ralph Loop | 정식 |
| Codex CLI | OpenAI | Rust 샌드박스, JSONL 세션 | 정식 |
| Gemini CLI | Google | Behavioral Evals, 1M Context | 정식 |

### 2.2 오픈소스/커뮤니티 도구

| 도구 | 개발자 | 핵심 특징 | 상태 |
|------|--------|----------|------|
| OpenCode | SST/Anomaly | 모델 Agnostic, 5 Frontend, ACP | 활발 (2.37M DL) |
| SuperClaude | 커뮤니티 | PM Agent, ConfidenceChecker | 활발 |
| Oh My OpenCode | code-yeongyu | Sisyphus, Hephaestus Deep Worker | 활발 |
| Oh My ClaudeCode | 커뮤니티 | Tiered Routing, HUD, 32 Skills | 활발 |
| Everything Claude Code | affaan-m | Instinct, Iterative Retrieval | 활발 |
| Get Shit Done | 커뮤니티 | Thin Orchestrator, Context Engineering | 활발 |

### 2.3 개발 중 (본 프로젝트)

| 도구 | 목표 | 핵심 특징 | 상태 |
|------|------|----------|------|
| **ACA** | 24/7 자율 개발 시스템 | Agent OS, CEO Orchestrator, 11 Agents | 개발 중 |

---

## 3. 기능 비교표

### 3.1 기본 기능 비교

| 기능 | Claude Code | Codex | Gemini CLI | OpenCode | SuperClaude | Oh My OC | Oh My CC | ECC | GSD | **ACA** |
|------|:-----------:|:-----:|:----------:|:--------:|:-----------:|:--------:|:--------:|:---:|:---:|:-------:|
| CLI 인터페이스 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 멀티 모델 | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | **✅ (7)** |
| MCP 지원 | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| A2A/ACP | ❌ | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** |
| 백그라운드 실행 | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ⚠️ | ⚠️ | ❌ | **✅** |
| 24/7 자율 운영 | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ | ❌ | ❌ | **✅** |
| PR 자동화 | ⚠️ | ⚠️ | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | **✅** |

> ✅ 완전 지원 | 🟡 모듈 구현됨, 파이프라인 미연결 | ⚠️ 부분 지원 | ❌ 미지원
> Oh My OC = Oh My OpenCode, Oh My CC = Oh My ClaudeCode, ECC = Everything Claude Code, GSD = Get Shit Done

### 3.2 고급 기능 비교

| 기능 | Claude Code | Codex | Gemini CLI | OpenCode | SuperClaude | Oh My OC | Oh My CC | ECC | GSD | **ACA** |
|------|:-----------:|:-----:|:----------:|:--------:|:-----------:|:--------:|:--------:|:---:|:---:|:-------:|
| 멀티 에이전트 | ⚠️ | ❌ | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ | **✅ (11)** |
| LSP 통합 | ❌ | ❌ | ❌ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ❌ | 🔄 |
| 세션 지속성 | ⚠️ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | **✅** |
| 지식 학습 | ❌ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ | ✅ | ❌ | **✅** |
| 워크플로우 엔진 | ❌ | ❌ | ⚠️ | ⚠️ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ | **✅** |
| Behavioral Evals | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **🔄 계획** |
| Confidence Check | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | **🟡** |
| Error Learning | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | **🟡** |
| Tiered Routing | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ | ❌ | ❌ | **🔄 계획** |

### 3.3 v2.0 신규: 품질/보안/안정성 비교

| 기능 | Claude Code | Codex | Gemini CLI | OpenCode | Oh My OC | Oh My CC | GSD | **ACA** |
|------|:-----------:|:-----:|:----------:|:--------:|:--------:|:--------:|:---:|:-------:|
| 사전 검증 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **🟡** |
| 사후 검증 | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | **🟡** |
| 샌드박스 | ⚠️ | **✅** | ⚠️ | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| 권한 에스컬레이션 | ✅ | ✅ | ⚠️ | ✅ | ❌ | ❌ | ❌ | **🔄 계획** |
| crash-safe 세션 | ⚠️ | **✅** | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | **🔄 계획** |
| Todo 강제 완료 | ❌ | ❌ | ❌ | ❌ | **✅** | ❌ | ❌ | 🔄 |
| Context 품질 곡선 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | **✅** | **🟡** |

### 3.4 비용 및 라이선스

| 도구 | 라이선스 | 무료 티어 | API 비용 |
|------|----------|-----------|----------|
| Claude Code | 상용 | 제한적 | Claude API |
| Codex | Apache-2.0 | ChatGPT 플랜 | OpenAI API |
| Gemini CLI | Apache-2.0 | **1000 req/day** | Gemini API |
| OpenCode | MIT | ✅ | 선택적 |
| SuperClaude | MIT | ✅ | Claude API |
| Oh My OpenCode | SUL-1.0 | ✅ | 선택적 |
| Oh My ClaudeCode | MIT | ✅ | Claude API |
| Everything CC | MIT | ✅ | Claude API |
| Get Shit Done | MIT | ✅ | Claude API |
| **ACA** | AGPL-3.0 | ✅ | **멀티 API (7)** |

---

## 4. 각 도구 상세 분석

### 4.1 Claude Code (Anthropic)

**코드 레벨 분석 결과 (v2.0)**:
- **7-Phase Workflow**: Understand → Plan → Approve → Implement → Test → Review → Commit
- **Ralph Loop**: 실패 시 자율 재시도 (Plan → Execute → Evaluate → Adjust)
- **Agent Teams**: Lead + Worker + Review 멀티 에이전트
- **Progressive Disclosure**: 권한 Level 0-5 점진적 확대
- **Headless Mode**: SDK 기반 프로그래밍 방식 사용 (CI/CD 통합)

**적합**: 개인 개발자, 간단한 리팩토링, 코드 설명

---

### 4.2 Codex CLI (OpenAI)

**코드 레벨 분석 결과 (v2.0)**:
- **JSONL Session**: append-only, crash-safe 세션 저장
- **Progressive Sandbox**: suggest → auto-edit → full-auto 3단계
- **Protocol-First**: 마이크로커널 + JSON-RPC 2.0
- **MCP Bidirectional**: MCP 서버이자 클라이언트
- **Approval Pattern**: 의도 → 승인 → 실행

**적합**: 보안 민감 환경, ChatGPT 구독자, IDE 통합

---

### 4.3 Gemini CLI (Google)

**코드 레벨 분석 결과 (v2.0)**:
- **Behavioral Evals**: ALWAYS_PASSES / USUALLY_PASSES 심각도
- **31 Semantic Error Types**: 에러 유형별 복구 전략
- **Scheduler State Machine**: IDLE → PLANNING → EXECUTING → COMPLETED
- **Non-Interactive Mode**: -n 플래그 CI/CD 자동화
- **1M Token Context**: 대규모 컨텍스트 처리

**적합**: 비용 민감, 대규모 컨텍스트, GitHub 자동화

---

### 4.4 OpenCode (SST/Anomaly)

**코드 레벨 분석 결과 (v2.0)**:
- **ACP Protocol**: Agent Communication Protocol
- **5 Frontends**: TUI + Web + Desktop + Mobile + API
- **Spec-Driven Dev**: TypeSpec/Stainless 기반 API
- **LSP Integration**: 9개 시맨틱 작업
- **2.37M Downloads**: 시장 검증

**적합**: 모델 독립적, 터미널 중심, 커스텀 설정

---

### 4.5 Oh My ClaudeCode

**코드 레벨 분석 결과 (v2.0)**:
- **Tiered Model Routing**: 3-tier 자동 모델 선택 (30-50% 절감)
- **32 Composable Skills**: 조합 가능한 스킬 파이프라인
- **HUD Dashboard**: 실시간 에이전트 모니터링
- **SWE-bench Benchmarking**: 객관적 품질 측정
- **Comment Checker**: AI 주석 품질 제어

**적합**: Claude Code 파워 유저, 비용 최적화, 대규모 자동화

---

### 4.6 Oh My OpenCode

**코드 레벨 분석 결과 (v2.0)**:
- **Hephaestus Deep Worker**: 진정한 자율 실행 (not simulated)
- **Todo Continuation Enforcer**: 미완료 방지 (~1.8K LOC)
- **Prometheus/Atlas 분리**: 계획 ≠ 실행
- **Boulder State**: 세션 간 작업 연속성
- **Background Agent**: 비차단 병렬 실행

**적합**: 고강도 자동화, 멀티 모델, 장시간 비동기 작업

---

### 4.7 Everything Claude Code

**코드 레벨 분석 결과 (v2.0)**:
- **Instinct System**: 0.3-0.9 신뢰도 기반 학습
- **Instinct Import/Export**: 프로젝트 간 학습 전파
- **Iterative Retrieval**: DISPATCH → EVALUATE → REFINE → LOOP
- **PM2 Orchestration**: 프로세스 관리
- **Context Modes**: dev/review/research 동적 전환

**적합**: Claude Code 설정 최적화, TDD, 지속적 학습

---

### 4.8 Get Shit Done

**코드 레벨 분석 결과 (v2.0)**:
- **Thin Orchestrator**: 최소 조정자 (라우팅/상태만)
- **Context Engineering**: 4단계 품질 곡선 (PEAK/GOOD/DEGRADING/POOR)
- **Goal-Backward Verification**: exists → substantive → wired 3단계
- **XML Task Structure**: 실행 가능한 태스크 명세
- **Checkpoint Protocol**: pre-action / milestone / emergency
- **Brownfield Analysis**: 기존 코드 존중 패턴
- **Deviation Handling**: locked / deferred / discretion

**적합**: 체계적 개발 프로세스, 컨텍스트 관리, 대규모 프로젝트

---

### 4.9 SuperClaude Framework

**코드 레벨 분석 결과 (v2.0)**:
- **ConfidenceChecker**: 25-250x ROI 사전 검증
- **SelfCheckProtocol**: 4대 질문 + 7대 위험신호
- **ReflexionPattern**: 에러 학습 및 예방
- **Wave Parallel**: Wave → Checkpoint → Wave

**적합**: Claude Code 파워 유저, 리서치, 품질 중심 개발

---

## 5. 아키텍처 비교

### 5.1 실행 모델 스펙트럼

```
Interactive ◄──────────────────────────────────────────────────► Autonomous

Claude Code  Codex  Gemini  OpenCode  SuperClaude  Oh My OC  GSD  ACA
     │         │       │       │          │           │        │    │
     ▼         ▼       ▼       ▼          ▼           ▼        ▼    ▼
[인간 상호작용 필수] ◄────────── 부분 자동화 ──────────► [24/7 자율]
```

### 5.2 에이전트 구조 비교 (v2.0 업데이트)

| 도구 | 에이전트 수 | 에이전트 유형 | 조율 방식 | 자율성 패턴 |
|------|:-----------:|--------------|----------|------------|
| Claude Code | 1 | 단일 범용 | - | Ralph Loop |
| Codex | 1 | 단일 범용 | - | Approval Pattern |
| Gemini CLI | 1 | 단일 범용 | - | State Machine |
| OpenCode | 4 | build/plan/general/explore | Tab 전환 | - |
| SuperClaude | 16 | 전문화 | 명령어 기반 | Wave Parallel |
| Oh My OC | 11 | 전문화 (Sisyphus 조율) | 자동 위임 | Hephaestus |
| Oh My CC | 32 | 전문화 + 조합 가능 | Tiered Routing | - |
| ECC | 13 | 전문화 | 스킬 기반 | Instinct |
| GSD | 11 | 전문화 | Thin Orchestrator | Context Engineering |
| **ACA** | **11+** | **역할 기반 (CEO 조율)** | **ACP MessageBus** | **Agent OS** |

### 5.3 데이터 지속성 비교 (v2.0 업데이트)

| 도구 | 세션 저장 | 학습 DB | Instinct | 지식 그래프 | crash-safe |
|------|:---------:|:-------:|:--------:|:----------:|:----------:|
| Claude Code | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| Codex | **✅ JSONL** | ❌ | ❌ | ❌ | **✅** |
| Gemini CLI | ✅ | ❌ | ❌ | ❌ | ✅ |
| OpenCode | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| SuperClaude | ✅ | ⚠️ | ❌ | ❌ | ⚠️ |
| Oh My OC | ✅ (Boulder) | ⚠️ | ❌ | ❌ | ⚠️ |
| Oh My CC | ⚠️ | ❌ | ❌ | ❌ | ⚠️ |
| ECC | ⚠️ | ❌ | **✅** | ❌ | ⚠️ |
| **ACA** | **✅** | **🟡** | **🟡** | **🔄 계획** | **🔄 계획** |

---

## 6. v2.0 심층 패턴 비교

### 6.1 품질 보증 패턴

| 패턴 | 적용 프로젝트 | ACA 현황 |
|------|-------------|---------|
| Behavioral Evals | gemini-cli | 🔄 New P0 계획 |
| ConfidenceChecker | SuperClaude | 🟡 모듈 구현 완료, 파이프라인 미연결 |
| SelfCheckProtocol | SuperClaude | 🟡 모듈 구현 완료, 파이프라인 미연결 |
| Goal-Backward Verification | get-shit-done | 🟡 모듈 구현 완료, 파이프라인 미연결 |
| SWE-bench Benchmarking | oh-my-claudecode | 🔄 New P3 계획 |

### 6.2 비용 최적화 패턴

| 패턴 | 적용 프로젝트 | 효과 | ACA 현황 |
|------|-------------|------|---------|
| Tiered Model Routing | oh-my-claudecode | 30-50% 절감 | 🔄 New P0 계획 |
| Ecomode | oh-my-claudecode | 30-50% 토큰 절감 | 🔶 고도화 필요 |
| Context 품질 곡선 | get-shit-done | 컨텍스트 효율화 | 🟡 모듈 구현 완료, hooks에서 미참조 (dx/ 경로 사용 중) |

### 6.3 자율성 패턴

| 패턴 | 적용 프로젝트 | 자율 수준 | ACA 현황 |
|------|-------------|----------|---------|
| Hephaestus Deep Worker | oh-my-opencode | 진정한 자율 | 🔄 New P2 계획 |
| Ralph Loop | claude-code | 자율 재시도 | 🔄 New P2 계획 |
| Todo Continuation | oh-my-opencode | 미완료 방지 | 🔄 New P2 계획 |
| Thin Orchestrator | get-shit-done | 위임 중심 | 🔄 New P1 계획 |

### 6.4 세션/안정성 패턴

| 패턴 | 적용 프로젝트 | 효과 | ACA 현황 |
|------|-------------|------|---------|
| JSONL Persistence | codex | crash-safe | 🔄 New P1 계획 |
| Boulder State | oh-my-opencode | 세션 연속성 | 🔶 고도화 필요 |
| Checkpoint Protocol | get-shit-done | 3종 체크포인트 | 🔄 New P3 계획 |

---

## 7. autonomous-coding-agents 포지셔닝

### 7.1 차별화 요소 (v2.0 업데이트)

```
┌─────────────────────────────────────────────────────────────────┐
│              autonomous-coding-agents 차별화 매트릭스            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   기존 도구                    │    autonomous-coding-agents    │
│                                │                                 │
│   Human-in-the-loop           →    Human-out-of-the-loop        │
│                                │    (24/7 자동화)                │
│                                │                                 │
│   단일 에이전트               →    11+ 에이전트 팀 (Agent OS)    │
│                                │    (CEO + 전문화 에이전트)      │
│                                │                                 │
│   작업 단위 실행              →    프로젝트 단위 자율 실행       │
│                                │                                 │
│   품질 검증 없음              →    3중 검증 시스템 (🟡 미연결)    │
│   (대부분의 도구)              │    (Confidence+SelfCheck+Goal)  │
│                                │    ※ 모듈 구현 완료, 통합 필요   │
│                                │                                 │
│   에러 반복                   →    에러 학습 시스템 (🟡 미연결)    │
│                                │    (Reflexion+Instinct+Cache)   │
│                                │    ※ 모듈 구현 완료, 통합 필요   │
│                                │                                 │
│   단일 Provider               →    7 Provider 지원              │
│                                │    (API 3 + CLI 4)              │
│                                │                                 │
│   자체 프로토콜               →    표준 프로토콜                  │
│                                │    (A2A + ACP MessageBus + GraphQL) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 ACA 고유 강점 (경쟁 도구 대비)

| ACA 고유 기능 | 가장 가까운 경쟁자 | ACA 차별점 | 통합 상태 |
|-------------|-------------------|-----------|:--------:|
| Agent OS (커널 기반) | oh-my-opencode (Sisyphus) | 커널 레벨 리소스 관리 | ✅ 작동 |
| 3중 검증 시스템 | SuperClaude (개별 패턴) | 통합된 검증 파이프라인 | 🟡 미연결 |
| A2A Protocol 구현 | gemini-cli (부분 지원) | 완전한 양방향 A2A | 🟡 미연결 |
| ACP MessageBus | 없음 (대부분 직접 호출) | 비동기 멀티 에이전트 통신 | ✅ 작동 |
| Enterprise 모듈 | 없음 | SSO, Multi-Repo, Team | 🔄 계획 |
| 7 LLM Provider | opencode (멀티 모델) | API + CLI Provider 모두 지원 | ✅ 작동 |

### 7.3 ACA 약점 (보완 필요)

| 약점 | 참고 프로젝트 | 보완 계획 |
|-----|-------------|----------|
| **🔴 P0/P1 모듈 파이프라인 미연결** | **전체 (Dead Code)** | **🔴 Integration Sprint** |
| 품질 객관적 측정 부재 | gemini-cli Behavioral Evals | New P0 |
| 비용 최적화 미흡 | oh-my-claudecode Tiered Routing | New P0 |
| 세션 crash-safety | codex JSONL | New P1 |
| 오케스트레이터 과부하 | get-shit-done Thin Orchestrator | New P1 |
| 진정한 자율성 미달 | oh-my-opencode Hephaestus | New P2 |
| 실시간 모니터링 부재 | oh-my-claudecode HUD | New P3 |
| ILLMClient 이중 인터페이스 | 없음 (ACA 고유 문제) | Integration Sprint I-10 |

> **⚠️ 핵심 약점**: validation/, learning/, context/, a2a/, session/, di/ 모듈이 구현되었으나 실행 파이프라인에서 호출되지 않음. 현재 작동하는 파이프라인은 `OrchestratorRunner → CEOOrchestrator → TeamAgents → TeamAgentLLMAdapter → ILLMClient` 경로만 존재. Integration Sprint(I-1~I-11)로 해결 예정.

### 7.4 시장 기회 맵 (v2.0)

```
┌─────────────────────────────────────────────────────────────────┐
│                         시장 기회 맵                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   높은 자율성    │  ████████████████████████████████████        │
│   + 품질 검증   │  ← ACA 목표 영역                              │
│                  │  (자율 + 3중 검증 + 학습 = 유일)              │
│                  │  ※ 현재: 모듈 구현됨, 통합 진행 중             │
│                  │                                               │
│   높은 자율성    │  ████████  Oh My OC (Hephaestus)              │
│   - 품질 검증   │                                               │
│                  │                                               │
│   중간 자율성    │  ████  SuperClaude, GSD, Oh My CC             │
│                  │                                               │
│   낮은 자율성    │  ██  Claude Code, Codex, Gemini               │
│                  │                                               │
│                  └──────────────────────────────────────────────│
│                      단일 에이전트  →  멀티 에이전트  →  Agent OS │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 결론

### 8.1 시장 현황 요약 (v2.0)

- **공식 도구들** (Claude Code, Codex, Gemini): 안정적이나 자율성 제한. 각각 고유한 강점 보유 (Codex=보안, Gemini=Evals, Claude=워크플로우)
- **확장 프레임워크** (SuperClaude, Oh My CC, ECC, GSD): 강력한 워크플로우, 부분 자동화. 각각 특화 영역 존재
- **자율 에이전트** (Oh My OC): Hephaestus로 진정한 자율 도전 중
- **플랫폼** (OpenCode): Provider-Agnostic + 멀티 Frontend로 시장 검증 (2.37M DL)

### 8.2 ACA 전략적 포지셔닝

**"자율성 + 품질 검증 + 학습" 삼위일체 = 목표 포지션**

1. **자율성**: Agent OS + CEO Orchestrator + 11 전문 에이전트 → 24/7 운영 ✅ 작동
2. **품질 검증**: 3중 검증 (Confidence + SelfCheck + GoalBackward) → 신뢰성 🟡 모듈 완료, 통합 필요
3. **학습**: 3계층 학습 (Reflexion + Instinct + SolutionsCache) → 지속 개선 🟡 모듈 완료, 통합 필요

> **현황**: 자율성 파이프라인(1)은 작동 중이나, 품질 검증(2)과 학습(3)은 모듈만 구현된 상태. Integration Sprint 완료 시 삼위일체 달성.

### 8.3 Next Phase 전략

| 최우선 | 단기 | 중기 | 장기 |
|--------|------|------|------|
| **🔴 Integration Sprint** | Behavioral Evals + Tiered Routing | Thin Orchestrator + Deep Worker | HUD + SWE-bench |
| (P0/P1 모듈 파이프라인 연결) | (품질 측정 + 비용 절감) | (복잡성 감소 + 진정한 자율) | (모니터링 + 벤치마크) |

---

## 부록: 참고 자료

### 프로젝트 링크

- [Claude Code](https://github.com/anthropics/claude-code)
- [Codex](https://github.com/openai/codex)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [OpenCode](https://github.com/sst/opencode)
- [SuperClaude Framework](https://github.com/nicekid1/SuperClaude_Framework)
- [Oh My OpenCode](https://github.com/code-yeongyu/oh-my-opencode)
- [Oh My ClaudeCode](https://github.com/nicekid1/oh-my-claudecode)
- [Everything Claude Code](https://github.com/nicekid1/everything-claude-code)
- [Get Shit Done](https://github.com/nicekid1/get-shit-done)

### 관련 문서

- [UNIFIED_VISION.md](./UNIFIED_VISION.md) - 통합 비전 문서 (마스터)
- [IMPROVEMENT_RECOMMENDATIONS.md](../04-planning/IMPROVEMENT_RECOMMENDATIONS.md) - 개선 권고 v3.2
- [IMPLEMENTATION_PRIORITY_LIST.md](../04-planning/IMPLEMENTATION_PRIORITY_LIST.md) - 구현 우선순위 v2.2
- [SYSTEM_DESIGN.md](../02-architecture/SYSTEM_DESIGN.md) - 시스템 설계 문서

---

```yaml
문서_메타데이터:
  버전: 2.2
  작성일: 2026-02-08
  이전_버전: 2.1 (2026-02-08), 2.0 (2026-02-08), 1.0 (2026-01-24)
  변경_사항:
    v2.2:
      - "ACA 파이프라인 통합 검증 결과 반영"
      - "P0/P1 모듈 Dead Code 발견 → 기능 비교표 🟡 표기"
      - "§3.2/3.3: Confidence Check, Error Learning, 사전/사후 검증 ✅→🟡"
      - "§5.3: 학습 DB, Instinct 지속성 ✅→🟡"
      - "§6.1/6.2: QA/비용 패턴 ACA 현황 통합 상태 반영"
      - "§7.2: 고유 강점 테이블에 '통합 상태' 컬럼 추가"
      - "§7.3: P0/P1 파이프라인 미연결을 최우선 약점으로 추가"
      - "§8.3: Integration Sprint를 최우선 과제로 추가"
    v2.1:
      - "팩트 체크: LOC, 파일 수 등 정량 데이터 검증 및 수정"
    v2.0:
      - "9개 프로젝트 소스 코드 2차 심층 분석 반영"
      - "v2.0 심층 패턴 비교 섹션 추가 (§6)"
      - "기능 비교표에 Oh My ClaudeCode, Everything CC, Get Shit Done 추가"
      - "품질/보안/안정성 비교표 신규 추가 (§3.3)"
      - "ACA 고유 강점 및 약점 분석 업데이트 (§7)"
      - "시장 기회 맵 업데이트 (자율성+품질 검증 포지션)"
```
