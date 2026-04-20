import { execFile } from "child_process";
import type { ClaudeSession } from "./claudeSessions.js";

function run(cmd: string, args: string[]): void {
  execFile(cmd, args, () => {});
}

function osascript(script: string): void {
  run("osascript", ["-e", script]);
}

export function focusSession(session: ClaudeSession): void {
  const tty = session.tty ? `/dev/${session.tty}` : "";
  switch (session.app) {
    case "iTerm2":
      if (tty) {
        osascript(`
tell application "iTerm"
  activate
  set tgt to "${tty}"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if tty of s is tgt then
          select w
          tell t to select
          tell s to select
          return
        end if
      end repeat
    end repeat
  end repeat
end tell`);
      } else {
        osascript(`tell application "iTerm" to activate`);
      }
      return;

    case "Terminal":
      if (tty) {
        osascript(`
tell application "Terminal"
  activate
  set tgt to "${tty}"
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is tgt then
        set selected of t to true
        set frontmost of w to true
        return
      end if
    end repeat
  end repeat
end tell`);
      } else {
        osascript(`tell application "Terminal" to activate`);
      }
      return;

    case "Code":
      run("open", ["-a", "Visual Studio Code", session.cwd || ""]);
      return;

    case "Cursor":
      run("open", ["-a", "Cursor", session.cwd || ""]);
      return;

    case "Warp":
      osascript(`tell application "Warp" to activate`);
      return;

    case "Ghostty":
      osascript(`tell application "Ghostty" to activate`);
      return;

    case "Alacritty":
      osascript(`tell application "Alacritty" to activate`);
      return;

    case "Tabby":
      osascript(`tell application "Tabby" to activate`);
      return;

    default:
      // Unknown app — fallback: just notify + copy cwd
      if (session.cwd) {
        const pb = execFile("pbcopy", [], () => {});
        pb.stdin?.end(session.cwd);
      }
      osascript(`display notification "${(session.project || session.cwd).replace(/"/g, "")}" with title "Session ${session.state}"`);
  }
}
