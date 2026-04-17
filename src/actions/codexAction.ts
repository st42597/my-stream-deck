import streamDeck, { action, KeyDownEvent } from "@elgato/streamdeck";
import { fetchCodexUsage } from "../utils/codexOAuth.js";
import { renderButtonSvg, formatResetsIn } from "../utils/renderButton.js";
import { svgToDataUrl } from "../utils/svgUtils.js";
import { BasePollingAction, PollingSettings } from "./basePollingAction.js";

type View = "5H" | "7D";

@action({ UUID: "com.sh.aitoken.codex" })
export class CodexAction extends BasePollingAction<PollingSettings> {
  private view: View = "5H";

  override async onKeyDown(_ev: KeyDownEvent<PollingSettings>): Promise<void> {
    this.view = this.view === "5H" ? "7D" : "5H";
    await this.updateDisplay();
  }

  protected async updateDisplay(): Promise<void> {
    if (!this.action) return;
    try {
      const { primaryWindow, secondaryWindow } = await fetchCodexUsage();
      const window = this.view === "5H" ? primaryWindow : secondaryWindow;
      const resets = formatResetsIn(window?.resetAt ?? null);
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CODEX",
        percent: window?.usedPercent ?? 0,
        resetsIn: resets ? `↺ ${resets}` : "",
        accentColor: "#10a37f",
      })));
      await this.action.setTitle("");
    } catch (err) {
      streamDeck.logger.error(`[CodexAction] fetch failed: ${err}`);
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CODEX", percent: 0, resetsIn: "", accentColor: "#10a37f", error: true,
      })));
    }
  }
}
