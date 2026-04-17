import fs from "fs";
import path from "path";
import os from "os";
import { httpsGet } from "./httpClient.js";

const CACHE_FILE = path.join(os.tmpdir(), "aitoken-codex.json");

export interface CodexUsageWindow {
  usedPercent: number;
  resetAt: Date | null;
  windowSeconds: number;
}

export interface CodexUsageResult {
  primaryWindow: CodexUsageWindow | null;
  secondaryWindow: CodexUsageWindow | null;
  planType: string;
}

interface AuthFile {
  tokens?: { access_token?: string; account_id?: string };
}

function readAuth(): { accessToken: string; accountId: string } {
  const raw = fs.readFileSync(path.join(os.homedir(), ".codex", "auth.json"), "utf8");
  const data = JSON.parse(raw) as AuthFile;
  const accessToken = data.tokens?.access_token ?? "";
  if (!accessToken) throw new Error("No Codex access token found in ~/.codex/auth.json");
  return { accessToken, accountId: data.tokens?.account_id ?? "" };
}

let cachedResult: CodexUsageResult | null = loadCache();
let cooldownUntil = 0;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;

function loadCache(): CodexUsageResult | null {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const data = JSON.parse(raw) as {
      planType: string;
      primaryWindow: { usedPercent: number; resetAt: string | null; windowSeconds: number } | null;
      secondaryWindow: { usedPercent: number; resetAt: string | null; windowSeconds: number } | null;
    };
    const rehydrate = (w: { usedPercent: number; resetAt: string | null; windowSeconds: number } | null) =>
      w ? { usedPercent: w.usedPercent, resetAt: w.resetAt ? new Date(w.resetAt) : null, windowSeconds: w.windowSeconds } : null;
    return { planType: data.planType, primaryWindow: rehydrate(data.primaryWindow), secondaryWindow: rehydrate(data.secondaryWindow) };
  } catch { return null; }
}

function saveCache(r: CodexUsageResult): void {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(r)); } catch {}
}

export async function fetchCodexUsage(): Promise<CodexUsageResult> {
  if (Date.now() < cooldownUntil) {
    return cachedResult ?? { planType: "unknown", primaryWindow: null, secondaryWindow: null };
  }
  const { accessToken, accountId } = readAuth();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "User-Agent": "CodexBar",
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  const { body, status } = await httpsGet("chatgpt.com", "/backend-api/wham/usage", headers);

  if (status === 429) {
    cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    return cachedResult ?? { planType: "unknown", primaryWindow: null, secondaryWindow: null };
  }

  const data = JSON.parse(body) as {
    plan_type?: string;
    rate_limit?: {
      primary_window?: WindowRaw | null;
      secondary_window?: WindowRaw | null;
    };
  };

  cachedResult = {
    planType: data.plan_type ?? "unknown",
    primaryWindow: parseWindow(data.rate_limit?.primary_window),
    secondaryWindow: parseWindow(data.rate_limit?.secondary_window),
  };
  saveCache(cachedResult);
  return cachedResult;
}

interface WindowRaw {
  used_percent: number;
  reset_at: number;
  limit_window_seconds: number;
}

function parseWindow(w: WindowRaw | null | undefined): CodexUsageWindow | null {
  if (!w) return null;
  return {
    usedPercent: w.used_percent ?? 0,
    resetAt: w.reset_at ? new Date(w.reset_at * 1000) : null,
    windowSeconds: w.limit_window_seconds ?? 18000,
  };
}
