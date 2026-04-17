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
} from "../utils/slackDockBadge.js";
import { renderSlackSvg } from "../utils/renderSlack.js";
import { svgToDataUrl } from "../utils/svgUtils.js";

interface SlackSettings {
  [key: string]: JsonValue;
}

const JUMP_NEXT_UNREAD_SCRIPT = `
tell application "Slack" to activate
delay 0.25
tell application "System Events"
  tell process "Slack"
    key code 125 using {option down, shift down}
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
    execFile("osascript", ["-e", JUMP_NEXT_UNREAD_SCRIPT], () => {});
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
