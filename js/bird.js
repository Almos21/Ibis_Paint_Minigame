/* ------------------------------------------------------------------
   bird.js — el ibis: las letras «ibis» se arman como un pajarito
     i (1.ª) -> patica (al revés: el puntico es el pie)
     b       -> cuerpo (girada 90°: el palito es el lomo)
     s       -> cuello
     i (2.ª) -> cabeza (el puntico es el ojo y el palito el pico)

   Después de armarse es un AGENTE PROPIO: se mueve a saltitos y actúa según
   el color del ÚLTIMO trazo dibujado (si ese trazo se borra, cuenta el anterior).
   Cada color tiene su comportamiento en la tabla BEHAVIORS (más abajo); los
   colores que aún no tienen uno lo dejan quieto.

   Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint.
   ------------------------------------------------------------------ */

/* ---------------------------------------------------------------- comportamientos por color
   Distancias en "alturas del pájaro" (BH). Los colores son los del logo, en minúscula.
     hopDist  largo de cada saltito        hopDur  segundos en el aire
     pause    descanso entre saltitos      hopH    altura del saltito
     stop     a qué distancia de la punta se detiene
     flee     en vez de seguir la línea, HUYE de ella;  safe = a qué distancia se calma (en BH)
     float    en vez de saltar, flota: speed = velocidad en alturas por segundo   */
const BEHAVIORS = {
  // amarillo: feliz, sigue SIEMPRE la punta del último trazo, saltando contento
  '#f2f31e': { id: 'feliz', hopDist: 0.45, hopDur: 0.30, pause: 0.05, hopH: 0.17, stop: 0.22, happy: true },
  // naranja medio: lo sigue, pero mientras se mueve crece y se encoge al azar
  '#f3b318': { id: 'inquieto', hopDist: 0.45, hopDur: 0.32, pause: 0.12, hopH: 0.13, stop: 0.22, wobble: true },
  // el otro naranja: lo sigue, pero muy lentamente
  '#eb8118': { id: 'lento', hopDist: 0.13, hopDur: 0.55, pause: 1.4, hopH: 0.06, stop: 0.22, sleepy: true },
  // rojo: enojado, la persigue a grandes y fuertes saltos, con humito saliéndole de la cabeza
  '#e6511d': { id: 'enojado', hopDist: 0.95, hopDur: 0.40, pause: 0.16, hopH: 0.30, stop: 0.22, angry: true },
  // rosa: enamorado, sigue la línea dando vueltas sobre su propio eje, con corazoncitos
  '#df39a5': { id: 'enamorado', hopDist: 0.34, hopDur: 0.42, pause: 0.05, hopH: 0.13, stop: 0.22, love: true },
  // morado: asustado, huye de la línea (con sudor, ojos grandes y temblando)
  '#a632b5': { id: 'asustado', flee: true, hopDist: 0.75, hopDur: 0.26, pause: 0.04, hopH: 0.20, safe: 1.15, scared: true },
  // azul oscuro: la sigue triste y lento, cabeceando
  '#1c76c3': { id: 'triste', hopDist: 0.20, hopDur: 0.50, pause: 0.70, hopH: 0.05, stop: 0.22, sad: true },
  // azul normal: la sigue "flotando" (sin saltos: se desliza en el aire, subiendo y bajando)
  '#229fe1': { id: 'flotando', float: true, speed: 0.55, stop: 0.22 },
  // celeste: huye de la línea, pero sin prisa; si la línea lo alcanza, se pone a brillar celeste intenso
  '#16dcdb': { id: 'esquivo', flee: true, hopDist: 0.35, hopDur: 0.38, pause: 0.35, hopH: 0.12, safe: 0.9, shy: true, cyan: true },
  // verde oscuro: persigue la línea y se la va comiendo (por la punta más cercana); al comer, crece
  '#21af20': { id: 'devorador', eat: true, grow: true, hopDist: 0.30, hopDur: 0.30, pause: 0.08, hopH: 0.12, stop: 0.14, speed: 85 },
  // verde del medio: también se la come, pero se le va poniendo la cabeza verde, se marea y al final vomita el color
  '#7ed118': { id: 'mareado', eat: true, dizzy: true, hopDist: 0.28, hopDur: 0.36, pause: 0.12, hopH: 0.10, stop: 0.14, speed: 70 },
  // verde neón: no hace nada con la línea, pero entre más cerca esté de ella, más se le contagia el color (radioactivo)
  '#b8ff1f': { id: 'radioactivo', idle: true, radio: true },
};
const BEHAVIOR_IDLE = { id: 'quieto', idle: true };   // cualquier otro color (por ahora)

/* ---------------------------------------------------------------- anatomía
   Disposición del pájaro en "unidades del logo", con el origen en el punto de apoyo del pie
   y el eje y hacia abajo (negativo = arriba). `pos` es la posición del pivote de cada letra. */
const BIRD_UNITS = 500; // altura aproximada
const BL = {
  leg:  { id: 'i1', pos: [0, -89],   rot: Math.PI,     ls: 1 },
  body: { id: 'b',  pos: [0, -243],  rot: Math.PI / 2, ls: 1 },
  neck: { id: 's',  pos: [92, -392], rot: 0,           ls: 1.3 },
  head: { id: 'i2', pos: [162, -460], rot: -0.5,       ls: 0.72 },
};
const BIRD_HIP = [0, -178];           // donde la pata se une al cuerpo
const BIRD_NECK_BASE = [92, -303];    // base del cuello
const BIRD_HEAD_ATTACH = [142, -434]; // donde la cabeza se une al cuello
const ZERO_ANIM = { hop: 0, crouch: 0, body: 0, neck: 0, head: 0, leg: 0 };

/** Posición/rotación/escala de cada letra del pájaro. `a` son los ángulos y alturas de animación. */
function birdPose(B, a) {
  const f = B.flipv, s = B.s, c = Math.cos(B.tilt), sn = Math.sin(B.tilt);
  const world = (lx, ly, lrot, ls) => {
    const X = f * lx * s, Y = (ly - a.hop) * s;
    return { x: B.F.x + X * c - Y * sn, y: B.F.y + X * sn + Y * c, rot: B.tilt + f * lrot, scl: s * ls, flip: f };
  };
  const [hx, hy] = BIRD_HIP, [nx, ny] = BIRD_NECK_BASE;

  // pata: se balancea desde la cadera
  const leg = rotAbout(BL.leg.pos[0], BL.leg.pos[1], hx, hy, a.leg);
  const legRot = BL.leg.rot + a.leg;

  // cuello: se mece desde su base; la cabeza va pegada al cuello y además cabecea
  let neck = rotAbout(BL.neck.pos[0], BL.neck.pos[1], nx, ny, a.neck);
  const attach = rotAbout(BIRD_HEAD_ATTACH[0], BIRD_HEAD_ATTACH[1], nx, ny, a.neck);
  let head = rotAbout(BL.head.pos[0], BL.head.pos[1], nx, ny, a.neck);
  head = rotAbout(head[0], head[1], attach[0], attach[1], a.head);
  let neckRot = BL.neck.rot + a.neck, headRot = BL.head.rot + a.neck + a.head;

  // cuerpo + cuello + cabeza se inclinan juntos alrededor de la cadera
  let body = rotAbout(BL.body.pos[0], BL.body.pos[1], hx, hy, a.body);
  const bodyRot = BL.body.rot + a.body;
  neck = rotAbout(neck[0], neck[1], hx, hy, a.body); neckRot += a.body;
  head = rotAbout(head[0], head[1], hx, hy, a.body); headRot += a.body;

  // agacharse: el cuerpo baja sobre la pata (todo es negro, así que se funden)
  const cr = a.crouch;
  body = [body[0], body[1] + cr]; neck = [neck[0], neck[1] + cr]; head = [head[0], head[1] + cr];

  return {
    leg: world(leg[0], leg[1], legRot, BL.leg.ls),
    body: world(body[0], body[1], bodyRot, BL.body.ls),
    neck: world(neck[0], neck[1], neckRot, BL.neck.ls),
    head: world(head[0], head[1], headRot, BL.head.ls),
  };
}

/* ---------------------------------------------------------------- el pájaro */
const Bird = {
  state: 'off',            // off | morph | alive
  baseS: 0.4, s: 0.4,      // escala (px por unidad del logo): base y actual (con el cambio de tamaño)
  sizeMul: 1, sizeT: 1, sizeTimer: 0,
  F: { x: 0, y: 0 },       // punto de apoyo (la parte de abajo del puntico-pie)
  face: 1, flipv: 1, tilt: 0,
  hopSt: null,             // saltito en curso: {t, dur, x0, y0, x1, y1, h, land}
  wait: 0, landT: 0,
  B: BEHAVIOR_IDLE, curColor: undefined, target: null, pendingReact: null, moving: false,
  a: { ...ZERO_ANIM },
  blinkNext: 0, blinkU: -1, eyeBase: 1,
  fx: [], fxAcc: { smoke: 0, heart: 0, drop: 0, tear: 0 },   // humito, corazones, gotas de sudor...
  spin: 0, near: null, fv: { x: 0, y: 0 },   // fv = velocidad al flotar
  glowOn: false, glowV: 0,                   // brillo del celeste cuando lo toca la línea
  t: 0,                                      // reloj (s)
  mouthOff: { x: 80, y: 200 },               // dónde queda el pico respecto a los pies (a tamaño normal)
  eatStroke: null, eatEnd: 0, eatEndId: -1, eatUndoId: -1, eatPt: null, eating: false, eatCap: 200, eatSince: 0,
  grow: 1, sick: 0, vomit: null, rad: 0,     // crecer (verde oscuro), mareo + vómito (verde medio), contagio (neón)

  get BH() { return BIRD_UNITS * this.baseS; },                      // altura "normal" en px
  get parts() { const L = S.letters; return [L.i1, L.b, L.s, L.i2]; }, // orden de dibujo
  get maxY() { return this.B.eat ? VH + 0.8 * this.BH * this.sizeMul : VH - 8; },     // el que come puede asomarse por abajo
  get minYf() { return this.BH * this.sizeMul * (this.B.eat ? 0.5 : 0.95); },
  get busy() { return this.state !== 'off'; },

  /** Enter (o tocar «ibis», o dibujar con la i): despierta al ibis. Despierto, ya no se duerme. */
  toggle() { this.wake(); },

  wake() {
    if (this.state !== 'off') return;
    const L = S.letters;
    this.baseS = clamp((VH * 0.3) / BIRD_UNITS, 0.2, 0.62);
    this.s = this.baseS; this.sizeMul = this.sizeT = 1;
    const bb = this.parts.map((l) => l.worldBBox());
    const x0 = Math.min(...bb.map((b) => b[0])), x1 = Math.max(...bb.map((b) => b[2]));
    this.F.x = clamp((x0 + x1) / 2, 60, VW - 60);
    this.F.y = clamp(L.b.worldBBox()[3], this.BH, VH - 10);
    this.face = this.flipv = 1; this.tilt = 0; this.hopSt = null; this.landT = 0; this.wait = 0.4;
    this.a = { ...ZERO_ANIM };
    this.curColor = undefined; this.pendingReact = null;
    this.mouthOff = { x: 0.33 * this.BH, y: 0.85 * this.BH };
    const rest = birdPose(this, ZERO_ANIM), delays = { body: 0, leg: 0.1, neck: 0.2, head: 0.32 };
    for (const part of ['leg', 'body', 'neck', 'head']) {
      const to = rest[part];
      L[BL[part].id].startTween(to, 1.05, delays[part], easeOutBack);
      setTimeout(() => puff(to.x, to.y, '#222', 8), (delays[part] + 0.7) * 1000);
    }
    this.state = 'morph';
  },

  carried(stroke, dx, dy) {},   // la «t» movió una línea: el pájaro la sigue solo (mira la punta cada cuadro)

  /** un cuadro de lógica + animación */
  update(dt, now) {
    if (this.state === 'morph') {
      if (this.parts.every((l) => !l.tween)) { this.state = 'alive'; this.watch(); }
      return;
    }
    if (this.state !== 'alive') return;
    dt = Math.min(dt, 1 / 30);
    this.watch();
    this.t = now;
    if (this.B.cyan) this.checkTouch();
    if (this.B.eat) this.aimEat();
    this.think(dt, now);
    if (this.B.eat) this.eatStep(dt);
    this.radStep(dt);
    this.animate(dt, now);
    this.emitFX(dt);
    this.updateFX(dt);
  },

  /** ¿cuál es el último trazo y de qué color? Si cambia el color, el comportamiento se reinicia. */
  watch() {
    const last = S.strokes[S.strokes.length - 1];
    const col = last ? String(last.color).toLowerCase() : null;
    this.target = last && last.pts.length >= 2 ? [last.pts[last.pts.length - 2], last.pts[last.pts.length - 1]] : null;
    if (col === this.curColor) return;
    const first = this.curColor === undefined;
    this.curColor = col;
    this.B = BEHAVIORS[col] || BEHAVIOR_IDLE;
    this.sizeT = 1; this.sizeTimer = 0;
    this.wait = 0;
    this.glowOn = false;                          // el brillo desaparece al cambiar de color
    this.grow = 1; this.sick = 0; this.vomit = null; this.eatSince = 0; this.eatEndId = -1;   // todo se reinicia con un color nuevo
    if (!first && col) this.pendingReact = col;   // un saltito de "¡ah, otro color!"
  },

  startHop(dx, dy, len, dur, h) {
    const d = Math.hypot(dx, dy) || 1, k = len / d;
    const minY = this.minYf;
    this.hopSt = {
      t: -0.09, dur, h,                                 // t<0: se agacha antes de saltar
      x0: this.F.x, y0: this.F.y,
      x1: clamp(this.F.x + dx * k, 40, VW - 40), y1: clamp(this.F.y + dy * k, minY, this.maxY),
    };
  },

  think(dt, now) {
    const B = this.B, BH = this.BH;
    // ---- saltito en curso
    const H = this.hopSt;
    if (this.vomit) {
      this.hopSt = null; this.pendingReact = null; this.moving = false; this.landT = 0;
      this.vomitStep(dt);
    } else if (B.float) {
      this.thinkFloat(dt);
    } else if (H) {
      H.t += dt;
      const u = clamp(H.t / H.dur, 0, 1);
      if (H.t > 0) { this.F.x = mix(H.x0, H.x1, u); this.F.y = mix(H.y0, H.y1, u); }
      if (u >= 1) {
        this.hopSt = null; this.landT = 0.14;
        this.wait = (B.pause !== undefined ? B.pause : 0.3) * (0.8 + Math.random() * 0.4);
        puff(this.F.x, this.F.y, '#cfcfcf', 3);
        if (B.happy && this.target) puff(this.F.x, this.F.y - BH * 0.55, '#f2f31e', 3);
        if (B.angry) for (let i = 0; i < 6; i++) puff(this.F.x + rnd(-25, 25) * this.sizeMul, this.F.y, '#b9b9b9', 1);  // pisotón
        if (H.react) { puff(this.F.x, this.F.y - BH * 0.55, H.react, 9); this.reactFX(B); }
      }
      this.moving = true;
    } else {
      this.landT = Math.max(0, this.landT - dt);
      this.wait -= dt;
      this.moving = false;
      const last = S.strokes[S.strokes.length - 1];
      const minY = this.minYf;
      const tx = this.target ? clamp(this.target[0], 40, VW - 40) : 0, ty = this.target ? clamp(this.target[1], minY, this.maxY) : 0;
      const dx = tx - this.F.x, dy = ty - this.F.y, dist = Math.hypot(dx, dy);
      if (B.flee) {                                   // amenaza = el punto de la línea más cercano al cuerpo
        this.near = last ? nearestOnStroke(last, this.F.x, this.F.y - 0.35 * BH * this.sizeMul) : null;
        this.moving = !!this.near && this.near.d < B.safe * BH * this.sizeMul;
      } else {
        this.near = null;
        if (this.target && !B.idle) this.moving = dist > B.stop * BH;   // "se mueve" = aún le falta llegar
      }
      if (this.wait <= 0) {
        if (this.pendingReact) {
          const react = this.pendingReact; this.pendingReact = null;
          this.startHop(1, 0, 0, 0.4, 0.2); this.hopSt.react = react;
        } else if (B.flee) {
          this.flee(B);
        } else if (!B.idle && this.target) {
          const stop = B.stop * BH;
          if (dist > stop) {
            const len = Math.min(B.hopDist * BH * (0.85 + Math.random() * 0.3), Math.max(2, dist - stop * 0.6));
            if (Math.abs(dx) > 6 && !B.eat) this.face = dx > 0 ? 1 : -1;
            let hdx = dx, hdy = dy;
            if (B.dizzy && this.sick > 0.1) { const r = rnd(-1, 1) * this.sick * 0.9, c = Math.cos(r), sn = Math.sin(r); hdx = dx * c - dy * sn; hdy = dx * sn + dy * c; }   // mareado: va haciendo eses
            this.startHop(hdx, hdy, len, B.hopDur * (0.9 + Math.random() * 0.2), B.hopH);
          } else if (B.happy) {                       // llegó: bailecito de alegría en su sitio
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
            this.startHop(1, 0, 0, 0.3, 0.07); this.wait = 0.12;
          } else if (B.love) {                        // llegó: flota suspirando mientras sigue girando
            this.startHop(1, 0, 0, 0.5, 0.05); this.wait = 0.25;
          } else if (B.angry) {                       // llegó: patalea de rabia en su sitio
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
            this.startHop(1, 0, 0, 0.3, 0.10); this.wait = 0.1;
          } else this.wait = 0.25;
        } else {                                      // quieto: de vez en cuando mira hacia el otro lado
          this.wait = 2 + Math.random() * 3.5;
          if (Math.random() < 0.45) this.face = -this.face;
        }
      }
    }
    // ---- tamaño que crece y se encoge al azar (solo mientras se mueve)
    if (B.wobble && this.moving) {
      this.sizeTimer -= dt;
      if (this.sizeTimer <= 0) { this.sizeT = 0.55 + Math.random() * 1.2; this.sizeTimer = 0.25 + Math.random() * 0.55; }
    } else this.sizeT = B.grow ? this.grow : 1;
    this.sizeMul = approach(this.sizeMul, this.sizeT, 9, dt);
    this.s = this.baseS * this.sizeMul;
    this.F.x = clamp(this.F.x, 30, VW - 30);
    this.F.y = clamp(this.F.y, this.minYf * (this.B.eat ? 1 : 0.9 / 0.95), this.maxY);
  },

  /** pico (la punta de abajo de la «i» de la cabeza) en el mundo */
  mouth() {
    const l = S.letters[BL.head.id], d = l.def.dot, b = l.bbox, m = l.toWorld(d.cx, b[3]);
    return { x: m[0], y: m[1] };
  },

  /** el trazo que se come: el último que no sea un vómito, y solo si es del color del comportamiento */
  aimEat() {
    let ts = null;
    for (let i = S.strokes.length - 1; i >= 0; i--) { if (S.strokes[i].noEat) continue; ts = S.strokes[i]; break; }
    if (!ts || ts.pts.length < 4 || String(ts.color).toLowerCase() !== this.curColor) { this.eatStroke = null; this.target = null; this.eatPt = null; return; }
    this.eatStroke = ts;
    const p = ts.pts, n = p.length / 2, BH = this.BH, m = this.sizeMul;
    if (this.eatEndId !== ts.id) {                    // va por la punta más cercana
      const d0 = Math.hypot(p[0] - this.F.x, p[1] - this.F.y), d1 = Math.hypot(p[2 * n - 2] - this.F.x, p[2 * n - 1] - this.F.y);
      this.eatEnd = d0 <= d1 ? 0 : 1; this.eatEndId = ts.id;
    }
    const ei = this.eatEnd === 0 ? 0 : n - 1, ex = p[2 * ei], ey = p[2 * ei + 1], o = this.mouthOff;
    if (Math.abs(ex - this.F.x) > 0.45 * BH * m) this.face = ex > this.F.x ? 1 : -1;
    this.eatPt = [ex, ey];
    this.target = [ex - this.face * o.x * m, ey + o.y * m];   // los pies quedan donde el pico alcance la punta
  },

  /** comer: acorta el trazo desde la punta mientras el pico la alcance */
  eatStep(dt) {
    this.eating = false;
    const B = this.B, ts = this.eatStroke, D = S.drag;
    if (!ts || this.vomit || ts.live || (D && (D.cur === ts || D.carry === ts))) return;
    const M = this.mouth(), m = this.sizeMul, p = ts.pts, reach = 0.26 * this.BH * m + ts.w / 2;
    const idx = () => (this.eatEnd === 0 ? 0 : p.length / 2 - 1);
    let ei = idx();
    if (Math.hypot(p[2 * ei] - M.x, p[2 * ei + 1] - M.y) > reach) return;
    if (this.eatUndoId !== ts.id) {                   // Ctrl+Z devuelve la línea
      pushUndo(); this.eatUndoId = ts.id;
      let tot = 0; for (let i = 2; i < p.length; i += 2) tot += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
      this.eatCap = clamp(tot * 0.85, 80, 320); this.eatSince = 0;
    }
    this.eating = true;
    let budget = B.speed * dt, eaten = 0, exhausted = false;
    while (budget > 0) {
      const n = p.length / 2;
      if (n < 2) { exhausted = true; break; }
      ei = idx();
      const nb = this.eatEnd === 0 ? 1 : n - 2, seg = Math.hypot(p[2 * ei] - p[2 * nb], p[2 * ei + 1] - p[2 * nb + 1]);
      if (seg <= budget) {
        budget -= seg; eaten += seg;
        if (this.eatEnd === 0) p.splice(0, 2); else p.length -= 2;
        if (p.length / 2 < 2) { exhausted = true; break; }
      } else {
        const k = budget / seg;
        p[2 * ei] += (p[2 * nb] - p[2 * ei]) * k; p[2 * ei + 1] += (p[2 * nb + 1] - p[2 * ei + 1]) * k;
        eaten += budget; budget = 0;
      }
    }
    ts.geometryChanged(); layerDirty = true;
    if (B.grow) this.grow = Math.min(1.9, this.grow + eaten * 0.0022);
    if (B.dizzy) { this.eatSince += eaten; this.sick = clamp(this.eatSince / this.eatCap, 0, 1); }
    if (exhausted || (B.dizzy && this.sick >= 1)) {
      if (B.dizzy && this.sick >= 0.25) this.startVomit(exhausted ? ts : null);   // ¡no aguanta más!
      else if (exhausted) { const i = S.strokes.indexOf(ts); if (i >= 0) S.strokes.splice(i, 1); this.eatStroke = null; }
    }
  },

  startVomit(stub) {
    const BH = this.BH, m = this.sizeMul, M = this.mouth(), f = this.face, cx = M.x + f * 0.22 * BH * m, cy = this.F.y - 2;
    const L = rnd(0.34, 0.46) * BH * m, N = 16, pts = [];
    for (let i = 0; i < N; i++) { const u = i / (N - 1) - 0.5; pts.push(cx + u * L, cy + Math.sin(i * 1.3) * 0.02 * BH * m); }
    this.vomit = { t: 0, stub, pts, made: null, cx, cy };
    this.hopSt = null;
  },

  vomitStep(dt) {
    const V = this.vomit, BH = this.BH, m = this.sizeMul, WIND = 0.8, SPEW = 1.5, REC = 0.7, col = this.curColor;
    V.t += dt;
    if (V.t >= WIND && V.t < WIND + SPEW) {
      const k = (V.t - WIND) / SPEW, M = this.mouth();
      if (!V.made) {
        pushUndo();
        V.made = new Stroke(col, Math.max(14, 0.1 * BH * m), []); V.made.noEat = true; S.strokes.push(V.made);
      }
      const want = Math.max(2, Math.ceil(V.pts.length / 2 * k));
      while (V.made.pts.length / 2 < want) { const i = V.made.pts.length / 2; V.made.addPoint(V.pts[2 * i], V.pts[2 * i + 1]); }
      layerDirty = true;
      this.fxAcc.goo = (this.fxAcc.goo || 0) + dt * 55;
      while (this.fxAcc.goo >= 1) {
        this.fxAcc.goo -= 1;
        this.fx.push({ k: 'goo', x: M.x, y: M.y, vx: this.face * rnd(30, 120) * m, vy: rnd(-30, 70), g: 650, floor: this.F.y - 2, age: 0, max: 1.4, size: rnd(2.5, 5) * Math.max(0.7, BH * m / 240), col });
      }
    }
    if (V.t >= WIND + SPEW + REC) {
      if (V.stub) { const i = S.strokes.indexOf(V.stub); if (i >= 0) S.strokes.splice(i, 1); this.eatStroke = null; layerDirty = true; }
      this.sick = 0; this.eatSince = 0; this.vomit = null; this.wait = 0.8;
    }
  },

  /** neón: entre más cerca de la línea, más se contagia (0..1) */
  radStep(dt) {
    let tgt = 0;
    if (this.B.radio && this.state === 'alive') {
      const last = S.strokes[S.strokes.length - 1];
      if (last) {
        const BH = this.BH * this.sizeMul;
        let d = Infinity;
        for (const [x, y] of this.bodyPoints()) { const n = nearestOnStroke(last, x, y); if (n) d = Math.min(d, n.d - last.w / 2); }
        tgt = clamp(1 - (d - 0.12 * BH) / (1.6 * BH), 0, 1);
        tgt = tgt * tgt * (3 - 2 * tgt);
      }
    }
    this.rad = approach(this.rad, tgt, 3, dt);
  },

  bodyPoints() {
    const BH = this.BH * this.sizeMul, pts = [[this.F.x, this.F.y - 0.05 * BH]];
    for (const l of this.parts) pts.push([l.x, l.y]);
    for (let i = 0; i < 4; i++) pts.push([(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]);
    return pts;
  },

  /** Flotando: sin saltos; se desliza suavemente hacia la punta (acelera y frena despacio). */
  thinkFloat(dt) {
    const B = this.B, BH = this.BH, m = this.sizeMul;
    this.hopSt = null; this.pendingReact = null; this.landT = 0; this.near = null; this.moving = false;
    let vx = 0, vy = 0;
    if (this.target) {
      const tx = clamp(this.target[0], 40, VW - 40), ty = clamp(this.target[1], BH * m * 0.95, VH - 8);
      const dx = tx - this.F.x, dy = ty - this.F.y, dist = Math.hypot(dx, dy), stop = B.stop * BH;
      if (dist > stop) {
        this.moving = true;
        const sp = B.speed * BH * clamp((dist - stop) / (BH * 0.9), 0.12, 1);
        vx = (dx / dist) * sp; vy = (dy / dist) * sp;
        if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
      }
    }
    this.fv.x = approach(this.fv.x, vx, 3, dt); this.fv.y = approach(this.fv.y, vy, 3, dt);
    this.F.x += this.fv.x * dt; this.F.y += this.fv.y * dt;
  },

  /** Celeste: ¿la línea (último trazo) tocó alguna parte del cuerpo? Entonces brilla hasta que cambie el color. */
  checkTouch() {
    if (this.glowOn) return;
    const last = S.strokes[S.strokes.length - 1];
    if (!last) return;
    const BH = this.BH * this.sizeMul, reach = last.w / 2 + 0.11 * BH;
    for (const [x, y] of this.bodyPoints()) {
      const n = nearestOnStroke(last, x, y);
      if (n && n.d < reach) {
        this.glowOn = true;
        puff(this.F.x, this.F.y - BH * 0.5, '#16dcdb', 14);
        return;
      }
    }
  },

  /** Asustado: salta lejos del punto de la línea más cercano (y se pega a las paredes lo menos posible). */
  flee(B) {
    const BH = this.BH, m = this.sizeMul, near = this.near;
    if (!near) { this.wait = 0.3; return; }
    if (near.d >= B.safe * BH * m) {                  // ya está lejos: se queda temblando, vigilando la línea
      if (Math.abs(near.x - this.F.x) > 8) this.face = near.x > this.F.x ? 1 : -1;
      this.wait = 0.2; return;
    }
    let ax = this.F.x - near.x, ay = this.F.y - 0.35 * BH * m - near.y;
    const al = Math.hypot(ax, ay);
    if (al < 1e-3) { const r = Math.random() * TWOPI; ax = Math.cos(r); ay = Math.sin(r); } else { ax /= al; ay /= al; }
    const len = B.hopDist * BH * (0.85 + Math.random() * 0.3), minY = BH * m * 0.95;
    let best = null;
    for (const off of [0, 0.5, -0.5, 1.1, -1.1, 1.8, -1.8, Math.PI]) {   // si choca con un borde, rodea
      const c = Math.cos(off), s = Math.sin(off), dx = ax * c - ay * s, dy = ax * s + ay * c;
      const ex = clamp(this.F.x + dx * len, 40, VW - 40), ey = clamp(this.F.y + dy * len, minY, VH - 8);
      const score = Math.hypot(ex - near.x, ey - 0.35 * BH * m - near.y) - Math.abs(off) * len * 0.12;
      if (!best || score > best.score) best = { dx, dy, score };
    }
    if (Math.abs(best.dx) > 0.1) this.face = best.dx > 0 ? 1 : -1;
    this.startHop(best.dx, best.dy, len, B.hopDur * (0.9 + Math.random() * 0.2), B.hopH);
  },

  animate(dt, now) {
    const B = this.B, H = this.hopSt, a = this.a;
    const prep = !!H && H.t < 0, air = !!H && H.t >= 0;
    const u = air ? clamp(H.t / H.dur, 0, 1) : 0;
    const floatT = B.float ? 62 + 22 * Math.sin(now * 2.3) : 0;     // flotando: sobre el suelo, subiendo y bajando
    if (air) a.hop = 4 * u * (1 - u) * H.h * BIRD_UNITS;
    else a.hop = approach(a.hop, floatT, B.float ? 5 : 18, dt);
    const vxn = clamp(this.fv.x / (this.BH * 0.6), -1, 1), fwd = vxn * this.face;

    // agacharse antes de saltar, estirarse en el aire, "aplastarse" al caer
    const crouchT = prep ? 1 : air ? -0.3 : this.landT > 0 ? 0.9 : B.sad ? 0.35 : 0;
    a.crouch = approach(a.crouch, crouchT * (B.angry ? 36 : 26), 24, dt);
    const legT = air ? 0.62 : B.float ? 0.22 * Math.sin(now * 1.9) + 0.3 * fwd : 0;   // al flotar la patica cuelga y se arrastra
    a.leg = approach(a.leg, legT, B.float ? 6 : 20, dt);

    const sway = Math.sin(now * 1.7);
    let bodyT = 0.012 * Math.sin(now * 2.1), neckT = 0.035 * sway, headT = 0.05 * Math.sin(now * 1.1 + 1), tiltT = 0;
    if (air) { neckT = 0.15; headT = -0.05; tiltT = this.face * (B.angry ? 0.16 : 0.10); }
    else if (this.landT > 0) { neckT = -0.09; }
    if (B.happy) {                                    // contento: se contonea y cabecea rápido
      bodyT += 0.07 * Math.sin(now * 15); headT += 0.12 * Math.sin(now * 11);
    }
    if (B.sleepy) {                                   // adormilado: cabeza caída y movimientos lentos
      neckT = -0.12 + 0.03 * Math.sin(now * 0.9); headT = 0.22 + 0.06 * Math.sin(now * 0.8);
    }
    if (B.angry) {                                    // furioso: cuello hacia adelante, cabeza gacha
      neckT += 0.10; headT += 0.14;
    }
    if (B.love) {                                     // enamorado: cabeza ladeada, suspirando
      headT += -0.10 + 0.08 * Math.sin(now * 2.6); neckT += 0.03 * Math.sin(now * 2.6 + 1);
    }
    if (B.scared) {                                   // asustado: cuello encogido hacia atrás
      neckT += -0.16; headT += -0.12;
    }
    if (B.sad) { neckT += -0.14; headT = 0.12 + 0.26 * Math.sin(now * 1.8); }   // triste: cabecea despacito
    if (B.float) {
      bodyT += 0.035 * Math.sin(now * 1.5); neckT += 0.04 * Math.sin(now * 1.3 + 1); headT += 0.06 * Math.sin(now * 1.1);
      tiltT = vxn * 0.14 + 0.03 * Math.sin(now * 1.3);                             // se inclina hacia donde flota
    }
    if (B.shy) neckT += -0.07;
    if (this.eating) { neckT += 0.07 + 0.05 * Math.sin(now * 17 + 1); headT += 0.35 + 0.28 * Math.sin(now * 17); }   // mordiscos
    if (B.dizzy && this.sick > 0) {                   // mareado: se tambalea cada vez más
      const k = this.sick;
      bodyT += k * 0.10 * Math.sin(now * 3.1); neckT += k * 0.12 * Math.sin(now * 2.3); headT += k * 0.30 * Math.sin(now * 2.6 + 1);
      tiltT += k * 0.13 * Math.sin(now * 2.0);
    }
    if (this.vomit) {
      const V = this.vomit, WIND = 0.8, SPEW = 1.5;
      if (V.t < WIND) { const u = V.t / WIND; neckT = -0.22 * u; headT = -0.55 * u; bodyT += 0.06 * Math.sin(now * 25) * u; }
      else if (V.t < WIND + SPEW) { neckT = 0.42; headT = 0.85 + 0.1 * Math.sin(now * 20); bodyT += 0.05 * Math.sin(now * 22); }
      else { headT += 0.3 * Math.sin(now * 14); neckT += -0.1; }
    }
    a.body = approach(a.body, bodyT, 14, dt);
    a.neck = approach(a.neck, neckT, 12, dt);
    a.head = approach(a.head, headT, 12, dt);
    this.tilt = approach(this.tilt, tiltT, 12, dt);
    if (B.love) {                                     // vueltas sobre su propio eje (de perfil -> de frente -> de perfil...)
      this.spin += dt * TWOPI * 1.15;
      this.flipv = approach(this.flipv, Math.cos(this.spin), 25, dt);
    } else {
      this.spin = 0;
      this.flipv = approach(this.flipv, this.face, 14, dt);
      if (Math.abs(this.flipv - this.face) < 0.01) this.flipv = this.face;
    }

    // ojo (el puntico de la i-cabeza): entrecerrado si está feliz o con sueño, enorme si se asusta; parpadea
    const eye = S.letters[BL.head.id];
    const eyeT = B.scared ? 1.55 : B.happy ? 0.5 : B.sleepy ? 0.3 : B.angry ? 0.75 : B.sad ? 0.55 : B.shy ? 1.2 : 1;
    const eyeK = B.dizzy && this.sick > 0 ? 1 + this.sick * 0.7 * Math.sin(now * 7) : 1;
    this.eyeBase = approach(this.eyeBase, eyeT * eyeK, 10, dt);
    if (now > this.blinkNext) { this.blinkU = 0; this.blinkNext = now + (B.scared ? 4 : 2) + Math.random() * 3.5; }
    let blink = 1;
    if (this.blinkU >= 0) { this.blinkU += dt / 0.16; if (this.blinkU >= 1) this.blinkU = -1; else blink = 1 - Math.sin(this.blinkU * Math.PI) * 0.95; }
    eye.eyeY = clamp(this.eyeBase * blink, 0.06, 1.6);
    eye.dotColor = B.angry ? '#e6511d' : B.love ? '#df39a5' : this.glowV > 0.5 || this.rad > 0.6 ? '#ffffff' : null;   // ojos rojos de rabia / rosados de amor

    // temblor (rabia y miedo)
    const amp = (B.scared ? 1.6 : B.angry ? 0.9 : B.radio ? 0.9 * this.rad * this.rad : 0) * this.sizeMul;
    const jx = amp ? (Math.random() - 0.5) * 2 * amp : 0, jy = amp ? (Math.random() - 0.5) * amp : 0;

    // brillo celeste intenso (celeste) / contagio neón (radioactivo) / cabeza verde (mareado)
    this.glowV = approach(this.glowV, this.glowOn ? 0.92 + 0.08 * Math.sin(now * 6) : 0, this.glowOn ? 16 : 7, dt);
    const gk = clamp(this.glowV, 0, 1), rk = clamp(this.rad, 0, 1), useRad = rk > gk;
    const glowK = Math.max(gk, rk * 0.85), glowC = useRad ? '#b8ff1f' : '#16dcdb', tc = useRad ? [184, 255, 31] : [24, 236, 234], tk = useRad ? rk : gk;
    const rgb = (c, k) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;
    for (const l of this.parts) {
      l.glow = glowK; l.glowColor = glowC; l.glowBlurs = [[50, 0.9], [22, 1], [8, 1]];
      l.tint = tk > 0.02 ? rgb(tc, tk) : null;
    }
    if (this.sick > 0.02 && tk < 0.5) {                // la cabeza (y un poco el cuello) se ponen verdes
      eye.tint = rgb([126, 209, 24], this.sick);
      S.letters[BL.neck.id].tint = rgb([126, 209, 24], this.sick * 0.45);
    }

    const pose = birdPose(this, a);
    for (const part of ['leg', 'body', 'neck', 'head']) {
      const l = S.letters[BL[part].id], p = pose[part];
      l.x = p.x + jx; l.y = p.y + jy; l.rot = p.rot; l.scl = p.scl; l.flip = p.flip;
    }
    if (this.state === 'alive' && Math.abs(this.flipv) > 0.9 && !this.vomit) {   // mide dónde queda el pico (para saber dónde parar)
      const M = this.mouth(), k = this.sizeMul, sg = Math.sign(this.flipv);
      this.mouthOff.x = approach(this.mouthOff.x, Math.max(10, (M.x - this.F.x) * sg / k), 3, dt);
      this.mouthOff.y = approach(this.mouthOff.y, Math.max(10, (this.F.y - M.y) / k), 3, dt);
    }
  },

  /* ---------------------------------------------------------------- efectos: humito, corazones, sudor */
  headPos() { const t = S.letters[BL.head.id].tip(); return { x: t[0], y: t[1] }; },

  emitFX(dt) {
    const B = this.B, A = this.fxAcc, k = this.sizeMul, BH = this.BH * k, e = this.headPos();
    if (B.angry) {
      A.smoke += dt * 22;
      while (A.smoke >= 1) {
        A.smoke -= 1;
        this.fx.push({ k: 'smoke', x: e.x + rnd(-4, 4) * k, y: e.y - BH * 0.04, vx: rnd(-12, 12), vy: -rnd(45, 85), age: 0, max: rnd(0.9, 1.5), r0: BH * 0.012 + 2, r1: BH * 0.05 + 5 });
      }
    } else A.smoke = 0;
    if (B.love) {
      A.heart += dt * 3.4;
      while (A.heart >= 1) { A.heart -= 1; this.addHeart(e); }
    } else A.heart = 0;
    if (B.sad) {                                       // una lagrimita que resbala del ojo
      A.tear += dt * 0.9;
      while (A.tear >= 1) { A.tear -= 1; this.fx.push({ k: 'drop', x: e.x, y: e.y + 2 * k, vx: this.face * 3, vy: 12, g: 90, age: 0, max: 1.6, size: 4.2 * Math.max(0.7, BH / 240) }); }
    } else A.tear = 0;
    if (B.scared) {
      A.drop += dt * (this.moving ? 8 : 3.5);
      while (A.drop >= 1) {
        A.drop -= 1;
        const sg = Math.random() < 0.5 ? -1 : 1;
        this.fx.push({ k: 'drop', x: e.x + sg * rnd(2, 8) * k, y: e.y - BH * 0.03, vx: sg * rnd(25, 70), vy: -rnd(40, 100), age: 0, max: rnd(0.7, 1.1), size: rnd(2.2, 3.6) * Math.max(0.6, BH / 240) });
      }
    } else A.drop = 0;
    if (this.eating) {                                // migajas del color que se está comiendo
      A.crumb = (A.crumb || 0) + dt * 18;
      const M = this.mouth();
      while (A.crumb >= 1) { A.crumb -= 1; this.fx.push({ k: 'crumb', x: M.x, y: M.y, vx: rnd(-50, 50), vy: -rnd(10, 70), g: 420, age: 0, max: rnd(0.4, 0.8), size: rnd(1.8, 3.6), col: this.curColor, rot: rnd(0, TWOPI) }); }
    } else A.crumb = 0;
    if (B.radio && this.rad > 0.15) {                  // chispitas radioactivas
      A.spark = (A.spark || 0) + dt * this.rad * 14;
      while (A.spark >= 1) {
        A.spark -= 1;
        const ps = this.bodyPoints(), q = ps[(Math.random() * ps.length) | 0];
        this.fx.push({ k: 'spark', x: q[0] + rnd(-10, 10) * k, y: q[1] + rnd(-10, 10) * k, vx: rnd(-14, 14), vy: -rnd(15, 45), age: 0, max: rnd(0.7, 1.3), size: rnd(1.5, 3.6) * Math.max(0.7, BH / 240) });
      }
    } else A.spark = 0;
    if (this.fx.length > 160) this.fx.splice(0, this.fx.length - 160);
  },

  addHeart(e) {
    const BH = this.BH * this.sizeMul;
    this.fx.push({ k: 'heart', x: e.x + rnd(-6, 6) * this.sizeMul, y: e.y - BH * 0.05, vx: rnd(-14, 14), vy: -rnd(36, 62), age: 0, max: rnd(1.3, 1.9), size: rnd(4.5, 8) * Math.max(0.7, BH / 240), ph: rnd(0, TWOPI), col: Math.random() < 0.35 ? '#ff8fcf' : '#df39a5' });
  },

  /** reacción al cambiar de color (al terminar el saltito de sorpresa) */
  reactFX(B) {
    const e = this.headPos(), BH = this.BH * this.sizeMul;
    if (B.angry) for (let i = 0; i < 9; i++) this.fx.push({ k: 'smoke', x: e.x + rnd(-8, 8), y: e.y - BH * 0.04, vx: rnd(-40, 40), vy: -rnd(40, 110), age: 0, max: rnd(0.9, 1.5), r0: BH * 0.02 + 3, r1: BH * 0.07 + 6 });
    else if (B.love) for (let i = 0; i < 6; i++) this.addHeart(e);
    else if (B.scared) this.fx.push({ k: 'bang', x: e.x, y: e.y - BH * 0.12, age: 0, max: 1.0 });
  },

  updateFX(dt) {
    for (const p of this.fx) {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'drop' || p.k === 'crumb') p.vy += (p.g || 300) * dt;
      else if (p.k === 'goo') { p.vy += p.g * dt; if (p.y >= p.floor && p.vy > 0) p.age = p.max; }
      else if (p.k === 'smoke') { p.vx *= 0.99; p.vy *= 0.996; }
      else if (p.k === 'heart') p.x += Math.sin(p.age * 5 + p.ph) * 14 * dt;
    }
    this.fx = this.fx.filter((p) => p.age < p.max);
  },

  drawFX(ctx) {
    if (!this.busy) return;
    ctx.save();
    for (const p of this.fx) {
      const u = p.age / p.max;
      if (p.k === 'smoke') {
        const r = p.r0 + (p.r1 - p.r0) * Math.sqrt(u);
        ctx.fillStyle = `rgba(88,88,92,${0.5 * Math.pow(1 - u, 1.3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TWOPI); ctx.fill();
        ctx.fillStyle = `rgba(40,40,44,${0.28 * Math.pow(1 - u, 1.6)})`;
        ctx.beginPath(); ctx.arc(p.x - r * 0.2, p.y + r * 0.15, r * 0.55, 0, TWOPI); ctx.fill();
      } else if (p.k === 'heart') {
        const sc = p.size * (u < 0.15 ? u / 0.15 : 1), rot = Math.sin(p.age * 4 + p.ph) * 0.3;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot); ctx.scale(sc, sc);
        ctx.globalAlpha = 1 - Math.pow(u, 3); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.moveTo(0, 0.9); ctx.bezierCurveTo(-1.6, -0.2, -0.7, -1.3, 0, -0.4); ctx.bezierCurveTo(0.7, -1.3, 1.6, -0.2, 0, 0.9); ctx.fill();
        ctx.restore();
      } else if (p.k === 'drop') {
        const sz = p.size;
        ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = 1 - Math.pow(u, 3);
        ctx.fillStyle = '#8fd3ff'; ctx.strokeStyle = '#3b9ae6'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -sz * 1.5); ctx.quadraticCurveTo(sz * 1.1, 0, 0, sz); ctx.quadraticCurveTo(-sz * 1.1, 0, 0, -sz * 1.5); ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (p.k === 'crumb') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.age * 8); ctx.globalAlpha = 1 - Math.pow(u, 2);
        ctx.fillStyle = p.col; ctx.fillRect(-p.size, -p.size * 0.7, p.size * 2, p.size * 1.4); ctx.restore();
      } else if (p.k === 'goo') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = p.col; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 1.25, 0, 0, TWOPI); ctx.fill(); ctx.stroke(); ctx.restore();
      } else if (p.k === 'spark') {
        ctx.save(); ctx.globalAlpha = (1 - u) * 0.95; ctx.shadowColor = '#b8ff1f'; ctx.shadowBlur = 10; ctx.fillStyle = '#d6ff5a';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - 0.5 * u), 0, TWOPI); ctx.fill(); ctx.restore();
      } else if (p.k === 'bang') {                      // "¡!" de susto sobre la cabeza
        const pop = 1 + 0.35 * Math.sin(Math.min(1, u * 5) * Math.PI), k = this.sizeMul;
        ctx.save(); ctx.translate(p.x, p.y - Math.min(u * 14, 8)); ctx.scale(pop * k, pop * k); ctx.globalAlpha = 1 - Math.pow(u, 4);
        ctx.lineCap = 'round'; ctx.strokeStyle = '#a632b5'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(0, -5); ctx.stroke();
        ctx.fillStyle = '#a632b5'; ctx.beginPath(); ctx.arc(0, 3, 3, 0, TWOPI); ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    // mareado: estrellitas/espiral girando sobre la cabeza
    if (this.state === 'alive' && this.B.dizzy && this.sick > 0.3) {
      const e = this.headPos(), BH = this.BH * this.sizeMul, a = this.t * 5, n = 3;
      ctx.save(); ctx.fillStyle = '#7ed118'; ctx.strokeStyle = '#2c6b00'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const an = a + (i * TWOPI) / n, x = e.x + Math.cos(an) * 0.11 * BH, y = e.y - 0.12 * BH + Math.sin(an) * 0.035 * BH, r = Math.max(2.5, 0.016 * BH);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TWOPI); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    // ceño fruncido (rojo): una rayita inclinada sobre el ojo
    if (this.state === 'alive' && this.B.angry && Math.abs(this.flipv) > 0.5) {
      const l = S.letters[BL.head.id], e = this.headPos(), r = Math.max(3, l.def.dot.r * l.scl), f = Math.sign(this.flipv);
      ctx.save();
      ctx.strokeStyle = '#000'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, r * 0.8);
      ctx.beginPath(); ctx.moveTo(e.x - f * r * 1.3, e.y - r * 2.3); ctx.lineTo(e.x + f * r * 1.4, e.y - r * 1.15); ctx.stroke();
      ctx.restore();
    }
  },

  /** sombrita en el suelo: se achica y se aclara cuando salta */
  drawShadow(ctx) {
    if (!this.busy) return;
    const air = this.state === 'alive' ? clamp(this.a.hop / (BIRD_UNITS * 0.2), 0, 1) : 0;
    const k = this.sizeMul * (1 - 0.3 * air);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.11 * (1 - 0.55 * air)})`;
    ctx.beginPath(); ctx.ellipse(this.F.x, this.F.y + 2, this.BH * 0.17 * k, this.BH * 0.03 * k, 0, 0, TWOPI); ctx.fill();
    ctx.restore();
  },
};

/** punto de la polilínea de un trazo más cercano a (cx, cy): {x, y, d} */
function nearestOnStroke(s, cx, cy) {
  const p = s.pts, n = p.length / 2;
  if (n === 0) return null;
  if (n === 1) return { x: p[0], y: p[1], d: Math.hypot(cx - p[0], cy - p[1]) };
  let best = { x: p[0], y: p[1], d: Infinity };
  const step = n > 1500 ? Math.ceil(n / 1500) : 1;
  for (let k = 0; k < n - 1; k += step) {
    const k2 = Math.min(n - 1, k + step);
    const ax = p[2 * k], ay = p[2 * k + 1], vx = p[2 * k2] - ax, vy = p[2 * k2 + 1] - ay, L2 = vx * vx + vy * vy;
    let t = L2 ? ((cx - ax) * vx + (cy - ay) * vy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + vx * t, qy = ay + vy * t, d = Math.hypot(cx - qx, cy - qy);
    if (d < best.d) best = { x: qx, y: qy, d };
  }
  return best;
}
