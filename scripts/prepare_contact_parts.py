"""Build local, width-preserving contact arm parts from each stage's peel texture."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
yy,xx=np.mgrid[:512,:512]
for stage in ['sprout','lively','mature','radiant']:
    torso=np.asarray(Image.open(ROOT/f'assets/pet/{stage}/body.png').convert('RGBA'))
    color=torso[380,256,:3].astype(float)
    for name,distance in [('segment',np.hypot(xx-np.clip(xx,224,288),yy-256)),('hand',np.hypot(xx-256,yy-256))]:
        pixels=np.zeros((512,512,4),dtype=np.uint8)
        shading=np.clip(1.05-(yy-244)*.009,.72,1.08)
        pixels[:,:,:3]=np.clip(color[None,None,:]*shading[:,:,None],0,255)
        pixels[:,:,3]=np.clip((19.5-distance)*255,0,255)
        if name=='segment':
            pixels[:,:,3]=np.minimum(pixels[:,:,3],np.clip(np.minimum(xx-224,288-xx)*255,0,255)).astype(np.uint8)
        pixels[pixels[:,:,3]==0]=0
        Image.fromarray(pixels).save(ROOT/f'assets/pet/{stage}/{name}.png')
    mouth={'sprout':(262,355),'lively':(270,340),'mature':(281,367),'radiant':(278,377)}[stage]
    for expression in ['delighted','refreshed']:
        pixels=np.asarray(Image.open(ROOT/f'assets/pet/{stage}/expressions/{expression}.png').convert('RGBA')).copy()
        mask=((xx-mouth[0])/32)**2+((yy-mouth[1])/19)**2<=1
        pixels[~mask]=0
        Image.fromarray(pixels).save(ROOT/f'assets/pet/{stage}/mouth-{expression}.png')
print('Generated eight 512 RGBA contact parts with fixed cross-section.')
for source in [*(ROOT/'assets/props/inventory').glob('*.png'), ROOT/'assets/props/mini-keyboard.png', ROOT/'assets/props/cursor-grab.png']:
    image=Image.open(source).convert('RGBA').resize((512,512),Image.Resampling.LANCZOS)
    pixels=np.asarray(image).copy(); pixels[pixels[:,:,3]<16]=0
    destination=ROOT/'assets/props/rig'/source.relative_to(ROOT/'assets/props')
    destination.parent.mkdir(parents=True,exist_ok=True)
    Image.fromarray(pixels).save(destination)

# The brush has its own canvas and grip; bottles and mirror stay in the shop art.
source=Image.open(ROOT/'assets/props/rig/inventory/grooming-kit.png').convert('RGBA')
mask=Image.new('L',source.size)
ImageDraw.Draw(mask).polygon([(18,80),(175,64),(220,185),(212,285),(197,309),(215,345),(264,412),(253,464),(192,472),(156,419),(145,342),(60,311),(20,236)],fill=255)
pixels=np.asarray(source).copy()
pixels[np.asarray(mask)==0]=0
Image.fromarray(pixels).save(ROOT/'assets/props/rig/inventory/grooming-brush.png')

# The legacy cursor already painted a hand. Rebuild its arrow alone so the rig
# owns the visible hands, including the portion formerly hidden by the fingers.
arrow=Image.new('RGBA',(512,512));draw=ImageDraw.Draw(arrow)
draw.polygon([(119,43),(326,177),(272,199),(350,337),(310,362),(211,236),(169,278)],fill='#f4f3f3',outline='#625c60',width=9)
arrow.save(ROOT/'assets/props/rig/cursor-arrow.png')

# Validate contact against opaque artwork, separately from transform residuals.
for file,points in {
    'honey-soda':[(151,310),(360,310)],
    'grooming-brush':[(205,402)],
    'party-popper':[(174,380)],
    'citrus-cookie':[(100,300),(412,300)],
    'ribbon-ball':[(100,300),(412,300)],
    'mouse-feather':[(160,395),(200,340)],
}.items():
    alpha=np.asarray(Image.open(ROOT/f'assets/props/rig/inventory/{file}.png'))[:,:,3]
    for x,y in points:
        assert alpha[y,x]>=220,(file,x,y,int(alpha[y,x]))
print('Contact artwork alpha checks passed.')
