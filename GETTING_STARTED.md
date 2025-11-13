# Getting Started - Multi-Agent Coding System

## 📋 새로운 리포지토리 생성 및 구현 시작 가이드

이 문서는 Multi-Agent Autonomous Coding System을 새로운 GitHub 리포지토리에서 구현하기 위한 단계별 가이드입니다.

---

## 🎯 Step 1: GitHub 리포지토리 생성

### 1.1 새 리포지토리 생성

```bash
# GitHub에서 새 리포지토리 생성
# Repository name: multi-agent-coding-system
# Description: 24/7 Autonomous Software Development with AI Agents
# Visibility: Public (또는 Private)
# Initialize with: README (체크 해제 - 우리가 직접 추가)
```

**또는 GitHub CLI 사용**:

```bash
gh repo create multi-agent-coding-system \
  --public \
  --description "24/7 Autonomous Software Development with AI Agents" \
  --clone
```

### 1.2 로컬에서 리포지토리 초기화 (수동 생성 시)

```bash
# 새 디렉토리 생성
mkdir multi-agent-coding-system
cd multi-agent-coding-system

# Git 초기화
git init

# 원격 저장소 추가
git remote add origin https://github.com/YOUR_USERNAME/multi-agent-coding-system.git
```

---

## 📄 Step 2: 핵심 문서 복사

### 2.1 문서 파일 복사

현재 디렉토리(`/Users/kevin/work/github/ai/`)에 있는 다음 파일들을 새 리포지토리로 복사:

```bash
# 현재 위치
cd /Users/kevin/work/github/ai/

# 새 리포지토리로 문서 복사
cp README.md ../multi-agent-coding-system/
cp MULTI_AGENT_SYSTEM_DESIGN.md ../multi-agent-coding-system/
cp PRD.md ../multi-agent-coding-system/
cp FEATURE_LIST.md ../multi-agent-coding-system/
cp GETTING_STARTED.md ../multi-agent-coding-system/

# 새 리포지토리로 이동
cd ../multi-agent-coding-system/
```

### 2.2 문서 구조 확인

```
multi-agent-coding-system/
├── README.md                           # 프로젝트 소개 및 빠른 시작
├── GETTING_STARTED.md                  # 이 문서
├── MULTI_AGENT_SYSTEM_DESIGN.md        # 아키텍처 설계
├── PRD.md                              # Product Requirements Document
└── FEATURE_LIST.md                     # 상세 기능 리스트 (48개)
```

---

## 🏗️ Step 3: 프로젝트 구조 생성

### 3.1 디렉토리 구조 생성

```bash
# 루트 디렉토리에서 실행
mkdir -p src/{agents,shared,types,scripts}
mkdir -p src/agents/{coder,reviewer,repo-manager}
mkdir -p src/shared/{llm,github,git,database,messaging,config,logging,errors}
mkdir -p tests/{unit,integration,e2e}
mkdir -p docs/{api,guides}
mkdir -p logs
```

### 3.2 최종 디렉토리 구조

```
multi-agent-coding-system/
├── docs/                               # 추가 문서
│   ├── api/                            # API 문서
│   └── guides/                         # 사용 가이드
├── logs/                               # 로그 파일 (gitignore)
├── src/
│   ├── agents/                         # 에이전트 구현
│   │   ├── coder/                      # 코딩 에이전트
│   │   │   ├── index.ts
│   │   │   ├── state-machine.ts
│   │   │   ├── requirements-analyzer.ts
│   │   │   ├── code-generator.ts
│   │   │   └── pr-creator.ts
│   │   ├── reviewer/                   # 코드리뷰 에이전트
│   │   │   ├── index.ts
│   │   │   ├── state-machine.ts
│   │   │   ├── pr-monitor.ts
│   │   │   ├── code-analyzer.ts
│   │   │   └── review-poster.ts
│   │   └── repo-manager/               # 레포관리 에이전트
│   │       ├── index.ts
│   │       ├── state-machine.ts
│   │       ├── message-router.ts
│   │       └── merge-manager.ts
│   ├── shared/                         # 공유 유틸리티
│   │   ├── llm/                        # LLM API 클라이언트
│   │   │   ├── base-client.ts
│   │   │   ├── claude-client.ts
│   │   │   ├── openai-client.ts
│   │   │   └── gemini-client.ts
│   │   ├── github/                     # GitHub API
│   │   │   └── client.ts
│   │   ├── git/                        # Git 작업
│   │   │   └── operations.ts
│   │   ├── database/                   # 데이터베이스
│   │   │   ├── prisma-client.ts
│   │   │   └── repositories/
│   │   ├── messaging/                  # 메시지 브로커
│   │   │   ├── nats-client.ts
│   │   │   └── schemas.ts
│   │   ├── config/                     # 설정
│   │   │   └── index.ts
│   │   ├── logging/                    # 로깅
│   │   │   └── logger.ts
│   │   └── errors/                     # 에러 핸들링
│   │       └── custom-errors.ts
│   ├── types/                          # TypeScript 타입
│   │   ├── agents.ts
│   │   ├── messages.ts
│   │   └── models.ts
│   ├── scripts/                        # 유틸리티 스크립트
│   │   ├── setup-db.ts
│   │   └── seed-data.ts
│   └── cli/                            # CLI 인터페이스
│       └── index.ts
├── tests/
│   ├── unit/                           # 단위 테스트
│   ├── integration/                    # 통합 테스트
│   └── e2e/                            # E2E 테스트
├── prisma/
│   ├── schema.prisma                   # Prisma 스키마
│   └── migrations/
├── .env.example                        # 환경변수 예시
├── .gitignore
├── package.json
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
├── jest.config.js
├── docker-compose.yml                  # NATS + PostgreSQL
├── README.md
├── MULTI_AGENT_SYSTEM_DESIGN.md
├── PRD.md
├── FEATURE_LIST.md
└── GETTING_STARTED.md
```

---

## 📦 Step 4: 프로젝트 초기화

### 4.1 package.json 생성

```bash
npm init -y
```

### 4.2 package.json 수정

```json
{
  "name": "multi-agent-coding-system",
  "version": "0.1.0",
  "description": "24/7 Autonomous Software Development with AI Agents",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/cli/index.ts",
    "build": "tsc",
    "start": "node dist/cli/index.js",
    "start:agents": "pm2 start ecosystem.config.js",
    "start:coder": "tsx src/agents/coder/index.ts",
    "start:reviewer": "tsx src/agents/reviewer/index.ts",
    "start:repo-manager": "tsx src/agents/repo-manager/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "type-check": "tsc --noEmit",
    "db:migrate": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio"
  },
  "keywords": [
    "ai",
    "automation",
    "coding-agent",
    "multi-agent",
    "llm",
    "github",
    "code-review"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@google/generative-ai": "^0.21.0",
    "@prisma/client": "^6.1.0",
    "commander": "^12.1.0",
    "ioredis": "^5.4.2",
    "nats": "^2.29.1",
    "octokit": "^4.0.2",
    "openai": "^4.75.0",
    "simple-git": "^3.27.0",
    "winston": "^3.17.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^20.17.10",
    "@typescript-eslint/eslint-plugin": "^8.18.2",
    "@typescript-eslint/parser": "^8.18.2",
    "eslint": "^9.18.0",
    "eslint-config-prettier": "^9.1.0",
    "jest": "^29.7.0",
    "prettier": "^3.4.2",
    "prisma": "^6.1.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
```

### 4.3 의존성 설치

```bash
npm install
```

---

## ⚙️ Step 5: 설정 파일 생성

### 5.1 TypeScript 설정 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 5.2 ESLint 설정 (eslint.config.js)

```javascript
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }]
    }
  },
  prettierConfig
];
```

### 5.3 Prettier 설정 (prettier.config.js)

```javascript
export default {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf'
};
```

### 5.4 Jest 설정 (jest.config.js)

```javascript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 5.5 .gitignore

```gitignore
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Testing
coverage/

# Database
*.db
*.sqlite

# Prisma
prisma/.env

# PM2
.pm2/
```

### 5.6 .env.example

```bash
# LLM API Keys (Choose at least one)
ANTHROPIC_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Default LLM Provider (claude | openai | gemini)
LLM_PROVIDER=claude

# GitHub
GITHUB_TOKEN=your_github_personal_access_token
GITHUB_OWNER=your_github_username_or_org
GITHUB_REPO=your_repository_name

# NATS
NATS_URL=nats://localhost:4222

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/multi_agent_db

# Agent Configuration
AUTO_MERGE_ENABLED=false
HUMAN_APPROVAL_REQUIRED=true
MAX_CONCURRENT_FEATURES=3
AGENT_TIMEOUT_MINUTES=240

# Notifications (Optional)
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=

# Logging
LOG_LEVEL=info
LOG_TO_FILE=true
```

---

## 🗄️ Step 6: Prisma 스키마 생성

### 6.1 Prisma 초기화

```bash
npx prisma init
```

### 6.2 schema.prisma 작성

**PRD.md**의 Appendix C에 있는 스키마를 `prisma/schema.prisma`에 복사

### 6.3 마이그레이션 생성 및 실행

```bash
# 마이그레이션 생성
npx prisma migrate dev --name init

# Prisma Client 생성
npx prisma generate
```

---

## 🐳 Step 7: Docker Compose 설정

### 7.1 docker-compose.yml 생성

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: multi-agent-postgres
    environment:
      POSTGRES_USER: multi_agent
      POSTGRES_PASSWORD: your_secure_password
      POSTGRES_DB: multi_agent_db
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  nats:
    image: nats:2-alpine
    container_name: multi-agent-nats
    command: ["-js", "-sd", "/data"]
    ports:
      - '4222:4222'
      - '8222:8222'
    volumes:
      - nats_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  nats_data:
```

### 7.2 인프라 시작

```bash
docker-compose up -d
```

---

## 🚀 Step 8: 첫 번째 커밋 및 푸시

### 8.1 Git 설정

```bash
# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "chore: initial project setup

- Add project documentation (README, PRD, FEATURE_LIST)
- Set up TypeScript, ESLint, Prettier, Jest
- Configure Prisma with PostgreSQL schema
- Add Docker Compose for infrastructure
- Initialize project structure"

# 원격 저장소에 푸시
git push -u origin main
```

---

## 📝 Step 9: 구현 시작

### Phase 1 구현 순서 (FEATURE_LIST.md 참고)

#### Week 1-2: 기초 인프라

1. **F1.1: 메시지 브로커 시스템**
   ```bash
   git checkout -b feature/message-broker
   # src/shared/messaging/nats-client.ts 구현
   ```

2. **F1.2: 메시지 스키마 정의**
   ```bash
   # src/shared/messaging/schemas.ts 구현
   ```

3. **F1.3-F1.5: 로깅, 설정, 에러 핸들링**
   ```bash
   # src/shared/logging/logger.ts
   # src/shared/config/index.ts
   # src/shared/errors/custom-errors.ts
   ```

4. **F1.6-F1.8: LLM, GitHub, Git 클라이언트**
   ```bash
   # src/shared/llm/base-client.ts
   # src/shared/github/client.ts
   # src/shared/git/operations.ts
   ```

#### Week 3-4: 에이전트 기본 구조

5. **F2.1, F3.1, F4.1: 에이전트 기본 구조**
   ```bash
   git checkout -b feature/agent-skeleton
   # src/agents/coder/index.ts
   # src/agents/reviewer/index.ts
   # src/agents/repo-manager/index.ts
   ```

### 개발 워크플로우

```bash
# 1. 기능 브랜치 생성
git checkout -b feature/F1.1-message-broker

# 2. 코드 구현
# ...

# 3. 테스트 작성
# tests/unit/shared/messaging/nats-client.test.ts

# 4. 테스트 실행
npm test

# 5. Lint & Format
npm run lint:fix
npm run format

# 6. 커밋
git add .
git commit -m "feat: implement NATS message broker client (F1.1)"

# 7. 푸시 및 PR 생성
git push origin feature/F1.1-message-broker
gh pr create --title "feat: implement NATS message broker (F1.1)" \
  --body "Implements Feature F1.1 from FEATURE_LIST.md"
```

---

## 🎯 Step 10: 마일스톤 설정

GitHub에서 다음 마일스톤 생성:

1. **Milestone: Phase 1 - Infrastructure** (Week 1-4)
   - F1.1 through F1.9

2. **Milestone: Phase 2 - Coding Agent MVP** (Week 5-8)
   - F2.1 through F2.6

3. **Milestone: Phase 3 - Review Agent** (Week 9-10)
   - F3.1 through F3.7

4. **Milestone: Phase 4 - Repo Manager** (Week 11)
   - F4.1 through F4.5

5. **Milestone: Phase 5 - Integration** (Week 12-14)
   - F5.1 through F5.5

6. **Milestone: MVP Release** (Month 3)
   - All P0 features complete

---

## ✅ 체크리스트

### 리포지토리 설정
- [ ] GitHub 리포지토리 생성 완료
- [ ] 로컬 Git 초기화 완료
- [ ] 핵심 문서 복사 완료
- [ ] 프로젝트 구조 생성 완료

### 프로젝트 초기화
- [ ] package.json 설정 완료
- [ ] 의존성 설치 완료
- [ ] TypeScript 설정 완료
- [ ] ESLint, Prettier 설정 완료
- [ ] Jest 설정 완료
- [ ] .gitignore 설정 완료
- [ ] .env.example 작성 완료

### 데이터베이스
- [ ] Prisma 초기화 완료
- [ ] schema.prisma 작성 완료
- [ ] 마이그레이션 실행 완료

### 인프라
- [ ] Docker Compose 설정 완료
- [ ] PostgreSQL 실행 확인
- [ ] NATS 실행 확인

### Git
- [ ] 첫 커밋 완료
- [ ] 원격 저장소 푸시 완료
- [ ] GitHub 마일스톤 생성 완료

### 준비 완료
- [ ] API 키 준비 (Claude/OpenAI/Gemini)
- [ ] GitHub Personal Access Token 생성
- [ ] .env 파일 작성
- [ ] 개발 환경 테스트 (`npm run dev`)

---

## 🎉 완료!

축하합니다! Multi-Agent Coding System의 새로운 리포지토리가 준비되었습니다.

### 다음 단계

1. **FEATURE_LIST.md** 참고하여 F1.1부터 순차적으로 구현 시작
2. 각 기능 완료 후 PR 생성 및 리뷰
3. Phase 1 완료 후 Phase 2로 진행
4. 3-4개월 후 MVP 출시 🚀

### 도움이 필요하면

- GitHub Issues에 질문 작성
- Discussions에 아이디어 공유
- PRD.md, FEATURE_LIST.md, MULTI_AGENT_SYSTEM_DESIGN.md 참고

**Happy Coding! 🤖💻**
