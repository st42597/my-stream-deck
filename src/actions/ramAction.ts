import { action } from "@elgato/streamdeck";
import { SystemSample } from "../utils/systemStats.js";
import { BaseChartAction } from "./baseChartAction.js";

@action({ UUID: "com.sh.aitoken.ram" })
export class RamAction extends BaseChartAction {
  protected readonly label = "RAM";
  protected readonly accentColor = "#ff9500";
  protected getStat(s: SystemSample): number { return s.ramPercent; }
}
