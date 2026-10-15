/* ------------------------------------------------------------------
   strokes.js — trazos vectoriales y efectos de la letra "a" (alterar)
   Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint.
   ------------------------------------------------------------------ */

class Stroke {
  constructor(color, w, pts) {
    this.id = ++Stroke.count;
    this.color = color;
    this.w = w;
    this.pts = pts || [];      // [x0,y0,x1,y1,...]
    this.fx = null;            // {type, seed, ...params} (efecto de la "a")
    this.live = false;         // true mientras otra herramienta lo está sosteniendo (t)
    this._path = null; this._bbox = null; this._nrm = null; this._arc = null;
    this._extra = null; this._disp = null; this._dispT = -1;
  }

  get n() { return this.pts.length / 2; }
  get animated() { return !!(this.fx && FX[this.fx.type].animated); }

  addPoint(x, y) { this.pts.push(x, y); this._path = null; this._bbox = null; this._nrm = null; this._arc = null; this._extra = null; }
  geometryChanged() { this._path = this._bbox = this._nrm = this._arc = this._extra = this._disp = null; this._dispT = -1; }

  translate(dx, dy) {
    const p = this.pts;
    for (let i = 0; i < p.length; i += 2) { p[i] += dx; p[i + 1] += dy; }
    if (this._bbox) { this._bbox[0] += dx; this._bbox[1] += dy; this._bbox[2] += dx; this._bbox[3] += dy; }
    this._path = null; this._extra = null; this._dispT = -1;
  }

  /** [x0,y0,x1,y1] con un margen */
  bbox() {
    if (!this._bbox) {
      const p = this.pts, pad = this.w / 2 + 14;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < p.length; i += 2) {
        if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i];
        if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1];
      }
      this._bbox = [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
    }
    return this._bbox;
  }

  path() { return this._path || (this._path = polyPath(this.pts)); }

  arc() {
    if (!this._arc) {
      const p = this.pts, n = p.length / 2, a = new Array(n);
      a[0] = 0;
      for (let k = 1; k < n; k++) a[k] = a[k - 1] + Math.hypot(p[2 * k] - p[2 * k - 2], p[2 * k + 1] - p[2 * k - 1]);
      this._arc = a;
    }
    return this._arc;
  }

  normals() {
    if (!this._nrm) {
      const p = this.pts, n = p.length / 2, o = new Array(p.length);
      for (let k = 0; k < n; k++) {
        const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
        let tx = p[2 * b] - p[2 * a], ty = p[2 * b + 1] - p[2 * a + 1];
        const l = Math.hypot(tx, ty) || 1;
        o[2 * k] = -ty / l; o[2 * k + 1] = tx / l;
      }
      this._nrm = o;
    }
    return this._nrm;
  }

  /** puntos "visibles" en el instante t (los efectos de onda/temblor los desplazan) */
  points(t) {
    const f = this.fx && FX[this.fx.type];
    if (!f || !f.pos) return this.pts;
    if (this._dispT !== t || !this._disp) {
      const out = this._disp && this._disp.length === this.pts.length ? this._disp : new Array(this.pts.length);
      f.pos(this, t, out);
      this._disp = out; this._dispT = t;
    }
    return this._disp;
  }

  clone() {
    const s = new Stroke(this.color, this.w, this.pts.slice());
    s.fx = this.fx ? { ...this.fx } : null;
    return s;
  }
}
Stroke.count = 0;

/* ---------------------------------------------------------------- helpers de dibujo */
function strokeP(ctx, path, color, w, alpha) {
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke(path);
  ctx.globalAlpha = 1;
}

function isDarkColor(c) {
  if (c[0] !== '#') return false;
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70;
}

function starPath(cx, cy, r) {
  const p = new Path2D();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 === 0 ? r : r * 0.3;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  p.closePath();
  return p;
}

const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------------------------------------------------------------- efectos */
const FX = {
  /* --- animados (se dibujan "en vivo" cada cuadro) --- */
  onda: {
    name: 'Onda', animated: true,
    make: () => ({ amp: rnd(4, 9), len: rnd(26, 56), spd: rnd(3, 6) }),
    pos(s, t, out) {
      const p = s.pts, nr = s.normals(), arc = s.arc(), f = s.fx;
      for (let k = 0; k < arc.length; k++) {
        const o = f.amp * Math.sin((arc[k] / f.len) * TWOPI + f.spd * t);
        out[2 * k] = p[2 * k] + nr[2 * k] * o; out[2 * k + 1] = p[2 * k + 1] + nr[2 * k + 1] * o;
      }
    },
  },
  temblor: {
    name: 'Temblor', animated: true,
    make: () => ({ amp: rnd(1.6, 3.2) }),
    pos(s, t, out) {
      const p = s.pts, f = s.fx, q = Math.floor(t * 14);
      for (let k = 0; k < p.length / 2; k++) {
        out[2 * k] = p[2 * k] + (hash(f.seed + k * 7.3 + q * 13.1) - 0.5) * 2 * f.amp;
        out[2 * k + 1] = p[2 * k + 1] + (hash(f.seed + k * 3.1 + q * 5.7 + 99) - 0.5) * 2 * f.amp;
      }
    },
  },
  arcoiris: {
    name: 'Arcoíris', animated: true,
    draw(ctx, s, t) {
      const p = s.pts, n = p.length / 2, arc = s.arc();
      ctx.lineWidth = s.w;
      for (let k = 0; k < n - 1; k += 3) {
        const e = Math.min(k + 3, n - 1);
        ctx.strokeStyle = `hsl(${(arc[k] * 0.9 + t * 140) % 360},92%,54%)`;
        ctx.beginPath(); ctx.moveTo(p[2 * k], p[2 * k + 1]);
        for (let j = k + 1; j <= e; j++) ctx.lineTo(p[2 * j], p[2 * j + 1]);
        ctx.stroke();
      }
    },
  },
  hormigas: {
    name: 'Hormigas', animated: true,
    draw(ctx, s, t) {
      ctx.setLineDash([s.w * 1.5 + 6, s.w + 9]);
      ctx.lineDashOffset = -t * 38;
      strokeP(ctx, s.path(), s.color, s.w);
      ctx.setLineDash([]);
    },
  },
  neon: {
    name: 'Neón', animated: true,
    make: (s) => ({ col: isDarkColor(s.color) ? `hsl(${Math.floor(rnd(0, 360))},95%,55%)` : s.color }),
    draw(ctx, s, t) {
      const f = s.fx, path = s.path(), k = 0.78 + 0.22 * Math.sin(t * 3 + f.seed);
      strokeP(ctx, path, f.col, s.w * 5.5, 0.1 * k);
      strokeP(ctx, path, f.col, s.w * 3.4, 0.18 * k);
      strokeP(ctx, path, f.col, s.w * 2, 0.4 * k);
      strokeP(ctx, path, f.col, s.w * 1.1, 1);
      strokeP(ctx, path, '#ffffff', Math.max(1.5, s.w * 0.45), 0.9);
    },
  },
  destellos: {
    name: 'Destellos', animated: true,
    make: (s) => {
      const k = Math.max(3, Math.floor((s.arc()[s.n - 1] || 0) / 45));
      return { stars: Array.from({ length: k }, () => ({ f: Math.random(), ph: rnd(0, TWOPI), sp: rnd(2, 4) })) };
    },
    draw(ctx, s, t) {
      strokeP(ctx, s.path(), s.color, s.w);
      const p = s.pts, n = p.length / 2;
      for (const st of s.fx.stars) {
        const sc = Math.max(0, Math.sin(t * st.sp + st.ph));
        if (sc < 0.05) continue;
        const k = Math.floor(st.f * (n - 1)), r = (s.w * 1.2 + 8) * sc;
        const sp = starPath(p[2 * k], p[2 * k + 1], r);
        ctx.fillStyle = '#ffd21f'; ctx.fill(sp);
        ctx.lineWidth = 1; ctx.strokeStyle = '#1a1a1a'; ctx.stroke(sp);
      }
    },
  },
  goteo: {
    name: 'Goteo', animated: true,
    make: (s) => {
      const k = Math.max(3, Math.floor((s.arc()[s.n - 1] || 0) / 40));
      return { drips: Array.from({ length: k }, () => ({ f: Math.random(), ph: Math.random(), len: rnd(30, 110), sp: rnd(0.25, 0.6) })) };
    },
    draw(ctx, s, t) {
      strokeP(ctx, s.path(), s.color, s.w);
      const p = s.pts, n = p.length / 2;
      ctx.lineCap = 'round';
      for (const d of s.fx.drips) {
        const ph = (t * d.sp + d.ph) % 1, k = Math.floor(d.f * (n - 1));
        const L = d.len * (1 - Math.pow(1 - ph, 2)), al = 1 - Math.pow(ph, 4);
        const x = p[2 * k], y = p[2 * k + 1];
        ctx.globalAlpha = al; ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
        ctx.lineWidth = Math.max(1.5, s.w * 0.5);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + L); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + L, Math.max(2, s.w * 0.55 + 1), 0, TWOPI); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  },
  respirar: {
    name: 'Respirar', animated: true,
    draw(ctx, s, t) { strokeP(ctx, s.path(), s.color, Math.max(1, s.w * (1.15 + 0.6 * Math.sin(t * 2.4 + s.fx.seed)))); },
  },

  /* --- estáticos con apariencia especial (se guardan en la capa de caché) --- */
  aerosol: {
    name: 'Aerosol', animated: false,
    draw(ctx, s) {
      if (!s._extra) {
        const p = s.pts, n = p.length / 2, path = new Path2D(), sd = s.fx.seed;
        for (let k = 0; k < n; k++) {
          for (let j = 0; j < 4; j++) {
            const a = hash(sd + k * 3.7 + j * 11.1) * TWOPI, rr = Math.pow(hash(sd + k * 5.3 + j * 7.7), 0.6) * (s.w * 1.7 + 3);
            const r = 0.6 + hash(sd + k * 1.7 + j * 9.9) * 1.2, x = p[2 * k] + Math.cos(a) * rr, y = p[2 * k + 1] + Math.sin(a) * rr;
            path.moveTo(x + r, y); path.arc(x, y, r, 0, TWOPI);
          }
        }
        s._extra = path;
      }
      strokeP(ctx, s.path(), s.color, Math.max(1, s.w * 0.35), 0.55);
      ctx.fillStyle = s.color; ctx.globalAlpha = 0.7; ctx.fill(s._extra); ctx.globalAlpha = 1;
    },
  },
  eco: {
    name: 'Eco', animated: false,
    draw(ctx, s) {
      const p = s.pts, nr = s.normals(), off = s.w * 1.5 + 3;
      for (const sg of [-1, 1, 0]) {
        const q = new Array(p.length);
        for (let i = 0; i < p.length; i += 2) { q[i] = p[i] + nr[i] * off * sg; q[i + 1] = p[i + 1] + nr[i + 1] * off * sg; }
        strokeP(ctx, polyPath(q), s.color, Math.max(1, s.w * (sg === 0 ? 1 : 0.6)), sg === 0 ? 1 : 0.45);
      }
    },
  },

  /* --- permanentes: modifican la geometría del trazo una sola vez --- */
  zigzag: {
    name: 'Zigzag', permanent: true,
    apply(s) {
      const src = resample(s.pts, 3), n = src.length / 2;
      const arcA = [0];
      for (let k = 1; k < n; k++) arcA.push(arcA[k - 1] + Math.hypot(src[2 * k] - src[2 * k - 2], src[2 * k + 1] - src[2 * k - 1]));
      const total = arcA[n - 1], step = Math.max(s.w * 2.2 + 8, 14), amp = s.w * 0.9 + 6, out = [src[0], src[1]];
      let i = 1, sign = 1;
      for (let d = step; d < total - step * 0.5; d += step) {
        while (i < n - 1 && arcA[i] < d) i++;
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        let tx = src[2 * b] - src[2 * a], ty = src[2 * b + 1] - src[2 * a + 1];
        const l = Math.hypot(tx, ty) || 1;
        out.push(src[2 * i] + (-ty / l) * amp * sign, src[2 * i + 1] + (tx / l) * amp * sign);
        sign = -sign;
      }
      out.push(src[2 * n - 2], src[2 * n - 1]);
      s.pts = resample(out, 4);
    },
  },
  rizos: {
    name: 'Rizos', permanent: true,
    apply(s) {
      const src = resample(s.pts, 3), n = src.length / 2, r = s.w * 1.6 + 7, out = [];
      let acc = 0;
      for (let k = 0; k < n; k++) {
        if (k > 0) acc += Math.hypot(src[2 * k] - src[2 * k - 2], src[2 * k + 1] - src[2 * k - 1]);
        const th = acc / (r * 0.85);
        out.push(src[2 * k] + r * (Math.cos(th) - 1), src[2 * k + 1] + r * Math.sin(th));
      }
      s.pts = resample(out, 4);
    },
  },
};

/** Aplica un efecto al azar (distinto del que ya tiene) y devuelve su nombre */
function applyRandomEffect(s) {
  const keys = Object.keys(FX).filter((k) => k !== (s.fx && s.fx.type));
  const key = keys[Math.floor(Math.random() * keys.length)], f = FX[key];
  if (f.permanent) {
    f.apply(s);
  } else {
    s.fx = { type: key, seed: Math.random() * 1000, ...(f.make ? f.make(s) : {}) };
  }
  s.geometryChanged();
  return f.name;
}

/** Dibuja un trazo completo (con o sin efecto) en el contexto dado */
function drawStroke(ctx, s, t) {
  if (s.pts.length < 2) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const f = s.fx && FX[s.fx.type];
  if (f && f.draw) { f.draw(ctx, s, t); return; }
  if (f && f.pos) { strokeP(ctx, polyPath(s.points(t)), s.color, s.w); return; }
  strokeP(ctx, s.path(), s.color, s.w);
}
