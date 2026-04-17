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

function svgShell(body: string, extraDefs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${extraDefs}
  <rect width="${W}" height="${H}" fill="${BG}"/>
  ${body}
  ${slackHeader(ACCENT)}
</svg>`;
}

function slackHeader(color: string): string {
  return `<rect x="0" y="0" width="${W}" height="28" fill="${BG}" fill-opacity="0.75"/>
  <text x="72" y="20" font-family="${FONT}" font-size="18" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="3">SLACK</text>`;
}

function errorSvg(error: Exclude<BadgeError, null>): string {
  const [line1, line2] = errorLabel(error);
  return svgShell(`
  <text x="72" y="82" font-family="${FONT}" font-size="12" fill="#ff9500" text-anchor="middle">${line1}</text>
  <text x="72" y="100" font-family="${FONT}" font-size="10" fill="#664422" text-anchor="middle">${line2}</text>`);
}

function zeroSvg(): string {
  return svgShell(`
  <text x="72" y="${H / 2 + 56 * 0.36}" font-family="${FONT}" font-size="56" font-weight="700" fill="#2d2d2d" text-anchor="middle">0</text>`);
}

function silentSvg(): string {
  return svgShell(`
  <circle cx="72" cy="78" r="9" fill="${ACCENT}"/>
  <text x="72" y="${H - 10}" font-family="${FONT}" font-size="15" font-weight="600" fill="${ACCENT}" fill-opacity="0.6" text-anchor="middle">SILENT</text>`);
}

function countSvg(count: number): string {
  const countStr = count > 99 ? "99+" : String(count);
  const numFontSize = count > 9 ? 46 : 56;
  const label = count === 1 ? "ALERT" : "ALERTS";

  const defs = `
  <defs>
    <filter id="glow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

  return svgShell(`
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <text x="72" y="${H / 2 + numFontSize * 0.36}" font-family="${FONT}" font-size="${numFontSize}" font-weight="700" fill="#ffffff" text-anchor="middle" filter="url(#glow)">${countStr}</text>
  <rect x="0" y="${H - 30}" width="${W}" height="30" fill="${BG}" fill-opacity="0.75"/>
  <text x="72" y="${H - 10}" font-family="${FONT}" font-size="15" font-weight="600" fill="${ACCENT}" text-anchor="middle">${label}</text>`, defs);
}

function errorLabel(error: Exclude<BadgeError, null>): [string, string] {
  switch (error) {
    case "no_permission": return ["NEED ACCESS", "Accessibility perm"];
    case "slack_not_running": return ["NOT RUNNING", "Launch Slack"];
    case "timeout": return ["TIMEOUT", "Retrying..."];
  }
}
