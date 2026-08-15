"""Prepare aligned body and limb layers for the desktop pet."""

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PET_DIR = ROOT / "assets" / "pet"


def normalize(path: Path, size: int = 512) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise ValueError(f"No visible pixels in {path}")
    subject = image.crop(bbox)
    subject.thumbnail((size - 32, size - 32), Image.Resampling.LANCZOS)
    output = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    output.alpha_composite(subject, ((size - subject.width) // 2, (size - subject.height) // 2))
    output.save(path, optimize=True)
    return output


def extract_layer(source: Image.Image, polygon: list[tuple[int, int]], output_path: Path) -> None:
    mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    layer = source.copy()
    layer.putalpha(ImageChops.multiply(source.getchannel("A"), mask))
    clean = Image.new("RGBA", source.size, (0, 0, 0, 0))
    clean.alpha_composite(layer)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean.save(output_path, optimize=True)


def validate_layer(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    if image.size != (512, 512):
        raise ValueError(f"Layer must be 512x512: {path}")
    if image.getchannel("A").getbbox() is None:
        raise ValueError(f"Layer has no visible pixels: {path}")
    if any(image.getpixel(point)[3] for point in ((0, 0), (511, 0), (0, 511), (511, 511))):
        raise ValueError(f"Layer corners must be transparent: {path}")


def remove_magenta_fringe(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    pixels = []
    for red, green, blue, alpha in image.get_flattened_data():
        if alpha and red > 140 and blue > 55 and blue > green * 1.25:
            edge_alpha = round(alpha * max(0.0, min(1.0, (115 - blue) / 60)))
            pixels.append((red, green, min(blue, green), edge_alpha))
        else:
            pixels.append((red, green, blue, alpha))
    image.putdata(pixels)
    clean = Image.new("RGBA", image.size, (0, 0, 0, 0))
    clean.alpha_composite(image)
    clean.save(path, optimize=True)


stages = ("sprout", "lively", "mature", "radiant")
regions = {
    "arm-left": [(0, 245), (138, 245), (138, 442), (0, 442)],
    "arm-right": [(374, 245), (511, 245), (511, 442), (374, 442)],
    "leg-left": [(95, 408), (255, 408), (255, 511), (95, 511)],
    "leg-right": [(257, 408), (417, 408), (417, 511), (257, 511)],
}

for name in stages:
    source_path = PET_DIR / f"{name}.png"
    source = Image.open(source_path).convert("RGBA")
    if source.size != (512, 512):
        source = source.resize((512, 512), Image.Resampling.LANCZOS)
    stage_dir = PET_DIR / name
    body_path = stage_dir / "body.png"
    normalize(body_path)
    remove_magenta_fringe(body_path)
    for layer_name, polygon in regions.items():
        extract_layer(source, polygon, stage_dir / f"{layer_name}.png")
    for layer_name in ("body", *regions):
        validate_layer(stage_dir / f"{layer_name}.png")

icon = Image.open(PET_DIR / "sprout.png").convert("RGBA")
icon.thumbnail((240, 240), Image.Resampling.LANCZOS)
icon_canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
icon_canvas.alpha_composite(icon, ((256 - icon.width) // 2, (256 - icon.height) // 2))
icon_canvas.save(ROOT / "assets" / "icon.png", optimize=True)
