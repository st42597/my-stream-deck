import fs from "fs";
import path from "path";
import os from "os";

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const PLUGIN_HOOK_PATH = path.join(
  os.homedir(),
  "Library", "Application Support", "com.elgato.StreamDeck",
  "Plugins", "com.sh.aitoken.sdPlugin", "hooks", "streamdeck-notify.py",
);

const EVENTS = [
  "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse",
  "SubagentStop", "Stop", "Notification", "PreCompact",
] as const;

interface HookCmd { type: string; command: string; }
interface HookEntry { matcher?: string; hooks: HookCmd[]; }
interface Settings { hooks?: Record<string, HookEntry[]>; [k: string]: unknown; }

function commandFor(event: string): string {
  return `${JSON.stringify(PLUGIN_HOOK_PATH)} ${event}`;
}

function entryMatches(entry: HookEntry, event: string): boolean {
  return entry.hooks.some((h) => h.command.includes("streamdeck-notify.py") && h.command.includes(` ${event}`));
}

export function installHooksResult(): { installed: string[]; skipped: string[]; hookPath: string } {
  let settings: Settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Settings;
  } catch { /* fresh file */ }

  if (!settings.hooks) settings.hooks = {};
  const installed: string[] = [];
  const skipped: string[] = [];

  for (const event of EVENTS) {
    const list = settings.hooks[event] ?? [];
    if (list.some((entry) => entryMatches(entry, event))) {
      skipped.push(event);
      continue;
    }
    list.push({
      matcher: "*",
      hooks: [{ type: "command", command: commandFor(event) }],
    });
    settings.hooks[event] = list;
    installed.push(event);
  }

  try { fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true }); } catch {}
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));

  try { fs.chmodSync(PLUGIN_HOOK_PATH, 0o755); } catch {}

  return { installed, skipped, hookPath: PLUGIN_HOOK_PATH };
}

export function uninstallHooksResult(): { removed: string[] } {
  let settings: Settings;
  try { settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) as Settings; }
  catch { return { removed: [] }; }
  if (!settings.hooks) return { removed: [] };
  const removed: string[] = [];
  for (const event of EVENTS) {
    const list = settings.hooks[event];
    if (!list) continue;
    const filtered = list
      .map((entry) => ({ ...entry, hooks: entry.hooks.filter((h) => !h.command.includes("streamdeck-notify.py")) }))
      .filter((entry) => entry.hooks.length > 0);
    if (filtered.length !== list.length || filtered.some((e, i) => e.hooks.length !== list[i].hooks.length)) {
      removed.push(event);
    }
    if (filtered.length === 0) delete settings.hooks[event];
    else settings.hooks[event] = filtered;
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  return { removed };
}
