/* ------------------------------------------------------------------
   letters.js — cada letra del logo como objeto arrastrable
   (posición, rotación, escala, volteo) + animaciones ("tweens").
   Proyecto estudiantil sin fines de lucro · no afiliado a ibisPaint.
   ------------------------------------------------------------------ */

class Letter {
  constructor(id) {
    const def = LOGO.letters[id];
    this.id = id;
    this.def = def;
    this.pivot = def.pivot;
    this.bbox = def.bbox;
    this.parts = def.parts.map((p) => ({ k: p.k, path: new Path2D(p.d) }));
    this.segs = def.segments ? def.segments.map((s) => ({ color: s.color, path: new Path2D(s.d) })) : null;
    this.x = 0; this.y = 0; this.rot = 0; this.scl = 1; this.flip = 1;
    this.lift = 0;            // 0..1: "levantada" mientras la arrastras (sombra)
    this.dotColor = null;     // color del puntico (la i-pincel)
    this.eyeY = 1;            // parpadeo del ojo (la i-cabeza del pájaro)
    this.markColor = null;    // segmento de la P que se resalta
    this.glow = 0;            // 0..1: brillo de invitación (ver ATTN en sketch.js)
    this.glowColor = null;
    this.tween = null;
  }

  /* ---- coordenadas ---- */
  toLocal(wx, wy) {
    const dx = wx - this.x, dy = wy - this.y, c = Math.cos(-this.rot), s = Math.sin(-this.rot);
    const rx = dx * c - dy * s, ry = dx * s + dy * c;
    return [rx / (this.scl * this.flip) + this.pivot[0], ry / this.scl + this.pivot[1]];
  }
  toWorld(lx, ly) {
    const ax = (lx - this.pivot[0]) * this.scl * this.flip, ay = (ly - this.pivot[1]) * this.scl;
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [this.x + ax * c - ay * s, this.y + ax * s + ay * c];
  }
  /** caja envolvente en coordenadas del mundo [x0,y0,x1,y1] */
  worldBBox() {
    const b = this.bbox, pts = [this.toWorld(b[0], b[1]), this.toWorld(b[2], b[1]), this.toWorld(b[2], b[3]), this.toWorld(b[0], b[3])];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  /** centro del puntico (la punta del pincel en la i) en el mundo */
  tip() { const d = this.def.dot; return this.toWorld(d.cx, d.cy); }

  /** ¿el punto del mundo toca la letra? `tol` agranda un poco la zona de agarre (px) */
  hit(wx, wy, tol = 0) {
    const [lx, ly] = this.toLocal(wx, wy), c = hitCtx;
    const w = this.def.wheel;
    if (w && Math.hypot(lx - w.cx, ly - w.cy) < w.r) return true;
    if (this.segs) for (const s of this.segs) if (c.isPointInPath(s.path, lx, ly)) return true;
    for (const p of this.parts) {
      if (c.isPointInPath(p.path, lx, ly)) return true;
      if (tol > 0) { c.lineWidth = (2 * tol) / Math.abs(this.scl); if (c.isPointInStroke(p.path, lx, ly)) return true; }
    }
    return false;
  }

  /* ---- animación ---- */
  startTween(to, dur, delay, ease, onDone) {
    this.tween = { from: { x: this.x, y: this.y, rot: this.rot, scl: this.scl, flip: this.flip }, to, t0: NOW + (delay || 0), dur, ease: ease || easeInOutCubic, onDone };
  }
  updateTween(now) {
    const T = this.tween;
    if (!T) return false;
    const u = (now - T.t0) / T.dur;
    if (u < 0) return true;
    const f = T.from, t = T.to;
    if (u >= 1) {
      this.x = t.x; this.y = t.y; this.rot = t.rot; this.scl = t.scl; this.flip = t.flip;
      this.tween = null;
      if (T.onDone) T.onDone();
      return false;
    }
    const e = T.ease(u);
    this.x = mix(f.x, t.x, e); this.y = mix(f.y, t.y, e);
    this.rot = f.rot + angDiff(f.rot, t.rot) * e;
    this.scl = mix(f.scl, t.scl, e); this.flip = mix(f.flip, t.flip, e);
    return true;
  }

  /* ---- dibujo ---- */
  draw(ctx, dpr) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.scale(this.scl * this.flip, this.scl);
    ctx.translate(-this.pivot[0], -this.pivot[1]);
    if (this.lift > 0.02) {
      ctx.shadowColor = `rgba(0,0,0,${0.28 * this.lift})`;
      ctx.shadowBlur = 16 * this.lift * dpr;
      ctx.shadowOffsetY = 7 * this.lift * dpr;
    }
    const inv = 1 / Math.abs(this.scl);
    if (this.glow > 0.01 && this.glowColor && this.lift < 0.05) {
      // aura de color detrás de la letra (la silueta de color queda tapada por la letra negra)
      ctx.save();
      ctx.fillStyle = this.glowColor; ctx.shadowColor = this.glowColor;
      for (const [blur, alpha] of [[64, 0.75], [26, 1]]) {
        ctx.shadowBlur = blur * this.glow * dpr; ctx.globalAlpha = alpha * Math.min(1, this.glow * 1.2);
        for (const p of this.parts) ctx.fill(p.path);
      }
      ctx.restore();
    }
    if (this.segs) {
      for (const s of this.segs) {
        ctx.fillStyle = s.color; ctx.fill(s.path);
        ctx.lineWidth = 1.4 * inv; ctx.strokeStyle = s.color; ctx.stroke(s.path); // tapa las costuras
      }
      ctx.shadowColor = 'transparent';
    }
    for (const p of this.parts) {
      if (p.k === 'dot') {
        const d = this.def.dot, colored = this.dotColor && this.dotColor !== '#000000';
        ctx.save();
        if (this.eyeY < 0.999) { ctx.translate(d.cx, d.cy); ctx.scale(1, Math.max(0.06, this.eyeY)); ctx.translate(-d.cx, -d.cy); }
        ctx.fillStyle = colored ? this.dotColor : '#000'; ctx.fill(p.path);
        if (colored) { ctx.shadowColor = 'transparent'; ctx.lineWidth = 4.5 * inv; ctx.strokeStyle = '#000'; ctx.stroke(p.path); }
        ctx.restore();
      } else {
        ctx.fillStyle = '#000'; ctx.fill(p.path);
      }
    }
    ctx.shadowColor = 'transparent';
    if (this.segs && this.markColor) {
      for (const s of this.segs) {
        if (s.color !== this.markColor) continue;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 7 * inv; ctx.strokeStyle = '#000'; ctx.stroke(s.path);
        ctx.lineWidth = 2.6 * inv; ctx.strokeStyle = '#fff'; ctx.stroke(s.path);
      }
    }
    ctx.restore();
  }
}
