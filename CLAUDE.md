# Stream Deck Plugin — AI Token Monitor

## Overview

macOS-only Stream Deck plugin that displays Claude Code, Codex, Slack notifications, and CPU/RAM status on buttons.

- Plugin ID: `com.sh.aitoken`
- SDK: `@elgato/streamdeck` v2 (Node.js)
- Language: TypeScript → Rollup bundle → ESM

---

## Directory Structure

```
my-stream-deck/
├── src/
│   ├── plugin.ts               # Entry point — register actions + connect
│   ├── actions/                # Stream Deck actions (1 button = 1 action)
│   │   ├── claudeAction.ts
│   │   ├── codexAction.ts
│   │   ├── cpuAction.ts
│   │   ├── ramAction.ts
│   │   └── slackAction.ts
│   └── utils/                  # Data collection + rendering
│       ├── claudeOAuth.ts      # Keychain → Anthropic API
│       ├── codexOAuth.ts       # ~/.codex/auth.json → ChatGPT API
│       ├── claudeTokens.ts     # JSONL parser (legacy fallback)
│       ├── codexTokens.ts      # SQLite parser (legacy fallback)
│       ├── slackNotifications.ts
│       ├── systemStats.ts      # CPU/RAM sampling
│       ├── renderButton.ts     # Claude/Codex SVG renderer
│       ├── renderChart.ts      # CPU/RAM area chart SVG renderer
│       └── renderSlack.ts      # Slack SVG renderer
├── com.sh.aitoken.sdPlugin/
│   ├── manifest.json           # ← Nodejs field required
│   ├── bin/plugin.js           # Build artifact (recommend git ignore)
│   ├── imgs/                   # Icon SVGs
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

## Build & Install

```bash
# Build
npm run build

# Install to Stream Deck (app restart required)
DEST=~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/com.sh.aitoken.sdPlugin
rm -rf "$DEST"
cp -r com.sh.aitoken.sdPlugin "$DEST"
osascript -e 'tell application "Elgato Stream Deck" to quit'
sleep 2
open -a "Elgato Stream Deck"
```

### Auto-Apply Rule (Claude Code)

When source changes occur in this repo and development is finished, Claude Code **automatically** performs the following without explicit user request:

1. `npm run build`
2. `rm -rf "$DEST" && cp -r com.sh.aitoken.sdPlugin "$DEST"`
3. Force restart Stream Deck: `pkill -f "Elgato Stream Deck"; sleep 2; open -a "Elgato Stream Deck"`

- If build fails, abort apply and report to the user
- Skip when only docs/comments are modified
- Use `pkill` instead of `osascript quit` (the latter triggers a user confirmation dialog)

---

## manifest.json Key Rule

**Without the `Nodejs` field, Stream Deck will not run the plugin under Node.js.**

```json
{
  "Nodejs": {
    "Version": "20",
    "Debug": "enabled"
  },
  "CodePath": "bin/plugin.js"
}
```

Stream Deck bundles Node.js 20 (`NodeJS/20.20.0/node`).

---

## Action Development Pattern

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

  override onDidReceiveSettings(ev) { /* Re-setup interval on settings change */ }
  override onKeyDown(_ev)           { this.updateDisplay(); /* Refresh immediately */ }
}
```

- `SingletonAction`: use when only a single button instance exists
- `streamDeck.actions.getActionById(id)` — valid only after `onWillAppear`
- Settings types must include `[key: string]: JsonValue` index signature

---

## SVG Button Rendering

Stream Deck accepts 144×144px images via `action.setImage(dataUrl)`.

```typescript
await action.setImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
await action.setTitle(""); // Hide default title
```

---

## External API Authentication

| Service | Token Location | How to Read |
|---------|----------------|-------------|
| Claude  | macOS Keychain `Claude Code-credentials` | `security find-generic-password -s "Claude Code-credentials" -w` |
| Codex   | `~/.codex/auth.json` → `tokens.access_token` | fs.readFileSync |
| Slack   | Entered directly in Property Inspector (xoxp-...) | settings.token |

---

## Rate Limit Handling

- On API calls: **return the previous cached value on 429** (keep UI unchanged)
- Claude/Codex default polling interval: **5 minutes** (configurable in Property Inspector)
- Slack polling interval: **10 seconds** (fixed)

---

## Debugging

```bash
# Check plugin connection
grep "aitoken" ~/Library/Logs/ElgatoStreamDeck/StreamDeck.log | tail -5

# Run directly with Stream Deck's bundled Node
PLUGIN="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/com.sh.aitoken.sdPlugin"
NODE="$HOME/Library/Application Support/com.elgato.StreamDeck/NodeJS/20.20.0/node"
(cd "$PLUGIN" && "$NODE" ./bin/plugin.js)
```

---

## New Action Checklist

1. Write `src/actions/myAction.ts`
2. Add `registerAction` call in `src/plugin.ts`
3. Register UUID in `manifest.json` Actions array
4. Add `com.sh.aitoken.sdPlugin/imgs/actions/myaction/icon.svg`
5. Write `com.sh.aitoken.sdPlugin/inspector/myaction.html`
6. Run `npm run build` → run install script
