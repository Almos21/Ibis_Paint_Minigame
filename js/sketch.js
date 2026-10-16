/* ==================================================================
   ibis·Paint·juego — sketch principal (p5.js)

   PROYECTO ESTUDIANTIL, SIN FINES DE LUCRO.
   No está afiliado, patrocinado ni respaldado por ibisPaint ni por su
   empresa. El logo y la marca pertenecen a sus respectivos dueños; aquí
   solo se usa como material de un ejercicio de programación creativa.

   Letras de «Paint» = herramientas:
     P  paleta (los colores del logo)      i  pincel (la punta es el puntico)
     a  alterar: efecto aleatorio en línea n  borrador
     t  trasladar: agarra y mueve una línea
   Letras de «ibis» = pájaro: se arma al dibujar, al tocar «ibis» o con Enter (ver js/bird.js)
   ================================================================== */

let VW = 0, VH = 0, NOW = 0, DPR = 1;
let layer, lctx, layerDirty = true;

const keys = { shift: false };
const S = {
  strokes: [],
  letters: {},
  order: ['P', 'i1', 'b', 'i2', 's', 'a', 'i3', 'n', 't'], // de atrás hacia adelante
  undo: [],
  brush: { color: '#000000', w: 6, penDown: true },
  drag: null,
  particles: [],
  touched: false,
  nextPulse: 1.4,
  U: 1,
};
// Sin pistas: la persona descubre todo sola. Pon SHOW_HINTS = true para ver avisos de texto mientras desarrollas.
const SHOW_HINTS = false;

// Brillo que invita a tocar las letras de «Paint» (al inicio y cuando pasa un rato sin tocarlas)
const ATTN = {
  ids: ['P', 'a', 'i3', 'n', 't'],
  colors: ['#e6511d', '#f3b318', '#21af20', '#229fe1', '#a632b5'],  // una ola de arcoíris por la palabra
  first: 1.4,     // s hasta el primer destello
  idle: 10,       // s sin tocar nada para que vuelva a destellar
  dur: 1.7,       // s que dura el brillo de cada letra
  stagger: 0.17,  // s de retraso entre una letra y la siguiente
  waves: 2,       // olas por destello
  gap: 1.2,       // s entre olas
  t0: -1,
};
const IBIS_IDS = ['i1', 'b', 'i2', 's'];
const isIbis = (id) => IBIS_IDS.includes(id);

/* ================================================================= p5 */
function setup() {
  VW = windowWidth; VH = windowHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  pixelDensity(DPR);
  const cnv = createCanvas(VW, VH);
  cnv.parent('stage');
  textFont('system-ui, -apple-system, Segoe UI, Roboto, sans-serif');
  makeLayer();
  for (const id of Object.keys(LOGO.letters)) S.letters[id] = new Letter(id);
  layoutLogo();
  bindInput(cnv.elt);
  bindUI();
}

function windowResized() {
  VW = windowWidth; VH = windowHeight;
  resizeCanvas(VW, VH);
  makeLayer();
  if (!S.touched && !Bird.busy) layoutLogo();
  else for (const l of Object.values(S.letters)) { l.x = clamp(l.x, 10, VW - 10); l.y = clamp(l.y, 10, VH - 10); }
}

function draw() {
  const now = millis() / 1000, dt = Math.min(0.05, deltaTime / 1000);
  NOW = now;
  const ctx = drawingContext;

  /* ---- actualizar ---- */
  for (const l of Object.values(S.letters)) {
    l.updateTween(now);
    l.lift = approach(l.lift, S.drag && S.drag.letter === l && S.drag.moved ? 1 : 0, 14, dt);
  }
  updateAttention(now, dt);
  Bird.update(dt, now);
  updateParticles(dt);

  /* ---- dibujar ---- */
  background(255);
  if (layerDirty) redrawLayer();
  ctx.drawImage(layer, 0, 0, VW, VH);
  for (const s of S.strokes) if (s.live || s.animated) { ctx.save(); drawStroke(ctx, s, now); ctx.restore(); }
  if (S.drag) {
    if (S.drag.target) drawHalo(ctx, S.drag.target, '#ffc400', now);
    if (S.drag.carry) drawHalo(ctx, S.drag.carry, '#2d9cff', now);
  }

  if (Bird.busy) Bird.drawShadow(ctx);
  for (const id of S.order) {
    if (Bird.busy && isIbis(id)) continue;
    S.letters[id].draw(ctx, DPR);
  }
  if (Bird.busy) {                                  // el pájaro va por encima de las letras de Paint
    for (const l of Bird.parts) l.draw(ctx, DPR);
    Bird.drawFX(ctx);
  }
  drawBrushTip(ctx);
  drawParticles(ctx);
  drawWatermark(ctx);
}

/* ================================================================= dibujo auxiliar */
function makeLayer() {
  layer = document.createElement('canvas');
  layer.width = Math.round(VW * DPR); layer.height = Math.round(VH * DPR);
  lctx = layer.getContext('2d');
  lctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  layerDirty = true;
}

function redrawLayer() {
  lctx.clearRect(0, 0, VW, VH);
  for (const s of S.strokes) if (!s.live && !s.animated) { lctx.save(); drawStroke(lctx, s, 0); lctx.restore(); }
  layerDirty = false;
}

function drawHalo(ctx, s, color, now) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = 0.33 + 0.12 * Math.sin(now * 8); ctx.strokeStyle = color; ctx.lineWidth = s.w + 14;
  ctx.stroke(polyPath(s.points(now)));
  ctx.restore();
}

function drawBrushTip(ctx) {
  const i3 = S.letters.i3, [tx, ty] = i3.tip();
  const r = Math.max(1.5, S.brush.w / 2);
  ctx.save();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.arc(tx, ty, r + 1, 0, TWOPI); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, ty, r + 2.2, 0, TWOPI); ctx.stroke();
  ctx.restore();
}

function drawWatermark(ctx) {
  ctx.save();
  ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  const long = 'Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint · el logo pertenece a sus dueños';
  ctx.fillText(ctx.measureText(long).width < VW - 24 ? long : 'Proyecto estudiantil · no afiliado a ibisPaint', VW / 2, VH - 9);
  ctx.restore();
}

/* ---- partículas ---- */
function puff(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TWOPI, v = 40 + Math.random() * 140;
    S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 0.4 + Math.random() * 0.4, r: 2 + Math.random() * 3.5, color });
  }
}
function burst(x, y) {
  const cols = LOGO.letters.P.segments.map((s) => s.color);
  for (let i = 0; i < 26; i++) puff(x, y, cols[Math.floor(Math.random() * cols.length)], 1);
}
function updateParticles(dt) {
  for (const p of S.particles) { p.life += dt; p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; }
  S.particles = S.particles.filter((p) => p.life < p.max);
}
function drawParticles(ctx) {
  for (const p of S.particles) {
    ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - 0.4 * p.life / p.max), 0, TWOPI); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ================================================================= brillo de invitación */
function noteActivity() { S.nextPulse = NOW + ATTN.idle; ATTN.t0 = -1; }

function updateAttention(now, dt) {
  const A = ATTN, total = (A.waves - 1) * A.gap + (A.ids.length - 1) * A.stagger + A.dur;
  if (S.drag) { A.t0 = -1; S.nextPulse = now + A.idle; }
  else if (A.t0 < 0 && now >= S.nextPulse) A.t0 = now;
  else if (A.t0 >= 0 && now - A.t0 > total) { A.t0 = -1; S.nextPulse = now + A.idle; }
  A.ids.forEach((id, k) => {
    let g = 0;
    if (A.t0 >= 0) {
      for (let w = 0; w < A.waves; w++) {
        const u = (now - A.t0 - w * A.gap - k * A.stagger) / A.dur;
        if (u > 0 && u < 1) g = Math.max(g, Math.pow(Math.sin(Math.PI * u), 2));
      }
    }
    const l = S.letters[id];
    l.glowColor = A.colors[k];
    l.glow = approach(l.glow, g, g > l.glow ? 30 : 9, dt);
  });
}

/* ================================================================= logo */
function layoutLogo() {
  const U = Math.min((VW * (VW < 700 ? 0.8 : 0.54)) / LOGO.w, (VH * 0.3) / LOGO.h);
  S.U = U;
  const ox = (VW - LOGO.w * U) / 2, oy = (VH - LOGO.h * U) / 2 - VH * 0.03;
  for (const l of Object.values(S.letters)) {
    l.scl = U; l.rot = 0; l.flip = 1; l.tween = null;
    l.x = ox + l.pivot[0] * U; l.y = oy + l.pivot[1] * U;
  }
}

/* ================================================================= deshacer / limpiar */
function pushUndo() {
  S.undo.push(S.strokes.map((s) => ({ color: s.color, w: s.w, pts: s.pts.slice(), fx: s.fx ? JSON.parse(JSON.stringify(s.fx)) : null })));
  if (S.undo.length > 30) S.undo.shift();
}
function undo() {
  if (S.drag) return;
  const snap = S.undo.pop();
  if (!snap) { toast('No hay nada que deshacer'); return; }
  S.strokes = snap.map((o) => { const s = new Stroke(o.color, o.w, o.pts); s.fx = o.fx; return s; });
  layerDirty = true;
}
function clearAll() {
  if (S.drag || !S.strokes.length) return;
  pushUndo(); S.strokes = []; layerDirty = true;
  toast('Lienzo limpio (Ctrl+Z para deshacer)');
}

/* ================================================================= entrada */
function bindInput(el) {
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', (e) => { e.preventDefault(); setBrushSize(S.brush.w - Math.sign(e.deltaY)); }, { passive: false });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => { keys.shift = false; });
}

function pickLetter(x, y, tol) {
  // 1.º un toque exacto sobre alguna letra; 2.º, si falló, con margen de agarre (dedos/ratón torpes).
  // Así, una letra delgada (la i) no pierde frente a una vecina más ancha (la n).
  for (const t of tol > 0 ? [0, tol] : [0]) {
    for (let i = S.order.length - 1; i >= 0; i--) {
      const id = S.order[i];
      if (Bird.busy && isIbis(id)) continue;
      if (S.letters[id].hit(x, y, t)) return S.letters[id];
    }
  }
  return null;
}

function onDown(e) {
  if (S.drag || (e.pointerType === 'mouse' && e.button > 2)) return;
  hideIntro();
  const x = e.clientX, y = e.clientY, l = pickLetter(x, y, e.pointerType === 'mouse' ? 8 : 18);
  if (!l) return;
  if (isIbis(l.id)) { Bird.wake(); noteActivity(); return; }   // tocar «ibis» despierta al pájaro
  e.target.setPointerCapture(e.pointerId);
  S.touched = true; noteActivity();
  S.order.splice(S.order.indexOf(l.id), 1); S.order.push(l.id);
  S.drag = { letter: l, id: l.id, pid: e.pointerId, ox: x - l.x, oy: y - l.y, sx: x, sy: y, moved: false, cur: null, carry: null, target: null, penUp: e.button === 2, undone: false, lastTip: null };
  e.target.style.cursor = 'grabbing';
}

function onMove(e) {
  const D = S.drag;
  if (!D) { const hl = pickLetter(e.clientX, e.clientY, 8); e.target.style.cursor = hl ? (isIbis(hl.id) ? 'pointer' : 'grab') : 'default'; return; }
  if (e.pointerId !== D.pid) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  if (evs.length) for (const ev of evs) dragTo(ev.clientX, ev.clientY); else dragTo(e.clientX, e.clientY);
}

function dragTo(x, y) {
  const D = S.drag, l = D.letter;
  if (!D.moved && Math.hypot(x - D.sx, y - D.sy) < 4) return; // distingue clic de arrastre
  D.moved = true; noteActivity();
  // para la i-pincel se limita la PUNTA (el puntico), no el centro: así puede dibujar hasta el borde
  const tipDy = D.id === 'i3' ? (l.def.dot.cy - l.pivot[1]) * l.scl : 0;
  const tx = clamp(x - D.ox, 10, VW - 10), ty = clamp(y - D.oy + tipDy, 8, VH - 8) - tipDy;
  const x0 = l.x, y0 = l.y, dx = tx - x0, dy = ty - y0, dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(dist / (D.id === 'n' || D.id === 't' ? 6 : 3)));
  for (let k = 1; k <= n; k++) {
    const px = x0 + (dx * k) / n, py = y0 + (dy * k) / n, ddx = px - l.x, ddy = py - l.y;
    l.x = px; l.y = py;
    if (D.id === 'i3') brushStep(D, l);
    else if (D.id === 'n') eraseStep(D, l);
    else if (D.id === 't') carryStep(D, l, ddx, ddy);
  }
  if (D.id === 'a') D.target = alterTarget(l);
}

function onUp(e) {
  const D = S.drag;
  if (!D || e.pointerId !== D.pid) return;
  const l = D.letter;
  if (D.id === 'a' && D.moved) {
    if (D.target) {
      pushUndo();
      const name = applyRandomEffect(D.target);
      layerDirty = true;
      const [bx, by] = l.toWorld(l.def.pivot[0], l.def.pivot[1]);
      burst(bx, by);
      toast('Efecto: ' + name);
    } else toast('Suelta la «a» encima de una línea para alterarla');
  }
  if (D.id === 'P' && !D.moved) {
    const [lx, ly] = l.toLocal(e.clientX, e.clientY);
    for (const sg of l.segs) if (hitCtx.isPointInPath(sg.path, lx, ly)) { setBrushColor(sg.color); break; }
  }
  if (D.cur && D.cur.n < 2) { S.strokes.splice(S.strokes.indexOf(D.cur), 1); S.undo.pop(); }
  if (D.carry) { D.carry.live = false; layerDirty = true; }
  S.drag = null; noteActivity();
  e.target.style.cursor = 'default';
}

/* ================================================================= herramientas */

/* ---- paleta: ¿está la punta sobre la rueda de la P? ¿sobre qué color? ---- */
function paletteAt(x, y) {
  const P = S.letters.P, [lx, ly] = P.toLocal(x, y), w = P.def.wheel;
  const zone = Math.hypot(lx - w.cx, ly - w.cy) < w.r + 10 / P.scl;
  let color = null;
  if (zone) for (const sg of P.segs) if (hitCtx.isPointInPath(sg.path, lx, ly)) { color = sg.color; break; }
  return { zone, color };
}

function setBrushColor(c) {
  if (c === S.brush.color) return;
  S.brush.color = c;
  S.letters.i3.dotColor = c;
  S.letters.P.markColor = c;
  const [tx, ty] = S.letters.i3.tip();
  puff(tx, ty, c, 7);
}

function setBrushSize(w) {
  S.brush.w = clamp(Math.round(w), 2, 40);
  const el = document.getElementById('size'); if (el) el.value = S.brush.w;
}

/* ---- i: pincel ---- */
function brushStep(D, l) {
  const [tx, ty] = l.tip(), pal = paletteAt(tx, ty);
  if (pal.color) setBrushColor(pal.color);
  const drawing = S.brush.penDown !== (keys.shift || D.penUp) && !pal.zone;
  if (!drawing) {
    // Si apenas agarraste la i y ya estás sobre la paleta, el rastro era solo el "viaje" hasta la P: se borra.
    if (pal.zone && D.cur && performance.now() - D.cur.t0 < 1500 && D.cur.arc()[D.cur.n - 1] < 1200) {
      S.strokes.splice(S.strokes.indexOf(D.cur), 1); S.undo.pop(); layerDirty = true;
    }
    D.cur = null; D.lastTip = [tx, ty]; return;
  }
  if (!D.cur) {
    pushUndo();
    D.cur = new Stroke(S.brush.color, S.brush.w, [tx, ty]);
    D.cur.t0 = performance.now();
    Bird.wake();                                   // el primer trazo hace que «ibis» se arme como pájaro
    S.strokes.push(D.cur); D.lastTip = [tx, ty];
    return;
  }
  const lt = D.lastTip, d = Math.hypot(tx - lt[0], ty - lt[1]);
  if (d < 2.5) return;
  const n = Math.ceil(d / 3.5), st = D.cur;
  lctx.save();
  lctx.lineCap = 'round'; lctx.lineJoin = 'round'; lctx.strokeStyle = st.color; lctx.lineWidth = st.w;
  lctx.beginPath();
  lctx.moveTo(st.pts[st.pts.length - 2], st.pts[st.pts.length - 1]);
  for (let j = 1; j <= n; j++) { const x = mix(lt[0], tx, j / n), y = mix(lt[1], ty, j / n); st.addPoint(x, y); lctx.lineTo(x, y); }
  lctx.stroke();
  lctx.restore();
  D.lastTip = [tx, ty];
}

/* ---- n: borrador (borra solo lo que toca la letra, partiendo las líneas) ---- */
function overlaps(a, b) { return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]); }

function eraseStep(D, l) {
  const wb = l.worldBBox();
  let changed = false;
  for (let si = S.strokes.length - 1; si >= 0; si--) {
    const s = S.strokes[si];
    if (!overlaps(s.bbox(), wb)) continue;
    const p = s.pts, n = p.length / 2, keep = new Array(n);
    let any = false;
    for (let k = 0; k < n; k++) {
      const x = p[2 * k], y = p[2 * k + 1];
      const inside = x >= wb[0] - 8 && x <= wb[2] + 8 && y >= wb[1] - 8 && y <= wb[3] + 8 && l.hit(x, y, 5 + s.w / 2);
      keep[k] = !inside; if (inside) any = true;
    }
    if (!any) continue;
    if (!D.undone) { pushUndo(); D.undone = true; }
    const pieces = [];
    let cur = [];
    for (let k = 0; k < n; k++) {
      if (keep[k]) cur.push(p[2 * k], p[2 * k + 1]);
      else { if (cur.length >= 4) pieces.push(cur); cur = []; }
    }
    if (cur.length >= 4) pieces.push(cur);
    const news = pieces.map((pp) => { const ns = new Stroke(s.color, s.w, pp); ns.fx = s.fx ? { ...s.fx } : null; return ns; });
    S.strokes.splice(si, 1, ...news);
    changed = true;
  }
  if (changed) layerDirty = true;
}

/* ---- t: trasladar (agarra una línea y la arrastra) ---- */
function carryStep(D, l, dx, dy) {
  if (D.carry) { D.carry.translate(dx, dy); Bird.carried(D.carry, dx, dy); return; }
  const wb = l.worldBBox();
  let best = null, bestN = 0;
  for (const s of S.strokes) {
    if (!overlaps(s.bbox(), wb)) continue;
    const p = s.points(NOW);
    let c = 0;
    for (let k = 0; k < p.length; k += 2) if (p[k] >= wb[0] && p[k] <= wb[2] && p[k + 1] >= wb[1] && p[k + 1] <= wb[3] && l.hit(p[k], p[k + 1], 8 + s.w / 2)) c++;
    if (c > bestN) { bestN = c; best = s; }
  }
  if (best) {
    pushUndo();
    D.carry = best; best.live = true; layerDirty = true;
  }
}

/* ---- a: ¿qué línea está debajo de la letra? ---- */
function alterTarget(l) {
  const wb = l.worldBBox(), w = wb[2] - wb[0], h = wb[3] - wb[1];
  const r = [wb[0] + w * 0.08, wb[1] + h * 0.08, wb[2] - w * 0.08, wb[3] - h * 0.08];
  let best = null, bestN = 0;
  for (const s of S.strokes) {
    if (!overlaps(s.bbox(), r)) continue;
    const p = s.points(NOW);
    let c = 0;
    for (let k = 0; k < p.length; k += 2) if (p[k] >= r[0] && p[k] <= r[2] && p[k + 1] >= r[1] && p[k + 1] <= r[3]) c++;
    if (c > bestN) { bestN = c; best = s; }
  }
  return best;
}

/* ================================================================= teclado */
function onKeyDown(e) {
  if (e.target && e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
  const c = e.code;
  if (c === 'Enter' || c === 'NumpadEnter') { e.preventDefault(); if (!e.repeat) { hideIntro(); Bird.toggle(); } return; }
  if (c === 'ShiftLeft' || c === 'ShiftRight') keys.shift = true;
  else if ((e.ctrlKey || e.metaKey) && c === 'KeyZ') { e.preventDefault(); undo(); }
  else if (e.key === '[' || e.key === '{' || e.key === ',') setBrushSize(S.brush.w - 1);
  else if (e.key === ']' || e.key === '}' || e.key === '.') setBrushSize(S.brush.w + 1);
  else if (c === 'KeyH' || e.key === '?') toggleHelp();
  else if (c === 'Escape') toggleHelp(false);
}
function onKeyUp(e) {
  const c = e.code;
  if (c === 'ShiftLeft' || c === 'ShiftRight') keys.shift = false;
}

/* ================================================================= interfaz (HTML) */
let toastTimer = 0;
function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  if (!SHOW_HINTS || !el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
function hideIntro() { const el = document.getElementById('intro'); if (el) el.classList.add('gone'); }
function toggleHelp(force) {
  const el = document.getElementById('help'); if (!el) return;
  el.classList.toggle('open', force === undefined ? !el.classList.contains('open') : force);
}

function bindUI() {
  // La barra de herramientas ya no existe en la página; esto solo conecta lo que haya (ayuda con la tecla H).
  const $ = (id) => document.getElementById(id);
  const click = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', (e) => { fn(); e.currentTarget.blur(); }); };
  click('btn-pen', () => { S.brush.penDown = !S.brush.penDown; });
  click('btn-undo', undo);
  click('btn-clear', clearAll);
  click('btn-help', () => toggleHelp());
  click('help-close', () => toggleHelp(false));
}
