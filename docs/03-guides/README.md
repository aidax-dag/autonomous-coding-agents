# 03-guides

> 사용자 및 개발자 가이드 문서

## 문서 목록

| 문서 | 설명 | 대상 |
|------|------|------|
| [USER_GUIDE.md](./USER_GUIDE.md) | 설치/설정/사용 종합 가이드 | 사용자 |
| [CLI_USAGE.md](./CLI_USAGE.md) | CLI 명령어 및 사용법 | 사용자 |
| [CODE_QUALITY.md](./CODE_QUALITY.md) | 코드 품질 표준 및 베스트 프랙티스 | 개발자 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | PM2 배포 및 환경 설정 | 운영자 |
| [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) | 구현 가이드 (P0-P2 작업 상세) | 개발자 |
| [INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md) | 인터랙티브 모드 명령어 | 사용자 |
| [TESTING.md](./TESTING.md) | 테스트 가이드 및 패턴 | 개발자 |
| [WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md) | GitHub 웹훅 설정 | 운영자 |
| [DATABASE_SETUP.md](./DATABASE_SETUP.md) | DB 엔진 설정 및 마이그레이션 | 운영자 |
| [OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md) | 모니터링 및 추적 운영 가이드 | 운영자 |

## 읽기 순서

### 사용자
1. **[USER_GUIDE.md](./USER_GUIDE.md)** - 설치부터 사용까지 종합 가이드 (15분)
2. **[CLI_USAGE.md](./CLI_USAGE.md)** - CLI 명령어 상세 (10분)
3. **[INTERACTIVE_MODE.md](./INTERACTIVE_MODE.md)** - 인터랙티브 모드 (5분)

### 개발자
1. **[CODE_QUALITY.md](./CODE_QUALITY.md)** - 코드 품질 표준 (필독)
2. **[TESTING.md](./TESTING.md)** - 테스트 작성 가이드 (15분)
3. **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - 상세 구현 가이드 (30분+)

### 운영자
1. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - 배포 설정 (15분)
2. **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - DB 설정 및 마이그레이션 (10분)
3. **[OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md)** - 모니터링 운영 (15분)
4. **[WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md)** - 웹훅 구성 (10분)

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
