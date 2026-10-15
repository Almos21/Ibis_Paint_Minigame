/* ------------------------------------------------------------------
   util.js — utilidades matemáticas y geométricas
   Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint.
   ------------------------------------------------------------------ */

const TWOPI = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

/** diferencia angular más corta de a hacia b, en (-PI, PI] */
function angDiff(a, b) {
  let d = (b - a) % TWOPI;
  if (d > Math.PI) d -= TWOPI;
  if (d <= -Math.PI) d += TWOPI;
  return d;
}

/** rota el punto (px,py) alrededor de (cx,cy) */
function rotAbout(px, py, cx, cy, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), dx = px - cx, dy = py - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** ruido determinista 0..1 a partir de un número */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Los puntos de un trazo se guardan "planos": [x0,y0,x1,y1,...] */

/** inserta puntos intermedios para que dos puntos consecutivos no estén a más de `step` px */
function resample(pts, step) {
  if (pts.length < 4) return pts.slice();
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / step);
    for (let k = 1; k <= n; k++) out.push(mix(x0, x1, k / n), mix(y0, y1, k / n));
  }
  return out;
}

/** ¿se cruzan los segmentos AB y CD? devuelve t (0..1 sobre AB) o -1 */
function segIntersectT(ax, ay, bx, by, cx, cy, dx, dy) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return -1;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : -1;
}

/** Contexto 2D auxiliar (invisible) para hacer pruebas de "punto dentro de una letra" */
const hitCtx = document.createElement('canvas').getContext('2d');

/** Construye un Path2D con una polilínea plana */
function polyPath(p) {
  const path = new Path2D();
  if (p.length < 2) return path;
  path.moveTo(p[0], p[1]);
  if (p.length === 2) path.lineTo(p[0] + 0.01, p[1]);
  for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
  return path;
}
