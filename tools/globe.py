# Draws the banner's artwork once: the Earth at sunrise as a halftone of round
# dots, looking down on the Gulf. Writes art.json, which build.mjs places.
# The coastlines are Natural Earth's (public domain), as a small land/sea map.
import sys, json, math, random
from PIL import Image

land_png, out = sys.argv[1], sys.argv[2]
im = Image.open(land_png).convert("L"); MW, MH = im.size; px = im.load()

W, H = 960, 464
CX, CY, R = 738.0, 262.0, 236.0
LON0, LAT0 = math.radians(52.0), math.radians(19.0)
DUBAI = (55.27, 25.20)
PITCH = 6.0
L = (0.58, 0.60, 0.34); n_ = math.sqrt(sum(v * v for v in L)); L = tuple(v / n_ for v in L)
FADE_FROM, FADE_TO = 296.0, 344.0   # the globe sinks into the dark above the year's lines

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def is_land(lon, lat):
    u = int(((lon / (2 * math.pi) + 0.5) % 1.0) * MW) % MW
    v = min(MH - 1, max(0, int((0.5 - lat / math.pi) * MH)))
    return px[u, v] > 127

def project(lon_deg, lat_deg):
    lon, lat = math.radians(lon_deg), math.radians(lat_deg); dl = lon - LON0
    x = math.cos(lat) * math.sin(dl)
    y = math.cos(LAT0) * math.sin(lat) - math.sin(LAT0) * math.cos(lat) * math.cos(dl)
    return CX + x * R, CY - y * R

dubai = project(*DUBAI)
LABEL = (dubai[0] + 9, dubai[1] - 12, dubai[0] + 66, dubai[1] + 11)  # kept clear for the word

THEMES = {
  "dark":  {"night": "#2a2a2e", "land": ["#8e8e93", "#d2d2d7", "#ffffff"], "sea": ["#0b1c86", "#1f45ff"], "rim_land": "#dfe4ff", "rim_sea": "#8194ff"},
  "light": {"night": "#c7c7cc", "land": ["#636366", "#1d1d1f", "#000000"], "sea": ["#b7c2ff", "#1f45ff"], "rim_land": "#061a8a", "rim_sea": "#3d5dff"},
}
buckets = {t: {} for t in THEMES}

row, y = 0, PITCH / 2
while y < H:
    x = PITCH / 2 + (PITCH / 2 if row % 2 else 0)
    while x < W:
        nx, ny = (x - CX) / R, -(y - CY) / R; rr = nx * nx + ny * ny
        inside_label = LABEL[0] < x < LABEL[2] and LABEL[1] < y < LABEL[3]
        if rr < 0.992 and not inside_label:
            nz = math.sqrt(1 - rr)
            lat = math.asin(max(-1, min(1, ny * math.cos(LAT0) + nz * math.sin(LAT0))))
            lon = LON0 + math.atan2(nx, nz * math.cos(LAT0) - ny * math.sin(LAT0))
            lit = smooth(-0.04, 0.80, nx * L[0] + ny * L[1] + nz * L[2])
            keep = 1 - smooth(FADE_FROM, FADE_TO, y)
            rim = lit > 0.3 and nz < 0.33
            land = is_land(lon, lat)
            for t, c in THEMES.items():
                if land:
                    if lit < 0.03: colour, r = c["night"], 0.8
                    else:
                        r = 0.85 + 1.4 * lit
                        colour = c["rim_land"] if rim else c["land"][0 if lit < 0.3 else 1 if lit < 0.62 else 2]
                else:
                    if lit < 0.08: continue
                    r = 0.45 + 0.95 * lit
                    colour = c["rim_sea"] if rim else c["sea"][0 if lit < 0.45 else 1]
                r *= keep
                if r < 0.3: continue
                key = (colour, round(r * 2 * 4) / 4)   # stroke width, to a quarter
                buckets[t].setdefault(key, []).append(f"M{x:.1f} {y:.1f}h0")
        x += PITCH
    y += PITCH * 0.866; row += 1

random.seed(7); stars = []
while len(stars) < 64:
    x, y = random.uniform(8, W - 8), random.uniform(8, 300)
    if math.hypot(x - CX, y - CY) > R + 14: stars.append((round(x, 1), round(y, 1), random.choice([0.9, 0.9, 1.2, 1.6])))

art = {"W": W, "H": H, "cx": CX, "cy": CY, "r": R, "dubai": [round(dubai[0], 1), round(dubai[1], 1)],
       "sun": [round(CX + R * L[0] / math.hypot(L[0], L[1]), 1), round(CY - R * L[1] / math.hypot(L[0], L[1]), 1)],
       "stars": stars,
       "dots": {t: [[k[0], k[1], "".join(v)] for k, v in sorted(b.items())] for t, b in buckets.items()}}
json.dump(art, open(out, "w"), separators=(",", ":"))
print({t: sum(len(v) for v in b.values()) for t, b in buckets.items()}, art["dubai"], art["sun"])
