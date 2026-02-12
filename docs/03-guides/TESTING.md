# Testing Guide

> 테스트 인프라 및 모킹 가이드

---

## 테스트 현황

| 항목 | 값 |
|------|-----|
| 총 테스트 | 2,374개 |
| 테스트 스위트 | 97개 |
| 커버리지 목표 | 70% |

---

## 테스트 실행

```bash
# 전체 테스트
npm test

# 커버리지 포함
npm run test:coverage

# 특정 파일
npm test -- tests/unit/agents/base/agent.test.ts

# Watch 모드
npm test -- --watch
```

---

## 모킹 인프라

### 1. NATS Mock (`tests/__mocks__/nats.ts`)

NATS 서버 없이 메시징 테스트 가능:

```typescript
import { NatsClient } from '@/shared/messaging/nats-client';

// Jest가 자동으로 mock 사용
const client = new NatsClient(config);
await client.connect();  // 실제 서버 연결 없음

// Mock 상태 리셋
const natsMock = jest.requireMock('nats');
natsMock.__resetMockState();
```

**지원 기능:**
- `connect()` - 연결 시뮬레이션
- `publish()` / `subscribe()` - 메시지 발행/구독
- `request()` - 요청/응답 패턴
- JetStream API (streams, consumers)

### 2. GitHub/Octokit Mock (`tests/__mocks__/@octokit/rest.ts`)

```typescript
// 자동으로 mock 적용
import { GitHubClient } from '@/shared/github/client';

const client = new GitHubClient({ token: 'test' });
// 모든 API 호출이 mock 응답 반환
```

### 3. LLM Mock (`src/dx/testing/mock-llm-client.ts`)

```typescript
import { MockLLMClient } from '@/dx/testing';

const mockLLM = new MockLLMClient();

// 패턴 매칭 응답
mockLLM.setResponse(/implement.*function/, {
  content: 'function foo() { return 42; }',
});

// 순차 응답
mockLLM.setResponseSequence([
  { content: 'First response' },
  { content: 'Second response' },
]);

// 호출 검증
expect(mockLLM.getCallHistory()).toHaveLength(2);
```

---

## 테스트 패턴

### 1. 에이전트 테스트

```typescript
describe('MyAgent', () => {
  let agent: MyAgent;
  let mockNatsClient: jest.Mocked<NatsClient>;
  let mockLLMClient: jest.Mocked<ILLMClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';

    mockNatsClient = {
      subscribe: jest.fn(),
      publish: jest.fn(),
      request: jest.fn(),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    mockLLMClient = {
      chat: jest.fn().mockResolvedValue({
        content: 'test response',
        model: 'test-model',
        usage: { totalTokens: 100 },
      }),
    } as any;

    agent = new MyAgent(config, mockNatsClient, mockLLMClient);
  });

  afterEach(async () => {
    await agent.stop();
    delete process.env.ANTHROPIC_API_KEY;
  });
});
```

### 2. 타이밍 테스트

```typescript
// 측정 가능한 지연 추가
async processTask(task: Task): Promise<TaskResult> {
  await new Promise(resolve => setTimeout(resolve, 5));
  // ... 처리 로직
}

// 테스트에서 검증
expect(result.metadata.duration).toBeGreaterThan(0);
```

### 3. CI/CD Mock

```typescript
jest.mock('@/shared/ci/index.js', () => ({
  CIChecker: jest.fn().mockImplementation(() => ({
    getCIStatus: jest.fn().mockResolvedValue({
      status: 'success',
      overallStatus: 'success',
      hasFailures: false,
    }),
    isPassed: jest.fn().mockReturnValue(true),
    isFailed: jest.fn().mockReturnValue(false),
  })),
}));
```

---

## Jest 설정

```javascript
// jest.config.js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // ESM 패키지 mock
    '^nats$': '<rootDir>/tests/__mocks__/nats.ts',
    '^@octokit/rest$': '<rootDir>/tests/__mocks__/@octokit/rest.ts',
    '^octokit$': '<rootDir>/tests/__mocks__/octokit.ts',
    // Path aliases
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

---

## 디렉토리 구조

```
tests/
├── __mocks__/           # Jest 자동 mock
│   ├── nats.ts
│   ├── octokit.ts
│   └── @octokit/
│       └── rest.ts
├── unit/                # 단위 테스트
│   ├── agents/
│   ├── core/
│   └── shared/
├── integration/         # 통합 테스트
└── e2e/                 # E2E 테스트
```

---

## 트러블슈팅

### ESM 패키지 import 에러

```javascript
// jest.config.js에 mock 매핑 추가
moduleNameMapper: {
  '^problematic-package$': '<rootDir>/tests/__mocks__/problematic-package.ts',
}
```

### 타이밍 테스트 실패

```typescript
// 비동기 작업에 충분한 지연 추가
await new Promise(resolve => setTimeout(resolve, 5));

// 또는 Jest fake timers 사용
jest.useFakeTimers();
jest.advanceTimersByTime(100);
```

### Mock 상태 오염

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  // 필요시 mock 상태도 리셋
  const natsMock = jest.requireMock('nats');
  natsMock.__resetMockState?.();
});
```
