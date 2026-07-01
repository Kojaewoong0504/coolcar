from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
ICON_DIR = PUBLIC / 'icons'
ICON_DIR.mkdir(parents=True, exist_ok=True)

NAVY = (7, 17, 31, 255)
BLUE = (16, 170, 236, 255)
CYAN = (97, 232, 249, 255)
MINT = (34, 197, 94, 255)
WHITE = (255, 255, 255, 255)
ICE = (225, 252, 255, 255)


def rounded_rect(draw: ImageDraw.ImageDraw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def gradient(size: int) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pix = img.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.36 + y * 0.64) / size
            # bright cool app gradient, but not public-institution flat blue
            r = int(236 * (1 - t) + 15 * t)
            g = int(253 * (1 - t) + 168 * t)
            b = int(255 * (1 - t) + 232 * t)
            pix[x, y] = (r, g, b, 255)
    return img


def draw_symbol(size: int, maskable: bool = False) -> Image.Image:
    scale = size / 1024
    img = gradient(size)
    draw = ImageDraw.Draw(img)

    # Soft inner card glow: keeps app-icon feel without looking like a bus/agency pictogram.
    pad = int((130 if maskable else 82) * scale)
    card = [pad, pad, size - pad, size - pad]
    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(card, radius=int(210 * scale), fill=(0, 132, 180, 42))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(26 * scale)))
    img.alpha_composite(shadow)
    rounded_rect(draw, card, int(210 * scale), fill=(248, 254, 255, 238), outline=(255, 255, 255, 210), width=max(2, int(6 * scale)))

    # Metro-line track: communicates subway/navigation without a literal bus front.
    track_y = int(715 * scale)
    track_x1 = int(255 * scale)
    track_x2 = int(768 * scale)
    draw.line((track_x1, track_y, track_x2, track_y), fill=(14, 165, 233, 255), width=max(8, int(28 * scale)))
    for x in (track_x1, track_x2):
        draw.ellipse((x - int(22 * scale), track_y - int(22 * scale), x + int(22 * scale), track_y + int(22 * scale)), fill=(14, 165, 233, 255))
        draw.ellipse((x - int(9 * scale), track_y - int(9 * scale), x + int(9 * scale), track_y + int(9 * scale)), fill=WHITE)

    # Chosen cool car capsule: side/top abstraction, no wheels/headlights.
    car = [int(220 * scale), int(340 * scale), int(804 * scale), int(590 * scale)]
    car_shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cs = ImageDraw.Draw(car_shadow)
    cs.rounded_rectangle((car[0], car[1] + int(18 * scale), car[2], car[3] + int(18 * scale)), radius=int(94 * scale), fill=(7, 17, 31, 55))
    car_shadow = car_shadow.filter(ImageFilter.GaussianBlur(int(18 * scale)))
    img.alpha_composite(car_shadow)
    rounded_rect(draw, car, int(92 * scale), fill=NAVY)

    inner = [int(272 * scale), int(392 * scale), int(752 * scale), int(512 * scale)]
    rounded_rect(draw, inner, int(48 * scale), fill=(220, 252, 255, 255))

    # Door/window rhythm, deliberately vertical like a side-view train car.
    for x in (int(420 * scale), int(512 * scale), int(604 * scale)):
        draw.rounded_rectangle((x - int(7 * scale), inner[1] + int(18 * scale), x + int(7 * scale), inner[3] - int(18 * scale)), radius=int(6 * scale), fill=BLUE)
    draw.rounded_rectangle((int(660 * scale), inner[1] + int(18 * scale), int(674 * scale), inner[3] - int(18 * scale)), radius=int(6 * scale), fill=CYAN)

    # Cool airflow line inside the selected car.
    air_y = int(550 * scale)
    draw.line((int(300 * scale), air_y, int(724 * scale), air_y), fill=(34, 211, 238, 255), width=max(8, int(34 * scale)))
    draw.ellipse((int(283 * scale), air_y - int(17 * scale), int(317 * scale), air_y + int(17 * scale)), fill=(34, 211, 238, 255))
    draw.ellipse((int(707 * scale), air_y - int(17 * scale), int(741 * scale), air_y + int(17 * scale)), fill=(34, 211, 238, 255))

    # Recommendation marker: one cool point, not a snowflake.
    marker_c = (int(690 * scale), int(290 * scale))
    draw.ellipse((marker_c[0] - int(58 * scale), marker_c[1] - int(58 * scale), marker_c[0] + int(58 * scale), marker_c[1] + int(58 * scale)), fill=(34, 197, 94, 255), outline=WHITE, width=max(3, int(10 * scale)))
    draw.ellipse((marker_c[0] - int(22 * scale), marker_c[1] - int(22 * scale), marker_c[0] + int(22 * scale), marker_c[1] + int(22 * scale)), fill=WHITE)

    return img


def resize_icon(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


base = draw_symbol(1024, maskable=False)
maskable = draw_symbol(1024, maskable=True)

outputs = {
    ICON_DIR / 'icon-512.png': resize_icon(base, 512),
    ICON_DIR / 'icon-192.png': resize_icon(base, 192),
    ICON_DIR / 'maskable-icon-512.png': resize_icon(maskable, 512),
    ICON_DIR / 'maskable-icon-192.png': resize_icon(maskable, 192),
    PUBLIC / 'apple-touch-icon.png': resize_icon(base, 180),
    PUBLIC / 'favicon-32x32.png': resize_icon(base, 32),
    PUBLIC / 'favicon-16x16.png': resize_icon(base, 16),
}
for path, image in outputs.items():
    image.save(path)

# Multi-size favicon.ico for browsers that prefer ICO.
resize_icon(base, 32).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('generated coolcar icons:', ', '.join(str(p.relative_to(ROOT)) for p in outputs), 'public/favicon.ico')
