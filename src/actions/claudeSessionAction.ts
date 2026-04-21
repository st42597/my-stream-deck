import streamDeck, {
  action,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
  KeyDownEvent,
  SendToPluginEvent,
} from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { getSessionAtSlot } from "../utils/claudeSessions.js";
import { renderClaudeSessionSvg } from "../utils/renderClaudeSession.js";
import { svgToDataUrl } from "../utils/svgUtils.js";
import { installHooksResult } from "../utils/installClaudeHooks.js";
import { focusSession } from "../utils/focusTerminal.js";

interface ClaudeSessionSettings {
  slot?: number;
  [k: string]: JsonValue;
}

interface Instance {
  act: KeyAction<ClaudeSessionSettings>;
  slot: number;
}

const POLL_MS = 1_000;

@action({ UUID: "com.sh.aitoken.claudesession" })
export class ClaudeSessionAction extends SingletonAction<ClaudeSessionSettings> {
  private instances = new Map<string, Instance>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private pulsePhase = 0;

  override onWillAppear(ev: WillAppearEvent<ClaudeSessionSettings>): void {
    if (!ev.action.isKey()) return;
    this.instances.set(ev.action.id, {
      act: ev.action,
      slot: Math.max(0, Math.floor(ev.payload.settings.slot ?? 0)),
    });
    this.renderInstance(ev.action.id);
    this.ensureTimer();
  }

  override onWillDisappear(ev: WillDisappearEvent<ClaudeSessionSettings>): void {
    this.instances.delete(ev.action.id);
    if (this.instances.size === 0 && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  override onDidReceiveSettings(ev: DidReceiveSettingsEvent<ClaudeSessionSettings>): void {
    const inst = this.instances.get(ev.action.id);
    if (!inst) return;
    inst.slot = Math.max(0, Math.floor(ev.payload.settings.slot ?? 0));
    this.renderInstance(ev.action.id);
  }

  override onKeyDown(ev: KeyDownEvent<ClaudeSessionSettings>): void {
    const inst = this.instances.get(ev.action.id);
    if (!inst) return;
    const session = getSessionAtSlot(inst.slot);
    if (!session) return;
    focusSession(session);
    this.renderInstance(ev.action.id);
  }

  override onSendToPlugin(ev: SendToPluginEvent<JsonValue, ClaudeSessionSettings>): Promise<void> | void {
    const payload = ev.payload as { action?: string } | undefined;
    if (payload?.action !== "installHooks") return;
    try {
      const result = installHooksResult();
      streamDeck.logger.info(`[ClaudeSession] hooks installed: ${result.installed.join(",")} skipped: ${result.skipped.join(",")}`);
      return streamDeck.ui.sendToPropertyInspector({
        event: "installHooksResult",
        installed: result.installed,
        skipped: result.skipped,
        hookPath: result.hookPath,
      });
    } catch (err) {
      streamDeck.logger.error(`[ClaudeSession] install failed: ${err}`);
      return streamDeck.ui.sendToPropertyInspector({
        event: "installHooksResult",
        error: String(err),
      });
    }
  }

  private ensureTimer(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(() => {
      this.pulsePhase = (this.pulsePhase + 0.25) % 1;
      for (const id of this.instances.keys()) this.renderInstance(id);
    }, POLL_MS);
  }

  private renderInstance(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    const session = getSessionAtSlot(inst.slot);
    const svg = renderClaudeSessionSvg({
      slot: inst.slot,
      state: session?.state ?? "empty",
      project: session?.project ?? "",
      tool: session?.tool ?? "",
      pulsePhase: Math.sin(this.pulsePhase * Math.PI * 2) * 0.5 + 0.5,
    });
    inst.act.setImage(svgToDataUrl(svg)).catch(() => {});
    inst.act.setTitle("").catch(() => {});
  }
}
