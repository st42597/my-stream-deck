import { execFile } from "child_process";
import { promisify } from "util";
import { httpsGet } from "./httpClient.js";

const execFileAsync = promisify(execFile);

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

let cachedResult: ClaudeUsageResult | null = null;

export async function fetchClaudeUsage(): Promise<ClaudeUsageResult> {
  const token = await getAccessToken();
  const { body, status } = await httpsGet("api.anthropic.com", "/api/oauth/usage", {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "anthropic-beta": "oauth-2025-04-20",
    "User-Agent": "claude-code/2.1.109",
  });

  if (status === 429) return cachedResult ?? { fiveHour: null, sevenDay: null };

  const data = JSON.parse(body) as {
    five_hour?: { utilization?: number; resets_at?: string } | null;
    seven_day?: { utilization?: number; resets_at?: string } | null;
  };

  cachedResult = {
    fiveHour: parseWindow(data.five_hour),
    sevenDay: parseWindow(data.seven_day),
  };
  return cachedResult;
}

function parseWindow(w: { utilization?: number; resets_at?: string } | null | undefined): ClaudeUsageWindow | null {
  if (!w) return null;
  return {
    utilization: w.utilization ?? 0,
    resetsAt: w.resets_at ? new Date(w.resets_at) : null,
  };
}
