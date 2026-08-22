"""Build the approved v1.2.2 character rig and raster expression layers.

The source directory must contain sprout-master.png, lively-master.png,
mature-master.png, and radiant-master.png. Generated runtime assets follow the
stable 512x512 RGBA contract under assets/pet.
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


CANVAS = 512
MARGIN = 16
STAGES = ("sprout", "lively", "mature", "radiant")
EXPRESSIONS = (
    "neutral", "happy", "curious", "surprised", "proud", "focused", "delighted",
    "excited", "refreshed", "asleep", "sad", "sleepy", "hungry", "uncomfortable",
)


@dataclass(frozen=True)
class StageSpec:
    torso: tuple[int, int, int, int]
    limb_cut_y: int
    face_patch: tuple[int, int, int, int]
    eye_left: tuple[int, int]
    eye_right: tuple[int, int]
    eye_radius: tuple[int, int]
    mouth: tuple[int, int]
    iris: tuple[int, int, int]
    cheek: tuple[int, int, int]
    limb_polygons: dict[str, list[tuple[int, int]]]


SPECS = {
    "sprout": StageSpec(
        torso=(98, 151, 414, 439), limb_cut_y=298, face_patch=(131, 230, 382, 392),
        eye_left=(202, 302), eye_right=(322, 302), eye_radius=(29, 37), mouth=(262, 355),
        iris=(111, 49, 18), cheek=(255, 103, 70),
        limb_polygons={
            "arm-left": [(57, 296), (132, 292), (140, 405), (52, 407)],
            "arm-right": [(380, 292), (455, 296), (460, 407), (372, 405)],
            "leg-left": [(116, 394), (256, 397), (256, 503), (92, 503)],
            "leg-right": [(256, 397), (396, 394), (420, 503), (256, 503)],
        },
    ),
    "lively": StageSpec(
        torso=(129, 177, 383, 442), limb_cut_y=302, face_patch=(163, 239, 351, 381),
        eye_left=(221, 296), eye_right=(318, 296), eye_radius=(22, 29), mouth=(270, 340),
        iris=(105, 47, 15), cheek=(255, 105, 68),
        limb_polygons={
            "arm-left": [(86, 301), (148, 294), (157, 406), (76, 414)],
            "arm-right": [(364, 294), (426, 301), (436, 414), (355, 406)],
            "leg-left": [(140, 401), (257, 399), (257, 504), (118, 504)],
            "leg-right": [(255, 399), (372, 401), (394, 504), (255, 504)],
        },
    ),
    "mature": StageSpec(
        torso=(104, 215, 408, 459), limb_cut_y=301, face_patch=(170, 253, 367, 408),
        eye_left=(228, 326), eye_right=(334, 326), eye_radius=(18, 24), mouth=(281, 367),
        iris=(103, 49, 20), cheek=(247, 102, 66),
        limb_polygons={
            "arm-left": [(63, 293), (127, 289), (137, 416), (53, 423)],
            "arm-right": [(385, 289), (449, 293), (459, 423), (375, 416)],
            "leg-left": [(116, 414), (256, 411), (256, 505), (93, 505)],
            "leg-right": [(256, 411), (396, 414), (419, 505), (256, 505)],
        },
    ),
    "radiant": StageSpec(
        torso=(113, 232, 400, 451), limb_cut_y=312, face_patch=(166, 268, 374, 414),
        eye_left=(221, 340), eye_right=(334, 340), eye_radius=(18, 24), mouth=(278, 377),
        iris=(181, 104, 18), cheek=(246, 128, 105),
        limb_polygons={
            "arm-left": [(62, 309), (132, 301), (142, 424), (52, 432)],
            "arm-right": [(380, 301), (450, 309), (460, 432), (370, 424)],
            "leg-left": [(125, 410), (256, 409), (256, 504), (99, 504)],
            "leg-right": [(256, 409), (387, 410), (413, 504), (256, 504)],
        },
    ),
}


def crop_visible(image: Image.Image) -> Image.Image:
    box = image.getchannel("A").getbbox()
    if box is None:
        raise ValueError("source image has no visible pixels")
    return image.crop(box)


def normalize_master(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    if image.getchannel("A").getextrema() == (255, 255):
        raise ValueError(f"source must contain real transparency: {path}")
    subject = crop_visible(image)
    subject.thumbnail((CANVAS - MARGIN * 2, CANVAS - MARGIN * 2), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(subject, ((CANVAS - subject.width) // 2, CANVAS - MARGIN - subject.height))
    return canvas


def ellipse_mask(box: tuple[int, int, int, int], blur: int = 0) -> Image.Image:
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    return mask.filter(ImageFilter.GaussianBlur(blur)) if blur else mask


def polygon_mask(points: list[tuple[int, int]]) -> Image.Image:
    mask = Image.new("L", (CANVAS, CANVAS), 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    return mask


def clear_transparent_rgb(image: Image.Image) -> Image.Image:
    clean = Image.new("RGBA", image.size, (0, 0, 0, 0))
    clean.alpha_composite(image)
    return clean


def clean_face_surface(body: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    """Replace facial pixels with a fitted orange-surface color field."""
    left, top, right, bottom = box
    source = body.copy()
    source_data = np.asarray(source).copy()
    yy, xx = np.mgrid[0:CANVAS, 0:CANVAS]
    expanded = (xx >= left - 48) & (xx <= right + 48) & (yy >= top - 38) & (yy <= bottom + 38)
    inner = (xx >= left - 5) & (xx <= right + 5) & (yy >= top - 5) & (yy <= bottom + 5)
    red, green, blue, alpha = np.moveaxis(source_data, -1, 0)
    orange = (alpha > 220) & (red > 150) & (red > green + 24) & (green > blue + 18)
    samples = expanded & ~inner & orange
    sample_x = (xx[samples] - 256) / 256
    sample_y = (yy[samples] - 320) / 256
    design = np.column_stack((
        np.ones(sample_x.size), sample_x, sample_y, sample_x * sample_x,
        sample_x * sample_y, sample_y * sample_y, sample_x ** 3, sample_y ** 3,
    ))
    if sample_x.size < 100:
        raise ValueError("not enough clean orange pixels to reconstruct the face surface")
    target_x = (xx[expanded] - 256) / 256
    target_y = (yy[expanded] - 320) / 256
    target_design = np.column_stack((
        np.ones(target_x.size), target_x, target_y, target_x * target_x,
        target_x * target_y, target_y * target_y, target_x ** 3, target_y ** 3,
    ))
    fill_data = source_data.copy()
    for channel in range(3):
        coefficients, *_ = np.linalg.lstsq(design, source_data[..., channel][samples], rcond=None)
        predicted = np.clip(target_design @ coefficients, 0, 255).astype(np.uint8)
        fill_data[..., channel][expanded] = predicted
    fill = Image.fromarray(fill_data, "RGBA").filter(ImageFilter.GaussianBlur(.55))
    patch_mask = Image.new("L", source.size, 0)
    ImageDraw.Draw(patch_mask).rounded_rectangle(box, radius=52, fill=255)
    patch_mask = ImageChops.multiply(patch_mask.filter(ImageFilter.GaussianBlur(18)), source.getchannel("A"))
    return Image.composite(fill, source, patch_mask)


def build_rig(master: Image.Image, spec: StageSpec) -> tuple[Image.Image, dict[str, Image.Image]]:
    source_alpha = master.getchannel("A")
    torso = ellipse_mask(spec.torso, blur=1)
    upper = Image.new("L", master.size, 0)
    ImageDraw.Draw(upper).rectangle((0, 0, CANVAS, spec.limb_cut_y), fill=255)
    body_alpha = ImageChops.multiply(source_alpha, ImageChops.lighter(upper, torso))
    body = master.copy()
    body.putalpha(body_alpha)
    body = clear_transparent_rgb(clean_face_surface(body, spec.face_patch))

    inner_box = (spec.torso[0] + 7, spec.torso[1] + 7, spec.torso[2] - 7, spec.torso[3] - 7)
    outside_inner = ImageChops.invert(ellipse_mask(inner_box, blur=2))
    layers: dict[str, Image.Image] = {}
    for name, points in spec.limb_polygons.items():
        mask = ImageChops.multiply(source_alpha, ImageChops.multiply(polygon_mask(points), outside_inner))
        layer = master.copy()
        layer.putalpha(mask)
        layers[name] = clear_transparent_rgb(layer)
    return body, layers


def scaled_draw() -> tuple[Image.Image, ImageDraw.ImageDraw, int]:
    scale = 3
    image = Image.new("RGBA", (CANVAS * scale, CANVAS * scale), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image), scale


def pts(points: list[tuple[float, float]], scale: int) -> list[tuple[int, int]]:
    return [(round(x * scale), round(y * scale)) for x, y in points]


def arc(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], start: int, end: int, fill: tuple[int, ...], width: int, scale: int) -> None:
    draw.arc(tuple(round(value * scale) for value in box), start, end, fill=fill, width=width * scale)


def ellipse(draw: ImageDraw.ImageDraw, box: tuple[float, float, float, float], fill: tuple[int, ...], scale: int, outline: tuple[int, ...] | None = None, width: int = 1) -> None:
    draw.ellipse(tuple(round(value * scale) for value in box), fill=fill, outline=outline, width=width * scale)


def draw_open_eye(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: tuple[int, int], iris: tuple[int, int, int], scale: int, *, pupil_dx: int = 0, pupil_dy: int = 0, openness: float = 1.0, star: bool = False, watery: bool = False) -> None:
    x, y = center
    rx, ry = radius
    visible_ry = max(5, round(ry * openness))
    shadow = (x - rx - 3, y - visible_ry - 2, x + rx + 3, y + visible_ry + 4)
    ellipse(draw, shadow, (96, 42, 20, 60), scale)
    ellipse(draw, (x - rx, y - visible_ry, x + rx, y + visible_ry), (255, 249, 239, 255), scale, (104, 48, 27, 255), 2)
    iris_r = min(rx - 4, round(visible_ry * .82))
    ix, iy = x + pupil_dx, y + pupil_dy + 2
    ellipse(draw, (ix - iris_r, iy - iris_r, ix + iris_r, iy + iris_r), (*iris, 255), scale, (76, 32, 18, 255), 2)
    ellipse(draw, (ix - iris_r * .6, iy - iris_r * .55, ix + iris_r * .6, iy + iris_r * .7), (45, 20, 13, 255), scale)
    ellipse(draw, (ix - iris_r * .25, iy - iris_r * .2, ix + iris_r * .25, iy + iris_r * .35), (20, 13, 12, 255), scale)
    if star:
        r = max(4, iris_r * .35)
        star_points = []
        for index in range(8):
            angle = -math.pi / 2 + index * math.pi / 4
            distance = r if index % 2 == 0 else r * .35
            star_points.append((ix + math.cos(angle) * distance, iy + math.sin(angle) * distance))
        draw.polygon(pts(star_points, scale), fill=(255, 239, 139, 255))
    ellipse(draw, (ix - iris_r * .55, iy - iris_r * .65, ix - iris_r * .08, iy - iris_r * .18), (255, 255, 255, 245), scale)
    ellipse(draw, (ix + iris_r * .18, iy + iris_r * .15, ix + iris_r * .42, iy + iris_r * .39), (255, 218, 166, 210), scale)
    if watery:
        ellipse(draw, (x - rx * .55, y + visible_ry * .45, x + rx * .55, y + visible_ry * .85), (145, 214, 255, 105), scale)


def draw_brow(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: tuple[int, int], scale: int, *, tilt: float = 0, raised: int = 0) -> None:
    x, y = center
    rx, ry = radius
    brow_y = y - ry - 19 - raised
    dy = math.tan(math.radians(tilt)) * 15
    draw.line(pts([(x - 14, brow_y - dy), (x, brow_y - 4), (x + 14, brow_y + dy)], scale), fill=(91, 39, 23, 255), width=5 * scale, joint="curve")


def draw_closed_eye(draw: ImageDraw.ImageDraw, center: tuple[int, int], radius: tuple[int, int], scale: int, *, happy: bool = True, tilt: int = 0) -> None:
    x, y = center
    rx, _ = radius
    if happy:
        arc(draw, (x - rx, y - 7, x + rx, y + 17), 200 + tilt, 340 + tilt, (80, 34, 22, 255), 5, scale)
    else:
        arc(draw, (x - rx, y - 6, x + rx, y + 10), 20 + tilt, 160 + tilt, (80, 34, 22, 255), 5, scale)


def draw_cheeks(draw: ImageDraw.ImageDraw, spec: StageSpec, scale: int, strength: int = 125) -> None:
    lx, ly = spec.eye_left
    rx, _ = spec.eye_right
    eye_rx, eye_ry = spec.eye_radius
    radius_x = max(14, eye_rx * .78)
    radius_y = max(7, eye_ry * .28)
    color = (*spec.cheek, strength)
    ellipse(draw, (lx - eye_rx - radius_x, ly + eye_ry * .55, lx - eye_rx + radius_x, ly + eye_ry * .55 + radius_y * 2), color, scale)
    ellipse(draw, (rx + eye_rx - radius_x, ly + eye_ry * .55, rx + eye_rx + radius_x, ly + eye_ry * .55 + radius_y * 2), color, scale)


def draw_mouth(draw: ImageDraw.ImageDraw, center: tuple[int, int], kind: str, scale: int) -> None:
    x, y = center
    dark = (91, 36, 24, 255)
    if kind == "smile":
        arc(draw, (x - 22, y - 14, x + 22, y + 16), 20, 160, dark, 5, scale)
    elif kind == "open":
        ellipse(draw, (x - 19, y - 9, x + 19, y + 22), dark, scale)
        ellipse(draw, (x - 11, y + 8, x + 11, y + 20), (241, 105, 93, 255), scale)
    elif kind == "o":
        ellipse(draw, (x - 9, y - 7, x + 9, y + 12), (92, 38, 27, 255), scale)
        ellipse(draw, (x - 5, y - 3, x + 5, y + 7), (42, 23, 20, 255), scale)
    elif kind == "frown":
        arc(draw, (x - 18, y - 2, x + 18, y + 22), 200, 340, dark, 5, scale)
    elif kind == "flat":
        arc(draw, (x - 15, y - 4, x + 15, y + 7), 200, 340, dark, 4, scale)
    elif kind == "smirk":
        arc(draw, (x - 18, y - 10, x + 20, y + 12), 10, 145, dark, 5, scale)
    elif kind == "wavy":
        draw.line(pts([(x - 18, y), (x - 9, y + 5), (x, y), (x + 9, y + 5), (x + 18, y)], scale), fill=dark, width=4 * scale, joint="curve")
    elif kind == "grimace":
        draw.rounded_rectangle(tuple(round(v * scale) for v in (x - 17, y - 5, x + 17, y + 10)), radius=5 * scale, fill=(255, 245, 225, 255), outline=dark, width=3 * scale)
        draw.line(pts([(x, y - 3), (x, y + 8)], scale), fill=dark, width=2 * scale)


def draw_sparkle(draw: ImageDraw.ImageDraw, x: int, y: int, scale: int, color: tuple[int, int, int, int]) -> None:
    draw.polygon(pts([(x, y - 12), (x + 4, y - 4), (x + 12, y), (x + 4, y + 4), (x, y + 12), (x - 4, y + 4), (x - 12, y), (x - 4, y - 4)], scale), fill=color)


def render_expression(spec: StageSpec, expression: str) -> Image.Image:
    image, draw, scale = scaled_draw()
    left, right = spec.eye_left, spec.eye_right
    radius = spec.eye_radius
    brow_left: dict[str, float | int] = {}
    brow_right: dict[str, float | int] = {}
    mouth_kind = "smile"
    cheek_strength = 105

    if expression in {"happy", "delighted", "refreshed"}:
        draw_closed_eye(draw, left, radius, scale, happy=True)
        draw_closed_eye(draw, right, radius, scale, happy=True)
        mouth_kind = "open" if expression == "delighted" else "smile"
        cheek_strength = 165
    elif expression == "asleep":
        draw_closed_eye(draw, left, radius, scale, happy=False)
        draw_closed_eye(draw, right, radius, scale, happy=False)
        mouth_kind = "o"
        cheek_strength = 55
    elif expression == "proud":
        draw_open_eye(draw, left, radius, spec.iris, scale, openness=.42, pupil_dy=3)
        draw_open_eye(draw, right, radius, spec.iris, scale, openness=.42, pupil_dy=3)
        mouth_kind = "smirk"
        brow_left = {"tilt": -10}
        brow_right = {"tilt": 10}
    elif expression == "focused":
        draw_open_eye(draw, left, radius, spec.iris, scale, openness=.72)
        draw_open_eye(draw, right, radius, spec.iris, scale, openness=.72)
        mouth_kind = "flat"
        brow_left = {"tilt": 18}
        brow_right = {"tilt": -18}
    elif expression == "sleepy":
        draw_open_eye(draw, left, radius, spec.iris, scale, openness=.34, pupil_dy=5)
        draw_open_eye(draw, right, radius, spec.iris, scale, openness=.22, pupil_dy=5)
        mouth_kind = "o"
        cheek_strength = 55
    elif expression == "sad":
        draw_open_eye(draw, left, radius, spec.iris, scale, pupil_dy=4, watery=True)
        draw_open_eye(draw, right, radius, spec.iris, scale, pupil_dy=4, watery=True)
        mouth_kind = "frown"
        brow_left = {"tilt": -17}
        brow_right = {"tilt": 17}
        cheek_strength = 55
    elif expression == "uncomfortable":
        draw_closed_eye(draw, left, radius, scale, happy=False, tilt=12)
        draw_closed_eye(draw, right, radius, scale, happy=False, tilt=-12)
        mouth_kind = "grimace"
        cheek_strength = 45
    else:
        pupil_dx = 5 if expression == "curious" else 0
        pupil_dy = -4 if expression == "curious" else 0
        star = expression == "excited"
        openness = 1.12 if expression in {"surprised", "excited"} else 1.0
        draw_open_eye(draw, left, radius, spec.iris, scale, pupil_dx=pupil_dx, pupil_dy=pupil_dy, openness=openness, star=star)
        draw_open_eye(draw, right, radius, spec.iris, scale, pupil_dx=pupil_dx, pupil_dy=pupil_dy, openness=openness, star=star)
        if expression == "curious":
            mouth_kind = "o"
            brow_left = {"tilt": -13, "raised": 7}
            brow_right = {"tilt": 10, "raised": -1}
        elif expression == "surprised":
            mouth_kind = "o"
            brow_left = {"raised": 8}
            brow_right = {"raised": 8}
        elif expression == "excited":
            mouth_kind = "open"
            cheek_strength = 185
        elif expression == "hungry":
            mouth_kind = "wavy"
            cheek_strength = 70

    if expression not in {"asleep", "uncomfortable"}:
        draw_brow(draw, left, radius, scale, **brow_left)
        draw_brow(draw, right, radius, scale, **brow_right)
    draw_cheeks(draw, spec, scale, cheek_strength)
    draw_mouth(draw, spec.mouth, mouth_kind, scale)

    if expression == "refreshed":
        draw_sparkle(draw, spec.eye_right[0] + spec.eye_radius[0] + 22, spec.eye_right[1] - 30, scale, (255, 232, 126, 255))
    elif expression == "sleepy":
        for index, radius_dot in enumerate((3, 4, 5)):
            x = spec.eye_right[0] + spec.eye_radius[0] + 13 + index * 11
            y = spec.eye_right[1] - 27 - index * 5
            ellipse(draw, (x - radius_dot, y - radius_dot, x + radius_dot, y + radius_dot), (117, 113, 164, 210), scale)
    elif expression == "hungry":
        x, y = spec.mouth
        ellipse(draw, (x + 8, y + 4, x + 19, y + 18), (241, 103, 94, 255), scale)
    elif expression == "uncomfortable":
        x = spec.eye_right[0] + spec.eye_radius[0] + 15
        y = spec.eye_right[1] - 24
        draw.polygon(pts([(x, y - 11), (x - 7, y + 3), (x, y + 10), (x + 7, y + 3)], scale), fill=(100, 192, 235, 230))

    return image.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)


def validate(path: Path) -> None:
    image = Image.open(path)
    if image.mode != "RGBA" or image.size != (CANVAS, CANVAS):
        raise ValueError(f"asset must be 512x512 RGBA: {path}")
    if image.getchannel("A").getbbox() is None:
        raise ValueError(f"asset has no visible pixels: {path}")
    if any(image.getpixel(point)[3] for point in ((0, 0), (511, 0), (0, 511), (511, 511))):
        raise ValueError(f"asset corners must remain transparent: {path}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--preview-dir", type=Path)
    args = parser.parse_args()
    preview_dir = args.preview_dir
    if preview_dir:
        preview_dir.mkdir(parents=True, exist_ok=True)

    comparison = Image.new("RGBA", (220 * len(STAGES), 220), (0, 0, 0, 0))
    expression_sheet = Image.new("RGBA", (220 * len(STAGES), 154 * len(EXPRESSIONS)), (250, 246, 235, 255))
    for stage_index, stage in enumerate(STAGES):
        spec = SPECS[stage]
        master = normalize_master(args.source / f"{stage}-master.png")
        body, limbs = build_rig(master, spec)
        stage_dir = args.output / stage
        expression_dir = stage_dir / "expressions"
        expression_dir.mkdir(parents=True, exist_ok=True)

        body.save(stage_dir / "body.png", optimize=True)
        composite = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        for name in ("leg-left", "leg-right", "arm-left", "arm-right"):
            limbs[name].save(stage_dir / f"{name}.png", optimize=True)
            composite.alpha_composite(limbs[name])
        composite.alpha_composite(body)
        neutral = None
        for expression_index, expression in enumerate(EXPRESSIONS):
            face = render_expression(spec, expression)
            face.save(expression_dir / f"{expression}.png", optimize=True)
            preview = composite.copy()
            preview.alpha_composite(face)
            expression_sheet.alpha_composite(preview.resize((154, 154), Image.Resampling.LANCZOS), (stage_index * 220 + 33, expression_index * 154))
            if expression == "neutral":
                neutral = preview
        assert neutral is not None
        neutral.save(args.output / f"{stage}.png", optimize=True)
        if preview_dir:
            neutral.save(preview_dir / f"{stage}.png", optimize=True)
        comparison.alpha_composite(neutral.resize((220, 220), Image.Resampling.LANCZOS), (stage_index * 220, 0))

        paths = [args.output / f"{stage}.png", stage_dir / "body.png"]
        paths.extend(stage_dir / f"{name}.png" for name in ("arm-left", "arm-right", "leg-left", "leg-right"))
        paths.extend(expression_dir / f"{expression}.png" for expression in EXPRESSIONS)
        for path in paths:
            validate(path)

    if preview_dir:
        comparison.save(preview_dir / "stage-comparison-220.png", optimize=True)
        expression_sheet.save(preview_dir / "expression-comparison.png", optimize=True)


if __name__ == "__main__":
    main()
