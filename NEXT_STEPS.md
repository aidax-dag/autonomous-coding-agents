# 🚀 다음 단계 가이드

축하합니다! 프로젝트 초기 설정이 완료되었습니다. 이제 구현을 시작할 준비가 되었습니다.

## ✅ 완료된 작업

- [x] GitHub 리포지토리 생성
- [x] 프로젝트 문서 작성 (README, PRD, FEATURE_LIST 등)
- [x] 디렉토리 구조 생성
- [x] package.json 및 TypeScript 설정
- [x] Prisma 스키마 정의
- [x] Docker Compose 설정
- [x] Git 초기 커밋 및 푸시

## 🎯 즉시 시작 가능한 작업

### 1. 의존성 설치

```bash
cd /Users/kevin/work/github/ai/autonomous-coding-agents
npm install
```

### 2. 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# 편집기로 .env 파일 열고 API 키 입력
# - ANTHROPIC_API_KEY 또는 OPENAI_API_KEY 또는 GEMINI_API_KEY
# - GITHUB_TOKEN
```

### 3. 인프라 시작 (PostgreSQL + NATS)

```bash
# Docker Compose로 인프라 시작
docker-compose up -d

# 상태 확인
docker-compose ps

# 로그 확인
docker-compose logs -f
```

### 4. 데이터베이스 마이그레이션

```bash
# Prisma 클라이언트 생성
npx prisma generate

# 마이그레이션 실행
npx prisma migrate dev --name init

# Prisma Studio로 데이터베이스 확인 (선택)
npx prisma studio
```

## 📋 구현 우선순위 (FEATURE_LIST.md 기반)

### Phase 1: 기초 인프라 (1-2주)

**Week 1**:
1. **F1.1: NATS 메시지 브로커 클라이언트**
   - `src/shared/messaging/nats-client.ts`
   - 연결, Pub/Sub, 재시도 로직

2. **F1.2: 메시지 스키마 정의**
   - `src/shared/messaging/schemas.ts`
   - Zod로 모든 메시지 타입 정의

3. **F1.3: 로깅 시스템**
   - `src/shared/logging/logger.ts`
   - Winston 설정, 파일 로테이션

**Week 2**:
4. **F1.4: 환경 설정 관리**
   - `src/shared/config/index.ts`
   - .env 로드 및 검증

5. **F1.5: 에러 핸들링**
   - `src/shared/errors/custom-errors.ts`
   - AgentError 클래스, 재시도 로직

6. **F1.6: LLM API 클라이언트**
   - `src/shared/llm/base-client.ts`
   - `src/shared/llm/claude-client.ts`
   - `src/shared/llm/openai-client.ts`

7. **F1.7: GitHub API 클라이언트**
   - `src/shared/github/client.ts`
   - Octokit 래퍼

8. **F1.8: Git 작업 유틸리티**
   - `src/shared/git/operations.ts`
   - simple-git 래퍼

## 🛠️ 개발 워크플로우

### 기능 개발 프로세스

```bash
# 1. 새 기능 브랜치 생성
git checkout -b feature/F1.1-message-broker

# 2. 코드 작성
# src/shared/messaging/nats-client.ts

# 3. 타입 체크
npm run type-check

# 4. 테스트 작성
# tests/unit/shared/messaging/nats-client.test.ts

# 5. 테스트 실행
npm test

# 6. Lint 및 Format
npm run lint:fix
npm run format

# 7. 커밋
git add .
git commit -m "feat: implement NATS message broker client (F1.1)

- Add NatsClient class with connection pooling
- Implement pub/sub pattern
- Add automatic reconnection logic
- Add comprehensive error handling
- Add unit tests with 90%+ coverage

Implements Feature F1.1 from FEATURE_LIST.md"

# 8. 푸시 및 PR 생성
git push origin feature/F1.1-message-broker
gh pr create --title "feat: implement NATS message broker (F1.1)" \
  --body "Implements Feature F1.1 from FEATURE_LIST.md

## Changes
- NatsClient with connection pooling
- Pub/sub implementation
- Auto-reconnection
- Error handling

## Testing
- Unit tests with 90%+ coverage
- Integration test with real NATS server

## Checklist
- [x] Code implemented
- [x] Tests written and passing
- [x] Documentation updated
- [x] No linting errors"
```

## 📝 첫 번째 구현 예시

### F1.1: NATS 메시지 브로커 클라이언트

**파일**: `src/shared/messaging/nats-client.ts`

```typescript
import { connect, NatsConnection, StringCodec } from 'nats';
import { logger } from '../logging/logger.js';

export class NatsClient {
  private connection: NatsConnection | null = null;
  private codec = StringCodec();

  async connect(url: string): Promise<void> {
    try {
      this.connection = await connect({
        servers: url,
        reconnect: true,
        maxReconnectAttempts: 10,
      });
      logger.info('NATS connected successfully');
    } catch (error) {
      logger.error('Failed to connect to NATS', { error });
      throw error;
    }
  }

  async publish(subject: string, data: unknown): Promise<void> {
    if (!this.connection) {
      throw new Error('NATS not connected');
    }
    const message = JSON.stringify(data);
    this.connection.publish(subject, this.codec.encode(message));
    logger.debug('Published message', { subject });
  }

  async subscribe(subject: string, handler: (data: unknown) => Promise<void>): Promise<void> {
    if (!this.connection) {
      throw new Error('NATS not connected');
    }

    const sub = this.connection.subscribe(subject);

    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.codec.decode(msg.data));
          await handler(data);
        } catch (error) {
          logger.error('Error processing message', { subject, error });
        }
      }
    })();
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      logger.info('NATS connection closed');
    }
  }
}
```

## 🧪 테스트 예시

**파일**: `tests/unit/shared/messaging/nats-client.test.ts`

```typescript
import { NatsClient } from '@shared/messaging/nats-client';

describe('NatsClient', () => {
  let client: NatsClient;

  beforeEach(() => {
    client = new NatsClient();
  });

  afterEach(async () => {
    await client.close();
  });

  it('should connect to NATS server', async () => {
    await expect(client.connect('nats://localhost:4222')).resolves.not.toThrow();
  });

  it('should publish and receive messages', async () => {
    await client.connect('nats://localhost:4222');

    const testData = { message: 'test' };
    const received: unknown[] = [];

    await client.subscribe('test.subject', async (data) => {
      received.push(data);
    });

    await client.publish('test.subject', testData);

    // Wait a bit for message to be received
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(testData);
  });
});
```

## 🎯 단기 목표 (1-2주)

### Week 1 목표
- [ ] F1.1-F1.3 완료 (메시지 브로커, 스키마, 로깅)
- [ ] Docker Compose 환경에서 로컬 테스트 성공
- [ ] 3개 PR 생성 및 머지

### Week 2 목표
- [ ] F1.4-F1.8 완료 (설정, 에러, LLM, GitHub, Git 클라이언트)
- [ ] 통합 테스트 작성
- [ ] Phase 1 완료!

## 📚 참고 자료

### 내부 문서
- **FEATURE_LIST.md**: 전체 48개 기능 리스트
- **PRD.md**: 상세 요구사항 및 사용자 스토리
- **MULTI_AGENT_SYSTEM_DESIGN.md**: 아키텍처 설계
- **GETTING_STARTED.md**: 상세 설정 가이드

### 외부 문서
- [NATS.io Documentation](https://docs.nats.io/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs)
- [Octokit GitHub API](https://octokit.github.io/rest.js/)

## 🐛 문제 해결

### Docker Compose 실행 안 됨
```bash
# Docker 실행 확인
docker --version

# 기존 컨테이너 정리
docker-compose down -v

# 재시작
docker-compose up -d
```

### npm install 실패
```bash
# Node.js 버전 확인 (20+ 필요)
node --version

# npm 캐시 정리
npm cache clean --force

# 재시도
rm -rf node_modules package-lock.json
npm install
```

### Prisma 마이그레이션 실패
```bash
# DATABASE_URL 확인
echo $DATABASE_URL

# PostgreSQL 실행 확인
docker-compose ps postgres

# 수동 연결 테스트
psql postgresql://multi_agent:password@localhost:5432/multi_agent_db
```

## ✨ 추천 개발 도구

### VS Code Extensions
- **Prisma** (prisma.prisma)
- **ESLint** (dbaeumer.vscode-eslint)
- **Prettier** (esbenp.prettier-vscode)
- **Jest** (orta.vscode-jest)
- **GitLens** (eamodio.gitlens)
- **Error Lens** (usernamehw.errorlens)

### CLI Tools
```bash
# TypeScript 실행 (tsx)
npm install -g tsx

# Prisma CLI
npm install -g prisma

# GitHub CLI
brew install gh
```

## 🎉 준비 완료!

이제 Phase 1의 첫 번째 기능인 **F1.1: NATS 메시지 브로커**부터 구현을 시작하세요!

```bash
# 시작!
git checkout -b feature/F1.1-message-broker
code src/shared/messaging/nats-client.ts
```

**Happy Coding! 🚀**
