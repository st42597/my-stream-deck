import fs from "fs";
import path from "path";
import os from "os";
import { httpsGet } from "./httpClient.js";

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

let cachedResult: CodexUsageResult | null = null;

export async function fetchCodexUsage(): Promise<CodexUsageResult> {
  const { accessToken, accountId } = readAuth();
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "User-Agent": "CodexBar",
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  const { body, status } = await httpsGet("chatgpt.com", "/backend-api/wham/usage", headers);

  if (status === 429) return cachedResult ?? { planType: "unknown", primaryWindow: null, secondaryWindow: null };

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
