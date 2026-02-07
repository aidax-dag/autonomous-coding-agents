# 03-guides

> 사용자 및 개발자 가이드 문서

## 문서 목록

| 문서 | 설명 | 대상 |
|------|------|------|
| [CLI_USAGE.md](./CLI_USAGE.md) | CLI 명령어 및 사용법 | 사용자 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | PM2 배포 및 환경 설정 | 운영자 |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | 구현 가이드 (P0-P2 작업 상세) | 개발자 |
| [INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md) | 인터랙티브 모드 명령어 | 사용자 |
| [TESTING.md](./TESTING.md) | 테스트 가이드 및 패턴 | 개발자 |
| [WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md) | GitHub 웹훅 설정 | 운영자 |

## 읽기 순서

### 사용자
1. **[CLI_USAGE.md](./CLI_USAGE.md)** - CLI 기본 사용법 (10분)
2. **[INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md)** - 인터랙티브 모드 (5분)

### 개발자
1. **[TESTING.md](./TESTING.md)** - 테스트 작성 가이드 (15분)
2. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - 상세 구현 가이드 (30분+)

### 운영자
1. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 배포 설정 (15분)
2. **[WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md)** - 웹훅 구성 (10분)

## 주요 CLI 명령어

```bash
# 프로젝트 시작
multi-agent start-project --prd ./docs/PRD.md

# 기능 제출
multi-agent submit-feature --file feature.md

# 인터랙티브 모드
multi-agent interactive
```

## 인터랙티브 모드 명령어

| 명령어 | 설명 |
|--------|------|
| `/help` | 도움말 표시 |
| `/status` | 시스템 상태 확인 |
| `/respond` | 에이전트 응답 |
| `/logs` | 로그 확인 |
| `/pause` | 작업 일시 중지 |
| `/resume` | 작업 재개 |

## 관련 문서

- [01-vision/](../01-vision/) - 프로젝트 비전
- [02-architecture/](../02-architecture/) - 시스템 아키텍처
- [06-roadmap/](../06-roadmap/) - 개발 로드맵
