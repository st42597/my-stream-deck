import {
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
  KeyDownEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";

export interface PollingSettings {
  refreshSeconds?: number;
  [key: string]: JsonValue;
}

const DEFAULT_REFRESH_SEC = 300;

export abstract class BasePollingAction<S extends PollingSettings> extends SingletonAction<S> {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private refreshSec = DEFAULT_REFRESH_SEC;
  protected action: KeyAction<S> | null = null;

  override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
    if (!ev.action.isKey()) return;
    this.action = ev.action;
    this.refreshSec = ev.payload.settings.refreshSeconds ?? DEFAULT_REFRESH_SEC;
    await this.updateDisplay();
    this.startInterval();
  }

  override onWillDisappear(_ev: WillDisappearEvent<S>): void {
    this.action = null;
    this.stopInterval();
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
    const newSec = ev.payload.settings.refreshSeconds ?? DEFAULT_REFRESH_SEC;
    if (newSec !== this.refreshSec) {
      this.refreshSec = newSec;
      this.stopInterval();
      this.startInterval();
    }
    await this.updateDisplay();
  }

  override async onKeyDown(_ev: KeyDownEvent<S>): Promise<void> {
    await this.updateDisplay();
  }

  private startInterval(): void {
    if (this.refreshSec <= 0) return;
    this.intervalId = setInterval(() => { this.updateDisplay().catch(() => {}); }, this.refreshSec * 1_000);
  }

  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  protected abstract updateDisplay(): Promise<void>;
}
