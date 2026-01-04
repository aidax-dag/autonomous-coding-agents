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

### 핵심 문서

- **[시스템 설계](./MULTI_AGENT_SYSTEM_DESIGN.md)** - 아키텍처 및 기술 설계
- **[PRD](./PRD.md)** - 제품 요구사항 명세
- **[기능 목록](./FEATURE_LIST.md)** - 상세 기능 리스트

### 사용 가이드

- **[CLI 사용법](./docs/CLI_USAGE.md)** - 명령어 레퍼런스
- **[배포 가이드](./docs/DEPLOYMENT.md)** - PM2 프로덕션 배포
- **[Webhook 설정](./docs/WEBHOOK_SETUP.md)** - GitHub Webhook 연동
- **[Interactive 모드](./docs/INTERACTIVE_MODE.md)** - 실시간 모니터링
- **[테스트 가이드](./docs/TESTING.md)** - 테스트 인프라 및 모킹

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

| Phase                    | 상태    |
| ------------------------ | ------- |
| Phase 1: 핵심 인프라     | ✅ 완료 |
| Phase 2: 에이전트 구현   | ✅ 완료 |
| Phase 3: 프로덕션 인프라 | ✅ 완료 |
| Phase 4: 고급 기능       | ✅ 완료 |

**현재 버전**: 0.1.0 (Production Ready 🚀)

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
