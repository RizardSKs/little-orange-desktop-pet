// Read-only PNG measurement using the project's bundled Electron; no Python dependency.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const output = path.resolve('tmp/rig-evidence');
fs.mkdirSync(output, { recursive: true });
app.setPath('userData', path.join(output, 'measurement-profile'));
function hull(points) {
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half = list => { const out=[]; for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out; };
  return [...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];
}
app.whenReady().then(()=>{
  const hulls={}, assets=[], contacts=[];
  const contactPoints={
    'assets/props/rig/care/bread.png':[[256,115],[350,330]],
    'assets/props/rig/care/pillow.png':[[82,295],[430,295]],
    'assets/props/rig/care/bowl.png':[[130,310],[382,310]],
    'assets/props/rig/care/washcloth.png':[[256,330]],
    'assets/props/rig/inventory/honey-soda.png':[[151,310],[360,310],[354,34]],
    'assets/props/rig/inventory/grooming-brush.png':[[205,402],[118,205]],
    'assets/props/rig/inventory/ribbon-ball.png':[[353,300]],
    'assets/props/rig/mini-keyboard.png':[[195,290],[310,290]],
  };
  for(const directory of ['assets/pet','assets/outfits','assets/props/rig']) {
    for(const name of fs.readdirSync(directory,{recursive:true}).filter(name=>name.endsWith('.png'))) {
      const file=path.join(directory,name), key=file.replaceAll('\\','/');
      const png=fs.readFileSync(file), image=nativeImage.createFromBuffer(png);
      if(image.isEmpty())throw Error('Cannot decode '+file);
      const bitmap=image.resize({width:512,height:512}).toBitmap();
      for(const [x,y] of contactPoints[key]??[])contacts.push({file:key,x,y,alpha:bitmap[(y*512+x)*4+3]});
      const points=[];
      for(let y=0;y<512;y++) {
        let lo=512,hi=-1;
        for(let x=0;x<512;x++)if(bitmap[(y*512+x)*4+3]>=16){lo=Math.min(lo,x);hi=x;}
        if(hi>=lo)points.push([lo,y],[hi+1,y],[lo,y+1],[hi+1,y+1]);
      }
      hulls[key]=hull(points);
      assets.push({file:key,...image.getSize(),sha256:createHash('sha256').update(png).digest('hex'),hull:hulls[key]});
    }
  }
  fs.writeFileSync(path.join(output,'alpha-hulls.json'),JSON.stringify(hulls));
  fs.writeFileSync(path.join(output,'asset-measurements.json'),JSON.stringify(assets,null,2));
  fs.writeFileSync(path.join(output,'contact-pixels.json'),JSON.stringify(contacts,null,2));
  if(contacts.some(point=>point.alpha<220))throw Error('Contact on transparent pixel; see contact-pixels.json');
  console.log(JSON.stringify({assets:assets.length,output}));app.exit(0);
}).catch(error=>{console.error(error);app.exit(1);});
