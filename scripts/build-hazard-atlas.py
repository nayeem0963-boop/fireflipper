"""
Builds public/images/hazards/hazards.webp: the flying-hazard sprites cut out of five supplied paintings (each an effect on a pale studio background), one 192 px cell per (hazard, world) pair
that exists (a hazard is introduced in one world and stays in the later ones), colour-graded for the world it appears in. Run: python3 scripts/build-hazard-atlas.py <folder with 49.jpg ... 55.jpg>

The first hazard (id 'smoke', world 1 onwards) is a harmless crystal burst, cut from two supplied paintings (54.jpg a fire crystal burst, 55.jpg an ice crystal burst); it replaced the smoke cloud. Each world gets the
painting and the colour grade that blend with it (see GRADE).

Cut-out: "colour to alpha" against the background (alpha = the largest per-channel darkening, colour = what remains once the background is taken out), so fire, embers, smoke and energy keep their
soft edges; the disc and the rims of the rings get an opaque body (a flat average would make them translucent), the ring holes are cleared, and the faint floor shadow is thresholded away.
No outline is added. The (hazard, world) -> cell table must match ATLAS in src/systems/fliers/fliers.js.
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
CELL = 192
KINDS = ['smoke', 'firering', 'energyring', 'tornado', 'disc']
FILES = {'disc': 49, 'tornado': 50, 'smoke': 54, 'energyring': 52, 'firering': 53}
ICE_FILE = 55  # the second crystal painting
INTRO = {'smoke': 0, 'firering': 1, 'energyring': 2, 'tornado': 3, 'disc': 4}
# crop centre, half-size (px in the source) and, for the shaped ones, the body radius and hole radius (px)
GEO = {
    'disc': dict(c=(704, 385), half=308, body=275, hole=0),
    'tornado': dict(c=(700, 330), half=400, body=0, hole=0),
    'smoke': dict(c=(690, 385), half=470, body=0, hole=0),
    'ice': dict(c=(700, 385), half=470, body=0, hole=0),
    'energyring': dict(c=(718, 380), half=340, body=262, hole=140),
    'firering': dict(c=(704, 388), half=340, body=270, hole=140),
}
# per (kind, world index 0..4): hue shift in degrees, saturation and brightness multipliers, and for smoke an optional tint colour
GRADE = {
    # the crystal burst: the fire painting in the warm worlds, the ice painting in the cold ones, each graded to sit in its world
    'smoke': [dict(src='smoke', sat=0.95, val=0.95), dict(src='ice', sat=1.5, val=0.78), dict(src='ice', hue=12, sat=0.75, val=1.65),
              dict(src='smoke', hue=-48, sat=0.85, val=0.9), dict(src='smoke', hue=0, sat=0.9, val=1.0)],
    'firering': [None, dict(hue=0), dict(hue=0), dict(hue=170, sat=0.95), dict(hue=300, sat=0.9)],
    'energyring': [None, None, None, None, dict(hue=110, sat=1.0)],
    'tornado': [None, None, None, dict(hue=0), dict(hue=265, sat=0.9)],
    'disc': [None, None, None, None, dict(hue=0)],
}

def hsv(rgb, hue, sat, val):
    a = rgb / 255.0
    mx = a.max(2); mn = a.min(2); df = mx - mn
    m = df > 1e-6; safe = np.where(m, df, 1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.where(mx == r, ((g - b) / safe) % 6, np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4)) / 6
    h = np.where(m, h, 0)
    s = np.where(mx > 0, df / np.where(mx > 0, mx, 1), 0); v = mx
    h = (h + hue / 360.0) % 1; s = np.clip(s * sat, 0, 1); v = np.clip(v * val, 0, 1)
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    out = np.zeros_like(a)
    for k, (rr, gg, bb) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[..., 0] = np.where(sel, rr, out[..., 0]); out[..., 1] = np.where(sel, gg, out[..., 1]); out[..., 2] = np.where(sel, bb, out[..., 2])
    return out * 255.0

def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def cut(kind):
    g = GEO[kind]
    im = Image.open(os.path.join(SRC, f'{ICE_FILE if kind == "ice" else FILES[kind]}.jpg')).convert('RGB')
    bgc = np.median(np.concatenate([np.asarray(im)[:30].reshape(-1, 3), np.asarray(im)[:, :30].reshape(-1, 3), np.asarray(im)[:, -30:].reshape(-1, 3)]), axis=0).astype(float)
    cx, cy = g['c']; H = g['half']
    # crop square (padding with the background colour where the crop leaves the picture), at twice the cell size for a clean downsample
    canvas = Image.new('RGB', (2 * H, 2 * H), tuple(int(v) for v in bgc))
    canvas.paste(im, (H - cx, H - cy))
    big = canvas.resize((CELL * 2, CELL * 2), Image.LANCZOS)
    P = np.asarray(big).astype(float)
    dark = np.clip((bgc - P) / bgc, 0, 1).max(2)
    alpha = smooth(0.07, 0.22, dark)  # the faint floor shadow and the background's gradient fall away
    F = np.clip((P - (1 - dark[..., None]) * bgc) / np.maximum(dark[..., None], 0.02), 0, 255)
    yy, xx = np.mgrid[0:CELL * 2, 0:CELL * 2]
    r = np.hypot(xx - CELL, yy - CELL) / (CELL * 2 / 2 / H)  # radius in source px
    colour = F
    below = (yy - CELL) / (CELL * 2 / 2 / H) / max(g['body'], 1)  # how far below the centre, in body radii (the floor reflection lives down there)
    if kind == 'disc':
        body = smooth(g['body'] + 3, g['body'] - 6, r)  # opaque disc, soft rim just inside the painted edge
        alpha = np.maximum(alpha * (r < g['body'] * 1.12), body)
        colour = np.where(body[..., None] > 0.5, P, F)
        alpha = np.where(r > g['body'], alpha * 0, alpha)  # nothing outside the disc (floor shadow, sparks)
    elif g['body']:
        rim = smooth(g['hole'] - 4, g['hole'] + 8, r) * smooth(g['body'] + 8, g['body'] - 10, r)  # the rim, opaque; the hole stays clear
        a2 = np.maximum(alpha, rim * 0.93)
        w = np.where(a2 > 0, (a2 - alpha) / np.maximum(a2, 1e-6), 0)[..., None]  # how much of the pixel comes from the original colour
        colour = (1 - w) * F + w * P
        alpha = np.where(r < g['hole'] - 6, 0, a2)
        alpha = alpha * (1 - smooth(0.97, 1.08, below))  # cut the floor reflection under the ring
    if kind == 'tornado':
        ysrc = (yy - CELL) / (CELL * 2 / 2 / H) + g['c'][1]
        alpha = alpha * (1 - smooth(618, 650, ysrc))  # the glow on the floor under the base
    if kind == 'smoke':
        alpha = (alpha ** 0.9) * 0.82  # a little see-through: the crystals are harmless and drawn behind everything
    if kind == 'ice':
        alpha = (alpha ** 0.55) * 0.82  # the pale painting would otherwise lose its white facets against the white background
    return colour, alpha

def grade(kind, world, colour, alpha):
    spec = GRADE[kind][world]
    if spec is None:
        return colour
    return hsv(colour, spec.get('hue', 0), spec.get('sat', 1.0), spec.get('val', 1.0))

def cell_image(kind, world, base):
    colour, alpha = base
    c = grade(kind, world, colour, alpha)
    rgba = np.dstack([c, alpha * 255.0]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA').resize((CELL, CELL), Image.LANCZOS)

cells = [(k, w) for k in KINDS for w in range(5) if w >= INTRO[k]]
cols = 5; rows = (len(cells) + cols - 1) // cols
atlas = Image.new('RGBA', (CELL * cols, CELL * rows), (0, 0, 0, 0))
bases = {k: cut(k) for k in KINDS}
bases['ice'] = cut('ice')
for i, (k, w) in enumerate(cells):
    src = GRADE[k][w].get('src', k) if GRADE[k][w] else k  # the crystal burst picks its painting per world
    atlas.paste(cell_image(k, w, bases[src]), ((i % cols) * CELL, (i // cols) * CELL))
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'images', 'hazards', 'hazards.webp')
atlas.save(out, 'WEBP', quality=84, method=6)
print('cells', len(cells), 'atlas', atlas.size, 'KB', os.path.getsize(out) // 1024)
# a preview on each world's mid backdrop colour
bgs = [(176, 72, 40), (200, 225, 240), (40, 48, 90), (235, 200, 215), (110, 140, 210)]
prev = Image.new('RGB', (CELL * cols, CELL * rows), (0, 0, 0))
for i, (k, w) in enumerate(cells):
    x, y = (i % cols) * CELL, (i // cols) * CELL
    tile = Image.new('RGB', (CELL, CELL), bgs[w]); c = atlas.crop((x, y, x + CELL, y + CELL)); tile.paste(c, (0, 0), c); prev.paste(tile, (x, y))
prev.save(os.environ.get('PREVIEW', '/tmp/hazards-preview.png'))
