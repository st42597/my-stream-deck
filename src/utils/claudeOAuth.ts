import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import streamDeck from "@elgato/streamdeck";
import { httpsGet } from "./httpClient.js";

const execFileAsync = promisify(execFile);
const CACHE_FILE = path.join(os.tmpdir(), "aitoken-claude.json");

export interface ClaudeUsageWindow {
  utilization: number;  // 0-100
  resetsAt: Date | null;
}

export interface ClaudeUsageResult {
  fiveHour: ClaudeUsageWindow | null;
  sevenDay: ClaudeUsageWindow | null;
}

async function getAccessToken(): Promise<string> {
  const { stdout } = await execFileAsync("security", [
    "find-generic-password", "-s", "Claude Code-credentials", "-w",
  ]);
  const creds = JSON.parse(stdout.trim()) as { claudeAiOauth: { accessToken: string } };
  return creds.claudeAiOauth.accessToken;
}

let cachedResult: ClaudeUsageResult | null = loadCache();
let cooldownUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;

function loadCache(): ClaudeUsageResult | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const data = JSON.parse(raw) as {
      fiveHour: { utilization: number; resetsAt: string | null } | null;
      sevenDay: { utilization: number; resetsAt: string | null } | null;
    };
    return {
      fiveHour: data.fiveHour ? { utilization: data.fiveHour.utilization, resetsAt: data.fiveHour.resetsAt ? new Date(data.fiveHour.resetsAt) : null } : null,
      sevenDay: data.sevenDay ? { utilization: data.sevenDay.utilization, resetsAt: data.sevenDay.resetsAt ? new Date(data.sevenDay.resetsAt) : null } : null,
    };
  } catch { return null; }
}

function saveCache(r: ClaudeUsageResult): void {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(r)); } catch {}
}

export async function fetchClaudeUsage(): Promise<ClaudeUsageResult> {
  if (Date.now() < cooldownUntil) {
    return cachedResult ?? { fiveHour: null, sevenDay: null };
  }
  const token = await getAccessToken();
  const { body, status } = await httpsGet("api.anthropic.com", "/api/oauth/usage", {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "anthropic-beta": "oauth-2025-04-20",
    "User-Agent": "claude-code/2.1.109",
  });

  if (status === 429) {
    cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    streamDeck.logger.warn(`[claudeOAuth] 429 — cooldown ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
    return cachedResult ?? { fiveHour: null, sevenDay: null };
  }
  if (status !== 200) {
    streamDeck.logger.warn(`[claudeOAuth] status=${status} body=${body.slice(0, 200)}`);
    return cachedResult ?? { fiveHour: null, sevenDay: null };
  }

  const data = JSON.parse(body) as {
    five_hour?: { utilization?: number; resets_at?: string } | null;
    seven_day?: { utilization?: number; resets_at?: string } | null;
  };

  cachedResult = {
    fiveHour: parseWindow(data.five_hour),
    sevenDay: parseWindow(data.seven_day),
  };
  saveCache(cachedResult);
  return cachedResult;
}

function parseWindow(w: { utilization?: number; resets_at?: string } | null | undefined): ClaudeUsageWindow | null {
  if (!w) return null;
  return {
    utilization: w.utilization ?? 0,
    resetsAt: w.resets_at ? new Date(w.resets_at) : null,
  };
}
