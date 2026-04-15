import { action } from "@elgato/streamdeck";
import { SystemSample } from "../utils/systemStats.js";
import { BaseChartAction } from "./baseChartAction.js";

@action({ UUID: "com.sh.aitoken.cpu" })
export class CpuAction extends BaseChartAction {
  protected readonly label = "CPU";
  protected readonly accentColor = "#00ff88";
  protected getStat(s: SystemSample): number { return s.cpuPercent; }
}
