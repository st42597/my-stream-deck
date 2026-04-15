import { action } from "@elgato/streamdeck";
import { fetchClaudeUsage } from "../utils/claudeOAuth.js";
import { renderButtonSvg, formatResetsIn } from "../utils/renderButton.js";
import { svgToDataUrl } from "../utils/svgUtils.js";
import { BasePollingAction, PollingSettings } from "./basePollingAction.js";

@action({ UUID: "com.sh.aitoken.claude" })
export class ClaudeAction extends BasePollingAction<PollingSettings> {
  protected async updateDisplay(): Promise<void> {
    if (!this.action) return;
    try {
      const { fiveHour } = await fetchClaudeUsage();
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CLAUDE",
        percent: fiveHour?.utilization ?? 0,
        resetsIn: formatResetsIn(fiveHour?.resetsAt ?? null),
        accentColor: "#cc785c",
      })));
      await this.action.setTitle("");
    } catch {
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CLAUDE", percent: 0, resetsIn: "", accentColor: "#cc785c", error: true,
      })));
    }
  }
}
