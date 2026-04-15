import {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { startSlackPolling, stopSlackPolling, getSlackStats, getNextNotification } from "../utils/slackNotifications.js";
import { renderSlackSvg } from "../utils/renderSlack.js";
import { svgToDataUrl } from "../utils/svgUtils.js";
import { execFile } from "child_process";

interface SlackSettings {
  token?: string;
  [key: string]: JsonValue;
}

@action({ UUID: "com.sh.aitoken.slack" })
export class SlackAction extends SingletonAction<SlackSettings> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentToken = "";
  private act: KeyAction<SlackSettings> | null = null;

  override onWillAppear(ev: WillAppearEvent<SlackSettings>): void {
    if (!ev.action.isKey()) return;
    this.act = ev.action;
    this.currentToken = (ev.payload.settings.token as string) ?? "";
    if (this.currentToken) startSlackPolling(this.currentToken);
    this.updateDisplay();
    this.intervalId = setInterval(() => this.updateDisplay(), 5_000);
  }

  override onWillDisappear(_ev: WillDisappearEvent<SlackSettings>): void {
    this.act = null;
    if (this.intervalId !== null) { clearInterval(this.intervalId); this.intervalId = null; }
    if (this.currentToken) stopSlackPolling();
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SlackSettings>): void {
    const newToken = (ev.payload.settings.token as string) ?? "";
    if (newToken !== this.currentToken) {
      if (this.currentToken) stopSlackPolling();
      this.currentToken = newToken;
      if (newToken) startSlackPolling(newToken);
    }
    this.updateDisplay();
  }

  override onKeyDown(_ev: KeyDownEvent<SlackSettings>): void {
    if (!this.currentToken) return;
    const next = getNextNotification();
    if (!next) return;
    execFile("open", [`slack://channel?id=${next.channelId}&team=`], () => {});
  }

  private updateDisplay(): void {
    if (!this.act) return;
    const stats = getSlackStats();
    const svg = renderSlackSvg({ count: stats.totalCount, hasToken: !!this.currentToken, error: stats.error });
    this.act.setImage(svgToDataUrl(svg)).catch(() => {});
    this.act.setTitle("").catch(() => {});
  }
}
