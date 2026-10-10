export function canOccupy(x,z,buildings,radius=0.7) {
  if(Math.abs(x)>115-radius || Math.abs(z)>115-radius) return false;
  return !buildings.some(b => x > b.x-b.w/2-radius && x < b.x+b.w/2+radius && z > b.z-b.d/2-radius && z < b.z+b.d/2+radius);
}
export function movePlayer(position,dx,dz,buildings) {
  // Substeps prevent tunnelling, and independent axes allow wall sliding.
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/0.25));
  for(let i=0;i<steps;i++) {
    if(canOccupy(position.x+dx/steps,position.z,buildings)) position.x+=dx/steps;
    if(canOccupy(position.x,position.z+dz/steps,buildings)) position.z+=dz/steps;
  }
  return position;
}
