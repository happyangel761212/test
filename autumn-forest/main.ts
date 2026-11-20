// 가을 숲 — 단풍과 은행나무가 가득한 자연을 한 자루 잉크 펜으로 그린 라인아트 장면.
// 라이브러리(lib/)는 JDhruv14/line-art-animation (MIT)에서 가져왔다.
//
// 상호작용: 해/달을 끌어 시간 바꾸기 · 나무를 누르면 흔들리며 잎이 쏟아짐 · 사람을 누르면 반응 ·
// 다람쥐·까치를 누르면 달아남 · 물을 누르면 물결 · 하늘을 누르면 기러기 떼 · 포인터를 움직이면 바람.
import { el, pen, shape, blot, limb, shoe, place, inkDefs, run, f, pt, PEN, PAPER, type Vec, type Limb } from './lib/ink.ts';
import { gait } from './lib/gait.ts';
import { spring, pendulum, pointerWind, seeded, wobble, ease, clamp, lerp, smooth, rnd } from './lib/motion.ts';
import { palette, applyPalette, nightTint, rgb, mix, toRGB, type Palette } from './lib/daynight.ts';

declare global { interface Element { setAttribute(qualifiedName: string, value: string | number): void } }

// ------------------------------------------------------------------ 장면 상수
declare const __PORTRAIT__: boolean;
const PORTRAIT = typeof __PORTRAIT__ !== 'undefined' && __PORTRAIT__;
const W = PORTRAIT ? 540 : 960, H = PORTRAIT ? 960 : 480;
const GY = PORTRAIT ? 380 : 0;   // 세로 화면: 땅 전체를 아래로 내리고 하늘을 넓힌다
const HB = H - GY;               // 땅 좌표계에서 화면 맨 아래
const FX = (W - 960) / 2;        // 먼 산(960 폭으로 그림)을 가운데 맞춤
const QS = new URLSearchParams(location.search);
const SP = 0.8;              // scene pen = PEN × figure scale
const FS = 0.5;              // figure scale
const HILL = 322;            // 뒷줄 나무 밑동
const BACK = 340;            // 길 뒤쪽 가장자리, 앞줄 나무 밑동
const LANES = [349, 357, 365];
const FRONT = 374;           // 길 앞쪽 가장자리
const WATER = 402, WATER_B = 446;
const DAY = 160;             // 하루(초)

const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];
const srnd = seeded(23);
const oval = (cx: number, cy: number, rx: number, ry: number) => `M${f(cx - rx)} ${f(cy)} a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0 a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;

// 색: CSS 변수로 두고 매 프레임 nightTint만 다시 계산한다.
const COLORS: Record<string, string> = {
  '--m1': '#c2412b', '--m2': '#d9702e', '--m3': '#a3302a', '--m4': '#e08a3a',
  '--g1': '#e2b236', '--g2': '#edc85c', '--g3': '#cf9a2a',
  '--coat': '#b98a5e', '--beret': '#8e2f2a', '--scarf': '#3f5f6b', '--tote': '#d8cbb0', '--tights': '#3a3236',
  '--vest': '#5d6b7a', '--trou': '#3b3b40', '--cap': '#7a6a55',
  '--kid': '#4f7f72', '--pack': '#c2412b', '--shorts': '#2f3d55',
  '--sq': '#b07a45', '--plume': '#b9a68a', '--sun': '#fbefd9',
};
const vfill = (v: string) => `fill:var(${v})`;
const paintV = (parent: Element, v: string, w = SP) => el('path', { style: vfill(v), stroke: 'currentColor', 'stroke-width': w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, parent);
function solidV(l: Limb, v: string): Limb { const n = l.g.querySelector('path') as SVGPathElement; n.classList.remove('pp'); n.removeAttribute('fill'); n.style.fill = `var(${v})`; return l; }

// ------------------------------------------------------------------ SVG 뼈대
const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '단풍나무와 은행나무가 가득한 가을 숲길을 잉크 선으로 그린 움직이는 그림' });
const ink = inkDefs(svg, 'af');
const defs = ink.defs;
document.querySelector('#forest')!.appendChild(svg);

const grad = el('linearGradient', { id: 'af-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
const s0 = el('stop', { offset: 0 }, grad), s1 = el('stop', { offset: 1 }, grad);
const radial = (id: string, c: string, o: number) => { const g = el('radialGradient', { id }, defs); el('stop', { offset: 0, 'stop-color': c, 'stop-opacity': o }, g); el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 }, g); };
radial('af-sunglow', '#ffd9a0', 0.55); radial('af-moonglow', '#e9e4ff', 0.35); radial('af-lamp', '#ffc77a', 0.9); radial('af-warm', '#ffb768', 0.7);
const waterGrad = el('linearGradient', { id: 'af-water', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
const w0 = el('stop', { offset: 0 }, waterGrad), w1 = el('stop', { offset: 1 }, waterGrad);

const skyG = el('g', {}, svg);
const scene = el('g', { filter: ink.filter, transform: `translate(0 ${GY})` }, svg);
const L = {
  backTrees: el('g', { opacity: 0.62 }, scene),
  ground: el('g', {}, scene),
  frontTrees: el('g', {}, scene),
  props: el('g', {}, scene),
  restLeaves: el('g', {}, scene),
  actors: el('g', {}, scene),
  bank: el('g', {}, scene),
  water: el('g', {}, scene),
  floatLeaves: el('g', {}, scene),
  near: el('g', {}, scene),
  fall: el('g', { 'pointer-events': 'none' }, scene),
  branch: null as unknown as SVGGElement,
};
const topG = el('g', { filter: ink.filter }, svg);
const BS = PORTRAIT ? 1.65 : 1;
L.branch = el('g', { transform: `scale(${BS})` }, topG) as any;
const skyGlow = el('g', { style: 'mix-blend-mode:screen', 'pointer-events': 'none' }, svg);
const glow = el('g', { style: 'mix-blend-mode:screen', 'pointer-events': 'none', transform: `translate(0 ${GY})` }, svg);

const wind = pointerWind(svg, 0.28);
let tau = QS.has('tau') ? Number(QS.get('tau')) : 0.6;

// ------------------------------------------------------------------ 잎 모양 (단위 크기, 꼭지가 +y)
const MAPLE = (() => {
  // 손바닥 모양 다섯 갈래 + 잎자루
  const tips = [-90, -38, 14, 166, 218].map((d) => d * Math.PI / 180);
  const rr = [1, 0.86, 0.62, 0.62, 0.86];
  let d = '';
  const P = (a: number, r: number): Vec => [Math.cos(a) * r, Math.sin(a) * r - 0.05];
  const order = [3, 4, 0, 1, 2]; // 왼쪽 아래 → 위 → 오른쪽 아래
  order.forEach((k, i) => {
    const a = tips[k], r = rr[k];
    const tip = P(a, r), sL = P(a - 0.32, r * 0.55), sR = P(a + 0.32, r * 0.55);
    d += (i === 0 ? `M${pt(P(a - 0.55, 0.32))}` : '') + `L${pt(sL)}L${pt(tip)}L${pt(sR)}`;
    const next = order[i + 1];
    if (next !== undefined) { const mid = (a + tips[next] + (next < k ? Math.PI * 2 : 0)) / 2; d += `Q${pt(P(mid, 0.5))} ${pt(P(mid, 0.3))}`; }
  });
  d += `L${pt(P(tips[2] + 0.55, 0.32))}Q0.08 0.3 0 0.36Q-0.08 0.3 ${pt(P(tips[3] - 0.55, 0.32))}Z`;
  return d;
})();
const MAPLE_VEIN = 'M0 0.36L0 -0.85M0 0.2L0.62 -0.5M0 0.2L-0.62 -0.5M0 0.3L0.45 0.1M0 0.3L-0.45 0.1M0 0.36L0 0.95';
const GINKGO = 'M0 0.95L0 0.42C-0.12 0.28 -0.82 -0.12 -0.86 -0.5Q-0.5 -0.86 -0.06 -0.66L0 -0.5L0.06 -0.66Q0.5 -0.86 0.86 -0.5C0.82 -0.12 0.12 0.28 0 0.42Z';
const GINKGO_VEIN = 'M0 0.42L-0.5 -0.62M0 0.42L-0.22 -0.7M0 0.42L0.22 -0.7M0 0.42L0.5 -0.62';

type Kind = 'maple' | 'ginkgo';
const MAPLE_COLS = ['--m1', '--m2', '--m3', '--m4'];
const GINKGO_COLS = ['--g1', '--g2', '--g3'];

// ------------------------------------------------------------------ 하늘
const SUN_SPAN = [0.225, 0.55], MOON_SPAN = [0.775, 0.45];
const SX0 = W * 0.042, SXW = W * 0.916, MX0 = W * 0.062, MXW = W * 0.876;
const sunArc = (u: number): Vec => [SX0 + SXW * u, 300 + GY - (236 + GY * 0.72) * Math.sin(Math.PI * u)];
const moonArc = (u: number): Vec => [MX0 + MXW * u, 290 + GY - (205 + GY * 0.72) * Math.sin(Math.PI * u)];

el('rect', { x: -20, y: -20, width: W + 40, height: H + 40, fill: 'url(#af-sky)' }, skyG);
const starG = el('g', {}, skyG);
const stars = Array.from({ length: 80 }, () => ({ n: el('circle', { cx: f(srnd(0, W)), cy: f(srnd(6, 230 + GY * 0.85)), r: f(srnd(0.35, 1.05)), fill: '#f5efda' }, starG), ph: srnd(0, 6), sp: srnd(0.6, 2.4) }));
const sunG = el('g', { style: 'cursor:grab' }, skyG);
el('circle', { r: 70, fill: 'url(#af-sunglow)' }, sunG);
el('circle', { r: 21, style: vfill('--sun'), stroke: 'currentColor', 'stroke-width': SP }, sunG);
el('title', {}, sunG).textContent = '해를 끌어 시간을 바꿔 보세요';
const moonG = el('g', { style: 'cursor:grab' }, skyG);
el('circle', { r: 60, fill: 'url(#af-moonglow)' }, moonG);
el('path', { d: 'M0 -15 A15 15 0 1 1 0 15 A11 15 0 1 0 0 -15Z', fill: '#f3ecd6' }, moonG);
el('title', {}, moonG).textContent = '달을 끌어 시간을 바꿔 보세요';

// 구름: 끝이 말려 들어가는 긴 가로 획
const cloudD = (x: number, y: number, w: number) => {
  const curl = (cx: number, cy: number, s: number) => `M${f(cx)} ${f(cy)} q${5 * s} 0 ${5 * s} -4 q0 -3.2 ${-3.2 * s} -3.2 q-2.2 0 -2.2 2.2`;
  return `M${f(x)} ${f(y)} L${f(x + w)} ${f(y)} ${curl(x + w, y, 1)} M${f(x + w * 0.22)} ${f(y - 7)} L${f(x + w * 0.7)} ${f(y - 7)} ${curl(x + w * 0.7, y - 7, 1)} M${f(x + w * 0.4)} ${f(y + 6)} L${f(x + w * 0.9)} ${f(y + 6)} ${curl(x + w * 0.4, y + 6, -1)}`;
};
const cloudG = el('g', {}, skyG);
const clouds = (PORTRAIT ? [[250, 70, 150], [40, 200, 150], [330, 290, 110], [130, 380, 90]] : [[90, 70, 150], [480, 48, 190], [760, 96, 130], [300, 118, 100]]).map(([x, y, w]) => ({ x, y, w, v: rnd(1.2, 2.6), n: pen(cloudG, SP * 0.75) }));

// 먼 산: 겹겹이 능선, 가을빛 점묘
const FY = PORTRAIT ? GY - 150 : 0;
const far = el('g', { transform: `translate(${FX} ${FY})` }, skyG);
const ridge = (pts: number[][], op: number, w: number) => { const n = pen(far, w); n.setAttribute('opacity', op); n.setAttribute('d', 'M' + pts.map((p, i) => (i ? `Q${f(p[0])} ${f(p[1])} ${f(p[2])} ${f(p[3])}` : `${f(p[0])} ${f(p[1])}`)).join(' ')); };
ridge([[0, 196], [60, 168, 130, 176], [200, 150, 270, 170], [330, 186, 400, 164], [470, 138, 540, 160], [610, 180, 680, 150], [760, 126, 830, 156], [890, 176, 960, 162]], 0.28, SP * 0.7);
ridge([[0, 248], [90, 214, 180, 226], [260, 238, 330, 214], [400, 192, 480, 216], [560, 240, 640, 222], [700, 206, 760, 214], [850, 228, 960, 210]], 0.45, SP * 0.8);
// 가운데 능선 위 단풍 점묘 (먼 숲)
{
  const ridgeY = (x: number) => 226 - 12 * Math.sin(x / 70) - 8 * Math.sin(x / 31 + 1);
  const g = el('g', { opacity: 0.55 }, far);
  for (let i = 0; i < 150; i++) {
    const x = srnd(0, W), y = ridgeY(x) + srnd(4, 70) * Math.pow(srnd(0, 1), 0.6);
    if (y > 282) continue;
    el('circle', { cx: f(x), cy: f(y), r: f(srnd(1.2, 2.6)), style: vfill(pick([...MAPLE_COLS, ...GINKGO_COLS, '--m1', '--m3'])) }, g);
  }
  // 먼 숲의 나무 끝 표시
  const ticks = pen(far, SP * 0.45); ticks.setAttribute('opacity', 0.5);
  let d = ''; for (let x = 6; x < W; x += srnd(9, 16)) { const y = ridgeY(x) + srnd(2, 8); d += `M${f(x - 2.4)} ${f(y + 2)} Q${f(x)} ${f(y - 4)} ${f(x + 2.4)} ${f(y + 2)} `; }
  ticks.setAttribute('d', d);
}
// 언덕 위 정자
const pavilion = el('g', { opacity: 0.6 }, far);
{
  const x = 712, y = 236;
  pen(pavilion, SP * 0.6).setAttribute('d', `M${x - 9} ${y} L${x - 9} ${y - 13} M${x + 9} ${y} L${x + 9} ${y - 13} M${x - 13} ${y} L${x + 13} ${y} M${x - 10} ${y - 5} L${x + 10} ${y - 5}`);
  shape(pavilion, SP * 0.6).setAttribute('d', `M${x - 19} ${y - 12} Q${x - 12} ${y - 14} ${x - 7} ${y - 19} L${x} ${y - 23} L${x + 7} ${y - 19} Q${x + 12} ${y - 14} ${x + 19} ${y - 12} Q${x + 10} ${y - 15} ${x} ${y - 15} Q${x - 10} ${y - 15} ${x - 19} ${y - 12}Z`);
  pen(pavilion, SP * 0.5).setAttribute('d', `M${x} ${y - 23} l0 -3`);
}
const pavLight = el('circle', { cx: 712 + FX, cy: 227 + FY, r: 9, fill: 'url(#af-warm)', opacity: 0 }, skyGlow);

// 기러기 떼
type Goose = { x: number; y: number; ph: number; n: SVGPathElement };
let flock: { geese: Goose[]; vx: number; } | null = null;
let nextFlock = 6;
const flockG = el('g', {}, skyG);
function launchFlock() {
  if (flock) return;
  const dir = Math.random() < 0.5 ? -1 : 1, y0 = PORTRAIT ? rnd(90, 320) : rnd(56, 120), n = 7 + ((Math.random() * 4) | 0);
  const x0 = dir < 0 ? W + 30 : -30;
  flock = { vx: dir * rnd(26, 34), geese: Array.from({ length: n }, (_, i) => {
    const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    return { x: x0 - dir * Math.abs(k) * 13, y: y0 + k * 7 + rnd(-1, 1), ph: rnd(0, 6), n: pen(flockG, SP * 0.75) };
  }) };
}
skyG.addEventListener('pointerdown', (e) => { if (!(e.target as Element).closest('g[style*="grab"]')) launchFlock(); });

// ------------------------------------------------------------------ 땅: 언덕선, 길, 둑, 물, 가까운 둑
pen(L.ground, SP).setAttribute('d', `M0 ${HILL + 4} Q120 ${HILL - 6} 260 ${HILL} T520 ${HILL - 2} T760 ${HILL + 2} T960 ${HILL - 3}`);
{
  const grass = pen(L.ground, SP * 0.45); grass.setAttribute('opacity', 0.6);
  let d = ''; for (let x = 4; x < W; x += srnd(10, 22)) { const y = srnd(HILL + 4, BACK - 3); d += `M${f(x)} ${f(y)} l-1 -2.6 M${f(x + 1.4)} ${f(y)} l0.6 -3.2 M${f(x + 2.6)} ${f(y)} l1.4 -2.2 `; }
  grass.setAttribute('d', d);
}
// 길
const pathEdge = (y: number, amp: number, ph: number) => { let d = `M-10 ${y}`; for (let x = 0; x <= W + 20; x += 40) d += ` Q${x + 20} ${f(y + amp * Math.sin(x / 90 + ph))} ${x + 40} ${f(y + amp * 0.5 * Math.sin((x + 40) / 70 + ph))}`; return d; };
pen(L.ground, SP).setAttribute('d', pathEdge(BACK, 1.6, 0));
pen(L.bank, SP).setAttribute('d', pathEdge(FRONT, 1.4, 2));
{
  const pebbles = pen(L.ground, SP * 0.45);
  let d = ''; for (let i = 0; i < 90; i++) { const x = srnd(0, W), y = srnd(BACK + 4, FRONT - 3), r = srnd(0.6, 1.5); d += `M${f(x - r)} ${f(y)} q${f(r)} ${f(-r * 0.8)} ${f(2 * r)} 0 `; }
  pebbles.setAttribute('d', d);
  // 둑: 풀 획
  const g2 = pen(L.bank, SP * 0.5);
  d = ''; for (let x = 2; x < W; x += srnd(5, 11)) { const y = srnd(FRONT + 6, WATER - 2); const h = srnd(2.5, 5.5); d += `M${f(x)} ${f(y)} q${f(srnd(-1, 1))} ${f(-h * 0.6)} ${f(srnd(-2, 2))} ${f(-h)} `; }
  g2.setAttribute('d', d);
}
// 물
el('rect', { x: -10, y: WATER, width: W + 20, height: WATER_B - WATER, fill: 'url(#af-water)' }, L.water);
pen(L.water, SP).setAttribute('d', pathEdge(WATER, 1.2, 4));
pen(L.water, SP).setAttribute('d', pathEdge(WATER_B, 1.6, 1));
const strokes = Array.from({ length: 26 }, () => ({ x: srnd(0, W), y: srnd(WATER + 6, WATER_B - 4), w: srnd(10, 34), v: srnd(5, 10), n: pen(L.water, SP * 0.55) }));
// 징검다리
{
  const stones = [[248, 436, 9], [272, 426, 8], [296, 418, 8.6], [321, 411, 7.4]];
  for (const [x, y, r] of stones) {
    shape(L.water, SP).setAttribute('d', `M${x - r} ${y} Q${x - r} ${y - r * 0.55} ${x} ${y - r * 0.6} Q${x + r} ${y - r * 0.55} ${x + r} ${y} Q${x + r * 0.6} ${y + r * 0.35} ${x} ${y + r * 0.32} Q${x - r * 0.7} ${y + r * 0.35} ${x - r} ${y}Z`);
    pen(L.water, SP * 0.45).setAttribute('d', `M${x - r - 4} ${y + 2} l6 0 M${x + r - 1} ${y + 2.5} l6 0`);
  }
}
const ripples: { x: number; y: number; t: number; n: SVGPathElement }[] = [];
const waterHit = el('rect', { x: 0, y: WATER, width: W, height: WATER_B - WATER, fill: 'transparent', style: 'cursor:pointer' }, L.water);
el('title', {}, waterHit).textContent = '물을 눌러 보세요';
waterHit.addEventListener('pointerdown', (e) => {
  const p = toSvg(e as PointerEvent); p[1] -= GY;
  for (let i = 0; i < 3; i++) ripples.push({ x: p[0], y: p[1], t: -i * 0.35, n: pen(L.water, SP * 0.6) });
  for (const l of leaves) if (l.state === 'float') { const dx = l.x - p[0], dy = (l.y - p[1]) * 2, d = Math.hypot(dx, dy) || 1; if (d < 60) { l.vx += (dx / d) * 30; l.bob += 0.6; } }
});
// 가까운 둑 + 바위
pen(L.near, SP * 0.5).setAttribute('d', (() => { let d = ''; for (let x = 2; x < W; x += srnd(6, 12)) { const y = srnd(WATER_B + 8, HB - 2); const h = srnd(3, 7); d += `M${f(x)} ${f(y)} q${f(srnd(-1, 1))} ${f(-h * 0.6)} ${f(srnd(-2.5, 2.5))} ${f(-h)} `; } return d; })());
for (const [x, y, r] of (PORTRAIT ? [[90, 520, 22], [400, 560, 28], [500, 478, 13], [22, 388, 9]] : [[170, 464, 14], [610, 471, 18], [930, 460, 11], [22, 388, 9]])) {
  shape(L.near, SP).setAttribute('d', `M${x - r} ${y} Q${x - r * 1.05} ${y - r * 0.45} ${x - r * 0.55} ${y - r * 0.62} Q${x - r * 0.2} ${y - r * 0.95} ${x + r * 0.3} ${y - r * 0.7} Q${x + r * 0.95} ${y - r * 0.6} ${x + r * 1.05} ${y - r * 0.1} Q${x + r * 1.1} ${y + r * 0.12} ${x + r * 0.7} ${y + r * 0.16} L${x - r * 0.8} ${y + r * 0.14} Q${x - r * 1.1} ${y + r * 0.1} ${x - r} ${y}Z`);
  pen(L.near, SP * 0.45).setAttribute('d', `M${x - r * 0.5} ${y - r * 0.5} q${r * 0.25} ${r * 0.15} ${r * 0.3} ${r * 0.5} M${x + r * 0.35} ${y - r * 0.55} q-${r * 0.12} ${r * 0.25} 0 ${r * 0.5} M${x - r * 1.3} ${y + r * 0.16} l${r * 0.35} 0 M${x + r * 1.05} ${y + r * 0.18} l${r * 0.4} 0`);
}

// ------------------------------------------------------------------ 나무
interface Tree { x: number; y: number; kind: Kind; s: number; g: SVGGElement; can: SVGGElement; lobes: { cx: number; cy: number; rx: number; ry: number }[]; swing: ReturnType<typeof spring>; shake: ReturnType<typeof pendulum>; ph: number; front: boolean; drop: number; canTop: number }
const trees: Tree[] = [];

function lobePath(cx: number, cy: number, rx: number, ry: number, r: () => number) {
  const n = 9 + ((r() * 4) | 0);
  const P: Vec[] = [];
  const off = r() * 6;
  for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; const k = 0.9 + r() * 0.12; P.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  let d = `M${pt(P[0])}`;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n];
    const m: Vec = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bulge = 1.2 + r() * 0.12;
    d += ` Q${f(cx + (m[0] - cx) * bulge)} ${f(cy + (m[1] - cy) * bulge)} ${pt(b)}`;
  }
  return d + 'Z';
}

function makeTree(parent: Element, x: number, y: number, kind: Kind, s: number, front: boolean, seed: number): Tree {
  const r = seeded(seed);
  const g = el('g', { style: 'cursor:pointer' }, parent);
  const pw = SP * (front ? 1 : 0.85);
  const ginkgo = kind === 'ginkgo';
  const h = (ginkgo ? 214 : 150) * s, wd = (ginkgo ? 84 : 160) * s;
  const cols = ginkgo ? GINKGO_COLS : MAPLE_COLS;
  // 줄기와 가지 (열린 두 줄 — 이 스타일의 서명)
  const trunkTop: Vec = ginkgo ? [x + r(-2, 2) * s, y - h * 0.86] : [x + r(-6, 6) * s, y - h * 0.42];
  limb(g, (ginkgo ? 7.5 : 9) * s, pw).draw([[x, y + 1], [x + r(-2, 2) * s, y - h * 0.3], trunkTop], [0, 0]);
  pen(g, pw * 0.8).setAttribute('d', `M${f(x - 7 * s)} ${f(y + 1)} Q${f(x - 4 * s)} ${f(y - 1)} ${f(x - 3 * s)} ${f(y - 6 * s)} M${f(x + 7 * s)} ${f(y + 1)} Q${f(x + 4 * s)} ${f(y - 1)} ${f(x + 3.2 * s)} ${f(y - 5 * s)}`);
  pen(g, pw * 0.5).setAttribute('d', `M${f(x - 1)} ${f(y - 14 * s)} q1 -6 0 -12 M${f(x + 1.5 * s)} ${f(y - 34 * s)} q-1 -5 0 -9`);
  const limbs: Vec[][] = [];
  if (ginkgo) {
    for (let i = 0; i < 6; i++) {
      const yy = y - h * (0.36 + i * 0.09), side = i % 2 ? 1 : -1, len = wd * r(0.2, 0.28) * (1 - i * 0.1);
      limbs.push([[x + side * 1.5 * s, yy], [x + side * len * 0.55, yy - len * 0.5], [x + side * len, yy - len * 0.95]]);
    }
  } else {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = lerp(-0.95, 0.95, i / (n - 1)) + r(-0.15, 0.15);
      const len = h * r(0.36, 0.46);
      limbs.push([trunkTop, [trunkTop[0] + Math.sin(a) * len * 0.5, trunkTop[1] - len * 0.45], [trunkTop[0] + Math.sin(a) * len * 1.05, trunkTop[1] - Math.cos(a * 0.8) * len * 0.85]]);
    }
  }
  limbs.forEach((jt, i) => limb(g, (ginkgo ? 3.4 : 5.4) * s * (1 - i * 0.04), pw * 0.9).draw(jt, [0.6, 1]));
  // 수관: 겹친 덩어리들, 각자 평면 색
  const can = el('g', {}, g);
  const lobes: Tree['lobes'] = [];
  const top = y - h, canBottom = ginkgo ? y - h * 0.34 : y - h * 0.36;
  const ccx = x, ccy = (top + canBottom) / 2, erx = wd / 2, ery = (canBottom - top) / 2;
  const N = ginkgo ? 15 : 17;
  for (let i = 0; i < N; i++) {
    let u = r(-1, 1), v = r(-1, 1);
    if (u * u + v * v > 0.8) { const k = Math.sqrt(0.8 / (u * u + v * v)); u *= k; v *= k; }
    // 은행: 위가 좁은 불꽃꼴 / 단풍: 아래가 납작한 둥근 지붕꼴
    const taper = ginkgo ? lerp(0.5, 1, (v + 1) / 2) : lerp(1, 0.8, (v + 1) / 2);
    const lr = (ginkgo ? r(0.3, 0.4) : r(0.22, 0.32)) * wd * taper;
    lobes.push({ cx: ccx + u * erx * 0.72 * taper, cy: ccy + v * ery * 0.78, rx: lr, ry: lr * (ginkgo ? r(0.85, 1.05) : r(0.66, 0.8)) });
  }
  lobes.sort((a, b) => a.cy - b.cy + (a.rx - b.rx) * 0.2);
  // 가장 아래는 가지가 들어가는 그늘, 그 위로 차례로
  lobes.forEach((lb, i) => {
    const col = cols[(seed + i * 7 + (ginkgo ? 0 : (lb.cy < ccy ? 0 : 1))) % cols.length];
    paintV(can, col, pw).setAttribute('d', lobePath(lb.cx, lb.cy, lb.rx, lb.ry, r));
    // 잎 무늬
    const tick = pen(can, pw * 0.5); tick.setAttribute('opacity', 0.55);
    let d = '';
    const k = Math.round(lb.rx * lb.ry / (ginkgo ? 55 : 70));
    for (let j = 0; j < k; j++) {
      const a = r(0, 6.28), rr = Math.sqrt(r(0, 1)) * 0.72;
      const px = lb.cx + Math.cos(a) * lb.rx * rr, py = lb.cy + Math.sin(a) * lb.ry * rr;
      d += ginkgo ? `M${f(px - 1.5 * s)} ${f(py - 1.3 * s)} Q${f(px)} ${f(py - 2.3 * s)} ${f(px + 1.5 * s)} ${f(py - 1.3 * s)} L${f(px)} ${f(py + 0.6 * s)}Z ` : `M${f(px)} ${f(py + 1.2 * s)} l0 ${f(-2.6 * s)} M${f(px)} ${f(py)} l${f(-1.8 * s)} ${f(-0.9 * s)} M${f(px)} ${f(py)} l${f(1.8 * s)} ${f(-0.9 * s)} `;
    }
    // 덩어리 아래쪽 그늘선
    d += `M${f(lb.cx - lb.rx * 0.55)} ${f(lb.cy + lb.ry * 0.5)} Q${f(lb.cx)} ${f(lb.cy + lb.ry * 0.82)} ${f(lb.cx + lb.rx * 0.55)} ${f(lb.cy + lb.ry * 0.5)}`;
    tick.setAttribute('d', d);
  });
  // 수관 아래로 비치는 잔가지
  const tw = pen(can, pw * 0.7);
  tw.setAttribute('d', limbs.slice(0, 3).map((jt) => { const e = jt[2]; return `M${pt(jt[1])} Q${f((jt[1][0] + e[0]) / 2 + 3)} ${f((jt[1][1] + e[1]) / 2 + 4)} ${f(e[0])} ${f(e[1] + 10 * s)}`; }).join(' '));
  el('title', {}, g).textContent = ginkgo ? '은행나무 — 눌러서 흔들기' : '단풍나무 — 눌러서 흔들기';
  const t: Tree = { x, y, kind, s, g, can, lobes, swing: spring(18, 3.2), shake: pendulum(26, 2.6), ph: r(0, 30), front, drop: r(0, 2), canTop: top };
  g.addEventListener('pointerdown', (e) => { e.stopPropagation(); shakeTree(t, 1); });
  trees.push(t);
  return t;
}
function shakeTree(t: Tree, k: number) {
  t.shake.kick((Math.random() < 0.5 ? -1 : 1) * 2.4 * k);
  const n = Math.round((t.front ? 18 : 9) * k);
  for (let i = 0; i < n; i++) spawnLeaf(t, true);
}

// 뒷줄
(PORTRAIT ? [[14, 'maple'], [92, 'ginkgo'], [176, 'maple'], [250, 'ginkgo'], [356, 'maple'], [442, 'ginkgo'], [528, 'maple']] : [[18, 'ginkgo'], [96, 'maple'], [190, 'ginkgo'], [262, 'maple'], [372, 'maple'], [452, 'ginkgo'], [540, 'maple'], [636, 'ginkgo'], [740, 'maple'], [836, 'ginkgo'], [920, 'maple']]).forEach(([x, k], i) => makeTree(L.backTrees, (x as number) + srnd(-8, 8), HILL + srnd(-2, 2), k as Kind, srnd(0.56, 0.68) * (PORTRAIT ? 1.5 : 1), false, 100 + i * 13));
// 앞줄
(PORTRAIT ? [[34, 'ginkgo', 1.72], [168, 'maple', 1.5], [296, 'ginkgo', 1.86], [430, 'maple', 1.56], [528, 'ginkgo', 1.64]] : [[60, 'ginkgo', 1.0], [178, 'maple', 0.92], [330, 'ginkgo', 1.08], [462, 'maple', 1.0], [612, 'ginkgo', 0.96], [748, 'maple', 1.06], [894, 'ginkgo', 1.02]]).forEach(([x, k, s], i) => makeTree(L.frontTrees, x as number, BACK + 1, k as Kind, s as number, true, 7 + i * 31));

// ------------------------------------------------------------------ 벤치와 가로등
{
  const bx = PORTRAIT ? 226 : 500, by = BACK + 3;
  shape(L.props, SP).setAttribute('d', `M${bx - 26} ${by - 13} L${bx + 26} ${by - 13} L${bx + 27} ${by - 10.5} L${bx - 27} ${by - 10.5}Z`);
  shape(L.props, SP).setAttribute('d', `M${bx - 25} ${by - 26} L${bx + 25} ${by - 26} L${bx + 25} ${by - 22} L${bx - 25} ${by - 22}Z`);
  pen(L.props, SP * 0.5).setAttribute('d', `M${bx - 25} ${by - 18} L${bx + 25} ${by - 18} M${bx - 26} ${by - 12} l52 0`);
  pen(L.props, SP).setAttribute('d', `M${bx - 22} ${by - 26} L${bx - 22} ${by} M${bx + 22} ${by - 26} L${bx + 22} ${by} M${bx - 19} ${by - 10.5} L${bx - 20} ${by + 1} M${bx + 19} ${by - 10.5} L${bx + 20} ${by + 1}`);
}
const LAMP: Vec = [PORTRAIT ? 370 : 548, 262];
{
  const [lx, ly] = LAMP;
  shape(L.props, SP).setAttribute('d', `M${lx - 1.6} ${BACK + 2} L${lx - 1.2} ${ly + 8} L${lx + 1.2} ${ly + 8} L${lx + 1.6} ${BACK + 2}Z`);
  pen(L.props, SP).setAttribute('d', `M${lx - 4} ${BACK + 2} L${lx + 4} ${BACK + 2} M${lx - 2.6} ${BACK - 2} L${lx + 2.6} ${BACK - 2}`);
  shape(L.props, SP).setAttribute('d', `M${lx - 5} ${ly} L${lx + 5} ${ly} L${lx + 3.6} ${ly + 8} L${lx - 3.6} ${ly + 8}Z`);
  shape(L.props, SP).setAttribute('d', `M${lx - 7} ${ly} L${lx + 7} ${ly} L${lx} ${ly - 5}Z`);
  pen(L.props, SP * 0.5).setAttribute('d', `M${lx} ${ly} L${lx} ${ly + 8}`);
}
const lampPane = el('path', { d: `M${LAMP[0] - 4.3} ${LAMP[1] + 0.6} L${LAMP[0] + 4.3} ${LAMP[1] + 0.6} L${LAMP[0] + 3.2} ${LAMP[1] + 7.4} L${LAMP[0] - 3.2} ${LAMP[1] + 7.4}Z`, fill: '#ffd38a', opacity: 0 }, L.props);
const lampGlow = el('circle', { cx: LAMP[0], cy: LAMP[1] + 4, r: 46, fill: 'url(#af-lamp)', opacity: 0 }, glow);
const lampPool = el('ellipse', { cx: LAMP[0], cy: BACK + 10, rx: 48, ry: 9, fill: 'url(#af-warm)', opacity: 0 }, glow);
const lampRefl = pen(glow, 1.4); lampRefl.setAttribute('stroke', '#ffc77a');

// ------------------------------------------------------------------ 억새
interface Reed { x: number; y: number; stalks: { dx: number; h: number; lean: number; ph: number }[]; sw: ReturnType<typeof spring>; stem: SVGPathElement; plume: SVGPathElement }
const reeds: Reed[] = [];
function makeReeds(parent: Element, x: number, y: number, n: number, hs: number) {
  const stem = pen(parent, SP * 0.6), plume = el('path', { fill: 'none', style: 'stroke:var(--plume)', 'stroke-width': SP * 0.9, 'stroke-linecap': 'round' }, parent);
  const plumeInk = pen(parent, SP * 0.35);
  const stalks = Array.from({ length: n }, () => ({ dx: srnd(-7, 7), h: srnd(28, 46) * hs, lean: srnd(-0.25, 0.25), ph: srnd(0, 6) }));
  const leaves = pen(parent, SP * 0.6);
  let d = ''; for (let i = 0; i < n + 2; i++) { const a = srnd(-1, 1); d += `M${f(x + srnd(-5, 5))} ${y} Q${f(x + a * 10)} ${f(y - 14 * hs)} ${f(x + a * 22)} ${f(y - srnd(8, 18) * hs)} `; }
  leaves.setAttribute('d', d);
  const r: Reed & { ink: SVGPathElement } = { x, y, stalks, sw: spring(14, 2.4), stem, plume, ink: plumeInk };
  reeds.push(r);
}
(PORTRAIT ? [[34, HB - 8, 11, 1.9], [160, HB - 30, 9, 1.5], [250, HB - 4, 10, 2.1], [470, HB - 6, 12, 2.0], [520, HB - 70, 7, 1.4], [330, WATER_B + 40, 6, 1.1], [400, WATER - 3, 5, 0.8], [52, WATER - 2, 5, 0.75]] : [[30, H - 6, 9, 1.1], [118, H - 4, 7, 1.0], [430, H - 3, 6, 0.9], [700, H - 4, 8, 1.15], [852, H - 6, 9, 1.05], [400, WATER - 3, 5, 0.75], [880, WATER - 2, 6, 0.8], [52, WATER - 2, 5, 0.7]]).forEach(([x, y, n, hs]) => makeReeds(L.near, x, y, n, hs));

// ------------------------------------------------------------------ 앞쪽 단풍 가지 (왼쪽 위 모서리)
const branchG = el('g', { style: 'cursor:pointer' }, L.branch);
const branchClusters: { x: number; y: number }[] = [];
{
  const r = seeded(77);
  limb(branchG, 7, SP * 1.1).draw([[-14, 6], [70, 22], [168, 30]], [0.4, 1]);
  limb(branchG, 3.6, SP).draw([[60, 20], [92, 40], [124, 62]], [0.4, 1]);
  limb(branchG, 3, SP).draw([[120, 27], [150, 14], [190, 10]], [0.4, 1]);
  const tw = pen(branchG, SP * 0.7);
  tw.setAttribute('d', 'M168 30 q12 2 22 10 M124 62 q6 8 6 18 M40 16 q-4 14 2 24 M100 26 q10 -12 4 -22 M150 14 q8 -10 18 -10');
  const spots: Vec[] = [[188, 40], [132, 80], [44, 42], [104, 2], [170, 2], [150, 34], [78, 34], [196, 12], [116, 48]];
  for (const [cx, cy] of spots) {
    branchClusters.push({ x: cx, y: cy });
    for (let i = 0; i < 6; i++) {
      const lx = cx + r(-9, 9), ly = cy + r(-7, 7), s = r(4.2, 6), rot = r(-40, 40) + 180;
      el('path', { d: MAPLE, transform: `translate(${f(lx)} ${f(ly)}) rotate(${f(rot)}) scale(${f(s)})`, style: vfill(pick(MAPLE_COLS)), stroke: 'currentColor', 'stroke-width': f(SP / s), 'stroke-linejoin': 'round' }, branchG);
      el('path', { d: MAPLE_VEIN, transform: `translate(${f(lx)} ${f(ly)}) rotate(${f(rot)}) scale(${f(s)})`, fill: 'none', stroke: 'currentColor', 'stroke-width': f(SP * 0.4 / s), opacity: 0.6 }, branchG);
    }
  }
  el('title', {}, branchG).textContent = '단풍 가지 — 눌러서 흔들기';
}
const branchSw = spring(16, 2.6), branchShake = pendulum(24, 2.4);
branchG.addEventListener('pointerdown', (e) => { e.stopPropagation(); branchShake.kick(2.2); for (let i = 0; i < 12; i++) spawnBranchLeaf(true); });

// ------------------------------------------------------------------ 잎 입자
interface Leaf { n: SVGGElement; kind: Kind; x: number; y: number; vx: number; vy: number; r: number; spin: number; ph: number; fl: number; s: number; state: 'fall' | 'rest' | 'float'; ty: number; life: number; bob: number; dead?: boolean }
const leaves: Leaf[] = [];
let restCount = 0;
function leafNode(kind: Kind, col: string, s: number, parent: Element) {
  const g = el('g', {}, parent);
  el('path', { d: kind === 'maple' ? MAPLE : GINKGO, style: vfill(col), stroke: 'currentColor', 'stroke-width': f(SP * 0.55 / s), 'stroke-linejoin': 'round' }, g);
  el('path', { d: kind === 'maple' ? MAPLE_VEIN : GINKGO_VEIN, fill: 'none', stroke: 'currentColor', 'stroke-width': f(SP * 0.35 / s), opacity: 0.55 }, g);
  return g;
}
function landingY(fromY: number) {
  const u = Math.random();
  if (u < 0.5) return rnd(Math.max(BACK + 2, fromY + 30), FRONT - 1);
  if (u < 0.72) return rnd(FRONT + 2, WATER - 2);
  if (u < 0.94) return rnd(WATER + 4, WATER_B - 4);
  return rnd(WATER_B + 6, HB - 4);
}
function addLeaf(kind: Kind, col: string, x: number, y: number, s: number, burst: boolean, ty?: number) {
  if (leaves.length > 620) return;
  const l: Leaf = { n: leafNode(kind, col, s, L.fall), kind, x, y, vx: rnd(-6, 6) + (burst ? rnd(-14, 14) : 0), vy: burst ? rnd(-14, 4) : rnd(2, 8), r: rnd(0, 360), spin: rnd(-120, 120), ph: rnd(0, 6), fl: rnd(0, 6), s, state: 'fall', ty: ty ?? landingY(y), life: 0, bob: 0 };
  leaves.push(l);
}
function spawnLeaf(t: Tree, burst = false) {
  const lb = pick(t.lobes);
  const a = rnd(0, 6.28), rr = Math.sqrt(Math.random()) * 0.85;
  const kind = t.kind;
  const col = pick(kind === 'ginkgo' ? GINKGO_COLS : MAPLE_COLS);
  const s = (kind === 'ginkgo' ? rnd(2.6, 3.4) : rnd(2.8, 3.8)) * (t.front ? 1 : 0.72);
  const [x, y] = treePoint(t, lb.cx + Math.cos(a) * lb.rx * rr, lb.cy + Math.sin(a) * lb.ry * rr);
  addLeaf(kind, col, x, y, s, burst, t.front ? undefined : rnd(HILL - 2, BACK - 2));
}
function spawnBranchLeaf(burst = false) {
  const c = pick(branchClusters);
  addLeaf('maple', pick(MAPLE_COLS), (c.x + rnd(-8, 8)) * BS, (c.y + rnd(-6, 6)) * BS - GY, rnd(3.6, 4.6) * BS, burst, Math.random() < 0.6 ? rnd(WATER + 4, WATER_B - 4) : rnd(WATER_B + 6, HB - 4));
}
const treeAngle = new Map<Tree, number>();
function treePoint(t: Tree, x: number, y: number): Vec {
  const a = (treeAngle.get(t) ?? 0) * Math.PI / 180;
  const dx = x - t.x, dy = y - t.y;
  return [t.x + dx * Math.cos(a) - dy * Math.sin(a), t.y + dx * Math.sin(a) + dy * Math.cos(a)];
}
function setLeafTf(l: Leaf) {
  if (l.state === 'fall') {
    const sx = Math.cos(l.fl); const k = Math.sign(sx || 1) * Math.max(0.18, Math.abs(sx));
    l.n.setAttribute('transform', `translate(${f(l.x)} ${f(l.y)}) rotate(${f(l.r)}) scale(${f(k * l.s)} ${f(l.s)})`);
  } else {
    l.n.setAttribute('transform', `translate(${f(l.x)} ${f(l.y)}) scale(1 0.55) rotate(${f(l.r)}) scale(${f(l.s)})`);
  }
}
// 처음부터 땅에 쌓여 있는 잎 (은행나무 아래는 노란 융단)
{
  const r = seeded(5);
  const front = trees.filter((t) => t.front);
  for (let i = 0; i < (PORTRAIT ? 440 : 300); i++) {
    let x: number, y: number, kind: Kind;
    const u = r();
    if (u < 0.45) { const t = front[(r() * front.length) | 0]; x = t.x + r(-60, 60) * (t.kind === 'ginkgo' ? 1 : 1.2); y = r(BACK + 1, BACK + 16); kind = t.kind; if (r() < 0.25) kind = kind === 'ginkgo' ? 'maple' : 'ginkgo'; }
    else if (u < 0.7) { x = r(0, W); y = r(BACK + 2, FRONT - 1); kind = r() < 0.55 ? 'ginkgo' : 'maple'; }
    else if (u < 0.88) { x = r(0, W); y = r(FRONT + 2, WATER - 2); kind = r() < 0.5 ? 'ginkgo' : 'maple'; }
    else { x = r(0, W); y = r(WATER_B + 4, HB - 3); kind = r() < 0.35 ? 'ginkgo' : 'maple'; }
    const col = kind === 'ginkgo' ? GINKGO_COLS[(r() * 3) | 0] : MAPLE_COLS[(r() * 4) | 0];
    const s = kind === 'ginkgo' ? r(2.5, 3.4) : r(2.7, 3.7);
    const l: Leaf = { n: leafNode(kind, col, s, L.restLeaves), kind, x, y, vx: 0, vy: 0, r: r(0, 360), spin: 0, ph: r(0, 6), fl: 0, s, state: 'rest', ty: y, life: r(0, 60), bob: 0 };
    if (y > WATER_B) L.near.insertBefore(l.n, L.near.firstChild);
    setLeafTf(l); leaves.push(l); restCount++;
  }
}
function kick(x: number, y: number, dir: number, rad: number, power: number) {
  for (const l of leaves) {
    if (l.state !== 'rest' || l.y > WATER) continue;
    const dx = l.x - x, dy = (l.y - y) * 1.6;
    if (dx * dx + dy * dy < rad * rad) {
      l.state = 'fall'; l.vy = -rnd(8, 22) * power; l.vx = dir * rnd(6, 20) * power + dx * 0.6; l.spin = rnd(-300, 300); l.ty = clamp(l.y + rnd(-3, 4), BACK + 1, WATER - 2);
      L.fall.appendChild(l.n); restCount--;
    }
  }
}

// ------------------------------------------------------------------ 사람들
interface Actor { g: SVGGElement; y: number; dead?: boolean; draw(t: number, dt: number, P: Palette): void }
const actors: Actor[] = [];

function lookTree(x: number) { let best: Tree | null = null, bd = 1e9; for (const t of trees) if (t.front) { const d = Math.abs(t.x - x); if (d < bd) { bd = d; best = t; } } return best; }

function makeAdult(kind: 'coat' | 'grandpa', lane: number, dir: 1 | -1, x0: number): Actor {
  const g = el('g', { style: 'cursor:pointer' }, L.actors);
  const fig = el('g', {}, g);
  const old = kind === 'grandpa';
  const farArm = limb(fig, 3.6);
  const legs = [limb(fig, 4.2), limb(fig, 4.2)];
  if (old) legs.forEach((l) => solidV(l, '--trou')); else legs.forEach((l) => solidV(l, '--tights'));
  const shoes = [blot(fig), blot(fig)];
  const coat = paintV(fig, old ? '--vest' : '--coat', PEN);
  const seam = pen(fig, PEN * 0.55);
  const headG = el('g', {}, fig);
  const hairBack = blot(headG);
  el('ellipse', { cx: 0, cy: 0, rx: 3.7, ry: 4.6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN }, headG);
  const hat = paintV(headG, old ? '--cap' : '--beret', PEN * 0.8);
  const scarf = paintV(fig, '--scarf', PEN * 0.8);
  const tote = el('g', {}, fig);
  const toteBag = paintV(tote, '--tote', PEN * 0.8), toteStrap = pen(tote, PEN * 0.7);
  const nearArm = limb(fig, 3.6);
  const cane = pen(fig, PEN * 1.1);
  el('rect', { x: 26, y: 24, width: 30, height: 98, fill: 'transparent' }, fig);
  el('title', {}, g).textContent = old ? '산책하는 할아버지' : '산책하는 사람';
  hairBack.setAttribute('d', old ? 'M-3.4 -1 Q-4.2 2.6 -2 4 L-1 1Z' : 'M-3.8 -2 Q-5 3.6 -3 5.6 Q-1 6 0.6 4.6 L-1 0 Q0 -3 3.6 -2.4 Q2 -5.2 -1 -4.8 Q-3.6 -4.4 -3.8 -2Z');
  hat.setAttribute('d', old ? 'M-4 -2.2 Q-3.6 -6 0.4 -6 Q3.8 -5.8 4 -2.8 L7.2 -2.2 Q5 -1.4 -4 -1.6Z' : 'M-5.4 -3.4 Q-4.6 -7.4 0.6 -7.2 Q5.4 -7 5 -3.6 Q0 -2.4 -5.4 -3.4Z M0.2 -7.2 l0.4 -1.4');
  const walk = gait(old ? { kind: 'shuffle', period: 1.15 } : { kind: 'walk', period: 1.04 });
  const arms = [spring(60, 9), spring(60, 9)];
  const bag = pendulum(12, 1.6);
  const scarfS = spring(30, 4);
  let phase = Math.random(), x = x0, look = -1, shookTree = false;
  g.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (look < 0) { look = 0; shookTree = false; } });
  const a: Actor = {
    g, y: lane,
    draw(t, dt) {
      let gest = 0;
      if (look >= 0) {
        look += dt;
        gest = look < 0.5 ? ease(look / 0.5) : look < 2.6 ? 1 : 1 - ease((look - 2.6) / 0.6);
        if (look > 0.7 && !shookTree) { shookTree = true; const tr = lookTree(x); if (tr) shakeTree(tr, 0.45); }
        if (look > 3.2) look = -1;
      }
      const go = 1 - gest;
      phase += (dt / walk.period) * go;
      x += dir * walk.speed * FS * dt * go;
      if (x < -60 || x > W + 60) a.dead = true;
      place(g, x, lane, dir, FS);
      const p = walk.pose(phase, go);
      const b = p.bob;
      const hunch = old ? 2.6 : 0;
      p.feet.forEach((fo, i) => { legs[i].draw([p.hip, fo.knee, fo.ankle], [0.3, 0.8]); shoe(shoes[i], fo.ankle, fo.pitch); });
      fig.insertBefore(legs[p.front].g, coat); fig.insertBefore(shoes[p.front], coat);
      const kF = p.feet[p.front].knee, aF = p.feet[p.front].ankle, aB = p.feet[1 - p.front].ankle;
      const sh: Vec = [41 + hunch, 41 + b + hunch * 0.6];
      const hemY = old ? 82 : 99;
      const fx = Math.max(old ? 46 : kF[0] + 2.6, 46.6);
      const front = old ? `L${f(fx)} ${f(70 + b)} Q${f(fx + 0.4)} ${f(77 + b)} ${f(fx - 0.6)} ${hemY}` : `L${f(fx - 0.6)} ${f(70 + b)} Q${f(fx)} ${f(84 + b * 0.5)} ${f(Math.max(fx, aF[0] - 3))} ${hemY}`;
      const backX = old ? 32.4 : Math.min(31.4, aB[0] + 3.4);
      coat.setAttribute('d', `M${f(sh[0] - 6)} ${f(sh[1] + 1)} Q${f(sh[0] - 1)} ${f(sh[1] - 2.4)} ${f(sh[0] + 5)} ${f(sh[1] + 1)} ${front} Q${f((fx + backX) / 2)} ${hemY + 1.4} ${f(backX)} ${hemY} L${f(33.2 + hunch * 0.3)} ${f(70 + b)}Z`);
      seam.setAttribute('d', `M${f(sh[0] + 2.6)} ${f(sh[1] + 4)} L${f(sh[0] + (old ? 3.4 : 4.2))} ${f((old ? 78 : 92) + b * 0.5)}` + (old ? ` M${f(sh[0] + 1)} ${f(sh[1] + 13)} l2.4 0.6` : ` M${f(sh[0] - 4.6)} ${f(66 + b)} l7 0.8`));
      // 머리: 올려다보기
      const hc: Vec = [42.6 + hunch * 1.3, 31.6 + b + hunch * 0.9];
      headG.setAttribute('transform', `translate(${f(hc[0])} ${f(hc[1])}) rotate(${f(-24 * gest)} 0 3)`);
      scarf.setAttribute('d', `M${f(hc[0] - 4.6)} ${f(hc[1] + 4.6)} Q${f(hc[0])} ${f(hc[1] + 8.4)} ${f(hc[0] + 4)} ${f(hc[1] + 4.8)} L${f(hc[0] + 4.4)} ${f(hc[1] + 7.6)} Q${f(hc[0])} ${f(hc[1] + 11)} ${f(hc[0] - 4.8)} ${f(hc[1] + 7.4)}Z` + (old ? '' : (() => { const fl = scarfS.step(-4 - wind.value * 4 * dir - go * 2 + Math.sin(t * 8) * 0.6, dt); return ` M${f(hc[0] - 3)} ${f(hc[1] + 7)} Q${f(hc[0] - 4 + fl * 0.4)} ${f(hc[1] + 12)} ${f(hc[0] - 2 + fl)} ${f(hc[1] + 19)} L${f(hc[0] + 0.6 + fl * 0.9)} ${f(hc[1] + 18.6)} Q${f(hc[0] - 1 + fl * 0.3)} ${f(hc[1] + 12)} ${f(hc[0] - 0.2)} ${f(hc[1] + 8)}Z`; })()));
      // 팔
      const legSwing = (p.feet[0].ankle[0] - 40) / (walk.stride / 2);
      const farA = arms[0].step(-legSwing * (old ? 8 : 15) * go, dt) * Math.PI / 180;
      const nearA = arms[1].step(legSwing * (old ? 6 : 13) * go, dt) * Math.PI / 180;
      const shF: Vec = [sh[0] - 1, sh[1] + 2], shN: Vec = [sh[0] + 1.6, sh[1] + 2.4];
      const elbF: Vec = [shF[0] + 17 * Math.sin(farA), shF[1] + 17 * Math.cos(farA)];
      farArm.draw([shF, elbF, [elbF[0] + 16 * Math.sin(farA + 0.25), elbF[1] + 16 * Math.cos(farA + 0.25)]], [0.2, 0.5]);
      if (old) {
        // 지팡이 짚은 손: 팔꿈치를 굽혀 앞으로
        const hand: Vec = [shN[0] + 10 + 4 * Math.sin(nearA * 3), shN[1] + 29];
        const elb: Vec = [shN[0] + 2 + 2 * gest, shN[1] + 17];
        const up: Vec = [hc[0] + 12, hc[1] - 10];
        const hd: Vec = [lerp(hand[0], up[0], gest * 0.0), lerp(hand[1], up[1], 0)];
        nearArm.draw([shN, elb, hd], [0.2, 0.4]);
        const tip: Vec = [hd[0] + 3 + legSwing * 2.4 * go, 120];
        cane.setAttribute('d', `M${f(hd[0] - 3.4)} ${f(hd[1] - 0.6)} Q${f(hd[0] - 1.6)} ${f(hd[1] - 3.6)} ${f(hd[0] + 0.4)} ${f(hd[1] - 0.4)} L${f(tip[0])} ${f(tip[1])}`);
        tote.style.display = 'none';
      } else {
        // 올려다보며 손을 뻗어 떨어지는 잎을 받으려 한다
        const swingElb: Vec = [shN[0] + 17 * Math.sin(nearA), shN[1] + 17 * Math.cos(nearA)];
        const swingHand: Vec = [swingElb[0] + 16 * Math.sin(nearA + 0.1), swingElb[1] + 16 * Math.cos(nearA + 0.1)];
        const reachH: Vec = [hc[0] + 13, hc[1] - 12], reachE: Vec = [shN[0] + 12, shN[1] - 2];
        const e2: Vec = [lerp(swingElb[0], reachE[0], gest), lerp(swingElb[1], reachE[1], gest)];
        const h2: Vec = [lerp(swingHand[0], reachH[0], gest), lerp(swingHand[1], reachH[1], gest)];
        nearArm.draw([shN, e2, h2], [0.2, 0.4]);
        cane.style.display = 'none';
        const accel = Math.cos(2 * Math.PI * phase * 2) * 1.4 * go;
        const ba = bag.step(-accel - wind.value * 0.4 * dir, dt);
        const top: Vec = [sh[0] - 1.6, sh[1] + 1];
        tote.setAttribute('transform', `rotate(${f(ba * 57.3)} ${pt(top)})`);
        toteStrap.setAttribute('d', `M${f(top[0] - 1.6)} ${f(top[1])} L${f(top[0] - 4.6)} ${f(top[1] + 25)} M${f(top[0] + 1.6)} ${f(top[1])} L${f(top[0] + 4)} ${f(top[1] + 25)}`);
        toteBag.setAttribute('d', `M${f(top[0] - 7)} ${f(top[1] + 24)} L${f(top[0] + 6.4)} ${f(top[1] + 24)} L${f(top[0] + 7.4)} ${f(top[1] + 38)} Q${f(top[0])} ${f(top[1] + 39.4)} ${f(top[0] - 8)} ${f(top[1] + 38)}Z`);
      }
      if (go > 0.4 && Math.random() < dt * 3) { const fo = p.feet[p.front]; if (!fo.stance) kick(x + dir * 4, lane, dir, 5, 0.6); }
    },
  };
  actors.push(a);
  return a;
}

function makeKid(lane: number, dir: 1 | -1, x0: number): Actor {
  const g = el('g', { style: 'cursor:pointer' }, L.actors);
  const fig = el('g', {}, g);
  const pack = paintV(fig, '--pack', PEN * 0.8);
  const farArm = limb(fig, 3.2);
  const legs = [limb(fig, 3.6), limb(fig, 3.6)];
  const shoes = [blot(fig), blot(fig)];
  const shorts = paintV(fig, '--shorts', PEN * 0.8);
  const jacket = paintV(fig, '--kid', PEN);
  const zip = pen(fig, PEN * 0.55);
  const headG = el('g', {}, fig);
  el('ellipse', { cx: 0, cy: 0, rx: 5.6, ry: 6, fill: PAPER, stroke: 'currentColor', 'stroke-width': PEN }, headG);
  blot(headG).setAttribute('d', 'M-5.6 -0.6 Q-6.4 -6.8 0 -6.6 Q4.6 -6.6 5.6 -3 Q1 -4.4 -2 -2.2 Q-3.4 -0.8 -5.6 -0.6Z');
  paintV(headG, '--m1', PEN * 0.8).setAttribute('d', 'M-5.8 -2.6 Q-5.4 -8.6 0.4 -8.4 Q5.6 -8.2 5.6 -3.6 L10.2 -3 Q8 -1.8 -5.8 -2.6Z');
  const nearArm = limb(fig, 3.2);
  el('rect', { x: 28, y: 52, width: 26, height: 70, fill: 'transparent' }, fig);
  el('title', {}, g).textContent = '뛰어노는 아이';
  const run = gait({ kind: 'run' });
  const arms = [spring(90, 10), spring(90, 10)];
  let phase = Math.random(), x = x0, hop = -1, landed = 0;
  g.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (hop < 0) { hop = 0; landed = 0; } });
  const a: Actor = {
    g, y: lane,
    draw(t, dt) {
      let go = 1, jump = 0;
      if (hop >= 0) {
        hop += dt;
        go = hop < 0.3 ? 1 - ease(hop / 0.3) : hop < 2.3 ? 0 : ease((hop - 2.3) / 0.4);
        const hj = hop - 0.35;
        if (hj > 0 && hj < 1.8) { const k = (hj % 0.9) / 0.9; jump = Math.sin(Math.PI * clamp(k * 1.25, 0, 1)) * 14; const n = Math.floor(hj / 0.9); if (k > 0.8 && landed <= n) { landed = n + 1; kick(x, lane, dir, 16, 1.4); for (let i = 0; i < 6; i++) { const kind: Kind = Math.random() < 0.5 ? 'ginkgo' : 'maple'; addLeaf(kind, pick(kind === 'ginkgo' ? GINKGO_COLS : MAPLE_COLS), x + rnd(-8, 8), lane - 2, rnd(2, 2.8), true, clamp(lane + rnd(-4, 6), BACK + 1, FRONT - 1)); } } }
        if (hop > 2.7) hop = -1;
      }
      phase += (dt / run.period) * go;
      x += dir * run.speed * FS * dt * go * 0.82;
      if (x < -60 || x > W + 60) a.dead = true;
      place(g, x, lane - jump * FS, dir, FS);
      const p = run.pose(phase, go);
      const b = p.bob;
      p.feet.forEach((fo, i) => { legs[i].draw([p.hip, fo.knee, fo.ankle], [0.2, 0.6]); shoe(shoes[i], [fo.ankle[0], fo.ankle[1] + 0.6], fo.pitch); });
      fig.insertBefore(legs[p.front].g, shorts); fig.insertBefore(shoes[p.front], shorts);
      const lean = 3 * go;
      const hip = p.hip, sh: Vec = [hip[0] + 1.5 + lean, hip[1] - 18 + b * 0.3];
      shorts.setAttribute('d', `M${f(hip[0] - 5)} ${f(hip[1] - 3)} L${f(hip[0] + 5.4)} ${f(hip[1] - 3)} L${f(hip[0] + 6)} ${f(hip[1] + 4.4)} L${f(hip[0] - 5.6)} ${f(hip[1] + 4.4)}Z`);
      jacket.setAttribute('d', `M${f(sh[0] - 5.4)} ${f(sh[1])} Q${f(sh[0])} ${f(sh[1] - 2.4)} ${f(sh[0] + 5.2)} ${f(sh[1])} L${f(hip[0] + 6.4)} ${f(hip[1] - 1)} Q${f(hip[0])} ${f(hip[1] + 0.6)} ${f(hip[0] - 6)} ${f(hip[1] - 1)}Z`);
      zip.setAttribute('d', `M${f(sh[0] + 2.4)} ${f(sh[1] + 1)} L${f(hip[0] + 3.4)} ${f(hip[1] - 1)}`);
      pack.setAttribute('d', `M${f(sh[0] - 4)} ${f(sh[1] + 1)} Q${f(sh[0] - 11)} ${f(sh[1] + 2)} ${f(sh[0] - 10)} ${f(sh[1] + 10)} Q${f(sh[0] - 10)} ${f(sh[1] + 15)} ${f(sh[0] - 4.4)} ${f(sh[1] + 14)}Z`);
      headG.setAttribute('transform', `translate(${f(sh[0] + 1.6)} ${f(sh[1] - 8.4)}) rotate(${f(-8 * (1 - go) * (jump > 0 ? 1 : 0))})`);
      const legSwing = (p.feet[0].ankle[0] - 40) / (run.stride / 2);
      const cheer = hop >= 0 ? 1 - go : 0;
      const A = (s: ReturnType<typeof spring>, sg: number) => s.step(sg * legSwing * 42 * go - cheer * 150, dt) * Math.PI / 180;
      const fa = A(arms[0], -1), na = A(arms[1], 1);
      const shF: Vec = [sh[0] - 1, sh[1] + 1.4], shN: Vec = [sh[0] + 1.4, sh[1] + 1.8];
      const arm = (s0: Vec, an: number): Vec[] => { const e: Vec = [s0[0] + 9 * Math.sin(an), s0[1] + 9 * Math.cos(an)]; const bend = an + 1.5 * go + (cheer ? 0.3 : 0); return [s0, e, [e[0] + 8 * Math.sin(bend), e[1] + 8 * Math.cos(bend)]]; };
      farArm.draw(arm(shF, fa), [0.2, 0.4]); nearArm.draw(arm(shN, na), [0.2, 0.4]);
      if (go > 0.5 && Math.random() < dt * 5) kick(x + dir * 3, lane, dir, 7, 1);
    },
  };
  actors.push(a);
  return a;
}

// ------------------------------------------------------------------ 다람쥐 (등에 줄무늬)
function makeSquirrel(): Actor {
  const g = el('g', { style: 'cursor:pointer' }, L.actors);
  const tail = paintV(g, '--sq', SP * 0.8);
  const legsP = pen(g, SP * 1.1);
  const feet = blot(g);
  const body = paintV(g, '--sq', SP * 0.9);
  const belly = el('path', { fill: PAPER }, g);
  const stripes = pen(g, SP * 0.6);
  const head = paintV(g, '--sq', SP * 0.9);
  const eye = blot(g);
  const ear = paintV(g, '--sq', SP * 0.6);
  el('rect', { x: -14, y: -18, width: 26, height: 20, fill: 'transparent' }, g);
  el('title', {}, g).textContent = '다람쥐';
  const y = FRONT - 2;
  let x = -20, dir: 1 | -1 = 1, state: 'run' | 'sit' | 'dash' | 'away' = 'run', target = rnd(160, 420), timer = 0, ph = 0, sitK = 0;
  g.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state !== 'dash' && state !== 'away') { state = 'dash'; dir = x > W / 2 ? 1 : -1; } });
  const a: Actor = {
    g, y,
    draw(t, dt) {
      let speed = 0;
      if (state === 'run') { speed = 46; if ((target - x) * dir <= 0) { state = 'sit'; timer = rnd(2.5, 5); } }
      else if (state === 'sit') { timer -= dt; if (timer < 0) { state = 'run'; if (Math.random() < 0.35) dir = (dir * -1) as 1 | -1; target = clamp(x + dir * rnd(90, 280), 30, W - 30); if ((target - x) * dir <= 0) { dir = (dir * -1) as 1 | -1; target = clamp(x + dir * rnd(90, 280), 30, W - 30); } } }
      else if (state === 'dash') { speed = 120; if (x < -30 || x > W + 30) { state = 'away'; timer = rnd(10, 18); } }
      else { timer -= dt; g.style.display = 'none'; if (timer < 0) { g.style.display = ''; dir = Math.random() < 0.5 ? 1 : -1; x = dir > 0 ? -20 : W + 20; target = rnd(120, W - 120); state = 'run'; } return; }
      x += dir * speed * dt;
      ph += dt * (speed > 0 ? speed / 22 : 0);
      sitK = lerp(sitK, state === 'sit' ? 1 : 0, 1 - Math.exp(-dt * 10));
      g.setAttribute('transform', `translate(${f(x)} ${f(y)}) scale(${dir} 1)`);
      const s = Math.sin(ph * Math.PI * 2), c = Math.cos(ph * Math.PI * 2);
      const lift = Math.max(0, s) * 3.2 * (1 - sitK);
      const nib = state === 'sit' ? Math.sin(t * 14) * 0.25 : 0;
      const L2 = (r: Vec, q: Vec): Vec => [lerp(r[0], q[0], sitK), lerp(r[1], q[1], sitK)];
      const T = L2([-6.5, -4.2 - lift + c * 0.6], [-3, -1.6]);
      const B = L2([-0.5, -7.6 - lift - s * 0.8], [-3.2, -7.4]);
      const N = L2([4.4, -6.4 - lift], [-0.6, -11]);
      const Hd = L2([7.2, -6 - lift + s * 0.3], [0.6, -13.4 + nib]);
      const Hp = L2([-4, -3 - lift], [-2, -1.4]);
      const Sh = L2([3.4, -3.6 - lift], [0, -8]);
      const HF = L2([-4 - c * 4, s > 0 ? -lift * 0.6 : 0], [-1.6, 0]);
      const FF = L2([3.6 + c * 4, s < 0 ? -lift * 0.4 : 0], [1.8, -10.6 + nib]);
      body.setAttribute('d', `M${pt(T)} Q${pt(B)} ${pt(N)} Q${f(Sh[0] + 1)} ${f(Sh[1] + 1.4)} ${pt(Sh)} Q${f((Sh[0] + Hp[0]) / 2)} ${f(Math.max(Sh[1], Hp[1]) + 1.2)} ${pt(Hp)} Q${f(T[0] - 0.4)} ${f(T[1] + 1.6)} ${pt(T)}Z`);
      belly.setAttribute('d', `M${f(Hp[0] + 1)} ${f(Hp[1] - 0.4)} Q${f((Sh[0] + Hp[0]) / 2)} ${f(Math.max(Sh[1], Hp[1]) + 0.4)} ${f(Sh[0])} ${f(Sh[1] - 0.6)} Q${f((Sh[0] + Hp[0]) / 2)} ${f(Math.max(Sh[1], Hp[1]) - 1.2)} ${f(Hp[0] + 1)} ${f(Hp[1] - 0.4)}Z`);
      const m: Vec = [(T[0] + N[0]) / 2, (T[1] + N[1]) / 2];
      const bx = B[0] - m[0], by = B[1] - m[1];
      stripes.setAttribute('d', `M${f(T[0] + 1.2)} ${f(T[1] - 0.8)} Q${f(B[0] - bx * 0.25)} ${f(B[1] - by * 0.25)} ${f(N[0] - 0.8)} ${f(N[1] + 0.6)} M${f(T[0] + 1.8)} ${f(T[1] + 0.4)} Q${f(B[0] - bx * 0.55)} ${f(B[1] - by * 0.55)} ${f(N[0] - 1.2)} ${f(N[1] + 1.6)}`);
      head.setAttribute('d', oval(Hd[0], Hd[1], 2.6, 2.2) + `M${f(Hd[0] + 2)} ${f(Hd[1] - 0.6)} L${f(Hd[0] + 3.8)} ${f(Hd[1] + 0.4)} L${f(Hd[0] + 2)} ${f(Hd[1] + 1.2)}Z`);
      eye.setAttribute('d', oval(Hd[0] + 1.1, Hd[1] - 0.5, 0.45, 0.45));
      ear.setAttribute('d', `M${f(Hd[0] - 1.2)} ${f(Hd[1] - 1.6)} L${f(Hd[0] - 0.8)} ${f(Hd[1] - 3.8)} L${f(Hd[0] + 0.4)} ${f(Hd[1] - 1.8)}Z`);
      legsP.setAttribute('d', `M${pt(Hp)} Q${f(Hp[0] - 1)} ${f(Hp[1] + 2)} ${pt(HF)} M${pt(Sh)} L${pt(FF)}`);
      feet.setAttribute('d', oval(HF[0] + 0.6, HF[1] - 0.2, 1.2, 0.6) + oval(FF[0] + 0.3, FF[1], 0.7, 0.6));
      // 꼬리: 풍성하게 말려 올라감, 바람에 살짝
      const wv = wind.value * 0.8 * -dir;
      const t1 = L2([-12, -7 - lift - s * 2], [-7.6, -6]), t2 = L2([-12 + wv, -14 - lift - s * 1.4], [-7 + wv, -14]), t3 = L2([-8, -15 - lift], [-3.6, -16.4]);
      tail.setAttribute('d', `M${f(T[0] + 0.6)} ${f(T[1] - 0.8)} Q${pt(t1)} ${pt(t2)} Q${f(t2[0] + 1)} ${f(t3[1] - 0.8)} ${pt(t3)} Q${f(t3[0] - 1)} ${f(t3[1] + 2)} ${f(t2[0] + 2.6)} ${f(t2[1] + 1.6)} Q${f(t1[0] + 3.4)} ${f(t1[1] + 1.4)} ${f(T[0] + 0.4)} ${f(T[1] + 1)}Z`);
    },
  };
  actors.push(a);
  return a;
}

// ------------------------------------------------------------------ 까치
function makeMagpie(home: Vec): Actor {
  const g = el('g', { style: 'cursor:pointer' }, L.actors);
  const tailN = blot(g);
  const wingFar = blot(g);
  const legs = pen(g, SP * 0.6);
  const body = shape(g, SP * 0.8);
  const back = blot(g);
  const shoulder = el('path', { fill: PAPER }, g);
  const head = blot(g);
  const beak = blot(g);
  const wingNear = blot(g);
  el('rect', { x: -10, y: -12, width: 20, height: 13, fill: 'transparent' }, g);
  el('title', {}, g).textContent = '까치';
  let x = home[0], y = home[1], dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  let state: 'perch' | 'fly' | 'gone' | 'land' = 'perch', idle = rnd(0.5, 2), act: 'peck' | 'hop' | null = null, actT = 0, flap = 0, vx = 0, vy = 0, timer = 0;
  let from: Vec = [0, 0], to: Vec = [0, 0], lt = 0;
  const fly = () => { if (state !== 'perch') return; state = 'fly'; dir = Math.random() < 0.5 ? 1 : -1; vx = dir * rnd(70, 95); vy = -rnd(40, 60); };
  g.addEventListener('pointerdown', (e) => { e.stopPropagation(); fly(); });
  const a: Actor & { scare: () => void } = {
    g, y, scare: fly,
    draw(t, dt, P) {
      let hopY = 0, peck = 0, wing = 0;
      if (state === 'perch') {
        if (P.night > 0.5) fly();
        idle -= dt;
        if (!act && idle < 0) { act = Math.random() < 0.55 ? 'peck' : 'hop'; actT = 0; if (act === 'hop' && Math.random() < 0.3) dir = (dir * -1) as 1 | -1; }
        if (act) {
          actT += dt;
          if (act === 'peck') { peck = Math.sin(Math.PI * clamp(actT / 0.35, 0, 1)); if (actT > 0.35) { if (Math.random() < 0.5) actT = 0.0001; else { act = null; idle = rnd(1, 3.5); } } }
          else { const k = clamp(actT / 0.3, 0, 1); hopY = Math.sin(Math.PI * k) * 3; x += dir * 22 * dt; if (k >= 1) { act = null; idle = rnd(0.8, 3); } }
        }
        wing = 0;
      } else if (state === 'fly') {
        flap += dt * 11; wing = Math.sin(flap);
        vy += (-12 - vy) * dt * 0.8; x += vx * dt; y += vy * dt;
        if (x < -30 || x > W + 30 || y < -30) { state = 'gone'; timer = rnd(9, 16); g.style.display = 'none'; }
      } else if (state === 'gone') {
        timer -= dt;
        if (timer < 0 && P.night < 0.4) { state = 'land'; g.style.display = ''; dir = Math.random() < 0.5 ? 1 : -1; from = [dir > 0 ? -20 : W + 20, rnd(120, 200)]; to = [rnd(60, W - 60), pick([rnd(BACK + 3, FRONT - 3), rnd(FRONT + 6, WATER - 3)])]; lt = 0; }
      } else {
        lt += dt / 3.2; flap += dt * (lt < 0.8 ? 10 : 16); wing = lt < 0.9 ? Math.sin(flap) : 0;
        const k = ease(clamp(lt, 0, 1));
        x = lerp(from[0], to[0], k); y = lerp(from[1], to[1], k) - Math.sin(Math.PI * k) * 30;
        if (lt >= 1) { state = 'perch'; y = to[1]; idle = 1; }
      }
      a.y = state === 'perch' ? y : 999;
      const air = state === 'fly' || (state === 'land' && lt < 0.92);
      g.setAttribute('transform', `translate(${f(x)} ${f(y - hopY)}) scale(${dir} 1)`);
      const pk = peck * 4;
      body.setAttribute('d', `M-5.2 -5.2 Q-1 -9.2 3.2 -7 Q5 -5.4 4 -3 Q1 -1 -3.8 -2.6Z`);
      back.setAttribute('d', `M-5.2 -5.2 Q-1 -9.2 3.2 -7 Q2.4 -5.4 0.4 -5.4 Q-2.4 -5.2 -5.2 -4.4Z`);
      shoulder.setAttribute('d', `M-3.2 -5.6 Q-0.6 -6.4 1.4 -5.8 Q-0.6 -5 -3.2 -5.6Z`);
      const hx = 4.4 + pk * 0.4, hy = -8.2 + pk * 1.4;
      head.setAttribute('d', oval(hx, hy, 2.2, 2) + `M${f(hx - 1.6)} ${f(hy + 1.2)} L${f(3)} -6.2 L${f(1.8)} -7.2Z`);
      beak.setAttribute('d', `M${f(hx + 1.8)} ${f(hy - 0.4)} L${f(hx + 4.2 + pk * 0.2)} ${f(hy + 0.4 + pk * 0.3)} L${f(hx + 1.8)} ${f(hy + 0.8)}Z`);
      tailN.setAttribute('d', air ? `M-4.6 -4.6 L-14 -4.4 L-14 -3.2 L-4.4 -3.4Z` : `M-4.6 -4.6 L-13 -9.6 L-13.6 -8.4 L-4.2 -3.2Z`);
      legs.setAttribute('d', air ? 'M-1 -2.6 l-2 1.2 M0.4 -2.4 l-2 1.2' : 'M-0.6 -2.4 L-1 0 M1 -2.4 L1.2 0');
      const wy = air ? -6 - wing * 6 : -5.6;
      wingNear.setAttribute('d', air ? `M-2 -6 Q0 ${f(wy - 2)} ${f(-1 + wing * 1.5)} ${f(wy)} Q2.6 ${f(wy * 0.6 - 2)} 2 -6Z M-1.4 ${f(wy * 0.85)} l1.6 0` : 'M-4.4 -5 Q-1 -6.8 2.2 -5.4 Q-1 -4 -4.4 -4.2Z');
      wingFar.setAttribute('d', air ? `M-1 -6.4 Q1 ${f(wy - 1)} ${f(1 + wing)} ${f(wy + 1)} Q3 -7 2.6 -6.4Z` : '');
    },
  };
  actors.push(a);
  return a;
}

// ------------------------------------------------------------------ 등장 일정
const lanePick = () => pick(LANES);
function spawnPerson(atX?: number) {
  const hour = tau * 24;
  const r = Math.random();
  const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
  const x0 = atX ?? (dir > 0 ? -40 : W + 40);
  if (hour > 21 || hour < 6) { if (r < 0.7) makeAdult('coat', lanePick(), dir, x0); return; }
  if (r < 0.42) makeAdult('coat', lanePick(), dir, x0);
  else if (r < 0.72) makeAdult('grandpa', lanePick(), dir, x0);
  else makeKid(lanePick(), dir, x0);
}
makeAdult('coat', 357, 1, PORTRAIT ? 120 : 250);
makeAdult('grandpa', 365, -1, PORTRAIT ? 470 : 700);
makeKid(349, -1, PORTRAIT ? 330 : 520);
makeSquirrel();
const magpies = (PORTRAIT ? [[300, 388], [470, 394], [90, 352]] : [[395, 386], [660, 392], [150, 352]]).map((h) => makeMagpie(h as Vec));
let nextPerson = 9;

// ------------------------------------------------------------------ 시계 / 안내
const clockEl = document.querySelector('#clock') as HTMLElement;
if (QS.has('capture')) document.querySelector('#card')!.classList.add('capture');
const hint = document.querySelector('#hint') as HTMLElement;
svg.addEventListener('pointerdown', () => setTimeout(() => hint.classList.add('gone'), 2500), { once: true });
const DAYPART = (h: number) => (h < 5 ? '깊은 밤' : h < 7 ? '새벽' : h < 11 ? '아침' : h < 13 ? '한낮' : h < 17 ? '오후' : h < 19 ? '해 질 녘' : h < 22 ? '저녁' : '밤');

// 해/달 끌기
function toSvg(e: PointerEvent): Vec { const r = svg.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
let scrub: 'sun' | 'moon' | null = null;
sunG.addEventListener('pointerdown', (e) => { scrub = 'sun'; svg.setPointerCapture(e.pointerId); svg.classList.add('scrubbing'); e.stopPropagation(); });
moonG.addEventListener('pointerdown', (e) => { scrub = 'moon'; svg.setPointerCapture(e.pointerId); svg.classList.add('scrubbing'); e.stopPropagation(); });
svg.addEventListener('pointermove', (e) => {
  if (!scrub) return;
  const [x] = toSvg(e);
  if (scrub === 'sun') tau = SUN_SPAN[0] + clamp((x - SX0) / SXW, 0.001, 0.999) * SUN_SPAN[1];
  else tau = (MOON_SPAN[0] + clamp((x - MX0) / MXW, 0.001, 0.999) * MOON_SPAN[1]) % 1;
});
const endScrub = () => { scrub = null; svg.classList.remove('scrubbing'); };
svg.addEventListener('pointerup', endScrub); svg.addEventListener('pointercancel', endScrub);

// ------------------------------------------------------------------ 매 프레임
const rootStyle = svg.style;
run((t, dt) => {
  if (!scrub) tau = (tau + dt / DAY) % 1;
  const P = palette(tau);
  applyPalette(svg, P);
  for (const k in COLORS) rootStyle.setProperty(k, nightTint(COLORS[k], P, k === '--plume' || k === '--sun' ? 0.75 : 0.6));
  s0.setAttribute('stop-color', rgb(P.top)); s1.setAttribute('stop-color', rgb(P.bottom));
  const waterC = mix(P.paper, toRGB('#9fb3b8'), 0.32 + P.inkT * 0.1);
  w0.setAttribute('stop-color', rgb(mix(waterC, P.paper, 0.35))); w1.setAttribute('stop-color', rgb(waterC));
  const card = svg.parentElement!.parentElement!;
  card.style.setProperty('--ink', rgb(P.ink)); card.style.setProperty('--glow', rgb(P.paper));
  const hh = Math.floor(tau * 24), mm = Math.floor((tau * 24 - hh) * 60);
  clockEl.innerHTML = `<b>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</b><span>${DAYPART(tau * 24 + mm / 60)}</span>`;

  const wv = wind.step(t);

  // 해, 달, 별
  const su = (tau - SUN_SPAN[0]) / SUN_SPAN[1];
  if (su > -0.02 && su < 1.02) { const [x, y] = sunArc(clamp(su, 0, 1)); sunG.setAttribute('transform', `translate(${f(x)} ${f(y + (su < 0 || su > 1 ? 30 : 0))})`); sunG.style.display = ''; } else sunG.style.display = 'none';
  const mu = (((tau - MOON_SPAN[0]) % 1) + 1) % 1 / MOON_SPAN[1];
  if (mu < 1) { const [x, y] = moonArc(mu); moonG.setAttribute('transform', `translate(${f(x)} ${f(y)})`); moonG.style.display = ''; moonG.setAttribute('opacity', f(clamp(P.night * 1.4, 0, 1))); } else moonG.style.display = 'none';
  starG.setAttribute('opacity', f(P.night));
  if (P.night > 0.02) for (const s of stars) s.n.setAttribute('opacity', f(0.55 + 0.45 * Math.sin(t * s.sp + s.ph)));
  for (const c of clouds) { c.x += (c.v + wv * 3) * dt; if (c.x > W + 40) c.x = -c.w - 40; if (c.x < -c.w - 60) c.x = W + 30; c.n.setAttribute('d', cloudD(c.x, c.y, c.w)); }
  cloudG.setAttribute('opacity', f(1 - P.night * 0.7));
  pavLight.setAttribute('opacity', f(smooth(0.35, 0.8, P.lamp) * (0.8 + 0.2 * Math.sin(t * 7))));

  // 기러기
  nextFlock -= dt;
  if (nextFlock < 0) { if (P.night < 0.5) launchFlock(); nextFlock = rnd(28, 50); }
  if (flock) {
    let alive = false;
    for (const g of flock.geese) {
      g.x += flock.vx * dt; g.ph += dt * 6.5;
      const fl = Math.sin(g.ph) * 3.2, d = Math.sign(flock.vx);
      g.n.setAttribute('d', `M${f(g.x - 5)} ${f(g.y + fl)} Q${f(g.x - 2.4)} ${f(g.y - 1.2)} ${f(g.x)} ${f(g.y)} Q${f(g.x + 2.4)} ${f(g.y - 1.2)} ${f(g.x + 5)} ${f(g.y + fl)} M${f(g.x - d * 0.6)} ${f(g.y)} l${f(d * 2.4)} -0.4`);
      if (g.x > -40 && g.x < W + 40) alive = true;
    }
    if (!alive && Math.abs(flock.geese[0].x - W / 2) > W / 2 + 30) { flock.geese.forEach((g) => g.n.remove()); flock = null; }
  }

  // 나무 흔들림 + 잎 떨굼
  for (const tr of trees) {
    const flex = tr.front ? 1 : 0.7;
    const sway = tr.swing.step(wv * 0.9 * flex + wobble(t * 0.6 + tr.ph) * 0.35, dt);
    const sh = tr.shake.step(0, dt) * 1.6;
    const ang = (sway + sh) * (tr.kind === 'ginkgo' ? 0.75 : 0.6);
    treeAngle.set(tr, ang);
    tr.g.setAttribute('transform', `rotate(${f(ang)} ${f(tr.x)} ${f(tr.y)})`);
    tr.can.setAttribute('transform', `rotate(${f(ang * 0.6 + wobble(t * 1.3 + tr.ph, 1.4) * 0.25)} ${f(tr.x)} ${f(tr.canTop + (tr.y - tr.canTop) * 0.6)})`);
    const rate = (tr.front ? 0.12 : 0.05) + Math.pow(Math.abs(wv), 1.6) * (tr.front ? 0.45 : 0.18);
    tr.drop -= dt * rate;
    if (tr.drop < 0) { tr.drop = rnd(0.6, 1.4); spawnLeaf(tr); }
  }
  const bsw = branchSw.step(wv * 1.2 + wobble(t * 0.8 + 3) * 0.6, dt) + branchShake.step(0, dt) * 2;
  branchG.setAttribute('transform', `rotate(${f(bsw * 0.8)} -14 6)`);
  if (Math.random() < dt * (0.08 + Math.abs(wv) * 0.25)) spawnBranchLeaf();

  // 억새
  for (const rd of reeds as (Reed & { ink: SVGPathElement })[]) {
    const sw = rd.sw.step(wv * 0.35, dt);
    let ds = '', dp = '', di = '';
    for (const st of rd.stalks) {
      const a = st.lean + sw + wobble(t * 1.1 + st.ph, 1.2) * 0.07;
      const bx = rd.x + st.dx, tipX = bx + Math.sin(a) * st.h, tipY = rd.y - Math.cos(a) * st.h;
      ds += `M${f(bx)} ${rd.y} Q${f(bx + Math.sin(a) * st.h * 0.3)} ${f(rd.y - st.h * 0.55)} ${f(tipX)} ${f(tipY)} `;
      // 이삭: 바람 아래쪽으로 늘어지는 깃털 획
      const down = a + 0.5 + Math.abs(sw) * 0.4;
      for (let k = 0; k < 5; k++) {
        const len = 6 + k * 1.3, ang = down + (k - 2) * 0.16;
        const sx = tipX - Math.sin(a) * k * 1.2, sy = tipY + Math.cos(a) * k * 1.2;
        dp += `M${f(sx)} ${f(sy)} q${f(Math.sin(ang) * len * 0.4)} ${f(-Math.cos(ang) * len * 0.1)} ${f(Math.sin(ang) * len)} ${f(Math.cos(ang) * len * 0.6)} `;
        if (k % 2 === 0) di += `M${f(sx)} ${f(sy)} l${f(Math.sin(ang) * len * 0.8)} ${f(Math.cos(ang) * len * 0.5)} `;
      }
    }
    rd.stem.setAttribute('d', ds); rd.plume.setAttribute('d', dp); rd.ink.setAttribute('d', di);
  }

  // 잎 입자
  const gust = Math.abs(wv) > 1.1;
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.life += dt;
    if (l.state === 'fall') {
      l.ph += dt * (l.kind === 'ginkgo' ? 3.2 : 2.4);
      l.fl += dt * (l.kind === 'ginkgo' ? 5 : 3.6);
      const term = l.kind === 'ginkgo' ? 20 : 15;
      l.vy += (term - l.vy) * dt * 1.4 + Math.sin(l.ph) * 6 * dt;
      l.vx += (wv * 24 + Math.cos(l.ph) * 14 - l.vx) * dt * 1.6;
      l.x += l.vx * dt; l.y += l.vy * dt; l.r += l.spin * dt;
      if (l.y >= l.ty && l.vy > 0) {
        l.y = l.ty;
        if (l.ty > WATER + 2 && l.ty < WATER_B - 2) { l.state = 'float'; l.vx = 8; l.life = 0; L.floatLeaves.appendChild(l.n); }
        else { l.state = 'rest'; l.life = 0; restCount++; if (l.ty > WATER_B) L.near.insertBefore(l.n, L.near.firstChild); else L.restLeaves.appendChild(l.n); }
      }
      if (l.x < -30 || l.x > W + 30) l.dead = true;
      setLeafTf(l);
    } else if (l.state === 'float') {
      l.vx += (10 + wv * 7 - l.vx) * dt * 0.6;
      l.x += l.vx * dt; l.r += Math.sin(l.life * 0.7 + l.ph) * 8 * dt;
      l.bob = Math.max(0, l.bob - dt * 0.5);
      const yy = l.ty + Math.sin(l.life * 1.6 + l.ph) * (0.5 + l.bob * 2);
      l.n.setAttribute('transform', `translate(${f(l.x)} ${f(yy)}) scale(1 0.5) rotate(${f(l.r)}) scale(${f(l.s)})`);
      if (l.x > W + 20) l.dead = true;
    } else if (gust && l.y < WATER && Math.random() < dt * Math.abs(wv) * 0.5) {
      // 센 바람: 바닥의 잎이 굴러간다
      l.state = 'fall'; l.vy = -rnd(4, 14); l.vx = wv * 20; l.spin = rnd(-200, 200); l.ty = clamp(l.y + rnd(-3, 3), BACK + 1, WATER - 2); L.fall.appendChild(l.n); restCount--;
    }
    if (l.dead) { l.n.remove(); leaves.splice(i, 1); if (l.state === 'rest') restCount--; }
  }
  // 바닥에 너무 많이 쌓이면 오래된 잎부터 사라짐
  if (restCount > 460) { const old = leaves.find((l) => l.state === 'rest'); if (old) { old.n.remove(); leaves.splice(leaves.indexOf(old), 1); restCount--; } }

  // 물결, 물 획
  for (const s of strokes) { s.x += (s.v + wv * 4) * dt; if (s.x > W + 20) s.x = -s.w - 10; if (s.x < -s.w - 20) s.x = W + 10; s.n.setAttribute('d', `M${f(s.x)} ${f(s.y)} q${f(s.w / 2)} ${f(Math.sin(t + s.y) * 0.8)} ${f(s.w)} 0`); }
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i]; rp.t += dt;
    if (rp.t < 0) { rp.n.setAttribute('d', ''); continue; }
    const rr = 3 + rp.t * 22;
    rp.n.setAttribute('d', oval(rp.x, rp.y, rr, rr * 0.28)); rp.n.setAttribute('opacity', f(clamp(1 - rp.t / 1.6, 0, 1)));
    if (rp.t > 1.6) { rp.n.remove(); ripples.splice(i, 1); }
  }

  // 가로등
  const lit = smooth(0.3, 0.75, P.lamp);
  const flick = 0.92 + 0.08 * Math.sin(t * 11) * Math.sin(t * 3.7);
  lampPane.setAttribute('opacity', f(lit)); lampGlow.setAttribute('opacity', f(lit * flick)); lampPool.setAttribute('opacity', f(lit * 0.6));
  lampRefl.setAttribute('opacity', f(lit * 0.7));
  lampRefl.setAttribute('d', [0, 1, 2, 3].map((k) => `M${f(LAMP[0] - 8 + Math.sin(t * 2 + k) * 2 + k * 1.5)} ${f(WATER + 8 + k * 7)} l${f(14 - k * 2.6)} 0`).join(' '));

  // 사람, 동물
  nextPerson -= dt;
  const hour = tau * 24;
  const crowd = actors.filter((a) => a.g.querySelector('title')?.textContent?.includes('사람') || a.g.querySelector('title')?.textContent?.includes('할아버지') || a.g.querySelector('title')?.textContent?.includes('아이')).length;
  if (nextPerson < 0) { if (crowd < 5) spawnPerson(); nextPerson = hour > 21 || hour < 6 ? rnd(22, 40) : rnd(7, 15); }
  for (let i = actors.length - 1; i >= 0; i--) { const a = actors[i]; a.draw(t, dt, P); if (a.dead) { a.g.remove(); actors.splice(i, 1); } }
  // 사람이 가까이 오면 까치가 날아오른다
  for (const m of magpies) if (m.y < 999) for (const a of actors) if (a !== m && !(magpies as Actor[]).includes(a) && Math.abs(a.y - m.y) < 14) {
    const ax = +(a.g.getAttribute('transform') || '').match(/translate\(([-\d.]+)/)?.[1]!;
    const mx = +(m.g.getAttribute('transform') || '').match(/translate\(([-\d.]+)/)?.[1]!;
    if (Math.abs(ax - mx) < 22) (m as any).scare();
  }
  const sorted = [...actors].sort((a, b) => a.y - b.y);
  sorted.forEach((a) => L.actors.appendChild(a.g));
});
