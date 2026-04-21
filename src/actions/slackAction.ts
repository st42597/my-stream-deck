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
import streamDeck from "@elgato/streamdeck";
import { renderSlackSvg } from "../utils/renderSlack.js";

interface SlackSettings {
  [key: string]: JsonValue;
}

const POLL_MS = 5_000;

// Activate Slack and send ⌘⇧M (Activity). key code 46 = "m";
// raw key code bypasses keyboard-layout remapping.
const OPEN_SCRIPT = `
tell application "Slack" to activate
tell application "System Events"
  tell process "Slack"
    set frontmost to true
    repeat 60 times
      if frontmost then exit repeat
      delay 0.05
    end repeat
  end tell
  delay 0.15
  key code 46 using {command down, shift down}
end tell
`;

// Read Slack's Dock badge. "3" = mention count, "•" = silent unread,
// empty/missing = no unread.
const BADGE_SCRIPT = `
tell application "System Events"
  tell process "Dock"
    try
      return value of attribute "AXStatusLabel" of UI element "Slack" of list 1
    on error
      return ""
    end try
  end tell
end tell
`;

type Badge = { count: number; silent: boolean };

function readBadge(): Promise<Badge> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", BADGE_SCRIPT], { timeout: 3_000 }, (err, stdout) => {
      if (err) return resolve({ count: 0, silent: false });
      const raw = String(stdout).trim();
      if (!raw) return resolve({ count: 0, silent: false });
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) return resolve({ count: n, silent: false });
      resolve({ count: 0, silent: true });
    });
  });
}

@action({ UUID: "com.sh.aitoken.slack" })
export class SlackAction extends SingletonAction<SlackSettings> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private act: KeyAction<SlackSettings> | null = null;

  override onWillAppear(ev: WillAppearEvent<SlackSettings>): void {
    if (!ev.action.isKey()) return;
    this.act = ev.action;
    this.refresh();
    this.intervalId = setInterval(() => this.refresh(), POLL_MS);
  }

  override onWillDisappear(_ev: WillDisappearEvent<SlackSettings>): void {
    this.act = null;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  override onKeyDown(_ev: KeyDownEvent<SlackSettings>): void {
    execFile("osascript", ["-e", OPEN_SCRIPT], (err, _stdout, stderr) => {
      if (err) {
        streamDeck.logger.warn(`[slack] open err=${err.message} stderr=${String(stderr).trim()}`);
      }
    });
    // Re-poll a bit later — activity open usually clears unreads.
    setTimeout(() => this.refresh(), 1_500);
  }

  private async refresh(): Promise<void> {
    if (!this.act) return;
    const badge = await readBadge();
    if (!this.act) return;
    const svg = renderSlackSvg(badge);
    const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    this.act.setImage(url).catch(() => {});
    this.act.setTitle("").catch(() => {});
  }
}
