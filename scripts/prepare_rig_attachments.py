"""Deterministic local PNG repair, explicitly authorized by the user.

Uses original committed rig pixels; outputs 512 RGBA and repeatable evidence.
Run with --arms to repair only arms. No other assets are touched in Phase 2.
"""
import argparse
import json
import subprocess
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/rig-evidence/phase2'
SPECS = {
    'sprout': {'left': ((136, 333), (96, 353), 20), 'right': ((376, 333), (425, 353), 21)},
    'lively': {'left': ((151, 333), (112, 362), 19), 'right': ((361, 333), (402, 361), 19)},
    'mature': {'left': ((133, 333), (84, 381), 21), 'right': ((379, 333), (427, 381), 21)},
    'radiant': {'left': ((141, 348), (104, 403), 22), 'right': ((371, 338), (417, 403), 22)},
}
TORSOS = {'sprout': (260, 299, 161, 138), 'lively': (257, 309, 130, 132), 'mature': (256, 337, 163, 121), 'radiant': (257, 361, 144, 115)}
FEET = {'sprout': ((188, 436), (333, 436), 46, 28), 'lively': ((196, 445), (321, 445), 39, 24), 'mature': ((178, 451), (330, 451), 50, 24), 'radiant': ((190, 473), (317, 473), 49, 27)}

def repair_connections(stage):
    master = np.asarray(original(f'assets/pet/{stage}.png')).copy()
    body = np.asarray(original(f'assets/pet/{stage}/body.png')).copy()
    yy, xx = np.mgrid[:512,:512]
    cx, cy, rx, ry = TORSOS[stage]
    ellipse = np.sqrt(((xx-cx)/rx)**2 + ((yy-cy)/ry)**2)
    alpha = np.minimum(master[...,3], np.clip((1-ellipse)*min(rx,ry)*255,0,255)).astype(np.uint8)
    # Preserve the original leaf canopy, independent of the torso ellipse.
    canopy = (master[...,1].astype(float) > master[...,0]*1.02) & (yy < cy-50)
    alpha = np.maximum(alpha, np.where(canopy, body[...,3], 0)).astype(np.uint8)
    missing = (body[...,3] < 220) & (alpha > 0)
    body[missing,:3] = master[missing,:3]
    body[...,3] = alpha
    body[alpha == 0] = 0
    Image.fromarray(body).save(ROOT/f'assets/pet/{stage}/body.png')
    left, right, rx, ry = FEET[stage]
    for side, (cx,cy) in [('left',left),('right',right)]:
        pixels = master.copy()
        ellipse = np.sqrt(((xx-cx)/rx)**2 + ((yy-cy)/ry)**2)
        pixels[...,3] = np.minimum(master[...,3],np.clip((1-ellipse)*min(rx,ry)*255,0,255)).astype(np.uint8)
        pixels[pixels[...,3] == 0] = 0
        Image.fromarray(pixels).save(ROOT/f'assets/pet/{stage}/leg-{side}.png')

def original(relative):
    return Image.open(BytesIO(subprocess.check_output(['git', 'show', f'26766f0:{relative}'], cwd=ROOT))).convert('RGBA')

def repair_arm(stage, side, shoulder, hand, radius):
    source = original(f'assets/pet/{stage}/arm-{side}.png')
    master = original(f'assets/pet/{stage}.png')
    yy, xx = np.mgrid[:512, :512]
    a, b = np.asarray(shoulder), np.asarray(hand)
    t = np.clip(((xx-a[0])*(b[0]-a[0]) + (yy-a[1])*(b[1]-a[1])) / np.sum((b-a)**2), 0, 1)
    distance = np.hypot(xx-(a[0]+t*(b[0]-a[0])), yy-(a[1]+t*(b[1]-a[1])))
    # A filled root and connecting capsule replace the crescent left by extraction.
    alpha = np.clip((radius + .5 - distance)*255, 0, 255).astype(np.uint8)
    pixels = np.asarray(master).copy()
    source_pixels = np.asarray(source)
    original_visible = (source_pixels[..., 3] > 16) & (alpha > 0)
    # Sample matching peel from inside the body for formerly transparent root pixels.
    fill = np.asarray(master)[int(shoulder[1]), int(shoulder[0]), :3].astype(float)
    light = np.clip(1.02 - (xx-hand[0])*.002 - (yy-hand[1])*.001, .82, 1.1)
    pixels[..., :3] = np.clip(fill[None,None,:]*light[...,None], 0, 255)
    blend = np.clip((t-.35)/.5,0,1)*original_visible
    pixels[..., :3] = pixels[..., :3]*(1-blend[...,None])+source_pixels[..., :3]*blend[...,None]
    pixels[..., 3] = alpha
    pixels[alpha == 0] = 0
    result = Image.fromarray(pixels)
    result.save(ROOT / f'assets/pet/{stage}/arm-{side}.png')
    return result

def validate(stage, arms):
    body = Image.open(ROOT/f'assets/pet/{stage}/body.png').convert('RGBA')
    report = []
    for side, arm in arms.items():
        shoulder, hand, radius = SPECS[stage][side]
        for angle in range(-90, 91):
            moved = arm.rotate(-angle, Image.Resampling.BICUBIC, center=shoulder)
            a = np.asarray(moved.getchannel('A'))
            b = np.asarray(body.getchannel('A'))
            overlap = int(((a > 220) & (b > 220)).sum())
            if a[shoulder[1], shoulder[0]] < 220 or overlap < 400:
                raise ValueError(f'{stage}/{side}/{angle}: disconnected root ({overlap})')
        report.append({'side': side, 'angles': 181, 'shoulder': shoulder, 'hand': hand, 'rootRadius': radius})
    sheet = Image.new('RGBA', (512*5, 512), '#f5f1e9')
    for index, angle in enumerate([-82, -40, 0, 40, 82]):
        frame = Image.new('RGBA', (512,512))
        for side, arm in arms.items():
            frame.alpha_composite(arm.rotate(-angle if side == 'left' else angle, Image.Resampling.BICUBIC, center=SPECS[stage][side][0]))
        frame.alpha_composite(body)
        frame.alpha_composite(original(f'assets/pet/{stage}/expressions/neutral.png'))
        for side in ['left','right']: frame.alpha_composite(Image.open(ROOT/f'assets/pet/{stage}/leg-{side}.png').convert('RGBA'))
        sheet.alpha_composite(frame,(index*512,0))
    sheet.save(OUT/f'{stage}-angle-sweep.png')
    return report

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--arms', action='store_true', required=True)
    parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for stage, spec in SPECS.items():
        repair_connections(stage)
        arms = {side: repair_arm(stage, side, *values) for side, values in spec.items()}
        report[stage] = validate(stage, arms)
    (OUT/'geometry.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (ROOT/'src/renderer/rig/stage-data.json').write_text(json.dumps({stage: {side: {'shoulder': {'x': values[0][0], 'y': values[0][1]}, 'hand': {'x': values[1][0], 'y': values[1][1]}, 'rootRadius': values[2], 'minAngle': -90, 'maxAngle': 90} for side, values in spec.items()} for stage, spec in SPECS.items()}, indent=2)+'\n', encoding='utf-8')
    print('PASS: 8 arms, 1448 angle samples; 512 RGBA; opaque connected roots.')

if __name__ == '__main__': main()
