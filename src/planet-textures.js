import * as THREE from 'three';
import { createGlobeTexture, createMoonTexture } from './globe-texture.js';
import { makeEarthTexture, makeTileNoise } from './earth-texture.js';
export function planetTexture(planet,anisotropy) {
 if(planet.id==='earth') return makeEarthTexture(anisotropy);
 if(planet.id==='mercury') return createMoonTexture(anisotropy);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
 const ctx=canvas.getContext('2d'),image=ctx.createImageData(512,256),noise=makeTileNoise(32,16,52319);
 const base=new THREE.Color(planet.color);const rgb=[base.r,base.g,base.b].map(v=>THREE.ColorManagement.workingToColorSpace(new THREE.Color(v,v,v),THREE.SRGBColorSpace).r*255);
 for(let y=0;y<256;y++)for(let x=0;x<512;x++){
  const u=x/512,v=y/256,n=noise(u,v);let shade=.92+(n-.5)*.18;
  if(['jupiter','saturn'].includes(planet.id)) shade+=Math.sin(v*90+Math.sin(u*Math.PI*8)*.3+n*.8)*.10+Math.sin(v*35)*.06;
  if(planet.id==='venus')shade+=Math.sin(v*20+u*Math.PI*4+n*2)*.04;
  if(planet.id==='mars')shade+=(n>.6?-.25:0);
  const i=(y*512+x)*4;
  for(let c=0;c<3;c++)image.data[i+c]=Math.max(0,Math.min(255,rgb[c]*shade));
  if(planet.id==='mars'&&(v<.035||v>.97)){image.data[i]=218;image.data[i+1]=213;image.data[i+2]=203;}
  image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);
 if(planet.id==='jupiter'){ctx.fillStyle='#a45e47';ctx.beginPath();ctx.ellipse(340,156,24,10,-.1,0,Math.PI*2);ctx.fill();}
 return createGlobeTexture(canvas,anisotropy);
}
