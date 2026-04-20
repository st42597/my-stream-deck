import type { SessionState } from "./claudeSessions.js";

const W = 144;
const H = 144;
const BG = "#0a0a0a";
const FONT = "'SF Mono','Menlo',monospace";

export interface ClaudeSessionOptions {
  slot: number;
  state: SessionState | "empty";
  project: string;
  tool: string;
  pulsePhase: number; // 0..1 for approval blink
}

interface StateStyle {
  accent: string;
  sub: string;
  tag: string;
}

const STYLES: Record<string, StateStyle> = {
  empty:    { accent: "#2d2d2d", sub: "#444",    tag: "EMPTY"   },
  idle:     { accent: "#4a5a6a", sub: "#8a9aac", tag: "IDLE"    },
  thinking: { accent: "#3b82f6", sub: "#93c5fd", tag: "THINK"   },
  running:  { accent: "#cc785c", sub: "#f0b696", tag: "RUN"     },
  approval: { accent: "#ff3b30", sub: "#ffb4b0", tag: "APPROVE" },
  stopped:  { accent: "#2a2a2a", sub: "#3a3a3a", tag: "STOP"    },
};

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function splitProject(name: string): string[] {
  const parts = name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .split(/[_.\s]+/)
    .flatMap((chunk) => chunk.split("-"))
    .filter(Boolean);
  if (parts.length <= 1) return [name];
  let bestIdx = 0, bestMax = Infinity, bestDiff = Infinity;
  const lens = parts.map((p) => p.length);
  const total = lens.reduce((s, n) => s + n + 1, -1);
  let acc = -1;
  for (let i = 0; i < parts.length - 1; i++) {
    acc += lens[i] + 1;
    const right = total - acc - 1;
    const max = Math.max(acc, right);
    const diff = Math.abs(acc - right);
    if (max < bestMax || (max === bestMax && diff < bestDiff)) {
      bestMax = max; bestDiff = diff; bestIdx = i;
    }
  }
  return [parts.slice(0, bestIdx + 1).join("-"), parts.slice(bestIdx + 1).join("-")];
}

function fontForLength(len: number): number {
  if (len <= 7) return 19;
  if (len <= 9) return 17;
  if (len <= 11) return 15;
  if (len <= 13) return 13;
  if (len <= 15) return 12;
  if (len <= 17) return 11;
  return 10;
}

interface Layout { lines: string[]; fontSize: number; lineHeight: number; }

function layoutProject(name: string): Layout {
  const upper = name.toUpperCase();
  if (upper.length <= 8) return { lines: [upper], fontSize: 24, lineHeight: 0 };
  if (upper.length <= 11) return { lines: [upper], fontSize: 19, lineHeight: 0 };

  const chunks = splitProject(upper);
  if (chunks.length === 2) {
    const longest = Math.max(chunks[0].length, chunks[1].length);
    if (longest <= 18) {
      const fs = fontForLength(longest);
      return { lines: chunks, fontSize: fs, lineHeight: fs + 2 };
    }
    const truncated = chunks.map((c) => c.length > 17 ? c.slice(0, 16) + "…" : c);
    return { lines: truncated, fontSize: 10, lineHeight: 12 };
  }
  if (upper.length <= 14) return { lines: [upper], fontSize: 14, lineHeight: 0 };
  if (upper.length <= 18) return { lines: [upper], fontSize: 11, lineHeight: 0 };
  return { lines: [upper.slice(0, 17) + "…"], fontSize: 11, lineHeight: 0 };
}

function svgShell(body: string, headerColor: string, headerText: string, extraDefs = "", bg = BG): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${extraDefs}
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${body}
  <rect x="0" y="0" width="${W}" height="28" fill="${BG}" fill-opacity="0.75"/>
  <text x="72" y="20" font-family="${FONT}" font-size="18" font-weight="700" fill="${headerColor}" text-anchor="middle" letter-spacing="3">${escape(headerText)}</text>
</svg>`;
}

export function renderClaudeSessionSvg(opts: ClaudeSessionOptions): string {
  const { slot, state, project, tool, pulsePhase } = opts;
  const style = STYLES[state];
  const header = `CLAUDE S${slot + 1}`;

  if (state === "empty") {
    const body = `
  <text x="72" y="84" font-family="${FONT}" font-size="15" font-weight="600" fill="${style.sub}" text-anchor="middle">no session</text>`;
    return svgShell(body, style.accent, header);
  }

  const bgGlow = state === "approval"
    ? `rgb(${Math.round(20 + 50 * pulsePhase)}, ${Math.round(8 + 6 * pulsePhase)}, ${Math.round(8 + 6 * pulsePhase)})`
    : BG;

  const defs = `
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${style.accent}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="${style.accent}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b"/><feComposite in="SourceGraphic" in2="b" operator="over"/></filter>
  </defs>`;

  const ring = state === "approval"
    ? `<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${style.accent}" stroke-width="4" rx="12" opacity="${0.55 + 0.45 * pulsePhase}"/>`
    : "";

  const layout = layoutProject(project || "UNKNOWN");
  const lines = layout.lines;
  const centerY = 78;
  const totalH = lines.length === 1 ? 0 : (lines.length - 1) * layout.lineHeight;
  const startY = centerY - totalH / 2;
  const projectText = lines
    .map((line, i) => `<text x="72" y="${startY + i * layout.lineHeight}" font-family="'SF Pro Display','Helvetica',sans-serif" font-size="${layout.fontSize}" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" filter="url(#glow)">${escape(line)}</text>`)
    .join("\n  ");

  const subText = state === "running" && tool
    ? (tool.length > 13 ? tool.slice(0, 12) + "…" : tool).toUpperCase()
    : style.tag;

  const body = `
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${ring}
  ${projectText}
  <rect x="0" y="${H - 26}" width="${W}" height="26" fill="${BG}" fill-opacity="0.85"/>
  <text x="72" y="${H - 9}" font-family="${FONT}" font-size="13" font-weight="600" fill="${style.sub}" text-anchor="middle" letter-spacing="1">${escape(subText)}</text>`;

  return svgShell(body, style.accent, header, defs, bgGlow);
}
