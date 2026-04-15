import {
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
  KeyDownEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { startPolling, stopPolling, getSamples, getLatest, SystemSample } from "../utils/systemStats.js";
import { renderChartSvg } from "../utils/renderChart.js";
import { svgToDataUrl } from "../utils/svgUtils.js";

type WindowOption = "30s" | "1m" | "2m";

export interface ChartSettings {
  window?: WindowOption;
  [key: string]: JsonValue;
}

const WINDOW_MS: Record<WindowOption, number> = {
  "30s": 30_000,
  "1m": 60_000,
  "2m": 120_000,
};

export abstract class BaseChartAction extends SingletonAction<ChartSettings> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentWindow: WindowOption = "1m";
  private act: KeyAction<ChartSettings> | null = null;

  protected abstract readonly label: string;
  protected abstract readonly accentColor: string;
  protected abstract getStat(sample: SystemSample): number;

  override onWillAppear(ev: WillAppearEvent<ChartSettings>): void {
    if (!ev.action.isKey()) return;
    this.act = ev.action;
    this.currentWindow = (ev.payload.settings.window ?? "1m") as WindowOption;
    startPolling();
    this.updateDisplay();
    this.intervalId = setInterval(() => this.updateDisplay(), 5_000);
  }

  override onWillDisappear(_ev: WillDisappearEvent<ChartSettings>): void {
    this.act = null;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    stopPolling();
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ChartSettings>): void {
    this.currentWindow = (ev.payload.settings.window ?? "1m") as WindowOption;
    this.updateDisplay();
  }

  override onKeyDown(_ev: KeyDownEvent<ChartSettings>): void {
    this.updateDisplay();
  }

  private updateDisplay(): void {
    if (!this.act) return;
    const windowMs = WINDOW_MS[this.currentWindow] ?? WINDOW_MS["1m"];
    const latest = getLatest();
    const current = latest ? this.getStat(latest) : 0;
    const history = getSamples(windowMs).map((s) => this.getStat(s));

    const svg = renderChartSvg({
      label: this.label,
      samples: history.length > 0 ? history : [0],
      current,
      accentColor: this.accentColor,
    });

    this.act.setImage(svgToDataUrl(svg)).catch(() => {});
    this.act.setTitle("").catch(() => {});
  }
}
