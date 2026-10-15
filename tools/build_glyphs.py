#!/usr/bin/env python3
"""
Lee assets/logo.svg y genera js/glyphs.js con cada letra del logo como datos
independientes (path SVG absoluto + bbox + pivote), listos para usarse con Path2D.

Uso:  python3 tools/build_glyphs.py assets/logo.svg js/glyphs.js
Requiere:  pip install svgelements

Proyecto estudiantil, sin fines de lucro. El logo pertenece a sus dueños.
"""
import json
import math
import sys

from svgelements import SVG, Path

src, out = sys.argv[1], sys.argv[2]
svg = SVG.parse(src)
paths = {el.id: abs(el) for el in svg.elements() if isinstance(el, Path)}


def fmt(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def d_of(sub):
    out_ = []
    for seg in Path(sub):
        n = seg.__class__.__name__
        if n == "Move":
            out_.append(f"M{fmt(seg.end.x)} {fmt(seg.end.y)}")
        elif n == "Line":
            out_.append(f"L{fmt(seg.end.x)} {fmt(seg.end.y)}")
        elif n == "CubicBezier":
            out_.append(
                "C" + " ".join(fmt(v) for v in (
                    seg.control1.x, seg.control1.y, seg.control2.x, seg.control2.y, seg.end.x, seg.end.y))
            )
        elif n == "QuadraticBezier":
            out_.append(f"Q{fmt(seg.control.x)} {fmt(seg.control.y)} {fmt(seg.end.x)} {fmt(seg.end.y)}")
        elif n == "Close":
            out_.append("Z")
        else:
            raise SystemExit(f"segmento no soportado: {n}")
    return "".join(out_)


def bbox_of(subs):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for s in subs:
        x0, y0, x1, y1 = Path(s).bbox()
        xs0.append(x0); ys0.append(y0); xs1.append(x1); ys1.append(y1)
    return [min(xs0), min(ys0), max(xs1), max(ys1)]


# ---------------------------------------------------------------- negro
black = list(paths["path2"].as_subpaths())

# rangos de x (centro del bbox del subpath) -> letra
RANGES = [
    ("i1", 0, 35), ("b", 35, 190), ("i2", 190, 232), ("s", 232, 345),
    ("P", 345, 545), ("a", 545, 665), ("i3", 665, 722), ("n", 722, 856), ("t", 856, 1000),
]
groups = {k: [] for k, _, _ in RANGES}
for sp in black:
    x0, y0, x1, y1 = Path(sp).bbox()
    xc = (x0 + x1) / 2
    for k, a, b in RANGES:
        if a <= xc < b:
            groups[k].append(sp)
            break
    else:
        raise SystemExit("subpath sin letra: %s" % ((x0, y0, x1, y1),))

letters = {}
for k, subs in groups.items():
    bb = bbox_of(subs)
    entry = {"bbox": [round(v, 2) for v in bb]}
    if k in ("i1", "i2", "i3"):
        dot = [s for s in subs if (Path(s).bbox()[1] + Path(s).bbox()[3]) / 2 < 100]
        stem = [s for s in subs if s not in dot]
        assert len(dot) == 1 and len(stem) == 1, k
        dx0, dy0, dx1, dy1 = Path(dot[0]).bbox()
        entry["parts"] = [{"k": "stem", "d": d_of(stem[0])}, {"k": "dot", "d": d_of(dot[0])}]
        entry["dot"] = {"cx": round((dx0 + dx1) / 2, 2), "cy": round((dy0 + dy1) / 2, 2),
                        "r": round(((dx1 - dx0) + (dy1 - dy0)) / 4, 2)}
        entry["pivot"] = [round((bb[0] + bb[2]) / 2, 2), round((bb[1] + bb[3]) / 2, 2)]
    elif k == "P":
        entry["parts"] = [{"k": "ring", "d": "".join(d_of(s) for s in subs)}]
        segs = []
        allseg = [paths[i] for i in paths if i != "path2"]
        # centro de la rueda = centro del bbox de todos los segmentos de color
        sb = bbox_of([abs(p) for p in allseg])
        wcx, wcy = (sb[0] + sb[2]) / 2, (sb[1] + sb[3]) / 2
        wr = ((sb[2] - sb[0]) + (sb[3] - sb[1])) / 4
        for p in allseg:
            x0, y0, x1, y1 = p.bbox()
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            ang = math.degrees(math.atan2(cy - wcy, cx - wcx))
            segs.append({"color": str(p.fill.hex if hasattr(p.fill, "hex") else p.fill).lower(),
                         "d": d_of(p), "ang": round(ang, 1)})
        segs.sort(key=lambda s: (s["ang"] + 90) % 360)  # en sentido horario desde las 12
        entry["segments"] = segs
        entry["wheel"] = {"cx": round(wcx, 2), "cy": round(wcy, 2), "r": round(wr, 2)}
        entry["pivot"] = [round(wcx, 2), round(wcy, 2)]
    elif k == "b":
        # el pivote es el centro del hueco del cuerpo (la "barriga" de la b)
        counter = min(subs, key=lambda s: (lambda b: (b[2] - b[0]) * (b[3] - b[1]))(Path(s).bbox()))
        cx0, cy0, cx1, cy1 = Path(counter).bbox()
        entry["parts"] = [{"k": "body", "d": "".join(d_of(s) for s in subs)}]
        entry["pivot"] = [round((cx0 + cx1) / 2, 2), round((cy0 + cy1) / 2, 2)]
    else:
        entry["parts"] = [{"k": "body", "d": "".join(d_of(s) for s in subs)}]
        entry["pivot"] = [round((bb[0] + bb[2]) / 2, 2), round((bb[1] + bb[3]) / 2, 2)]
    letters[k] = entry

allbb = bbox_of(black)
logo = {"w": round(allbb[2], 2), "h": round(allbb[3], 2), "letters": letters}

with open(out, "w", encoding="utf-8") as f:
    f.write("// GENERADO por tools/build_glyphs.py a partir de assets/logo.svg — no editar a mano.\n")
    f.write("// Proyecto estudiantil sin fines de lucro. El logo de ibisPaint pertenece a sus dueños.\n")
    f.write("const LOGO = ")
    json.dump(logo, f, separators=(",", ":"), ensure_ascii=False)
    f.write(";\n")

print("ok ->", out, "| logo", logo["w"], "x", logo["h"])
for k, v in letters.items():
    print(f"  {k:3s} bbox={v['bbox']} pivot={v['pivot']}", ("dot=%s" % v["dot"]) if "dot" in v else "",
          ("wheel=%s segs=%d" % (v["wheel"], len(v["segments"]))) if "segments" in v else "")
