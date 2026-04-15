# Codex Token Monitor

## 개요

OpenAI Codex CLI의 5시간 롤링 윈도우 사용률을 Stream Deck 버튼에 표시.  
ChatGPT OAuth API에서 직접 퍼센트를 가져옴.

## 표시 내용

```
┌─────────────────────────┐
│ CODEX          (pill bg) │
│                          │
│   [fill: 사용률만큼 차오름] │
│                          │
│          22%             │
│                          │
│       ↺ 3h 12m           │
└─────────────────────────┘
```

- 85% 이상: 색상이 `#ff3b30` (빨강)으로 경고
- 액센트 컬러: `#10a37f` (OpenAI 그린)

## 데이터 소스

**엔드포인트**: `GET https://chatgpt.com/backend-api/wham/usage`

**인증**: `~/.codex/auth.json`에서 자동으로 읽음
```json
{
  "tokens": {
    "access_token": "eyJ...",
    "account_id": "4f743aad-..."
  }
}
```

**필수 헤더**:
```
Authorization: Bearer {access_token}
User-Agent: CodexBar
ChatGPT-Account-Id: {account_id}   ← account_id 있을 때만
```

**응답 구조**:
```json
{
  "plan_type": "team",
  "rate_limit": {
    "primary_window": {
      "used_percent": 22,
      "reset_at": 1776294941,
      "limit_window_seconds": 18000
    }
  }
}
```

`primary_window`가 5시간 윈도우 (18000초).  
`reset_at`은 Unix timestamp (초 단위).

## Rate Limit 대응

- 429 응답 시 이전 캐시값 반환
- 기본 폴링 간격: **5분**

## 설정 (Property Inspector)

| 항목 | 값 |
|------|----|
| Refresh Interval | Manual / 1m / 2m / **5m** / 15m / 30m |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/actions/codexAction.ts` | 액션 로직 |
| `src/utils/codexOAuth.ts` | auth.json 읽기 + API 호출 |
| `src/utils/renderButton.ts` | SVG 렌더링 (Claude/Codex 공용) |
| `inspector/codex.html` | Refresh Interval 선택 UI |
