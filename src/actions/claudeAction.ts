import streamDeck, { action, KeyDownEvent } from "@elgato/streamdeck";
import { fetchClaudeUsage } from "../utils/claudeOAuth.js";
import { renderButtonSvg, formatResetsIn } from "../utils/renderButton.js";
import { svgToDataUrl } from "../utils/svgUtils.js";
import { BasePollingAction, PollingSettings } from "./basePollingAction.js";

type View = "5H" | "7D";

@action({ UUID: "com.sh.aitoken.claude" })
export class ClaudeAction extends BasePollingAction<PollingSettings> {
  private view: View = "5H";

  override async onKeyDown(_ev: KeyDownEvent<PollingSettings>): Promise<void> {
    this.view = this.view === "5H" ? "7D" : "5H";
    await this.updateDisplay();
  }

  protected async updateDisplay(): Promise<void> {
    if (!this.action) return;
    try {
      const { fiveHour, sevenDay } = await fetchClaudeUsage();
      const window = this.view === "5H" ? fiveHour : sevenDay;
      const resets = formatResetsIn(window?.resetsAt ?? null);
      streamDeck.logger.info(`[ClaudeAction] view=${this.view} pct=${window?.utilization} resets=${resets} (5h=${fiveHour?.utilization} 7d=${sevenDay?.utilization})`);
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CLAUDE",
        percent: window?.utilization ?? 0,
        resetsIn: resets ? `↺ ${resets}` : "",
        accentColor: "#cc785c",
      })));
      await this.action.setTitle("");
    } catch (err) {
      streamDeck.logger.error(`[ClaudeAction] fetch failed: ${err}`);
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CLAUDE", percent: 0, resetsIn: "", accentColor: "#cc785c", error: true,
      })));
    }
  }
}
