#!/usr/bin/env node
// Smoke tests for Claude Session feature.
// Node ≥22 supports TS type stripping natively; we import from .ts via --experimental-strip-types.
// Run: node --experimental-strip-types scripts/test-claude-session.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SESSIONS_DIR = path.join(os.homedir(), ".claude", "streamdeck");

// Isolate: backup, run in clean dir, restore.
const BACKUP = path.join(os.tmpdir(), `claude-sd-backup-${Date.now()}`);
let existing = [];
try {
  existing = fs.readdirSync(SESSIONS_DIR);
  fs.mkdirSync(BACKUP, { recursive: true });
  for (const f of existing) fs.renameSync(path.join(SESSIONS_DIR, f), path.join(BACKUP, f));
} catch { /* fresh */ }
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

function restore() {
  try {
    for (const f of fs.readdirSync(SESSIONS_DIR)) fs.unlinkSync(path.join(SESSIONS_DIR, f));
    if (existing.length > 0) {
      for (const f of fs.readdirSync(BACKUP)) fs.renameSync(path.join(BACKUP, f), path.join(SESSIONS_DIR, f));
    }
    fs.rmdirSync(BACKUP);
  } catch (e) { console.error("restore failed", e); }
}

let failed = 0;
function assert(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else { console.error(`  FAIL ${label}`); failed++; }
}

function writeRecord(name, rec) {
  fs.writeFileSync(path.join(SESSIONS_DIR, `${name}.json`), JSON.stringify(rec));
}

async function main() {
  const now = Date.now();
  writeRecord("sess-a", { sessionId: "sess-a", cwd: "/Users/me/proj-short",                  state: "running",  tool: "Bash", event: "PreToolUse",  updatedAt: now });
  writeRecord("sess-b", { sessionId: "sess-b", cwd: "/Users/me/super-long-project-name-here", state: "approval", tool: "",     event: "Notification", message: "permission", updatedAt: now - 1000 });
  writeRecord("sess-c", { sessionId: "sess-c", cwd: "/x/idle-proj",                           state: "idle",     tool: "",     event: "Stop",         updatedAt: now - 10_000 });
  writeRecord("sess-old", { sessionId: "sess-old", cwd: "/x/stale",                            state: "idle",     event: "Stop", updatedAt: now - 60 * 60_000 }); // 60min → stopped

  const { readSessions, getSessionAtSlot } = await import(path.join(root, "src/utils/claudeSessions.ts"));
  const { renderClaudeSessionSvg }          = await import(path.join(root, "src/utils/renderClaudeSession.ts"));

  const sessions = readSessions();
  assert(sessions.length === 4, `readSessions finds 4 files (got ${sessions.length})`);
  assert(sessions[0].sessionId === "sess-a", `sort newest-first: sess-a (got ${sessions[0].sessionId})`);
  assert(sessions[1].sessionId === "sess-b", `sort 2nd: sess-b (got ${sessions[1].sessionId})`);
  assert(sessions.find(s => s.sessionId === "sess-old")?.state === "stopped", "60min record marked stopped");
  assert(sessions.find(s => s.sessionId === "sess-c")?.state === "idle",      "10s record stays idle");

  const slot0 = getSessionAtSlot(0);
  const slot1 = getSessionAtSlot(1);
  const slot2 = getSessionAtSlot(2);
  const slot3 = getSessionAtSlot(3);
  assert(slot0?.sessionId === "sess-a",  `slot 0 → sess-a (got ${slot0?.sessionId})`);
  assert(slot1?.sessionId === "sess-b",  `slot 1 → sess-b (got ${slot1?.sessionId})`);
  assert(slot2?.sessionId === "sess-c",  `slot 2 → sess-c (got ${slot2?.sessionId})`);
  assert(slot3 === null,                  "slot 3 (beyond active) → null");

  // Render output sanity
  const cases = [
    { label: "running short name",  opts: { slot: 0, state: "running",  project: "proj-short",                  tool: "Bash",      pulsePhase: 0 } },
    { label: "approval long name",  opts: { slot: 1, state: "approval", project: "super-long-project-name-here", tool: "",         pulsePhase: 0.5 } },
    { label: "idle medium name",    opts: { slot: 2, state: "idle",     project: "my-stream-deck",               tool: "",         pulsePhase: 0 } },
    { label: "empty slot",          opts: { slot: 3, state: "empty",    project: "",                             tool: "",         pulsePhase: 0 } },
    { label: "thinking camelCase",  opts: { slot: 4, state: "thinking", project: "myAwesomeProjectName",         tool: "",         pulsePhase: 0 } },
    { label: "running long tool",   opts: { slot: 0, state: "running",  project: "x",                            tool: "VeryLongToolName", pulsePhase: 0 } },
  ];
  for (const tc of cases) {
    const svg = renderClaudeSessionSvg(tc.opts);
    assert(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"), `${tc.label}: valid SVG envelope`);
    assert(!svg.includes("undefined"), `${tc.label}: no 'undefined' leaks`);
  }

  // Long project name must be split or fit under 144px (heuristic: no single line > 14 chars without ellipsis)
  const longSvg = renderClaudeSessionSvg({ slot: 1, state: "approval", project: "super-long-project-name-here", tool: "", pulsePhase: 0.5 });
  const textElts = [...longSvg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
  const nameLines = textElts.filter((t) => t.includes("SUPER") || t.includes("PROJECT") || t.includes("NAME") || t.includes("HERE"));
  const tooLong = nameLines.filter((t) => t.length > 18 && !t.endsWith("…"));
  assert(tooLong.length === 0, `long project split into ≤18-char lines (got ${JSON.stringify(nameLines)})`);
  assert(nameLines.length >= 2, `long project uses multi-line layout (got ${JSON.stringify(nameLines)})`);

  console.log(failed === 0 ? "\nALL PASS" : `\n${failed} TEST(S) FAILED`);
  return failed;
}

try {
  const code = await main();
  restore();
  process.exit(code === 0 ? 0 : 1);
} catch (e) {
  console.error("error", e);
  restore();
  process.exit(2);
}
