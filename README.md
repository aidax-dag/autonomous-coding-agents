# Multi-Agent Autonomous Coding System

> AI 에이전트가 자율적으로 코드를 작성하고, 리뷰하고, 배포하는 24/7 자동화 시스템

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## 🎯 핵심 가치

- **🌙 24/7 자율 개발** - 에이전트가 밤낮없이 작업하여 개발 속도 3-5배 향상
- **✨ 일관된 품질** - 자동화된 코드 리뷰로 버그 및 보안 이슈 사전 차단
- **🚀 빠른 출시** - 아이디어에서 프로덕션까지 자동화된 워크플로우
- **💰 비용 효율** - LLM API 비용으로 개발자 시간 80% 이상 절약

---

## 🤖 주요 기능

### 3개의 전문화된 AI 에이전트

**1. Coding Agent (코딩 에이전트)**

- 요구사항 분석 및 구현 계획 수립
- 코드 작성 및 테스트 생성
- PR 생성 및 피드백 반영

**2. Reviewer Agent (코드 리뷰 에이전트)**

- PR 자동 감지 및 분석
- 버그, 보안, 성능 이슈 탐지
- 개선 제안 및 자동 승인/거부

**3. Repository Manager Agent (레포 관리 에이전트)**

- 에이전트 간 작업 조율
- PR 자동 머지
- 워크플로우 관리

### 고급 기능

- **CI/CD 통합** - 자동 테스트 검증 및 커버리지 체크
- **GitHub Webhook** - 실시간 이벤트 처리
- **Interactive Mode** - 실시간 모니터링 및 피드백
- **Auto-Fix** - 코드 이슈 자동 감지 및 수정

---

## 🚀 빠른 시작

### 필수 요구사항

- Node.js 20+
- PostgreSQL 15+
- NATS Server 2.x
- GitHub Token
- LLM API 키 (Claude/OpenAI/Gemini)

### 설치

```bash
# 1. 클론
git clone https://github.com/aidax-dag/autonomous-coding-agents.git
cd autonomous-coding-agents

# 2. 의존성 설치
npm install

# 3. 환경 설정
cp .env.example .env
# .env 파일에 API 키 입력

# 4. 데이터베이스 설정
npx prisma migrate deploy

# 5. 빌드
npm run build
```

### 실행

```bash
# PM2로 모든 에이전트 시작
npm run start:agents

# CLI 사용
npm run build && npm link

# 프로젝트 시작
multi-agent start-project \
  --repo https://github.com/username/my-app \
  --requirements "사용자 인증 시스템 구현"

# Interactive 모드
multi-agent interactive <task-id>

# 코드 분석 및 자동 수정
multi-agent analyze ./src
multi-agent auto-fix --repo . --owner user --name repo
```

---

## 📚 문서

> **📖 [전체 문서 보기](./docs/README.md)** - 모든 문서의 인덱스

### 빠른 링크

| 분류 | 문서 | 설명 |
|------|------|------|
| 🎯 비전 | [프로젝트 비전](./docs/01-vision/UNIFIED_VISION.md) | 목표와 방향성 |
| 🏗️ 아키텍처 | [시스템 설계](./docs/02-architecture/SYSTEM_DESIGN.md) | 기술 아키텍처 |
| 📖 가이드 | [CLI 사용법](./docs/03-guides/CLI_USAGE.md) | 명령어 레퍼런스 |
| 📖 가이드 | [코드 품질 표준](./docs/03-guides/CODE_QUALITY.md) | 개발자 필독 |
| 📖 가이드 | [배포 가이드](./docs/03-guides/DEPLOYMENT.md) | PM2 프로덕션 배포 |
| 📋 스펙 | [Feature 스펙](./docs/05-specifications/v2/README.md) | 기능별 상세 스펙 |
| 🗺️ 로드맵 | [개발 현황](./docs/06-roadmap/STATUS.md) | 진행 상태 |

---

## 🏗️ 기술 스택

### Core

- **TypeScript** 5.0+ - 타입 안정성
- **Node.js** 20+ - 런타임
- **NATS** - 메시지 브로커
- **PostgreSQL** - 데이터베이스
- **Prisma** - ORM

### AI/LLM

- **Anthropic Claude** (Sonnet 4.5, Opus)
- **OpenAI** (GPT-4o, o1)
- **Google Gemini** (2.5 Pro)

### DevOps

- **PM2** - 프로세스 관리
- **GitHub API** - Git 작업 및 PR 관리
- **Zod** - 스키마 검증
- **Winston** - 로깅

---

## 📊 구현 현황

### 코어 아키텍처 (리팩토링)

| Phase | 설명 | 상태 | 테스트 |
|-------|------|------|--------|
| Phase 0 | Foundation (DI, Events, Error Recovery) | ✅ 완료 | 119개 |
| Phase 1 | Core Agents (Factory, Registry, Communication) | 🔄 진행 중 | 238개 |
| Phase 2 | Workflow Engine (Definition, Executor, Orchestrator) | 🔄 진행 중 | 369개 |
| Phase 3 | Tools & Hooks (Registry, Git, File, Shell, LSP, AST-Grep, MCP, Hooks, Session, Web Search) | 🔄 진행 중 | 983개 |

### 레거시 시스템

| Phase                    | 상태    |
| ------------------------ | ------- |
| Phase 1: 핵심 인프라     | ✅ 완료 |
| Phase 2: 에이전트 구현   | ✅ 완료 |
| Phase 3: 프로덕션 인프라 | ✅ 완료 |
| Phase 4: 고급 기능       | ✅ 완료 |

**현재 버전**: 0.1.0 | **총 테스트**: 2,234개 통과

---

## 🤝 기여

기여를 환영합니다! [기여 가이드](./CONTRIBUTING.md)를 참조하세요.

```bash
# 개발 환경 설정
npm install
npm run dev

# 테스트
npm test
npm run test:coverage
```

---

## 📄 라이선스

이 프로젝트는 [AGPL-3.0 License](LICENSE) 하에 배포됩니다.

---
