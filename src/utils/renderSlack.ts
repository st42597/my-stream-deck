import type { BadgeError } from "./slackDockBadge.js";

const W = 144;
const H = 144;
const BG = "#0a0a0a";
const ACCENT = "#e01e5a";
const FONT = "'SF Mono','Menlo',monospace";

export interface SlackButtonOptions {
  count: number;
  silent: boolean;
  error: BadgeError;
}

export function renderSlackSvg(opts: SlackButtonOptions): string {
  const { count, silent, error } = opts;
  if (error) return errorSvg(error);
  if (silent) return silentSvg();
  if (count === 0) return zeroSvg();
  return countSvg(count);
}

function svgShell(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${body}
</svg>`;
}

function slackHeader(): string {
  return `${hashmark(20, 18, 13, ACCENT, 0.6)}
  <text x="38" y="23" font-family="${FONT}" font-size="12" font-weight="700" fill="${ACCENT}" fill-opacity="0.7" letter-spacing="1">SLACK</text>
  <circle cx="${W - 12}" cy="12" r="5" fill="${ACCENT}"/>`;
}

function errorSvg(error: Exclude<BadgeError, null>): string {
  const [line1, line2] = errorLabel(error);
  return svgShell(`
  <text x="72" y="50" font-family="${FONT}" font-size="20" font-weight="700" fill="#4a154b" text-anchor="middle" letter-spacing="1">SLACK</text>
  <text x="72" y="82" font-family="${FONT}" font-size="12" fill="#ff9500" text-anchor="middle">${line1}</text>
  <text x="72" y="100" font-family="${FONT}" font-size="10" fill="#664422" text-anchor="middle">${line2}</text>`);
}

function zeroSvg(): string {
  return svgShell(`
  ${hashmark(72, 42, 28, "#4a154b", 0.4)}
  <text x="72" y="92" font-family="${FONT}" font-size="38" font-weight="700" fill="#2d2d2d" text-anchor="middle">0</text>
  <text x="72" y="116" font-family="${FONT}" font-size="11" fill="#333" text-anchor="middle" letter-spacing="0.5">NO ALERTS</text>`);
}

function silentSvg(): string {
  return svgShell(`${slackHeader()}
  <circle cx="72" cy="78" r="14" fill="${ACCENT}"/>
  <text x="72" y="${H - 8}" font-family="${FONT}" font-size="11" fill="${ACCENT}" fill-opacity="0.6" text-anchor="middle">SILENT</text>`);
}

function countSvg(count: number): string {
  const countStr = count > 99 ? "99+" : String(count);
  const numFontSize = count > 9 ? 46 : 56;
  const label = count === 1 ? "ALERT" : "ALERTS";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${slackHeader()}
  <text x="72" y="${H / 2 + numFontSize * 0.36}" font-family="${FONT}" font-size="${numFontSize}" font-weight="700" fill="#ffffff" text-anchor="middle" filter="url(#glow)">${countStr}</text>
  <text x="72" y="${H - 8}" font-family="${FONT}" font-size="11" fill="${ACCENT}" fill-opacity="0.6" text-anchor="middle">${label}</text>
</svg>`;
}

function hashmark(cx: number, cy: number, size: number, color: string, opacity: number): string {
  const s = size;
  const sw = s * 0.18;
  return `<g transform="translate(${cx - s / 2}, ${cy - s / 2})" opacity="${opacity}">
    <rect x="${s * 0.25}" y="0" width="${sw}" height="${s}" rx="${sw / 2}" fill="${color}"/>
    <rect x="${s * 0.58}" y="0" width="${sw}" height="${s}" rx="${sw / 2}" fill="${color}"/>
    <rect x="0" y="${s * 0.28}" width="${s}" height="${sw}" rx="${sw / 2}" fill="${color}"/>
    <rect x="0" y="${s * 0.58}" width="${s}" height="${sw}" rx="${sw / 2}" fill="${color}"/>
  </g>`;
}

function errorLabel(error: Exclude<BadgeError, null>): [string, string] {
  switch (error) {
    case "no_permission": return ["NEED ACCESS", "Accessibility perm"];
    case "slack_not_running": return ["NOT RUNNING", "Launch Slack"];
    case "timeout": return ["TIMEOUT", "Retrying..."];
  }
}
