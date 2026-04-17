import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface SystemSample {
  cpuPercent: number;
  ramPercent: number;
  timestamp: number;
}

const MAX_WINDOW_MS = 120_000; // longest chart window (2m)
const samples: SystemSample[] = [];
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let currentIntervalMs = 5_000;

function maxSamples(): number {
  return Math.ceil(MAX_WINDOW_MS / currentIntervalMs) + 2;
}

export function startPolling(): void {
  refCount++;
  if (pollingTimer !== null) return;
  collectSample();
  pollingTimer = setInterval(collectSample, currentIntervalMs);
}

export function stopPolling(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

export function setPollingInterval(intervalMs: number): void {
  const ms = Math.max(1_000, Math.min(60_000, Math.round(intervalMs)));
  if (ms === currentIntervalMs) return;
  currentIntervalMs = ms;
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    collectSample();
    pollingTimer = setInterval(collectSample, currentIntervalMs);
  }
}

export function getSamples(windowMs: number): SystemSample[] {
  const cutoff = Date.now() - windowMs;
  return samples.filter((s) => s.timestamp >= cutoff);
}

export function getLatest(): SystemSample | null {
  return samples.length > 0 ? samples[samples.length - 1] : null;
}

async function collectSample(): Promise<void> {
  const [cpuPercent, ramPercent] = await Promise.all([getCpuPercent(), getRamPercent()]);
  samples.push({ cpuPercent, ramPercent, timestamp: Date.now() });
  const cap = maxSamples();
  while (samples.length > cap) samples.shift();
}

async function getCpuPercent(): Promise<number> {
  try {
    // -l 1: single sample (no inter-sample wait), faster than -l 2 -s 1
    const { stdout } = await execFileAsync("top", ["-l", "1", "-n", "0"]);
    const line = stdout.split("\n").find((l) => l.includes("CPU usage:"));
    if (!line) return 0;
    const m = line.match(/(\d+(?:\.\d+)?)%\s+idle/);
    return m ? Math.round(100 - parseFloat(m[1])) : 0;
  } catch {
    return 0;
  }
}

async function getRamPercent(): Promise<number> {
  try {
    // memory_pressure matches Activity Monitor's Memory Pressure graph
    // used% = 100 - free%
    const { stdout } = await execFileAsync("memory_pressure", []);
    const m = stdout.match(/System-wide memory free percentage:\s*(\d+)%/);
    return m ? Math.round(100 - parseInt(m[1], 10)) : 0;
  } catch {
    return 0;
  }
}
