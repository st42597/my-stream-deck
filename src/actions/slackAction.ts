import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { execFile } from "child_process";
import {
  startBadgePolling,
  stopBadgePolling,
  getBadgeStatus,
  pollBadgeNow,
} from "../utils/slackDockBadge.js";
import { renderSlackSvg } from "../utils/renderSlack.js";
import { svgToDataUrl } from "../utils/svgUtils.js";

interface SlackSettings {
  [key: string]: JsonValue;
}

// Opens Slack's Activity view (⌘⇧M → 이동 > 내 활동) then jumps to the next
// unread channel/DM (⌥⇧↓). Uses raw key codes because Electron apps handle
// them more reliably than AppleScript `keystroke`.
const OPEN_LATEST_ACTIVITY_SCRIPT = `
tell application "Slack" to activate
delay 0.3
tell application "System Events"
  tell process "Slack"
    key code 46 using {command down, shift down}
    delay 0.15
    key code 126 using {option down, shift down}
  end tell
end tell
`;

@action({ UUID: "com.sh.aitoken.slack" })
export class SlackAction extends SingletonAction<SlackSettings> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private act: KeyAction<SlackSettings> | null = null;

  override onWillAppear(ev: WillAppearEvent<SlackSettings>): void {
    if (!ev.action.isKey()) return;
    this.act = ev.action;
    startBadgePolling();
    this.updateDisplay();
    this.intervalId = setInterval(() => this.updateDisplay(), 2_000);
  }

  override onWillDisappear(_ev: WillDisappearEvent<SlackSettings>): void {
    this.act = null;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    stopBadgePolling();
  }

  override onKeyDown(_ev: KeyDownEvent<SlackSettings>): void {
    execFile("osascript", ["-e", OPEN_LATEST_ACTIVITY_SCRIPT], () => {});
    for (let i = 1; i <= 4; i++) {
      setTimeout(() => {
        pollBadgeNow();
        this.updateDisplay();
      }, i * 500);
    }
  }

  private updateDisplay(): void {
    if (!this.act) return;
    const status = getBadgeStatus();
    const svg = renderSlackSvg({
      count: status.count,
      silent: status.silent,
      error: status.error,
    });
    this.act.setImage(svgToDataUrl(svg)).catch(() => {});
    this.act.setTitle("").catch(() => {});
  }
}
