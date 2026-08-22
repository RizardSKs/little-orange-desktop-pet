"""Normalize approved v1.2 ImageGen masters into the stable layered sprite contract."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


CANVAS = 512
MARGIN = 16
GROUNDLINE = CANVAS - MARGIN
STAGES = ("sprout", "lively", "mature", "radiant")
BODY_BOXES = {
    "sprout": (105, 86, 407, 414),
    "lively": (100, 16, 412, 430),
    "mature": (45, 16, 467, 438),
    "radiant": (42, 16, 470, 445),
}
LIMB_POLYGONS = {
    "sprout": {
        "arm-left": [(8, 302), (135, 290), (168, 420), (15, 448)],
        "arm-right": [(377, 290), (504, 302), (497, 448), (344, 420)],
        "leg-left": [(112, 405), (256, 405), (256, 511), (92, 511)],
        "leg-right": [(256, 405), (400, 405), (420, 511), (256, 511)],
    },
    "lively": {
        "arm-left": [(4, 286), (158, 268), (215, 372), (32, 447)],
        "arm-right": [(354, 268), (508, 286), (480, 447), (297, 372)],
        "leg-left": [(118, 385), (257, 388), (257, 511), (86, 511)],
        "leg-right": [(255, 388), (394, 385), (426, 511), (255, 511)],
    },
    "mature": {
        "arm-left": [(0, 295), (130, 278), (168, 426), (0, 452)],
        "arm-right": [(382, 278), (511, 295), (511, 452), (344, 426)],
        "leg-left": [(110, 405), (256, 405), (256, 511), (78, 511)],
        "leg-right": [(256, 405), (402, 405), (434, 511), (256, 511)],
    },
    "radiant": {
        "arm-left": [(0, 286), (136, 274), (171, 432), (0, 456)],
        "arm-right": [(376, 274), (511, 286), (511, 456), (341, 432)],
        "leg-left": [(108, 400), (256, 400), (256, 511), (76, 511)],
        "leg-right": [(256, 400), (404, 400), (436, 511), (256, 511)],
    },
}


def transparent_source(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    corners = [image.getpixel(point) for point in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))]
    if all(alpha == 255 and max(red, green, blue) <= 12 for red, green, blue, alpha in corners):
        pixels = []
        for red, green, blue, alpha in image.get_flattened_data():
            luminance = max(red, green, blue)
            keyed_alpha = 0 if luminance <= 8 else min(alpha, round((luminance - 8) * 255 / 28)) if luminance < 36 else alpha
            pixels.append((red, green, blue, keyed_alpha))
        image.putdata(pixels)
    return image


def crop_visible(image: Image.Image) -> Image.Image:
    box = image.getchannel("A").getbbox()
    if box is None:
        raise ValueError("generated image has no visible pixels")
    return image.crop(box)


def normalize_master(path: Path) -> Image.Image:
    subject = crop_visible(transparent_source(path))
    subject.thumbnail((CANVAS - MARGIN * 2, CANVAS - MARGIN * 2), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((CANVAS - subject.width) // 2, CANVAS - MARGIN - subject.height))
    return canvas


def normalize_body(path: Path, stage: str) -> Image.Image:
    subject = crop_visible(transparent_source(path))
    left, top, right, bottom = BODY_BOXES[stage]
    subject.thumbnail((right - left, bottom - top), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    x = left + ((right - left) - subject.width) // 2
    canvas.alpha_composite(subject, (x, top))
    return canvas


def align_to_ground(image: Image.Image, offset: int) -> Image.Image:
    aligned = Image.new("RGBA", image.size, (0, 0, 0, 0))
    aligned.alpha_composite(image, (0, offset))
    return aligned


def extract_layer(master: Image.Image, polygon: list[tuple[int, int]]) -> Image.Image:
    mask = Image.new("L", master.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    layer = master.copy()
    layer.putalpha(ImageChops.multiply(master.getchannel("A"), mask))
    clean = Image.new("RGBA", master.size, (0, 0, 0, 0))
    clean.alpha_composite(layer)
    return clean


def validate(path: Path) -> None:
    image = Image.open(path).convert("RGBA")
    if image.size != (CANVAS, CANVAS) or image.getchannel("A").getbbox() is None:
        raise ValueError(f"invalid layer: {path}")
    if any(image.getpixel(point)[3] for point in ((0, 0), (CANVAS - 1, 0), (0, CANVAS - 1), (CANVAS - 1, CANVAS - 1))):
        raise ValueError(f"layer corners must be transparent: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    preview_dir = args.output / "previews"
    preview_dir.mkdir(parents=True, exist_ok=True)

    for stage in STAGES:
        master = normalize_master(args.source / f"{stage}-master.png")
        body = normalize_body(args.source / f"{stage}-body.png", stage)
        stage_dir = args.output / stage
        stage_dir.mkdir(parents=True, exist_ok=True)
        layer_names = ("leg-left", "leg-right", "arm-left", "arm-right")
        layers = {name: extract_layer(master, LIMB_POLYGONS[stage][name]) for name in layer_names}
        unaligned = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        for layer_name in layer_names:
            unaligned.alpha_composite(layers[layer_name])
        unaligned.alpha_composite(body)
        unaligned_box = unaligned.getchannel("A").getbbox()
        if unaligned_box is None:
            raise ValueError(f"generated {stage} sprite has no visible pixels")
        ground_offset = GROUNDLINE - unaligned_box[3]
        body = align_to_ground(body, ground_offset)
        layers = {name: align_to_ground(layer, ground_offset) for name, layer in layers.items()}

        body.save(stage_dir / "body.png", optimize=True)
        preview = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        for layer_name in layer_names:
            layers[layer_name].save(stage_dir / f"{layer_name}.png", optimize=True)
            preview.alpha_composite(layers[layer_name])
        preview.alpha_composite(body)
        preview.save(preview_dir / f"{stage}.png", optimize=True)
        preview.save(args.output / f"{stage}.png", optimize=True)
        if preview.getchannel("A").getbbox()[3] != GROUNDLINE:
            raise ValueError(f"{stage} feet do not share the {GROUNDLINE}px groundline")
        for path in [args.output / f"{stage}.png", *(stage_dir / f"{name}.png" for name in ("body", "arm-left", "arm-right", "leg-left", "leg-right"))]:
            validate(path)

    comparison = Image.new("RGBA", (220 * len(STAGES), 220), (0, 0, 0, 0))
    for index, stage in enumerate(STAGES):
        preview = Image.open(preview_dir / f"{stage}.png").convert("RGBA").resize((220, 220), Image.Resampling.LANCZOS)
        comparison.alpha_composite(preview, (index * 220, 0))
    comparison.save(preview_dir / "stage-comparison-220.png", optimize=True)


if __name__ == "__main__":
    main()
