import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import streamDeck from "@elgato/streamdeck";
import { httpsGet, httpsPost } from "./httpClient.js";

const execFileAsync = promisify(execFile);
const CACHE_FILE = path.join(os.tmpdir(), "aitoken-claude.json");
const KEYCHAIN_SERVICE = "Claude Code-credentials";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const EXPIRY_BUFFER_MS = 60_000;

export interface ClaudeUsageWindow {
  utilization: number;  // 0-100
  resetsAt: Date | null;
}

export interface ClaudeUsageResult {
  fiveHour: ClaudeUsageWindow | null;
  sevenDay: ClaudeUsageWindow | null;
}

interface StoredCreds {
  claudeAiOauth: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    [k: string]: unknown;
  };
}

async function readKeychain(): Promise<{ account: string; creds: StoredCreds }> {
  const [pwResult, metaResult] = await Promise.all([
    execFileAsync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"]),
    execFileAsync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE]),
  ]);
  const creds = JSON.parse(pwResult.stdout.trim()) as StoredCreds;
  const acctMatch = metaResult.stdout.match(/"acct"<blob>="([^"]+)"/);
  const account = acctMatch ? acctMatch[1] : "";
  return { account, creds };
}

async function writeKeychain(account: string, creds: StoredCreds): Promise<void> {
  await execFileAsync("security", [
    "add-generic-password", "-U",
    "-s", KEYCHAIN_SERVICE,
    "-a", account,
    "-w", JSON.stringify(creds),
  ]);
}

async function refreshAccessToken(creds: StoredCreds): Promise<StoredCreds> {
  const body = JSON.stringify({
    grant_type: "refresh_token",
    refresh_token: creds.claudeAiOauth.refreshToken,
    client_id: CLIENT_ID,
  });
  const { body: respBody, status } = await httpsPost(
    "console.anthropic.com",
    "/v1/oauth/token",
    { "Content-Type": "application/json", "Accept": "application/json" },
    body,
  );
  if (status !== 200) {
    throw new Error(`refresh failed status=${status} body=${respBody.slice(0, 200)}`);
  }
  const data = JSON.parse(respBody) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("refresh missing access_token");
  const nextExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  return {
    ...creds,
    claudeAiOauth: {
      ...creds.claudeAiOauth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? creds.claudeAiOauth.refreshToken,
      expiresAt: nextExpiresAt,
    },
  };
}

async function getAccessToken(): Promise<string> {
  const { account, creds } = await readKeychain();
  const expiresAt = creds.claudeAiOauth.expiresAt ?? 0;
  if (expiresAt - EXPIRY_BUFFER_MS > Date.now()) {
    return creds.claudeAiOauth.accessToken;
  }
  streamDeck.logger.info(`[claudeOAuth] token expired (expiresAt=${new Date(expiresAt).toISOString()}), refreshing`);
  const next = await refreshAccessToken(creds);
  if (account) {
    await writeKeychain(account, next);
  } else {
    streamDeck.logger.warn(`[claudeOAuth] could not determine keychain account, skipping write-back`);
  }
  return next.claudeAiOauth.accessToken;
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

async function usageRequest(token: string) {
  return httpsGet("api.anthropic.com", "/api/oauth/usage", {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "anthropic-beta": "oauth-2025-04-20",
    "User-Agent": "claude-code/2.1.109",
  });
}

export async function fetchClaudeUsage(): Promise<ClaudeUsageResult> {
  if (Date.now() < cooldownUntil) {
    return cachedResult ?? { fiveHour: null, sevenDay: null };
  }
  let token = await getAccessToken();
  let { body, status } = await usageRequest(token);

  if (status === 401) {
    streamDeck.logger.info(`[claudeOAuth] 401 — forcing refresh`);
    const { account, creds } = await readKeychain();
    const refreshed = await refreshAccessToken(creds);
    if (account) await writeKeychain(account, refreshed);
    token = refreshed.claudeAiOauth.accessToken;
    ({ body, status } = await usageRequest(token));
  }

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
