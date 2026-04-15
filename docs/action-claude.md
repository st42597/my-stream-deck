# Claude Code Token Monitor

## 개요

Claude Code의 5시간 롤링 윈도우 사용률을 Stream Deck 버튼에 표시.  
Anthropic OAuth API에서 직접 퍼센트를 가져오므로 플랜에 무관하게 정확.

## 표시 내용

```
┌─────────────────────────┐
│ CLAUDE         (pill bg) │  ← 레이블 (pill 배경으로 항상 가시)
│                          │
│   [fill: 사용률만큼 차오름] │
│                          │
│          34%             │  ← 현재 사용률
│                          │
│       ↺ 4h 30m           │  ← 5시간 윈도우 리셋까지 남은 시간
└─────────────────────────┘
```

- 85% 이상: 색상이 `#ff3b30` (빨강)으로 경고
- fill 영역: 바닥에서 위로 차오르는 gradient

## 데이터 소스

**엔드포인트**: `GET https://api.anthropic.com/api/oauth/usage`

**인증**: macOS Keychain `Claude Code-credentials`에서 자동으로 읽음
```bash
security find-generic-password -s "Claude Code-credentials" -w
# → { claudeAiOauth: { accessToken: "sk-ant-o..." } }
```

**필수 헤더**:
```
Authorization: Bearer {accessToken}
anthropic-beta: oauth-2025-04-20
User-Agent: claude-code/2.1.109
```

**응답 구조**:
```json
{
  "five_hour": { "utilization": 34.0, "resets_at": "2026-04-16T08:00:00Z" },
  "seven_day": { "utilization": 16.0, "resets_at": "2026-04-21T15:00:00Z" }
}
```

`utilization`은 0~100 퍼센트 값.

## Rate Limit 대응

- 429 응답 시 이전 캐시값 반환 (화면 유지)
- 기본 폴링 간격: **5분**

## 설정 (Property Inspector)

| 항목 | 값 |
|------|----|
| Refresh Interval | Manual / 1m / 2m / **5m** / 15m / 30m |

설정 변경 시 폴링 타이머 즉시 재설정.  
버튼 클릭 시 즉시 갱신.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/actions/claudeAction.ts` | 액션 로직, 폴링, 디스플레이 |
| `src/utils/claudeOAuth.ts` | Keychain 읽기 + API 호출 |
| `src/utils/renderButton.ts` | SVG 렌더링 (Claude/Codex 공용) |
| `inspector/claude.html` | Refresh Interval 선택 UI |
