#!/usr/bin/env python3
"""Stream Deck hook — writes session state to ~/.claude/streamdeck/<id>.json."""
import json, os, subprocess, sys, time

EVENT = sys.argv[1] if len(sys.argv) > 1 else "Unknown"

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

session_id = data.get("session_id") or "unknown"
cwd = data.get("cwd") or ""
tool = data.get("tool_name") or ""
message = data.get("message") or ""

state_map = {
    "SessionStart":     "idle",
    "UserPromptSubmit": "thinking",
    "PreToolUse":       "running",
    "PostToolUse":      "thinking",
    "SubagentStop":     "thinking",
    "Stop":             "idle",
    "Notification":     "approval",
    "PreCompact":       "thinking",
}
state = state_map.get(EVENT, "idle")


def read_proc(pid: int):
    try:
        # command= gives full path + args (not truncated). ppid last.
        out = subprocess.check_output(
            ["ps", "-o", "ppid=,command=", "-p", str(pid)],
            text=True, stderr=subprocess.DEVNULL,
        ).strip()
        if not out:
            return None
        parts = out.split(None, 1)
        if len(parts) != 2:
            return None
        return {"ppid": int(parts[0]), "command": parts[1]}
    except Exception:
        return None


def get_tty(pid: int) -> str:
    try:
        out = subprocess.check_output(
            ["ps", "-o", "tty=", "-p", str(pid)],
            text=True, stderr=subprocess.DEVNULL,
        ).strip()
        return out if out and out.startswith("ttys") else ""
    except Exception:
        return ""


TERM_PATTERNS = [
    ("iTerm2",    ("/iterm.app/", "/iterm2.app/")),
    ("Cursor",    ("/cursor.app/",)),
    ("Code",      ("/visual studio code.app/", "/code - insiders.app/")),
    ("Warp",      ("/warp.app/",)),
    ("Ghostty",   ("/ghostty.app/",)),
    ("Alacritty", ("/alacritty.app/",)),
    ("Tabby",     ("/tabby.app/",)),
    ("Kitty",     ("/kitty.app/",)),
    ("WezTerm",   ("/wezterm.app/",)),
    ("Terminal",  ("/terminal.app/",)),
]


def detect_terminal(start_pid: int):
    pid = start_pid
    for _ in range(20):
        info = read_proc(pid)
        if not info or pid <= 1:
            return None
        cmd_low = info["command"].lower()
        for app_name, patterns in TERM_PATTERNS:
            for p in patterns:
                if p in cmd_low:
                    return {"app": app_name, "pid": pid}
        pid = info["ppid"]
    return None


# Hook runs as child of Claude Code CLI (its PPID == claude process).
claude_pid = os.getppid()
tty = get_tty(claude_pid)
terminal = detect_terminal(claude_pid)

record = {
    "sessionId":  session_id,
    "cwd":        cwd,
    "state":      state,
    "tool":       tool if state == "running" else "",
    "message":    message if state == "approval" else "",
    "event":      EVENT,
    "updatedAt":  int(time.time() * 1000),
    "app":        terminal["app"] if terminal else "",
    "appPid":     terminal["pid"] if terminal else 0,
    "tty":        tty,
    "claudePid":  claude_pid,
}

target_dir = os.path.expanduser("~/.claude/streamdeck")
os.makedirs(target_dir, exist_ok=True)
path = os.path.join(target_dir, f"{session_id}.json")
tmp = path + ".tmp"
try:
    with open(tmp, "w") as f:
        json.dump(record, f)
    os.replace(tmp, path)
except Exception:
    pass

sys.exit(0)
