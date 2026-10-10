import { CanvasTexture, ClampToEdgeWrapping, RepeatWrapping, SRGBColorSpace } from 'three';

// Longitude is periodic. The quarter-turn aligns the equirectangular map
// with our Greenwich +Z convention; sampling past U=1 must wrap to U=0.
export function createGlobeTexture(canvas, anisotropy = 1) {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.offset.x = .25;
  texture.anisotropy = anisotropy;
  return texture;
}

export function createMoonTexture(anisotropy = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  // Equal colors at both longitude edges prevent a seam after wrapping.
  const base = ctx.createLinearGradient(0, 0, 0, canvas.height);
  base.addColorStop(0, '#bfc2bf'); base.addColorStop(.5, '#e1dfd5'); base.addColorStop(1, '#a8aaa9');
  ctx.fillStyle = base; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 24681;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 1450; i++) {
    const x = random() * canvas.width, y = random() * canvas.height, radius = 1 + random() * 14;
    const shadow = .025 + random() * .09, highlight = .05 + random() * .14;
    const centers = [x];
    if (x - radius < 0) centers.push(x + canvas.width);
    if (x + radius > canvas.width) centers.push(x - canvas.width);
    for (const center of centers) {
      ctx.beginPath(); ctx.arc(center, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(61,65,68,${shadow})`; ctx.fill();
      ctx.beginPath(); ctx.arc(center - radius * .18, y - radius * .18, radius * .76, Math.PI, Math.PI * 1.8);
      ctx.strokeStyle = `rgba(255,255,255,${highlight})`; ctx.lineWidth = .8; ctx.stroke();
    }
  }
  return createGlobeTexture(canvas, anisotropy);
}
