# Turns Inter into the outlines the banner needs: the name (shaped, kerned)
# and a small alphabet for the notes. Run once; the banner script reads the JSON.
import sys, json, io
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb

src, out = sys.argv[1], sys.argv[2]

def instance(wght, opsz):
    f = instantiateVariableFont(TTFont(src), {"wght": wght, "opsz": opsz})
    buf = io.BytesIO(); f.save(buf)
    return f, hb.Font(hb.Face(buf.getvalue()))

def glyph(gs, name, dx=0):
    pen = SVGPathPen(gs, ntos=lambda v: str(round(v)))
    gs[name].draw(TransformPen(pen, (1, 0, 0, -1, dx, 0)))
    return pen.getCommands()

# the name
f, hbf = instance(800, 32)
gs, order, upm = f.getGlyphSet(), f.getGlyphOrder(), f["head"].unitsPerEm
track = -0.042 * upm
lines = []
for text in ("Ronit", "Dhansoia"):
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hbf, buf, {"kern": True})
    x, d, first = 0, "", None
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        if first is None:
            bp = BoundsPen(gs); gs[name].draw(bp); first = bp.bounds[0]
        d += glyph(gs, name, x + pos.x_offset)
        x += pos.x_advance + track
    lines.append({"text": text, "d": d, "width": round(x - track), "left": round(first)})
name = {"upm": upm, "cap": f["OS/2"].sCapHeight, "lines": lines}

# the notes
f, _ = instance(500, 14)
gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
chars = " ,.-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
notes = {"upm": f["head"].unitsPerEm, "cap": f["OS/2"].sCapHeight,
         "glyphs": {c: {"d": glyph(gs, cmap[ord(c)]), "adv": hmtx[cmap[ord(c)]][0]} for c in chars}}

json.dump({"font": "Inter, SIL Open Font License 1.1", "name": name, "notes": notes}, open(out, "w"), separators=(",", ":"))
print([(l["text"], l["width"], l["left"]) for l in lines], name["cap"], upm)
