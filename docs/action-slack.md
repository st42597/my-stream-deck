# Slack Activity

## 개요

버튼 클릭 시 Slack을 앞으로 가져오고 Activity 패널을 연다.

## 버튼 클릭 동작

```
Slack activate → ⌘⇧M (Activity 토글)
```

- `⌘⇧M`은 토글. Activity가 이미 열려있으면 한 번 더 누르면 닫힘.
- 뱃지/카운트 표시 없음. 정적 아이콘만 노출.

## 구현

`src/actions/slackAction.ts`가 `onKeyDown`에서 osascript로 두 줄 AppleScript 실행:

```applescript
tell application "Slack" to activate
tell application "System Events" to keystroke "m" using {command down, shift down}
```

## 권한

- **접근성(Accessibility)**: System Events로 키 입력을 합성하려면 macOS 접근성 권한 필요.
  시스템 설정 → 개인정보 보호 및 보안 → 접근성에서 Elgato Stream Deck 허용.
- **자동화**: Stream Deck이 Slack/System Events를 제어할 수 있도록 허용.

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/actions/slackAction.ts` | 액션 로직 (버튼 → Slack Activity) |
