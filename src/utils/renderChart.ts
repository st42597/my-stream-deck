export { svgToDataUrl } from "./svgUtils.js";

export interface ChartOptions {
  label: string;
  samples: number[];
  current: number;
  accentColor: string;
}

const W = 144;
const H = 144;
const PAD_TOP = 28;
const CHART_H = H - PAD_TOP - 16;

export function renderChartSvg(opts: ChartOptions): string {
  const { label, samples, current, accentColor } = opts;
  const isHigh = current >= 85;
  const color = isHigh ? "#ff3b30" : accentColor;

  let areaPath = "";
  let linePath = "";

  if (samples.length >= 2) {
    const pts = samples.map((v, i) => ({
      x: (i / (samples.length - 1)) * W,
      y: PAD_TOP + CHART_H - (v / 100) * CHART_H,
    }));
    const last = pts[pts.length - 1];
    const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    areaPath = `<path d="${lineD} L${last.x.toFixed(1)},${PAD_TOP + CHART_H} L0,${PAD_TOP + CHART_H} Z" fill="url(#areaGrad)"/>`;
    linePath = `<path d="${lineD}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  const fontSize = current >= 100 ? 38 : 44;
  const pctY = H / 2 + fontSize * 0.36;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <line x1="0" y1="${PAD_TOP + CHART_H * 0.25}" x2="${W}" y2="${PAD_TOP + CHART_H * 0.25}" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
  <line x1="0" y1="${PAD_TOP + CHART_H * 0.5}" x2="${W}" y2="${PAD_TOP + CHART_H * 0.5}" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
  <line x1="0" y1="${PAD_TOP + CHART_H * 0.75}" x2="${W}" y2="${PAD_TOP + CHART_H * 0.75}" stroke="#ffffff" stroke-opacity="0.04" stroke-width="1"/>
  ${areaPath}
  ${linePath}
  <text x="${W / 2}" y="${pctY.toFixed(1)}" font-family="'SF Mono','Menlo',monospace" font-size="${fontSize}" font-weight="700" fill="#ffffff" text-anchor="middle">${current}%</text>
  <rect x="0" y="0" width="${W}" height="28" fill="#0a0a0a" fill-opacity="0.75"/>
  <text x="72" y="20" font-family="'SF Mono','Menlo',monospace" font-size="18" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="3">${label}</text>
</svg>`;
}
