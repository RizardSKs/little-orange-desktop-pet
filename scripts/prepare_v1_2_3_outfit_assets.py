"""Normalize approved generated outfit cutouts into 512px RGBA runtime assets."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


CANVAS = 512
MARGIN = 26
ALPHA_CUTOFF = 24
OUTFIT_IDS = (
    "leaf-clip", "bow", "glasses", "top-hat",
    "headphones", "scarf", "crown", "halo",
)


def normalize(source_path: Path, output_path: Path) -> None:
    source = Image.open(source_path).convert("RGBA")
    alpha = source.getchannel("A")
    alpha = alpha.point(lambda value: 0 if value < ALPHA_CUTOFF else value)
    source.putalpha(alpha)
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"source has no visible pixels: {source_path}")
    subject = source.crop(bounds)
    subject.thumbnail((CANVAS - MARGIN * 2, CANVAS - MARGIN * 2), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((CANVAS - subject.width) // 2, (CANVAS - subject.height) // 2))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("assets/outfits"))
    for outfit_id in OUTFIT_IDS:
        parser.add_argument(f"--{outfit_id}", type=Path, required=True)
    args = parser.parse_args()
    for outfit_id in OUTFIT_IDS:
        normalize(getattr(args, outfit_id.replace("-", "_")), args.output / f"{outfit_id}.png")


if __name__ == "__main__":
    main()
