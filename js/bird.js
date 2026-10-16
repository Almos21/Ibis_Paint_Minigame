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
     stop     a qué distancia de la punta se detiene                                      */
const BEHAVIORS = {
  // amarillo: feliz, sigue SIEMPRE la punta del último trazo, saltando contento
  '#f2f31e': { id: 'feliz', hopDist: 0.45, hopDur: 0.30, pause: 0.05, hopH: 0.17, stop: 0.22, happy: true },
  // naranja medio: lo sigue, pero mientras se mueve crece y se encoge al azar
  '#f3b318': { id: 'inquieto', hopDist: 0.45, hopDur: 0.32, pause: 0.12, hopH: 0.13, stop: 0.22, wobble: true },
  // el otro naranja: lo sigue, pero muy lentamente
  '#eb8118': { id: 'lento', hopDist: 0.13, hopDur: 0.55, pause: 1.4, hopH: 0.06, stop: 0.22, sleepy: true },
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

  get BH() { return BIRD_UNITS * this.baseS; },                      // altura "normal" en px
  get parts() { const L = S.letters; return [L.i1, L.b, L.s, L.i2]; }, // orden de dibujo
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
    this.think(dt, now);
    this.animate(dt, now);
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
    if (!first && col) this.pendingReact = col;   // un saltito de "¡ah, otro color!"
  },

  startHop(dx, dy, len, dur, h) {
    const d = Math.hypot(dx, dy) || 1, k = len / d;
    const minY = this.BH * this.sizeMul * 0.95;
    this.hopSt = {
      t: -0.09, dur, h,                                 // t<0: se agacha antes de saltar
      x0: this.F.x, y0: this.F.y,
      x1: clamp(this.F.x + dx * k, 40, VW - 40), y1: clamp(this.F.y + dy * k, minY, VH - 8),
    };
  },

  think(dt, now) {
    const B = this.B, BH = this.BH;
    // ---- saltito en curso
    const H = this.hopSt;
    if (H) {
      H.t += dt;
      const u = clamp(H.t / H.dur, 0, 1);
      if (H.t > 0) { this.F.x = mix(H.x0, H.x1, u); this.F.y = mix(H.y0, H.y1, u); }
      if (u >= 1) {
        this.hopSt = null; this.landT = 0.14;
        this.wait = (B.pause !== undefined ? B.pause : 0.3) * (0.8 + Math.random() * 0.4);
        puff(this.F.x, this.F.y, '#cfcfcf', 3);
        if (B.happy && this.target) puff(this.F.x, this.F.y - BH * 0.55, '#f2f31e', 3);
        if (H.react) puff(this.F.x, this.F.y - BH * 0.55, H.react, 9);
      }
      this.moving = true;
    } else {
      this.landT = Math.max(0, this.landT - dt);
      this.wait -= dt;
      this.moving = false;
      const minY = BH * this.sizeMul * 0.95;
      const tx = this.target ? clamp(this.target[0], 40, VW - 40) : 0, ty = this.target ? clamp(this.target[1], minY, VH - 8) : 0;
      const dx = tx - this.F.x, dy = ty - this.F.y, dist = Math.hypot(dx, dy);
      if (this.target && !B.idle) this.moving = dist > B.stop * BH;   // "se mueve" = aún le falta llegar
      if (this.wait <= 0) {
        if (this.pendingReact) {
          const react = this.pendingReact; this.pendingReact = null;
          this.startHop(1, 0, 0, 0.4, 0.2); this.hopSt.react = react;
        } else if (!B.idle && this.target) {
          const stop = B.stop * BH;
          if (dist > stop) {
            const len = Math.min(B.hopDist * BH * (0.85 + Math.random() * 0.3), Math.max(2, dist - stop * 0.6));
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
            this.startHop(dx, dy, len, B.hopDur * (0.9 + Math.random() * 0.2), B.hopH);
          } else if (B.happy) {                       // llegó: bailecito de alegría en su sitio
            if (Math.abs(dx) > 6) this.face = dx > 0 ? 1 : -1;
            this.startHop(1, 0, 0, 0.3, 0.07); this.wait = 0.12;
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
    } else this.sizeT = 1;
    this.sizeMul = approach(this.sizeMul, this.sizeT, 9, dt);
    this.s = this.baseS * this.sizeMul;
    this.F.x = clamp(this.F.x, 30, VW - 30);
    this.F.y = clamp(this.F.y, this.BH * this.sizeMul * 0.9, VH - 8);
  },

  animate(dt, now) {
    const B = this.B, H = this.hopSt, a = this.a;
    const prep = !!H && H.t < 0, air = !!H && H.t >= 0;
    const u = air ? clamp(H.t / H.dur, 0, 1) : 0;
    a.hop = air ? 4 * u * (1 - u) * H.h * BIRD_UNITS : 0;

    // agacharse antes de saltar, estirarse en el aire, "aplastarse" al caer
    const crouchT = prep ? 1 : air ? -0.3 : this.landT > 0 ? 0.9 : 0;
    a.crouch = approach(a.crouch, crouchT * 26, 24, dt);
    a.leg = approach(a.leg, air ? 0.62 : 0, 20, dt);

    const sway = Math.sin(now * 1.7);
    let bodyT = 0.012 * Math.sin(now * 2.1), neckT = 0.035 * sway, headT = 0.05 * Math.sin(now * 1.1 + 1), tiltT = 0;
    if (air) { neckT = 0.15; headT = -0.05; tiltT = this.face * 0.10; }
    else if (this.landT > 0) { neckT = -0.09; }
    if (B.happy) {                                    // contento: se contonea y cabecea rápido
      bodyT += 0.07 * Math.sin(now * 15); headT += 0.12 * Math.sin(now * 11);
    }
    if (B.sleepy) {                                   // adormilado: cabeza caída y movimientos lentos
      neckT = -0.12 + 0.03 * Math.sin(now * 0.9); headT = 0.22 + 0.06 * Math.sin(now * 0.8);
    }
    a.body = approach(a.body, bodyT, 14, dt);
    a.neck = approach(a.neck, neckT, 12, dt);
    a.head = approach(a.head, headT, 12, dt);
    this.tilt = approach(this.tilt, tiltT, 12, dt);
    this.flipv = approach(this.flipv, this.face, 14, dt);
    if (Math.abs(this.flipv - this.face) < 0.01) this.flipv = this.face;

    // ojo (el puntico de la i-cabeza): entrecerrado si está feliz o con sueño; parpadea de vez en cuando
    const eye = S.letters[BL.head.id];
    this.eyeBase = approach(this.eyeBase, B.happy ? 0.5 : B.sleepy ? 0.3 : 1, 10, dt);
    if (now > this.blinkNext) { this.blinkU = 0; this.blinkNext = now + 2 + Math.random() * 3.5; }
    let blink = 1;
    if (this.blinkU >= 0) { this.blinkU += dt / 0.16; if (this.blinkU >= 1) this.blinkU = -1; else blink = 1 - Math.sin(this.blinkU * Math.PI) * 0.95; }
    eye.eyeY = Math.max(0.06, Math.min(this.eyeBase, 1) * blink);

    const pose = birdPose(this, a);
    for (const part of ['leg', 'body', 'neck', 'head']) {
      const l = S.letters[BL[part].id], p = pose[part];
      l.x = p.x; l.y = p.y; l.rot = p.rot; l.scl = p.scl; l.flip = p.flip;
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
