"""Local, transparent travel accessories with explicit front/back ownership."""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/outfits/travel';OUT.mkdir(parents=True,exist_ok=True)
def canvas(): return Image.new('RGBA',(512,512))
def save(image,name):
    image.save(OUT/f'{name}.png')
def shaded(mask,top,bottom):
    alpha=np.asarray(mask); yy=np.arange(512)[:,None,None]/511
    color=np.broadcast_to(np.array(top)[None,None,:]*(1-yy)+np.array(bottom)[None,None,:]*yy,(512,512,3))
    return Image.fromarray(np.dstack([color.astype('uint8'),alpha]))
def rounded(box,radius,top,bottom):
    mask=Image.new('L',(512,512));ImageDraw.Draw(mask).rounded_rectangle(box,radius,fill=255)
    return shaded(mask,top,bottom)

bag=rounded((120,150,400,435),52,(255,205,98),(177,82,22));d=ImageDraw.Draw(bag)
d.rounded_rectangle((130,150,390,255),38,fill='#eab368',outline='#aa652a',width=5)
d.rounded_rectangle((233,228,282,290),9,fill='#ffdc75',outline='#a97423',width=5)
d.rounded_rectangle((145,311,375,409),25,outline='#f5c27c',width=4)
save(bag,'satchel-bag')
strap=canvas();d=ImageDraw.Draw(strap);d.line([(143,98),(348,441)],fill='#985420',width=22);d.line([(143,98),(348,441)],fill='#e5aa65',width=13)
save(strap,'satchel-strap')

pack=rounded((84,111,420,465),70,(212,155,86),(110,61,25));d=ImageDraw.Draw(pack)
d.rounded_rectangle((174,52,334,150),35,outline='#85501f',width=25)
d.rounded_rectangle((93,127,411,258),50,fill='#c69652',outline='#7a4d27',width=5)
d.rounded_rectangle((146,304,370,438),30,fill='#b98642',outline='#e0b16c',width=5)
for x in [156,342]:d.rounded_rectangle((x,172,x+23,295),8,fill='#795022');d.rectangle((x-4,223,x+27,252),outline='#ffcf66',width=5)
save(pack,'backpack-bag')
straps=canvas();d=ImageDraw.Draw(straps)
for x in [155,345]:d.line([(x,111),(x-15,415)],fill='#8e542b',width=22);d.line([(x,111),(x-15,415)],fill='#ce9852',width=12)
save(straps,'backpack-straps')

mask=Image.new('L',(512,512));d=ImageDraw.Draw(mask)
d.polygon([(159,156),(350,156),(477,456),(263,486),(35,456)],fill=255)
cape=shaded(mask,(99,105,206),(49,44,115));d=ImageDraw.Draw(cape)
d.line([(159,156),(35,456),(263,486),(477,456),(350,156)],fill='#f5ce67',width=7)
for x,y in [(108,348),(408,364),(177,409),(328,428)]:
    points=[(x+math.cos(-math.pi/2+i*math.pi/5)*(17 if i%2==0 else 7),y+math.sin(-math.pi/2+i*math.pi/5)*(17 if i%2==0 else 7)) for i in range(10)]
    d.polygon(points,fill='#ffe190')
save(cape,'cape-back')
collar=canvas();d=ImageDraw.Draw(collar);d.arc((130,120,380,270),5,175,fill='#7776c1',width=36);d.ellipse((238,223,274,259),fill='#ffdb6c',outline='#bd8c36',width=3)
save(collar,'cape-collar')

mask=Image.new('L',(512,512));d=ImageDraw.Draw(mask)
d.rounded_rectangle((64,86,448,479),130,fill=255)
d.ellipse((108,89,404,359),fill=0)
coat=shaded(mask,(255,226,94),(223,156,33));d=ImageDraw.Draw(coat)
d.arc((99,79,413,369),0,360,fill='#fff2ae',width=9)
d.line([(256,365),(256,468)],fill='#b68429',width=4)
for y in [386,418,450]:d.ellipse((247,y-6,259,y+6),fill='#fff1b3')
save(coat,'raincoat-front')
print('Created seven local 512 RGBA travel layers.')
