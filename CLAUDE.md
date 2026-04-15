# Stream Deck Plugin — AI Token Monitor

## 프로젝트 개요

Claude Code, Codex, Slack 알림, CPU/RAM 상태를 Stream Deck 버튼에 표시하는 macOS 전용 플러그인.

- Plugin ID: `com.sh.aitoken`
- SDK: `@elgato/streamdeck` v2 (Node.js)
- 언어: TypeScript → Rollup 번들 → ESM

---

## 디렉토리 구조

```
my-stream-deck/
├── src/
│   ├── plugin.ts               # 엔트리포인트 — 액션 등록 + connect
│   ├── actions/                # Stream Deck 액션 (버튼 1개 = 액션 1개)
│   │   ├── claudeAction.ts
│   │   ├── codexAction.ts
│   │   ├── cpuAction.ts
│   │   ├── ramAction.ts
│   │   └── slackAction.ts
│   └── utils/                  # 데이터 수집 + 렌더링
│       ├── claudeOAuth.ts      # Keychain → Anthropic API
│       ├── codexOAuth.ts       # ~/.codex/auth.json → ChatGPT API
│       ├── claudeTokens.ts     # JSONL 파싱 (레거시 fallback)
│       ├── codexTokens.ts      # SQLite 파싱 (레거시 fallback)
│       ├── slackNotifications.ts
│       ├── systemStats.ts      # CPU/RAM 샘플링
│       ├── renderButton.ts     # Claude/Codex SVG 렌더러
│       ├── renderChart.ts      # CPU/RAM area chart SVG 렌더러
│       └── renderSlack.ts      # Slack SVG 렌더러
├── com.sh.aitoken.sdPlugin/
│   ├── manifest.json           # ← Nodejs 필드 필수
│   ├── bin/plugin.js           # 빌드 결과물 (git ignore 권장)
│   ├── imgs/                   # 아이콘 SVG
│   └── inspector/              # Property Inspector HTML
├── docs/
│   ├── action-claude.md
│   ├── action-codex.md
│   ├── action-cpu.md
│   ├── action-ram.md
│   └── action-slack.md
├── package.json
├── rollup.config.mjs
└── tsconfig.json
```

---

## 빌드 & 설치

```bash
# 빌드
npm run build

# Stream Deck에 설치 (앱 재시작 필요)
DEST=~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.sh.aitoken.sdPlugin
rm -rf "$DEST"
cp -r com.sh.aitoken.sdPlugin "$DEST"
osascript -e 'tell application "Elgato Stream Deck" to quit'
sleep 2
open -a "Elgato Stream Deck"
```

---

## manifest.json 핵심 규칙

**`Nodejs` 필드가 없으면 Stream Deck이 Node.js로 실행하지 않는다.**

```json
{
  "Nodejs": {
    "Version": "20",
    "Debug": "enabled"
  },
  "CodePath": "bin/plugin.js"
}
```

Stream Deck은 Node.js 20을 번들로 포함하고 있음 (`NodeJS/20.20.0/node`).

---

## 액션 개발 패턴

```typescript
@action({ UUID: "com.sh.aitoken.myaction" })
export class MyAction extends SingletonAction<MySettings> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private actionId = "";

  override onWillAppear(ev) {
    this.actionId = ev.action.id;
    this.updateDisplay();
    this.intervalId = setInterval(() => this.updateDisplay(), INTERVAL_MS);
  }

  override onWillDisappear(_ev) {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  override onDidReceiveSettings(ev) { /* 설정 변경 시 interval 재설정 */ }
  override onKeyDown(_ev)           { this.updateDisplay(); /* 즉시 갱신 */ }
}
```

- `SingletonAction`: 버튼 1개만 존재할 때 사용
- `streamDeck.actions.getActionById(id)` — onWillAppear 이후에만 유효
- Settings 타입은 반드시 `[key: string]: JsonValue` index signature 포함

---

## SVG 버튼 렌더링

Stream Deck은 144×144px 이미지를 `action.setImage(dataUrl)`로 받음.

```typescript
await action.setImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
await action.setTitle(""); // 기본 타이틀 숨김
```

---

## 외부 API 인증

| 서비스 | 토큰 위치 | 읽는 방법 |
|--------|-----------|-----------|
| Claude | macOS Keychain `Claude Code-credentials` | `security find-generic-password -s "Claude Code-credentials" -w` |
| Codex  | `~/.codex/auth.json` → `tokens.access_token` | fs.readFileSync |
| Slack  | Property Inspector에서 직접 입력 (xoxp-...) | settings.token |

---

## Rate Limit 대응

- API 호출 시 **429 응답이면 이전 캐시값 반환** (화면 유지)
- Claude/Codex 기본 폴링 간격: **5분** (Property Inspector에서 변경 가능)
- Slack 폴링 간격: **10초** 고정

---

## 디버깅

```bash
# 플러그인 연결 확인
grep "aitoken" ~/Library/Logs/ElgatoStreamDeck/StreamDeck.log | tail -5

# Stream Deck Node로 직접 실행 테스트
PLUGIN="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/com.sh.aitoken.sdPlugin"
NODE="$HOME/Library/Application Support/com.elgato.StreamDeck/NodeJS/20.20.0/node"
(cd "$PLUGIN" && "$NODE" ./bin/plugin.js)
```

---

## 새 액션 추가 체크리스트

1. `src/actions/myAction.ts` 작성
2. `src/plugin.ts`에 `registerAction` 추가
3. `manifest.json` Actions 배열에 UUID 등록
4. `com.sh.aitoken.sdPlugin/imgs/actions/myaction/icon.svg` 추가
5. `com.sh.aitoken.sdPlugin/inspector/myaction.html` 작성
6. `npm run build` → 설치 스크립트 실행
