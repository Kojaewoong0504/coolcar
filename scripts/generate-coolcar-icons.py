from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
ICON_DIR = PUBLIC / 'icons'
ICON_DIR.mkdir(parents=True, exist_ok=True)


def lerp(a: int, b: int, t: float) -> int:
    return int(a * (1 - t) + b * t)


def mix(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(lerp(c1[i], c2[i], t) for i in range(3))


def linear_gradient(size: int, stops: list[tuple[float, tuple[int, int, int]]]) -> Image.Image:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pix = img.load()
    for y in range(size):
        for x in range(size):
            # diagonal from top-left to bottom-right
            t = max(0.0, min(1.0, (x * 0.48 + y * 0.52) / size))
            for idx in range(len(stops) - 1):
                p1, c1 = stops[idx]
                p2, c2 = stops[idx + 1]
                if p1 <= t <= p2:
                    local = (t - p1) / max(0.0001, p2 - p1)
                    r, g, b = mix(c1, c2, local)
                    pix[x, y] = (r, g, b, 255)
                    break
            else:
                r, g, b = stops[-1][1]
                pix[x, y] = (r, g, b, 255)
    return img


def rounded_rect(draw: ImageDraw.ImageDraw, xy, radius: int, fill, outline=None, width: int = 1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def add_shadow(base: Image.Image, box, radius: int, blur: int, color: tuple[int, int, int, int]):
    shadow = Image.new('RGBA', base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    x1, y1, x2, y2 = box
    draw.rounded_rectangle((x1, y1 + int(22 * base.size[0] / 1024), x2, y2 + int(22 * base.size[0] / 1024)), radius=radius, fill=color)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(shadow)


def draw_a_icon(size: int, maskable: bool = False) -> Image.Image:
    s = size / 1024
    bg = linear_gradient(size, [
        (0.00, (79, 215, 255)),  # #4FD7FF
        (0.55, (20, 140, 255)),  # #148CFF
        (1.00, (7, 91, 255)),    # #075BFF
    ])
    draw = ImageDraw.Draw(bg)

    # Maskable icon needs extra safe-area padding so Android adaptive crops do not cut the mark.
    if maskable:
        panel = [int(254 * s), int(304 * s), int(770 * s), int(744 * s)]
        panel_radius = int(138 * s)
        slot1 = [int(340 * s), int(392 * s), int(478 * s), int(558 * s)]
        slot2 = [int(546 * s), int(392 * s), int(684 * s), int(558 * s)]
        wind1 = (int(322 * s), int(626 * s), int(405 * s), int(590 * s), int(460 * s), int(670 * s), int(530 * s), int(630 * s), int(600 * s), int(590 * s), int(648 * s), int(600 * s), int(720 * s), int(548 * s))
        indicator = [int(438 * s), int(686 * s), int(586 * s), int(714 * s)]
    else:
        panel = [int(236 * s), int(276 * s), int(788 * s), int(748 * s)]
        panel_radius = int(156 * s)
        slot1 = [int(328 * s), int(372 * s), int(480 * s), int(560 * s)]
        slot2 = [int(544 * s), int(372 * s), int(696 * s), int(560 * s)]
        wind1 = (int(304 * s), int(624 * s), int(394 * s), int(584 * s), int(452 * s), int(668 * s), int(524 * s), int(626 * s), int(594 * s), int(586 * s), int(642 * s), int(596 * s), int(720 * s), int(548 * s))
        indicator = [int(438 * s), int(690 * s), int(586 * s), int(718 * s)]

    # Main white subway-car/cabin capsule.
    add_shadow(bg, panel, panel_radius, max(8, int(34 * s)), (0, 58, 140, 62))
    panel_layer = linear_gradient(size, [(0, (255, 255, 255)), (1, (223, 248, 255))])
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(panel, radius=panel_radius, fill=255)
    bg.paste(panel_layer, (0, 0), mask)

    # Two vertical cabin slots — intentionally not a bus front.
    rounded_rect(draw, slot1, int(54 * s), fill=(19, 151, 255, 236))
    rounded_rect(draw, slot2, int(54 * s), fill=(19, 151, 255, 236))

    # Cool airflow, no snowflake.
    path = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pd = ImageDraw.Draw(path)
    pd.line(wind1, fill=(110, 242, 232, 255), width=max(12, int(54 * s)), joint='curve')
    # PIL line doesn't support cubic curves; approximate with smooth polyline from the SVG control points.
    bg.alpha_composite(path)
    # White highlight line.
    draw.line((int(336 * s), int(654 * s), int(424 * s), int(620 * s), int(468 * s), int(704 * s), int(548 * s), int(666 * s), int(610 * s), int(636 * s), int(660 * s), int(642 * s), int(704 * s), int(612 * s)), fill=(255, 255, 255, 184), width=max(5, int(18 * s)), joint='curve')

    # Quiet selected-cabin indicator.
    rounded_rect(draw, indicator, int(14 * s), fill=(11, 109, 255, 224))

    # Subtle gloss for modern app-store finish.
    draw.arc((int(250 * s), int(190 * s), int(780 * s), int(520 * s)), 205, 310, fill=(255, 255, 255, 76), width=max(5, int(22 * s)))

    return bg


def resize_icon(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


base = draw_a_icon(1024, maskable=False)
maskable = draw_a_icon(1024, maskable=True)

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

resize_icon(base, 48).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
print('generated A Cool Cabin icons:', ', '.join(str(p.relative_to(ROOT)) for p in outputs), 'public/favicon.ico')
