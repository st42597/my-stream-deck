# Slack Notifications

## 개요

Slack의 멘션/DM 알림 수를 표시하고, 버튼 클릭 시 미읽음 채널을 순서대로 열기.

## 표시 내용

```
알림 없음:               알림 있음:
┌──────────────┐         ┌──────────────┐
│  # (흐리게)   │         │ # SLACK    • │  ← 빨간 점
│              │         │              │
│      0       │         │      5       │  ← 알림 수
│   NO ALERTS  │         │   MENTIONS   │
└──────────────┘         └──────────────┘
```

- 알림 없음: 숫자 `0`, 어두운 색
- 알림 있음: 흰색 숫자 크게, 우상단 빨간 dot, radial glow 배경
- `99+` 이상이면 `99+`로 표시
- 액센트 컬러: `#e01e5a` (Slack 빨강)

## 버튼 클릭 동작

```
미읽음 있음 → slack://channel?id={channelId}&team= 딥링크 → Slack 앱에서 열기
미읽음 없음 → 아무 반응 없음
```

여러 번 클릭 시 미읽음 채널을 최신순으로 순환 (navIndex 사용).  
알림 목록이 변경되면 navIndex 자동 리셋.

## 데이터 수집

**우선 방식**: `GET https://slack.com/api/users.counts`
- 비공식 API지만 User Token으로 동작
- 채널별 `mention_count`, DM의 `dm_count` 직접 제공
- 가장 정확한 "내 활동" 알림 수

**Fallback**: `GET https://slack.com/api/conversations.list`
- `users.counts`가 실패하면 자동 전환
- 채널별 `unread_count_display` 합산
- 정확도 낮음 (일반 미읽음 포함)

## 설정 (Property Inspector)

User OAuth Token 입력 필요.

### Slack App 생성 방법

1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch
2. OAuth & Permissions → **User Token Scopes** 추가:
   - `channels:read`
   - `groups:read`
   - `im:read`
   - `mpim:read`
3. Install to Workspace
4. **User OAuth Token** (`xoxp-...`) 복사
5. Property Inspector에 붙여넣기

### 폴링

- 10초 간격 자동 갱신
- 버튼 클릭 시 즉시 채널 열기 (갱신은 다음 폴링 때)

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/actions/slackAction.ts` | 액션 로직, 딥링크 열기 |
| `src/utils/slackNotifications.ts` | 폴링, API 호출, navIndex 관리 |
| `src/utils/renderSlack.ts` | SVG 렌더링 |
| `inspector/slack.html` | User Token 입력 UI |
