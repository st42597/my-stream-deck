# my-stream-deck

개발 환경에서 자주 확인하는 정보들을 Stream Deck 버튼 하나에서 실시간으로 모니터링하기 위해 만든 개인용 플러그인입니다.

Claude Code와 Codex를 매일 쓰면서 rate limit에 걸리기 전까지 사용량을 파악하기 어려웠고, CPU/RAM 상태나 Slack 알림도 매번 앱을 전환해서 확인해야 했습니다. 이 플러그인은 그 모든 정보를 Stream Deck 위에 올려두고 한눈에 볼 수 있게 만든 결과물입니다.

---

## 기능

### Claude Code / Codex 토큰 사용량
- Anthropic OAuth API / ChatGPT API에서 직접 사용률(%)을 가져옴
- 5시간 롤링 윈도우 기준 (실제 rate limit 윈도우와 동일)
- 바닥에서 위로 차오르는 fill UI로 직관적으로 표시
- 리셋까지 남은 시간 표시 (`↺ 2h 30m`)
- 85% 이상이면 빨간색으로 경고
- 토큰 읽기: Claude는 macOS Keychain, Codex는 `~/.codex/auth.json` 자동 사용 (별도 설정 불필요)

### CPU / RAM 모니터
- Apple Silicon Mac 전용
- 선택한 시간 범위(30s / 1m / 2m)의 area chart를 배경으로 표시
- RAM은 Activity Monitor 메모리 압력 그래프와 동일한 값 (`memory_pressure` 기반)
- 5초 간격 자동 갱신

### Slack 알림
- 멘션 / DM 알림 수 표시 (Slack "내 활동" 기준)
- 버튼 클릭 시 가장 최신 미읽음 채널/DM을 Slack 앱에서 직접 열기
- 여러 번 클릭 시 미읽음 채널을 최신순으로 순환
- 미읽음 없으면 클릭해도 반응 없음

---

## 설치

### 요구사항
- macOS (Apple Silicon 권장)
- Node.js 20+
- Stream Deck 앱 6.0+
- Claude Code 로그인 상태
- Codex CLI 로그인 상태 (`~/.codex/auth.json` 존재)

### 빌드 및 설치

```bash
git clone https://github.com/st42597/my-stream-deck.git
cd my-stream-deck
npm install
npm run build

# Stream Deck에 설치
DEST=~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.sh.aitoken.sdPlugin
rm -rf "$DEST"
cp -r com.sh.aitoken.sdPlugin "$DEST"

# Stream Deck 앱 재시작
osascript -e 'tell application "Elgato Stream Deck" to quit'
sleep 2
open -a "Elgato Stream Deck"
```

Stream Deck 앱 왼쪽 패널 **AI Tools** 카테고리에서 원하는 버튼을 드래그해서 추가하면 됩니다.

### Slack 설정

Slack 버튼은 User OAuth Token 입력이 필요합니다.

1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App
2. OAuth & Permissions → User Token Scopes 추가: `channels:read`, `groups:read`, `im:read`, `mpim:read`
3. Install to Workspace → User OAuth Token (`xoxp-...`) 복사
4. Stream Deck에서 Slack 버튼 우클릭 → Edit → Token 입력

---

## 구조

```
src/
├── actions/          # Stream Deck 액션 (버튼 1개 = 액션 1개)
└── utils/            # 데이터 수집 + SVG 렌더링

com.sh.aitoken.sdPlugin/
├── manifest.json
├── imgs/             # 버튼 아이콘
└── inspector/        # 설정 UI (Property Inspector)
```

자세한 내용은 [`CLAUDE.md`](./CLAUDE.md)와 [`docs/`](./docs/) 참고.

---

## 기술 스택

- TypeScript + Rollup
- [@elgato/streamdeck](https://github.com/elgatosf/streamdeck) SDK v2
- Anthropic OAuth API, ChatGPT wham/usage API, Slack Web API
