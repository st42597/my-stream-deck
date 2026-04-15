const W = 144;
const H = 144;

export interface SlackButtonOptions {
  count: number;
  hasToken: boolean;
  error?: string;
}

export function renderSlackSvg(opts: SlackButtonOptions): string {
  const { count, hasToken, error } = opts;

  // No token configured
  if (!hasToken) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <text x="72" y="55" font-family="'SF Mono','Menlo',monospace" font-size="20" font-weight="700" fill="#4a154b" text-anchor="middle" letter-spacing="1">SLACK</text>
  <text x="72" y="82" font-family="'SF Mono','Menlo',monospace" font-size="11" fill="#666" text-anchor="middle">SET TOKEN</text>
  <text x="72" y="100" font-family="'SF Mono','Menlo',monospace" font-size="11" fill="#666" text-anchor="middle">IN SETTINGS</text>
</svg>`;
  }

  // Error state
  if (error) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <text x="72" y="55" font-family="'SF Mono','Menlo',monospace" font-size="20" font-weight="700" fill="#4a154b" text-anchor="middle" letter-spacing="1">SLACK</text>
  <text x="72" y="85" font-family="'SF Mono','Menlo',monospace" font-size="12" fill="#ff3b30" text-anchor="middle">API ERROR</text>
</svg>`;
  }

  // No notifications
  if (count === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <!-- Slack logo hash mark -->
  ${slackHashmark(72, 42, 28, "#4a154b", 0.4)}
  <text x="72" y="92" font-family="'SF Mono','Menlo',monospace" font-size="38" font-weight="700" fill="#2d2d2d" text-anchor="middle">0</text>
  <text x="72" y="116" font-family="'SF Mono','Menlo',monospace" font-size="11" fill="#333" text-anchor="middle" letter-spacing="0.5">NO ALERTS</text>
</svg>`;
  }

  // Has notifications — pulsing red badge style
  const isMany = count >= 10;
  const countStr = count > 99 ? "99+" : String(count);
  const numFontSize = count > 9 ? 46 : 56;
  const accentColor = "#e01e5a"; // Slack red

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="glow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <!-- Subtle glow bg -->
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>

  <!-- Slack logo top-left -->
  ${slackHashmark(20, 18, 13, accentColor, 0.6)}

  <!-- "SLACK" label -->
  <text x="38" y="23" font-family="'SF Mono','Menlo',monospace" font-size="12" font-weight="700" fill="${accentColor}" fill-opacity="0.7" letter-spacing="1">SLACK</text>

  <!-- Notification count — center big -->
  <text x="72" y="${H / 2 + numFontSize * 0.36}"
        font-family="'SF Mono','Menlo',monospace"
        font-size="${numFontSize}"
        font-weight="700"
        fill="#ffffff"
        text-anchor="middle"
        filter="url(#glow)">${countStr}</text>

  <!-- Bottom label -->
  <text x="72" y="${H - 8}"
        font-family="'SF Mono','Menlo',monospace"
        font-size="11"
        fill="${accentColor}"
        fill-opacity="0.6"
        text-anchor="middle">${isMany ? "MENTIONS" : count === 1 ? "MENTION" : "MENTIONS"}</text>

  <!-- Top-right corner dot indicator -->
  <circle cx="${W - 12}" cy="12" r="5" fill="${accentColor}"/>
</svg>`;
}

/**
 * Draws a simplified Slack # hashmark icon centered at (cx, cy) with given size.
 */
function slackHashmark(cx: number, cy: number, size: number, color: string, opacity: number): string {
  const s = size;
  const sw = s * 0.18;
  const gap = s * 0.28;
  return `<g transform="translate(${cx - s / 2}, ${cy - s / 2})" opacity="${opacity}">
    <!-- vertical bars -->
    <rect x="${s * 0.25}" y="0" width="${sw}" height="${s}" rx="${sw / 2}" fill="${color}"/>
    <rect x="${s * 0.58}" y="0" width="${sw}" height="${s}" rx="${sw / 2}" fill="${color}"/>
    <!-- horizontal bars -->
    <rect x="0" y="${s * 0.28}" width="${s}" height="${sw}" rx="${sw / 2}" fill="${color}"/>
    <rect x="0" y="${s * 0.58}" width="${s}" height="${sw}" rx="${sw / 2}" fill="${color}"/>
  </g>`;
}

export { svgToDataUrl } from "./svgUtils.js";
