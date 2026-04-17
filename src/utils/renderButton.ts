export { svgToDataUrl } from "./svgUtils.js";

const W = 144;
const H = 144;

export interface ButtonOptions {
  label: string;
  percent: number;
  resetsIn: string;
  accentColor: string;
  error?: boolean;
}

export function renderButtonSvg(opts: ButtonOptions): string {
  const { label, percent, resetsIn, accentColor, error } = opts;

  if (error) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <text x="72" y="55" font-family="'SF Mono','Menlo',monospace" font-size="22" font-weight="700" fill="${accentColor}" text-anchor="middle" letter-spacing="2">${label}</text>
  <text x="72" y="85" font-family="'SF Mono','Menlo',monospace" font-size="12" fill="#ff3b30" text-anchor="middle">ERROR</text>
</svg>`;
  }

  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const color = pct >= 85 ? "#ff3b30" : accentColor;
  const fillH = Math.round((H * pct) / 100);
  const fillY = H - fillH;
  const pctFontSize = pct >= 100 ? 40 : 46;
  const pctY = Math.round(H / 2 + pctFontSize * 0.36);

  const resetBlock = resetsIn
    ? `<text x="72" y="${H - 10}" font-family="'SF Mono','Menlo',monospace" font-size="15" font-weight="700" fill="none" stroke="#0a0a0a" stroke-width="4" stroke-linejoin="round" text-anchor="middle">${resetsIn}</text>
  <text x="72" y="${H - 10}" font-family="'SF Mono','Menlo',monospace" font-size="15" font-weight="700" fill="#ffffff" text-anchor="middle">${resetsIn}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.12"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>
      <feComposite in="SourceGraphic" in2="b" operator="over"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <rect x="0" y="${fillY}" width="${W}" height="${fillH}" fill="url(#fg)"/>
  ${fillH > 0 ? `<line x1="0" y1="${fillY}" x2="${W}" y2="${fillY}" stroke="${color}" stroke-width="1.5" stroke-opacity="0.6"/>` : ""}
  <text x="72" y="${pctY}" font-family="'SF Mono','Menlo',monospace" font-size="${pctFontSize}" font-weight="700" fill="#ffffff" text-anchor="middle" filter="url(#glow)">${pct}%</text>
  <rect x="0" y="0" width="${W}" height="28" fill="#0a0a0a" fill-opacity="0.75"/>
  <text x="72" y="20" font-family="'SF Mono','Menlo',monospace" font-size="18" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="3">${label}</text>
  ${resetBlock}
</svg>`;
}

export function formatResetsIn(resetsAt: Date | null): string {
  if (!resetsAt) return "";
  const ms = resetsAt.getTime() - Date.now();
  if (ms <= 0) return "soon";
  const totalMin = Math.floor(ms / 60_000);
  const d = Math.floor(totalMin / (60 * 24));
  const h = Math.floor((totalMin - d * 60 * 24) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
