"""
Umoya icon generator — uses the real brand logo (umoya-logo-dark.png from brand/).
Extracts the hexagon mark, removes the white paper background,
centres it on the dark navy brand background, and writes all required sizes.

Run from project root:  python3 mobile/scripts/generate_icons.py
"""

import os
from PIL import Image, ImageDraw

# ─── Paths ─────────────────────────────────────────────────────────────────────
ROOT   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(ROOT, 'brand', 'umoya-logo-dark.png')
OUT    = os.path.join(ROOT, 'mobile', 'assets')

# ─── Brand colours ─────────────────────────────────────────────────────────────
BG_COLOR  = (8, 14, 26, 255)   # #080E1A — dark navy

# ─── Step 1: extract just the hexagon mark ────────────────────────────────────

def extract_mark(src_path: str) -> Image.Image:
    """
    Load the full logo PNG, crop to the hexagon mark (above the wordmark),
    then remove the white/paper background so only the mark remains on alpha.
    """
    img = Image.open(src_path).convert('RGBA')
    w, h = img.size   # 2032 × 1452

    # ── Crop: the hexagon sits in the top ~56% of the image, centred horizontally
    # Fine-tuned by visual inspection of the 2032×1452 source.
    # Start at y=90 to skip the very top where paper shadow bleeds in.
    mark_box = (640, 90, 1390, 830)   # (left, top, right, bottom)
    mark = img.crop(mark_box)

    # ── Remove white/light paper background ──────────────────────────────────
    # The paper texture is near-white (high R, G, B). The hexagon has teal/navy
    # tones. We mask out pixels whose brightness exceeds a threshold.
    pixels = mark.load()
    mw, mh = mark.size

    for y in range(mh):
        for x in range(mw):
            r, g, b, a = pixels[x, y]
            # "Brightness" of the pixel (simple average)
            brightness = (r + g + b) / 3
            # Paper/white background: very bright AND low saturation
            max_c = max(r, g, b)
            min_c = min(r, g, b)
            saturation = (max_c - min_c) / max_c if max_c > 0 else 0
            if brightness > 220 and saturation < 0.12:
                pixels[x, y] = (r, g, b, 0)   # fully transparent

    return mark

# ─── Step 2: compose mark onto dark navy square ───────────────────────────────

def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=255
    )
    return mask

def compose(mark: Image.Image, icon_size: int, mark_scale: float = 0.72) -> Image.Image:
    """
    Place `mark` (RGBA, white bg removed) centred on a dark navy square.
    `mark_scale` controls how much of the icon the mark fills (0-1).
    """
    canvas = Image.new('RGBA', (icon_size, icon_size), BG_COLOR)

    # Scale mark to fit
    target_dim = int(icon_size * mark_scale)
    mw, mh = mark.size
    ratio   = target_dim / max(mw, mh)
    new_w   = int(mw * ratio)
    new_h   = int(mh * ratio)
    scaled  = mark.resize((new_w, new_h), Image.LANCZOS)

    # Centre on canvas
    ox = (icon_size - new_w) // 2
    oy = (icon_size - new_h) // 2
    canvas.alpha_composite(scaled, (ox, oy))

    return canvas

def apply_rounded_corners(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    size   = img.size[0]
    radius = int(size * radius_ratio)
    mask   = rounded_rect_mask(size, radius)
    result = img.copy()
    result.putalpha(mask)
    return result

# ─── Step 3: specialised variants ─────────────────────────────────────────────

def android_background(size: int) -> Image.Image:
    """Solid dark navy square (no rounded corners — Android clips itself)."""
    return Image.new('RGBA', (size, size), BG_COLOR)

def android_foreground(mark: Image.Image, size: int) -> Image.Image:
    """Mark only on transparent — scaled to 66% so Android safe-zone looks right."""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    target = int(size * 0.66)
    mw, mh = mark.size
    ratio  = target / max(mw, mh)
    scaled = mark.resize((int(mw * ratio), int(mh * ratio)), Image.LANCZOS)
    ox = (size - scaled.width)  // 2
    oy = (size - scaled.height) // 2
    canvas.alpha_composite(scaled, (ox, oy))
    return canvas

def android_monochrome(mark: Image.Image, size: int) -> Image.Image:
    """
    Android 13 themed icon: white silhouette on transparent.
    Convert the mark to white by replacing every non-transparent pixel with white.
    """
    fg = android_foreground(mark, size)
    pixels = fg.load()
    for y in range(size):
        for x in range(size):
            r, g, b, a = pixels[x, y]
            if a > 10:
                pixels[x, y] = (255, 255, 255, a)
    return fg

def notification_icon(mark: Image.Image, size: int = 96) -> Image.Image:
    """White silhouette on transparent, small size."""
    return android_monochrome(mark, size)

def favicon(mark: Image.Image, size: int = 48) -> Image.Image:
    """
    Tiny favicon — teal circle background ensures the mark reads against any surface.
    The hexagon is dark teal and becomes invisible against navy at 48px without a boost.
    """
    canvas = Image.new('RGBA', (size, size), BG_COLOR)
    draw   = ImageDraw.Draw(canvas)
    # Teal disc as a legibility boost
    pad = max(1, size // 16)
    draw.ellipse([pad, pad, size - pad - 1, size - pad - 1], fill=(0, 160, 120, 60))
    # Composite the mark
    target = int(size * 0.78)
    mw, mh = mark.size
    ratio  = target / max(mw, mh)
    scaled = mark.resize((int(mw * ratio), int(mh * ratio)), Image.LANCZOS)
    ox = (size - scaled.width)  // 2
    oy = (size - scaled.height) // 2
    canvas.alpha_composite(scaled, (ox, oy))
    return canvas

# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUT, exist_ok=True)

    print(f'Loading source logo from {SOURCE}…')
    mark = extract_mark(SOURCE)
    print(f'  Extracted mark: {mark.size}')

    # icon.png — 1024×1024 with iOS rounded corners baked in
    print('Writing icon.png (1024×1024)…')
    apply_rounded_corners(compose(mark, 1024), radius_ratio=0.22).save(
        os.path.join(OUT, 'icon.png')
    )

    # splash-icon.png — same mark, no rounded corners (Expo adds splash background)
    print('Writing splash-icon.png (1024×1024)…')
    compose(mark, 1024, mark_scale=0.60).save(
        os.path.join(OUT, 'splash-icon.png')
    )

    # Android adaptive layers — 1024×1024 (EAS scales down)
    print('Writing android-icon-background.png…')
    android_background(1024).save(os.path.join(OUT, 'android-icon-background.png'))

    print('Writing android-icon-foreground.png…')
    android_foreground(mark, 1024).save(os.path.join(OUT, 'android-icon-foreground.png'))

    print('Writing android-icon-monochrome.png…')
    android_monochrome(mark, 1024).save(os.path.join(OUT, 'android-icon-monochrome.png'))

    # Notification icon — white silhouette
    print('Writing notification-icon.png (96×96)…')
    notification_icon(mark, 96).save(os.path.join(OUT, 'notification-icon.png'))

    # Favicon
    print('Writing favicon.png (48×48)…')
    favicon(mark, 48).save(os.path.join(OUT, 'favicon.png'))

    print(f'\nAll assets written to {os.path.abspath(OUT)}')

if __name__ == '__main__':
    main()
