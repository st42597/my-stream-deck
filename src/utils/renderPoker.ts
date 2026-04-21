const SUITS = ["♠", "♥", "♦", "♣"] as const;
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
const RANK_VALUE: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
};

type Suit = (typeof SUITS)[number];
type Rank = (typeof RANKS)[number];

export interface PokerCard {
  rank: Rank;
  suit: Suit;
}

export function drawCards(): [PokerCard, PokerCard] {
  const deck: PokerCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  const i = Math.floor(Math.random() * 52);
  let j = Math.floor(Math.random() * 51);
  if (j >= i) j++;
  const a = deck[i], b = deck[j];
  return RANK_VALUE[a.rank] >= RANK_VALUE[b.rank] ? [a, b] : [b, a];
}

function suitColor(suit: Suit): string {
  return suit === "♥" || suit === "♦" ? "#e84040" : "#d0d0d0";
}

// SVG path suit symbols in a square viewBox — scales crisply at any size
// Each path fits in a 0 0 20 20 coordinate space
function suitPath(suit: Suit, cx: number, cy: number, size: number): string {
  const s = size / 20;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  const color = suitColor(suit);

  let path: string;
  if (suit === "♥") {
    // Heart: two circles top + V shape bottom
    path = `M 10 17 C 10 17 2 11 2 6.5 C 2 3.5 4.5 2 7 2 C 8.5 2 9.5 2.8 10 4 C 10.5 2.8 11.5 2 13 2 C 15.5 2 18 3.5 18 6.5 C 18 11 10 17 10 17 Z`;
  } else if (suit === "♦") {
    // Diamond: simple rhombus
    path = `M 10 1 L 19 10 L 10 19 L 1 10 Z`;
  } else if (suit === "♠") {
    // Spade: inverted heart top + stem
    path = `M 10 2 C 10 2 2 7 2 11.5 C 2 14.5 4.5 16 7 15 C 6 16.5 5 18 4 18 L 16 18 C 15 18 14 16.5 13 15 C 15.5 16 18 14.5 18 11.5 C 18 7 10 2 10 2 Z`;
  } else {
    // Club: three circles + stem
    path = `M 10 13 C 10 13 8 17 6 18 L 14 18 C 12 17 10 13 10 13 Z M 10 3 C 8 3 6.5 4.5 6.5 6.5 C 6.5 7.5 6.9 8.3 7.5 8.9 C 6.8 8.4 5.9 8 5 8 C 3 8 1.5 9.5 1.5 11.5 C 1.5 13.5 3 15 5 15 C 6.8 15 8.3 13.8 8.8 12.2 C 9.1 13 9.5 13.5 10 13.5 C 10.5 13.5 10.9 13 11.2 12.2 C 11.7 13.8 13.2 15 15 15 C 17 15 18.5 13.5 18.5 11.5 C 18.5 9.5 17 8 15 8 C 14.1 8 13.2 8.4 12.5 8.9 C 13.1 8.3 13.5 7.5 13.5 6.5 C 13.5 4.5 12 3 10 3 Z`;
  }

  return `<g transform="translate(${tx},${ty}) scale(${s})">
    <path d="${path}" fill="${color}" shape-rendering="geometricPrecision"/>
  </g>`;
}

function cardSvg(card: PokerCard, x: number, y: number, w: number, h: number): string {
  const color = suitColor(card.suit);
  const r = 6;
  const rankFs = card.rank === "10" ? 13 : 15;
  const cornerSuitSize = 11; // suit path size in corners
  const centerSuitSize = 28; // large center suit

  // Corner positions
  const tlx = x + 5;
  const tly = y + rankFs;
  const brx = x + w - 5;
  const bry = y + h - 5;

  // Suit in top-left corner (below rank)
  const tlSuitCx = x + 5 + cornerSuitSize / 2;
  const tlSuitCy = y + rankFs + 4 + cornerSuitSize / 2;

  // Center suit
  const cSuitCx = x + w / 2;
  const cSuitCy = y + h / 2 + 2;

  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"
      fill="#1e1e1e" stroke="${color}" stroke-width="1.5" stroke-opacity="0.6"/>
    <text x="${tlx}" y="${tly}"
      font-family="'SF Pro Display','Helvetica Neue',Arial,sans-serif"
      font-size="${rankFs}" font-weight="800" fill="${color}">${card.rank}</text>
    ${suitPath(card.suit, tlSuitCx, tlSuitCy, cornerSuitSize)}
    ${suitPath(card.suit, cSuitCx, cSuitCy, centerSuitSize)}
    <g transform="rotate(180, ${x + w / 2}, ${y + h / 2})">
      <text x="${x + w - brx + x}" y="${y + h - (bry - y - rankFs)}"
        font-family="'SF Pro Display','Helvetica Neue',Arial,sans-serif"
        font-size="${rankFs}" font-weight="800" fill="${color}">${card.rank}</text>
    </g>
  `;
}

export function renderPokerSvg(cards: [PokerCard, PokerCard] | null): string {
  const W = 144;
  const H = 144;
  const HEADER_H = 26;
  const ACCENT = "#c8a96e";

  const cardW = 58;
  const cardH = 90;
  const gap = 6;
  const totalW = cardW * 2 + gap;
  const startX = (W - totalW) / 2;
  const cardY = HEADER_H + (H - HEADER_H - cardH) / 2;

  const cardsSvg = cards
    ? cardSvg(cards[0], startX, cardY, cardW, cardH) +
      cardSvg(cards[1], startX + cardW + gap, cardY, cardW, cardH)
    : `<text x="72" y="88" font-family="'SF Mono',Menlo,monospace" font-size="13"
        fill="#555" text-anchor="middle">PRESS</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#141414"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bgGrad)"/>
  ${cardsSvg}
  <rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="#0a0a0a" fill-opacity="0.85"/>
  <text x="${W / 2}" y="18" font-family="'SF Mono',Menlo,monospace"
    font-size="11" font-weight="700" letter-spacing="2.5" fill="${ACCENT}"
    text-anchor="middle">POKER</text>
</svg>`;
}
