import fs from "fs";
import path from "path";
import os from "os";

const SESSIONS_DIR = path.join(os.homedir(), ".claude", "streamdeck");
const STOPPED_AFTER_MS = 30 * 60_000; // 30 min idle → stopped
const STALE_CLEANUP_MS = 24 * 60 * 60_000; // 24h → delete file

export type SessionState = "idle" | "thinking" | "running" | "approval" | "stopped";

export interface ClaudeSession {
  sessionId: string;
  cwd: string;
  project: string;
  state: SessionState;
  tool: string;
  message: string;
  event: string;
  updatedAt: number;
  ageMs: number;
  app: string;
  appPid: number;
  tty: string;
  claudePid: number;
}

interface RawRecord {
  sessionId?: string;
  cwd?: string;
  state?: string;
  tool?: string;
  message?: string;
  event?: string;
  updatedAt?: number;
  app?: string;
  appPid?: number;
  tty?: string;
  claudePid?: number;
}

const CACHE_TTL_MS = 500;
let cached: { at: number; sessions: ClaudeSession[] } | null = null;

function isPidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (err) { return (err as NodeJS.ErrnoException).code === "EPERM"; }
}

export function readSessions(): ClaudeSession[] {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.sessions;
  let entries: string[];
  try { entries = fs.readdirSync(SESSIONS_DIR); } catch { cached = { at: Date.now(), sessions: [] }; return []; }
  const now = Date.now();
  const out: ClaudeSession[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const full = path.join(SESSIONS_DIR, name);
    let raw: RawRecord;
    try { raw = JSON.parse(fs.readFileSync(full, "utf8")) as RawRecord; } catch { continue; }
    const updatedAt = typeof raw.updatedAt === "number" ? raw.updatedAt : 0;
    const ageMs = now - updatedAt;
    if (ageMs > STALE_CLEANUP_MS) { try { fs.unlinkSync(full); } catch {} continue; }
    const baseState = (raw.state as SessionState) ?? "idle";
    const claudePid = raw.claudePid ?? 0;
    const pidAlive = claudePid > 0 ? isPidAlive(claudePid) : true;
    const state: SessionState =
      !pidAlive ? "stopped" :
      baseState === "approval" ? "approval" :
      ageMs > STOPPED_AFTER_MS ? "stopped" :
      baseState;
    const cwd = raw.cwd ?? "";
    out.push({
      sessionId: raw.sessionId ?? "",
      cwd,
      project: cwd ? path.basename(cwd) : "",
      state,
      tool: raw.tool ?? "",
      message: raw.message ?? "",
      event: raw.event ?? "",
      updatedAt,
      ageMs,
      app: raw.app ?? "",
      appPid: raw.appPid ?? 0,
      tty: raw.tty ?? "",
      claudePid: raw.claudePid ?? 0,
    });
  }
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  cached = { at: now, sessions: out };
  return out;
}

export function getSessionAtSlot(slot: number): ClaudeSession | null {
  const sessions = readSessions().filter((s) => s.state !== "stopped");
  if (slot < 0 || slot >= sessions.length) return null;
  return sessions[slot];
}

export { SESSIONS_DIR };
