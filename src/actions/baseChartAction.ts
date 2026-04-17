import {
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
  KeyDownEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { startPolling, stopPolling, setPollingInterval, getSamples, getLatest, SystemSample } from "../utils/systemStats.js";
import { renderChartSvg } from "../utils/renderChart.js";
import { svgToDataUrl } from "../utils/svgUtils.js";

type WindowOption = "30s" | "1m" | "2m";

export interface ChartSettings {
  window?: WindowOption;
  intervalSec?: number;
  [key: string]: JsonValue;
}

const DEFAULT_INTERVAL_SEC = 5;
const MIN_INTERVAL_SEC = 1;
const MAX_INTERVAL_SEC = 60;

function clampIntervalSec(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL_SEC;
  return Math.max(MIN_INTERVAL_SEC, Math.min(MAX_INTERVAL_SEC, Math.round(n)));
}

const WINDOW_MS: Record<WindowOption, number> = {
  "30s": 30_000,
  "1m": 60_000,
  "2m": 120_000,
};

export abstract class BaseChartAction extends SingletonAction<ChartSettings> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentWindow: WindowOption = "1m";
  private currentIntervalSec: number = DEFAULT_INTERVAL_SEC;
  private act: KeyAction<ChartSettings> | null = null;

  protected abstract readonly label: string;
  protected abstract readonly accentColor: string;
  protected abstract getStat(sample: SystemSample): number;

  override onWillAppear(ev: WillAppearEvent<ChartSettings>): void {
    if (!ev.action.isKey()) return;
    this.act = ev.action;
    this.currentWindow = (ev.payload.settings.window ?? "1m") as WindowOption;
    this.currentIntervalSec = clampIntervalSec(ev.payload.settings.intervalSec);
    setPollingInterval(this.currentIntervalSec * 1000);
    startPolling();
    this.updateDisplay();
    this.intervalId = setInterval(() => this.updateDisplay(), this.currentIntervalSec * 1000);
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
    const newIntervalSec = clampIntervalSec(ev.payload.settings.intervalSec);
    if (newIntervalSec !== this.currentIntervalSec) {
      this.currentIntervalSec = newIntervalSec;
      setPollingInterval(newIntervalSec * 1000);
      if (this.intervalId !== null) clearInterval(this.intervalId);
      this.intervalId = setInterval(() => this.updateDisplay(), newIntervalSec * 1000);
    }
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
