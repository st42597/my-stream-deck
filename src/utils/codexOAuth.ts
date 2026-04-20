import fs from "fs";
import path from "path";
import os from "os";
import streamDeck from "@elgato/streamdeck";
import { httpsGet, httpsPost } from "./httpClient.js";

const CACHE_FILE = path.join(os.tmpdir(), "aitoken-codex.json");
const AUTH_FILE = path.join(os.homedir(), ".codex", "auth.json");
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const EXPIRY_BUFFER_MS = 60_000;

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
  auth_mode?: string;
  OPENAI_API_KEY?: string | null;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    account_id?: string;
  };
  last_refresh?: string;
  [k: string]: unknown;
}

function readAuth(): AuthFile {
  const raw = fs.readFileSync(AUTH_FILE, "utf8");
  return JSON.parse(raw) as AuthFile;
}

function writeAuth(auth: AuthFile): void {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

function jwtExpSeconds(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const data = JSON.parse(payload) as { exp?: number };
    return typeof data.exp === "number" ? data.exp : null;
  } catch { return null; }
}

async function refreshCodexTokens(auth: AuthFile): Promise<AuthFile> {
  const refreshToken = auth.tokens?.refresh_token;
  if (!refreshToken) throw new Error("No refresh_token in ~/.codex/auth.json");
  const form =
    `grant_type=refresh_token` +
    `&refresh_token=${encodeURIComponent(refreshToken)}` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&scope=${encodeURIComponent("openid profile email offline_access")}`;
  const { body, status } = await httpsPost(
    "auth.openai.com",
    "/oauth/token",
    {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
    },
    form,
  );
  if (status !== 200) {
    throw new Error(`codex refresh failed status=${status} body=${body.slice(0, 200)}`);
  }
  const data = JSON.parse(body) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
  };
  if (!data.access_token) throw new Error("codex refresh missing access_token");
  return {
    ...auth,
    tokens: {
      ...(auth.tokens ?? {}),
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? auth.tokens?.refresh_token,
      id_token: data.id_token ?? auth.tokens?.id_token,
    },
    last_refresh: new Date().toISOString(),
  };
}

async function getAccessToken(): Promise<{ accessToken: string; accountId: string }> {
  let auth = readAuth();
  const token = auth.tokens?.access_token ?? "";
  if (!token) throw new Error("No Codex access token found in ~/.codex/auth.json");
  const exp = jwtExpSeconds(token);
  const now = Math.floor(Date.now() / 1000);
  if (exp !== null && exp - Math.floor(EXPIRY_BUFFER_MS / 1000) <= now) {
    streamDeck.logger.info(`[codexOAuth] token expired (exp=${new Date(exp * 1000).toISOString()}), refreshing`);
    auth = await refreshCodexTokens(auth);
    writeAuth(auth);
  }
  return {
    accessToken: auth.tokens?.access_token ?? "",
    accountId: auth.tokens?.account_id ?? "",
  };
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

async function usageRequest(accessToken: string, accountId: string) {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
    "User-Agent": "CodexBar",
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;
  return httpsGet("chatgpt.com", "/backend-api/wham/usage", headers);
}

export async function fetchCodexUsage(): Promise<CodexUsageResult> {
  if (Date.now() < cooldownUntil) {
    return cachedResult ?? { planType: "unknown", primaryWindow: null, secondaryWindow: null };
  }
  let { accessToken, accountId } = await getAccessToken();
  let { body, status } = await usageRequest(accessToken, accountId);

  if (status === 401) {
    streamDeck.logger.info(`[codexOAuth] 401 — forcing refresh`);
    const refreshed = await refreshCodexTokens(readAuth());
    writeAuth(refreshed);
    accessToken = refreshed.tokens?.access_token ?? "";
    accountId = refreshed.tokens?.account_id ?? accountId;
    ({ body, status } = await usageRequest(accessToken, accountId));
  }

  if (status === 429) {
    cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    streamDeck.logger.warn(`[codexOAuth] 429 — cooldown ${RATE_LIMIT_COOLDOWN_MS / 1000}s`);
    return cachedResult ?? { planType: "unknown", primaryWindow: null, secondaryWindow: null };
  }
  if (status !== 200) {
    streamDeck.logger.warn(`[codexOAuth] status=${status} body=${body.slice(0, 200)}`);
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
