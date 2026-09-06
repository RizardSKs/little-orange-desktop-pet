"""Split existing local art into complementary layers without repainting it."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RECIPES = {'top-hat': 340, 'crown': 355, 'headphones': 245, 'scarf': 205}
output = ROOT/'assets/outfits/layers'
output.mkdir(parents=True, exist_ok=True)
for item, split_y in RECIPES.items():
    source = np.asarray(Image.open(ROOT/f'assets/outfits/{item}.png').convert('RGBA')).copy()
    yy, xx = np.indices((512,512))
    back_mask = yy < split_y
    if item == 'headphones': back_mask |= (xx > 130) & (xx < 382)
    for name, keep in [('back', back_mask), ('front', ~back_mask)]:
        pixels = source.copy()
        pixels[~keep] = 0
        Image.fromarray(pixels).save(output/f'{item}-{name}.png')
    back = np.asarray(Image.open(output/f'{item}-back.png'))
    front = np.asarray(Image.open(output/f'{item}-front.png'))
    assert np.array_equal(back.astype(int)+front.astype(int), source), item

for stage in ['sprout','lively','mature','radiant']:
    source = np.asarray(Image.open(ROOT/f'assets/pet/{stage}/body.png').convert('RGBA')).copy()
    yy, _ = np.indices((512,512))
    green = (source[...,1].astype(float) > source[...,0]*1.02) & (yy < 295)
    leaves = source.copy(); leaves[~green] = 0
    torso = source.copy(); torso[green] = 0
    Image.fromarray(leaves).save(ROOT/f'assets/pet/{stage}/leaves.png')
    Image.fromarray(torso).save(ROOT/f'assets/pet/{stage}/torso.png')
    assert np.array_equal(leaves.astype(int)+torso.astype(int),source)
print('PASS: four outfit recipes and four leaf/torso pairs have disjoint, lossless pixels.')
