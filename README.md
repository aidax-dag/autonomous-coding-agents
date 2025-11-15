# Multi-Agent Autonomous Coding System

> 24/7 자율 소프트웨어 개발 시스템 - 요구사항부터 배포까지 자동화

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

---

## 📖 개요

Multi-Agent Autonomous Coding System은 3개의 전문화된 AI 에이전트가 협력하여 소프트웨어 개발 전체 사이클을 자동화하는 혁신적인 도구입니다. 개발자는 자연어로 요구사항을 입력하기만 하면, 에이전트들이 24시간 내내 코드를 작성하고, 리뷰하고, 머지합니다.

### 🎯 핵심 가치

- **🌙 24/7 개발**: 에이전트가 밤낮없이 작업하여 개발 속도 3-5배 향상
- **⏱️ 시간 절약**: 개발자 시간의 80% 이상 절약
- **✨ 일관된 품질**: 자동화된 코드 리뷰로 버그 및 보안 이슈 사전 차단
- **🚀 빠른 출시**: 아이디어에서 프로덕션까지 몇 시간 단위
- **💰 비용 효율**: LLM API 비용 $50-200/day vs 개발자 급여 $800-2400/day

---

## 📊 프로젝트 상태

### 구현 완료 현황

| Phase | 기능 | 상태 | 완료일 |
|-------|------|------|--------|
| **Phase 1** | 핵심 인프라 | ✅ 완료 | 2025-11 |
| | - NATS 메시지 브로커 | ✅ | |
| | - LLM 통합 (Claude/OpenAI/Gemini) | ✅ | |
| | - GitHub API 연동 | ✅ | |
| | - 로깅 시스템 | ✅ | |
| **Phase 2** | 에이전트 구현 | ✅ 완료 | 2025-11 |
| | - Base Agent 추상화 | ✅ | |
| | - Coder Agent (TDD) | ✅ | |
| | - Reviewer Agent (TDD) | ✅ | |
| | - Repo Manager Agent | ✅ | |
| | - Agent Manager | ✅ | |
| **Phase 3** | 프로덕션 인프라 | ✅ 완료 | 2025-11 |
| | - E2E 테스트 인프라 | ✅ | |
| | - PM2 프로세스 관리 | ✅ | |
| | - 헬스체크 & 모니터링 | ✅ | |
| | - CLI 인터페이스 | ✅ | |
| | - 알림 시스템 (Slack/Discord) | ✅ | |
| **Phase 4** | 고급 기능 | ✅ 완료 | 2025-11 |
| | - CI/CD 통합 | ✅ | |
| | - GitHub Webhook 지원 | ✅ | |
| | - 대화형 피드백 시스템 | ✅ | |
| | - 자동 이슈 감지 및 수정 | ✅ | |
| | - 병렬 기능 개발 | 📋 | |

### 현재 릴리스

- **버전**: 0.1.0
- **상태**: Production Ready 🚀
- **주요 기능**: 3개 에이전트, CLI, 모니터링, 알림

---

## 🏗️ 시스템 아키텍처

```
                   사용자 요구사항
                          ↓
                   ┌─────────────┐
                   │  Message    │
                   │   Broker    │
                   │   (NATS)    │
                   └──────┬──────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌─────▼─────┐    ┌─────▼──────┐
   │ Coding  │      │   Code    │    │    Repo    │
   │  Agent  │──────│  Review   │────│  Manager   │
   │         │      │   Agent   │    │   Agent    │
   └─────────┘      └───────────┘    └────────────┘
        │                 │                 │
        └─────────────────┴─────────────────┘
                          │
                  ┌───────▼────────┐
                  │   PostgreSQL   │
                  └────────────────┘
```

### 3가지 에이전트

1. **🤖 코딩 에이전트 (Coding Agent)**
   - 요구사항 분석 및 기능 플랜 작성
   - 코드 구현 (파일 생성/수정/삭제)
   - PR 생성 및 리뷰 피드백 반영

2. **🔍 코드리뷰 에이전트 (Code Review Agent)**
   - PR 자동 감지 및 리뷰
   - 버그, 보안, 성능 이슈 탐지
   - 개선 제안 및 코드 예제 제공

3. **🔧 레포관리 에이전트 (Repository Manager Agent)**
   - 에이전트 간 메시지 라우팅
   - PR 자동 머지
   - 다음 작업 트리거

---

## 🚀 빠른 시작

### 전제 조건

- Node.js 20 이상
- PostgreSQL 15 이상
- NATS 서버 2.x
- GitHub Personal Access Token 또는 GitHub App
- LLM API 키 (Claude / OpenAI / Gemini 중 하나 이상)

### 설치

```bash
# 리포지토리 클론
git clone https://github.com/your-username/multi-agent-coding-system.git
cd multi-agent-coding-system

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 API 키 입력

# 데이터베이스 마이그레이션
npx prisma migrate deploy

# 빌드
npm run build
```

### 실행

```bash
# 모든 에이전트 시작 (PM2 사용)
npm run start:agents

# 또는 개별 실행 (tmux 사용)
npm run start:coder
npm run start:reviewer
npm run start:repo-manager
```

### CLI 사용

```bash
# 전역 설치 (선택사항)
npm run build
npm link

# 새 프로젝트 시작
multi-agent start-project \
  --repo https://github.com/username/my-app \
  --requirements "사용자 인증이 있는 블로그 시스템 만들기" \
  --priority high

# 또는 개발 모드로 실행
npm run cli -- start-project \
  --repo https://github.com/username/my-app \
  --requirements "사용자 인증이 있는 블로그 시스템 만들기"

# 진행 상황 확인
multi-agent job-status task-1234567890-abc123

# 모든 작업 목록 조회
multi-agent list-jobs --status in_progress

# 시스템 상태 확인
multi-agent health
```

자세한 CLI 사용법은 **[docs/CLI_USAGE.md](./docs/CLI_USAGE.md)** 참조

---

## 📚 문서

### 핵심 문서

| 문서 | 설명 |
|------|------|
| **[MULTI_AGENT_SYSTEM_DESIGN.md](./MULTI_AGENT_SYSTEM_DESIGN.md)** | 전체 시스템 아키텍처 및 기술 설계 |
| **[PRD.md](./PRD.md)** | Product Requirements Document (제품 요구사항 명세) |
| **[FEATURE_LIST.md](./FEATURE_LIST.md)** | 상세 기능 리스트 및 구현 계획 (48개 기능) |

### 운영 가이드

| 문서 | 설명 |
|------|------|
| **[docs/CLI_USAGE.md](./docs/CLI_USAGE.md)** | CLI 명령어 사용법 및 예제 |
| **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** | PM2를 사용한 프로덕션 배포 가이드 |
| **[docs/WEBHOOK_SETUP.md](./docs/WEBHOOK_SETUP.md)** | GitHub Webhook 설정 가이드 (실시간 이벤트 처리) |
| **[docs/INTERACTIVE_MODE.md](./docs/INTERACTIVE_MODE.md)** | 대화형 모드 가이드 (실시간 모니터링 및 피드백) |

### Phase별 구현 계획

| 문서 | 설명 | 상태 |
|------|------|------|
| **[docs/PHASE_2_PLAN.md](./docs/PHASE_2_PLAN.md)** | Phase 2 상세 구현 계획 (에이전트) | ✅ 완료 |
| **[docs/PHASE_3_PLAN.md](./docs/PHASE_3_PLAN.md)** | Phase 3 상세 구현 계획 (인프라) | ✅ 완료 |
| **[docs/PHASE_4_PLAN.md](./docs/PHASE_4_PLAN.md)** | Phase 4 상세 구현 계획 (고급 기능) | 📋 작성 중 |

### 추가 문서 (작성 예정)

- [ ] API Documentation
- [ ] Troubleshooting Guide
- [ ] Contributing Guidelines
- [ ] Agent Prompt Engineering Guide

---

## 🎬 사용 예시

### 1. 프로젝트 시작

```bash
$ multi-agent start-project \
    --repo https://github.com/username/blog-app \
    --requirements "Build a blog with user auth, markdown editor, and comments"

✓ Connecting to repository...
✓ Analyzing requirements...

📋 Generated Feature Plan:
  1. User Authentication System (Medium)
  2. Blog Post CRUD (Low)
  3. Markdown Editor (Medium)
  4. Comment System (Low)

Would you like to proceed? [Y/n]: Y

✓ Job started: abc-123
Agents are now working!
```

### 2. 진행 상황 모니터링

```bash
$ multi-agent job-status abc-123

Job: abc-123 | Status: Active | Started: 2 hours ago

Features:
  ✓ User Authentication System    [MERGED]   PR #42
  ⏳ Blog Post CRUD                [IN_REVIEW] PR #43
  ⏸  Markdown Editor              [PENDING]
  ⏸  Comment System               [PENDING]

Recent Activity:
  10:23 - Review comments posted on PR #43
  10:15 - PR #43 created
  10:02 - PR #42 merged
```

### 3. 자동 생성된 PR 예시

**Title**: `feat: implement user authentication system`

**Description**:
```markdown
## Summary
Implements complete user authentication with sign up, login, logout.

## What Changed
- Added User model with Prisma
- Implemented auth endpoints (signup, login, logout, me)
- Added JWT token generation and validation
- Added password hashing with bcrypt

## Testing
✓ User can sign up and log in
✓ Protected routes reject unauthenticated requests
✓ Tokens expire after 7 days

🤖 Generated by Multi-Agent Coding System
```

---

## 🛠️ 기술 스택

### 언어 및 런타임
- **TypeScript** 5.0+ - 타입 안정성
- **Node.js** 20+ - 런타임 환경

### 핵심 인프라
- **NATS** 2.x - 메시지 브로커 (에이전트 간 통신)
- **PostgreSQL** 15+ - 상태 영속화
- **Prisma** - ORM

### AI/LLM 통합
- **Anthropic Claude** (Sonnet 4.5, Opus)
- **OpenAI** (GPT-4o, o1)
- **Google Gemini** (2.5 Pro)

### GitHub 통합
- **Octokit.js** - GitHub REST API
- **simple-git** - Git 작업

### 유틸리티
- **Zod** - 스키마 검증
- **Winston** - 로깅
- **Jest** - 테스팅
- **PM2** - 프로세스 관리

---

## 📊 성공 메트릭

### MVP 목표

| 메트릭 | 목표 | 측정 방법 |
|--------|------|-----------|
| 자동화율 | 80%+ | 휴먼 개입 없이 완료된 작업 비율 |
| 개발 속도 | 3-5 features/day | 간단한 기능 기준 |
| 리뷰 품질 | 90%+ | 유효한 리뷰 코멘트 비율 |
| 시간 절약 | 20+ hours/week | 사용자 설문 |
| 에러율 | <5% | 에이전트 실패율 |

---

## 🗓️ 릴리스 계획

### Phase 1: 기초 인프라 (Week 1-4)
- ✅ 메시지 브로커 설정
- ✅ LLM/GitHub API 클라이언트
- ✅ 데이터베이스 스키마

### Phase 2: 코딩 에이전트 MVP (Week 5-8)
- ⬜ 요구사항 분석
- ⬜ 코드 생성
- ⬜ PR 생성
- ⬜ 피드백 반영

### Phase 3: 코드리뷰 에이전트 (Week 9-10)
- ⬜ PR 모니터링
- ⬜ 자동 리뷰
- ⬜ 재검토

### Phase 4: 레포관리 에이전트 (Week 11)
- ⬜ 메시지 라우팅
- ⬜ 자동 머지
- ⬜ 다음 작업 트리거

### Phase 5: 통합 및 배포 (Week 12-14)
- ⬜ E2E 테스트
- ⬜ CLI 인터페이스
- ⬜ 모니터링 및 알림

**MVP 출시 목표**: 3-4개월

---

## 🤝 기여하기

우리는 커뮤니티의 기여를 환영합니다!

### 기여 방법

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### 개발 환경 설정

```bash
# 개발 의존성 설치
npm install

# 개발 모드 실행 (hot reload)
npm run dev

# 테스트 실행
npm test

# 테스트 커버리지
npm run test:coverage

# Lint
npm run lint

# 타입 체크
npm run type-check
```

### 코드 스타일

- ESLint + Prettier로 자동 포매팅
- Conventional Commits 사용
- 모든 public API에 TSDoc 주석

---

## 🐛 이슈 및 지원

### 버그 리포트

[GitHub Issues](https://github.com/your-username/multi-agent-coding-system/issues)에서 버그를 보고해주세요.

버그 리포트 시 포함할 내용:
- 예상 동작 vs 실제 동작
- 재현 단계
- 에러 메시지 및 로그
- 환경 정보 (OS, Node.js 버전, etc.)

### 기능 요청

새로운 기능 아이디어가 있으시면 [Discussions](https://github.com/your-username/multi-agent-coding-system/discussions)에서 제안해주세요.

---

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.

---

## 🙏 감사의 글

이 프로젝트는 다음 훌륭한 오픈소스 프로젝트들의 아이디어와 패턴을 참고했습니다:

- [Claude Code](https://github.com/anthropics/claude-code) by Anthropic
- [Codex CLI](https://github.com/openai/codex) by OpenAI
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) by Google

---

## 📞 연락처

프로젝트 관리자: Your Name
- Email: your.email@example.com
- GitHub: [@your-username](https://github.com/your-username)
- Twitter: [@your-twitter](https://twitter.com/your-twitter)

프로젝트 링크: [https://github.com/your-username/multi-agent-coding-system](https://github.com/your-username/multi-agent-coding-system)

---

## ⭐ 스타를 눌러주세요!

이 프로젝트가 유용하다면 ⭐️를 눌러주세요! 더 많은 사람들이 발견할 수 있습니다.

---

<p align="center">
  Made with ❤️ by the Multi-Agent Coding System Team
</p>

<p align="center">
  <i>2025년, AI가 밤새 코드를 작성하는 시대에 오신 것을 환영합니다</i>
</p>
