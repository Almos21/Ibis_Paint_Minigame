/* ------------------------------------------------------------------
   bird.js — el ibis: las letras "ibis" se arman como un pajarito
     i (2ª)  -> cabeza: el puntico es el ojo y el palito el pico
     s       -> cuello
     b       -> cuerpo (girada 90°: el palito es el lomo)
     i (1ª)  -> patica (al revés: el puntico es el pie)
   Camina y salta sobre las líneas dibujadas.
   Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint.
   ------------------------------------------------------------------ */

/* Disposición del pájaro, en "unidades del logo" (1 unidad = 1 px del SVG a escala 1),
   con el origen en el punto de apoyo del pie y el eje y hacia abajo (negativo = arriba). */
const BIRD_UNITS = 500; // altura aproximada
const BL = {
  leg:  { id: 'i1', pos: [0, -89],   rot: Math.PI,     ls: 1 },
  body: { id: 'b',  pos: [0, -243],  rot: Math.PI / 2, ls: 1 },
  neck: { id: 's',  pos: [92, -392], rot: 0,           ls: 1.3 },
  head: { id: 'i2', pos: [172, -468], rot: -0.5,       ls: 0.72 },
};
const BIRD_HIP = [0, -178];          // donde la pata se une al cuerpo
const BIRD_NECK_BASE = [92, -303];   // base del cuello
const BIRD_HEAD_ATTACH = [150, -440];// donde la cabeza se une al cuello
const ZERO_ANIM = { hop: 0, body: 0, neck: 0, head: 0, leg: 0 };

/** Calcula la posición/rotación/escala de cada letra del pájaro. `a` son los ángulos de animación. */
function birdPose(B, a) {
  const f = B.flipv, s = B.s, c = Math.cos(B.tilt), sn = Math.sin(B.tilt);
  const world = (lx, ly, lrot, ls) => {
    const X = f * lx * s, Y = (ly - a.hop) * s;
    return { x: B.F.x + X * c - Y * sn, y: B.F.y + X * sn + Y * c, rot: B.tilt + f * lrot, scl: s * ls, flip: f };
  };
  const [hx, hy] = BIRD_HIP, [nx, ny] = BIRD_NECK_BASE;

  // pata: se balancea desde la cadera
  let leg = rotAbout(BL.leg.pos[0], BL.leg.pos[1], hx, hy, a.leg);
  const legRot = BL.leg.rot + a.leg;

  // cuello: se mece desde su base; la cabeza va pegada al cuello y además cabecea
  let neck = rotAbout(BL.neck.pos[0], BL.neck.pos[1], nx, ny, a.neck);
  let attach = rotAbout(BIRD_HEAD_ATTACH[0], BIRD_HEAD_ATTACH[1], nx, ny, a.neck);
  let head = rotAbout(BL.head.pos[0], BL.head.pos[1], nx, ny, a.neck);
  head = rotAbout(head[0], head[1], attach[0], attach[1], a.head);
  let neckRot = BL.neck.rot + a.neck, headRot = BL.head.rot + a.neck + a.head;

  // cuerpo + cuello + cabeza se inclinan juntos alrededor de la cadera
  let body = rotAbout(BL.body.pos[0], BL.body.pos[1], hx, hy, a.body);
  const bodyRot = BL.body.rot + a.body;
  neck = rotAbout(neck[0], neck[1], hx, hy, a.body); neckRot += a.body;
  head = rotAbout(head[0], head[1], hx, hy, a.body); headRot += a.body;

  return {
    leg: world(leg[0], leg[1], legRot, BL.leg.ls),
    body: world(body[0], body[1], bodyRot, BL.body.ls),
    neck: world(neck[0], neck[1], neckRot, BL.neck.ls),
    head: world(head[0], head[1], headRot, BL.head.ls),
  };
}

/* ---------------------------------------------------------------- consultas de terreno */
const MAX_SLOPE = 1.7; // pendiente máxima que puede subir caminando (~60°)

/** altura del suelo (línea o piso) en x, cerca de yRef: devuelve {y, stroke} o null */
function groundQuery(x, yRef, tolUp, tolDown, t) {
  let best = null, bestD = Infinity;
  for (const s of S.strokes) {
    const bb = s.bbox();
    if (x < bb[0] || x > bb[2] || yRef + tolDown < bb[1] - 30 || yRef - tolUp > bb[3] + 30) continue;
    const p = s.points(t), h = s.w / 2;
    for (let i = 0; i < p.length - 2; i += 2) {
      const x0 = p[i], x1 = p[i + 2];
      if ((x0 - x) * (x1 - x) > 0) continue;
      const dx = x1 - x0;
      if (Math.abs(dx) < 1e-4) continue;
      const y = p[i + 1] + ((x - x0) / dx) * (p[i + 3] - p[i + 1]) - h, d = y - yRef;
      if (d < -tolUp || d > tolDown) continue;
      if (Math.abs(d) < bestD) { bestD = Math.abs(d); best = { y, stroke: s }; }
    }
  }
  const fy = floorY(), d = fy - yRef;
  if (d >= -tolUp && d <= tolDown && Math.abs(d) < bestD) best = { y: fy, stroke: null };
  return best;
}

/** primer apoyo al caer del punto (x,y) a (nx,ny): solo aterriza viniendo desde arriba */
function landingQuery(x, y, nx, ny, t) {
  let bestT = 2, best = null;
  const minx = Math.min(x, nx) - 4, maxx = Math.max(x, nx) + 4, miny = Math.min(y, ny) - 40, maxy = Math.max(y, ny) + 40;
  for (const s of S.strokes) {
    const bb = s.bbox();
    if (bb[2] < minx || bb[0] > maxx || bb[3] < miny || bb[1] > maxy) continue;
    const p = s.points(t), h = s.w / 2;
    for (let i = 0; i < p.length - 2; i += 2) {
      const x0 = p[i], y0 = p[i + 1] - h, x1 = p[i + 2], y1 = p[i + 3] - h;
      if (Math.max(x0, x1) < minx || Math.min(x0, x1) > maxx) continue;
      const tt = segIntersectT(x, y, nx, ny, x0, y0, x1, y1);
      if (tt < 0 || tt >= bestT) continue;
      const side = ((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0)) * (Math.sign(x1 - x0) || 1);
      if (side > 2) continue; // el pie ya estaba por debajo de la línea: la atraviesa
      bestT = tt; best = { x: x + (nx - x) * tt, y: y + (ny - y) * tt, stroke: s };
    }
  }
  const fy = floorY();
  if (ny >= fy && y <= fy + 0.5) {
    const tt = (fy - y) / (ny - y || 1e-9);
    if (tt < bestT) best = { x: x + (nx - x) * tt, y: fy, stroke: null };
  }
  return best;
}

/* ---------------------------------------------------------------- el pájaro */
const Bird = {
  state: 'off',            // off | morph | alive | unmorph
  sizeMul: 1, s: 0.36,
  F: { x: 0, y: 0 },       // punto de apoyo (la parte de abajo del puntico-pie)
  vx: 0, vy: 0, grounded: false, ground: null,
  coyote: 0, jumpBuf: 0,
  face: 1, flipv: 1, phase: 0, tilt: 0, tiltT: 0,
  hopAmp: 0, a: { ...ZERO_ANIM },
  blinkNext: 0, blinkU: -1,
  saved: null,

  get height() { return BIRD_UNITS * this.s; },
  get parts() { const L = S.letters; return [L.i1, L.b, L.s, L.i2]; }, // orden de dibujo
  get busy() { return this.state !== 'off'; },

  consts() {
    const BH = this.height;
    return { SPEED: 1.4 * BH, G: 8 * BH, JUMP: Math.sqrt(2 * 8 * BH * 0.85 * BH), VMAX: 4 * BH, k: BH / 180 };
  },

  /** Enter: despierta al ibis (o lo vuelve a dormir) */
  toggle() {
    if (this.state === 'off') this.wake();
    else if (this.state === 'alive') this.sleep();
  },

  wake() {
    const L = S.letters;
    this.saved = {};
    for (const id of ['i1', 'b', 'i2', 's']) { const l = L[id]; this.saved[id] = { x: l.x, y: l.y, rot: l.rot, scl: l.scl, flip: l.flip }; }
    this.s = clamp((VH * 0.2) / BIRD_UNITS, 0.18, 0.5) * this.sizeMul;
    const x0 = Math.min(L.i1.worldBBox()[0], L.b.worldBBox()[0]), x1 = L.s.worldBBox()[2];
    this.F.x = clamp((x0 + x1) / 2, 40, VW - 40);
    this.F.y = Math.min(L.b.worldBBox()[3], floorY());
    this.vx = this.vy = 0; this.grounded = false; this.ground = null;
    this.face = 1; this.flipv = 1; this.tilt = 0; this.tiltT = 0; this.phase = 0; this.hopAmp = 0;
    this.a = { ...ZERO_ANIM };
    const rest = birdPose(this, ZERO_ANIM), delays = { body: 0, leg: 0.1, neck: 0.2, head: 0.32 };
    for (const part of ['leg', 'body', 'neck', 'head']) {
      const l = L[BL[part].id];
      l.startTween(rest[part], 1.05, delays[part], easeOutBack);
      const to = rest[part];
      setTimeout(() => puff(to.x, to.y, '#222', 10), (delays[part] + 0.7) * 1000);
    }
    this.state = 'morph';
    toast('¡El ibis despierta! Flechas / A D para caminar · Espacio para saltar');
  },

  sleep() {
    const L = S.letters;
    this.state = 'unmorph';
    let i = 0;
    for (const id of ['s', 'i1', 'b', 'i2']) {
      const to = this.saved[id];
      L[id].startTween({ ...to, flip: 1 }, 0.85, i++ * 0.06, easeInOutCubic);
    }
    toast('El ibis vuelve a ser palabra');
  },

  pressJump() { if (this.state === 'alive') this.jumpBuf = 0.13; },

  /** Un cuadro de física + animación. */
  update(dt, now) {
    if (this.state === 'morph' && this.parts.every((l) => !l.tween)) this.state = 'alive';
    if (this.state === 'unmorph' && this.parts.every((l) => !l.tween)) { this.state = 'off'; return; }
    if (this.state !== 'alive') return;
    dt = Math.min(dt, 1 / 30);
    const C = this.consts(), k = C.k;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir) this.face = dir;

    this.vx = approach(this.vx, dir * C.SPEED, this.grounded ? 16 : 5, dt);
    if (this.grounded && !dir && Math.abs(this.vx) < 4) this.vx = 0;
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);

    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -C.JUMP; this.grounded = false; this.ground = null; this.coyote = 0; this.jumpBuf = 0;
      puff(this.F.x, this.F.y, '#b9b9b9', 6);
    }

    const EDGE = 18 + 40 * this.s;
    if (this.grounded) {
      const nx = clamp(this.F.x + this.vx * dt, EDGE, VW - EDGE), adx = Math.abs(nx - this.F.x);
      const up = 7 * k + adx * MAX_SLOPE + 3, down = 20 * k + adx * MAX_SLOPE;
      const surf = groundQuery(nx, this.F.y, up, down, now);
      if (surf) { this.F.x = nx; this.F.y = surf.y; this.ground = surf.stroke; }
      else if (adx > 0.01 && groundQuery(nx, this.F.y - up - 1, this.height * 0.45, 0, now)) { this.vx = 0; } // pared
      else { this.F.x = nx; this.grounded = false; this.ground = null; this.vy = 0; }
    }
    if (!this.grounded) {
      this.vy = Math.min(this.vy + C.G * dt, C.VMAX);
      const nx = clamp(this.F.x + this.vx * dt, EDGE, VW - EDGE), ny = this.F.y + this.vy * dt;
      const hit = this.vy >= 0 ? landingQuery(this.F.x, this.F.y, nx, ny, now) : null;
      if (hit) {
        if (this.vy > C.VMAX * 0.35) puff(hit.x, hit.y, '#b9b9b9', 5);
        this.F.x = hit.x; this.F.y = hit.y; this.vy = 0; this.grounded = true; this.ground = hit.stroke;
      } else { this.F.x = nx; this.F.y = ny; }
      if (this.F.y >= floorY()) { this.F.y = floorY(); this.vy = 0; this.grounded = true; this.ground = null; }
    }
    if (!isFinite(this.F.x + this.F.y)) { this.F.x = VW / 2; this.F.y = 0; this.vy = 0; }

    // inclinación según el terreno
    if (this.grounded) {
      const dx = 12 * k, l = groundQuery(this.F.x - dx, this.F.y, 30 * k, 30 * k, now), r = groundQuery(this.F.x + dx, this.F.y, 30 * k, 30 * k, now);
      this.tiltT = l && r ? clamp(Math.atan2(r.y - l.y, 2 * dx) * 0.7, -0.6, 0.6) : 0;
    } else this.tiltT = 0;
    this.tilt = approach(this.tilt, this.tiltT, this.grounded ? 12 : 4, dt);
    this.flipv = approach(this.flipv, this.face, 14, dt);
    if (Math.abs(this.flipv - this.face) < 0.01) this.flipv = this.face;

    this.animate(dt, now, C);
  },

  animate(dt, now, C) {
    const moving = this.grounded && Math.abs(this.vx) > 0.15 * C.SPEED;
    this.phase += (Math.abs(this.vx) * dt) / (this.height * 0.2);
    this.hopAmp = approach(this.hopAmp, moving ? 1 : 0, 14, dt);
    const a = this.a, ph = this.phase, hop = this.hopAmp;
    a.hop = Math.abs(Math.sin(ph)) * 16 * hop;
    const air = !this.grounded ? 1 : 0;
    a.leg = approach(a.leg, air ? 0.7 : 0.24 * Math.sin(ph) * hop, 18, dt);
    const lean = (this.vx / C.SPEED) * this.face * 0.06 + (air ? clamp(this.vy / C.VMAX, -1, 1) * 0.28 : 0);
    a.body = approach(a.body, lean + 0.025 * Math.sin(ph * 2) * hop, 12, dt);
    a.neck = approach(a.neck, 0.05 * Math.sin(ph * 2 - 0.7) * hop + 0.035 * Math.sin(now * 1.7) - (air ? clamp(this.vy / C.VMAX, -1, 1) * 0.15 : 0), 10, dt);
    a.head = approach(a.head, 0.11 * Math.sin(ph * 2 - 1.6) * hop + 0.05 * Math.sin(now * 1.1 + 1), 10, dt);

    // parpadeo
    if (now > this.blinkNext) { this.blinkU = 0; this.blinkNext = now + 2 + Math.random() * 3.5; }
    const L = S.letters, eye = L[BL.head.id];
    if (this.blinkU >= 0) { this.blinkU += dt / 0.16; if (this.blinkU >= 1) { this.blinkU = -1; eye.eyeY = 1; } else eye.eyeY = 1 - Math.sin(this.blinkU * Math.PI) * 0.95; }

    const pose = birdPose(this, a);
    for (const part of ['leg', 'body', 'neck', 'head']) {
      const l = L[BL[part].id], p = pose[part];
      l.x = p.x; l.y = p.y; l.rot = p.rot; l.scl = p.scl; l.flip = p.flip;
    }
  },

  /** si una línea que sostiene al pájaro es trasladada con la "t", el pájaro se va con ella */
  carried(stroke, dx, dy) { if (this.state === 'alive' && this.ground === stroke) { this.F.x += dx; this.F.y += dy; } },
};
