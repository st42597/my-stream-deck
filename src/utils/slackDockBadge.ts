import { execFile } from "child_process";

const POLL_INTERVAL_MS = 5_000;
const OSASCRIPT_TIMEOUT_MS = 3_000;

const READ_BADGE_SCRIPT = `
tell application "System Events"
  tell process "Dock"
    try
      set badge to value of attribute "AXStatusLabel" of (UI element "Slack" of list 1)
      if badge is missing value then return ""
      return badge
    on error
      return "NOT_RUNNING"
    end try
  end tell
end tell
`;

export type BadgeError = "no_permission" | "slack_not_running" | "timeout" | null;

export interface BadgeStatus {
  count: number;
  silent: boolean;
  error: BadgeError;
}

let cached: BadgeStatus = { count: 0, silent: false, error: null };
let timer: ReturnType<typeof setInterval> | null = null;

export function startBadgePolling(): void {
  if (timer !== null) return;
  pollOnce();
  timer = setInterval(pollOnce, POLL_INTERVAL_MS);
}

export function stopBadgePolling(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export function getBadgeStatus(): BadgeStatus {
  return cached;
}

export function pollBadgeNow(): void {
  pollOnce();
}

function pollOnce(): void {
  execFile(
    "osascript",
    ["-e", READ_BADGE_SCRIPT],
    { timeout: OSASCRIPT_TIMEOUT_MS },
    (err, stdout, stderr) => {
      if (err) {
        const msg = String(stderr || err.message || "");
        const noPermission =
          msg.includes("not allowed assistive access") ||
          msg.includes("osascript is not allowed") ||
          msg.includes("-1719") ||
          msg.includes("-25211");
        cached = { count: 0, silent: false, error: noPermission ? "no_permission" : "timeout" };
        return;
      }
      const raw = stdout.trim();
      if (raw === "NOT_RUNNING") {
        cached = { count: 0, silent: false, error: "slack_not_running" };
      } else if (raw === "") {
        cached = { count: 0, silent: false, error: null };
      } else if (raw === "•") {
        cached = { count: 0, silent: true, error: null };
      } else {
        const n = parseInt(raw, 10);
        cached = { count: Number.isFinite(n) && n > 0 ? n : 0, silent: false, error: null };
      }
    },
  );
}
