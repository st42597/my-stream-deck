import { action } from "@elgato/streamdeck";
import { fetchCodexUsage } from "../utils/codexOAuth.js";
import { renderButtonSvg, formatResetsIn } from "../utils/renderButton.js";
import { svgToDataUrl } from "../utils/svgUtils.js";
import { BasePollingAction, PollingSettings } from "./basePollingAction.js";

@action({ UUID: "com.sh.aitoken.codex" })
export class CodexAction extends BasePollingAction<PollingSettings> {
  protected async updateDisplay(): Promise<void> {
    if (!this.action) return;
    try {
      const { primaryWindow } = await fetchCodexUsage();
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CODEX",
        percent: primaryWindow?.usedPercent ?? 0,
        resetsIn: formatResetsIn(primaryWindow?.resetAt ?? null),
        accentColor: "#10a37f",
      })));
      await this.action.setTitle("");
    } catch {
      await this.action.setImage(svgToDataUrl(renderButtonSvg({
        label: "CODEX", percent: 0, resetsIn: "", accentColor: "#10a37f", error: true,
      })));
    }
  }
}
