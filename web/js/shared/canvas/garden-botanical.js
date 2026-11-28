// Original layered botanical drawings. Compound paths stay inside the shared 12-path budget.
const n = x => Math.round(x * 100) / 100;
const point = p => `${n(p[0])} ${n(p[1])}`;
const mix = (a, b, t) => '#' + [1,3,5].map(i => Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const circle = (x,y,r) => `M${n(x-r)} ${n(y)}a${r} ${r} 0 1 0 ${r*2} 0a${r} ${r} 0 1 0 ${-r*2} 0Z`;
export function gardenSprigPaths({ leaf = '#C2D0AD', shade = '#8FA480', stem = '#BECDA6', vein = '#E8EDD8' } = {}) {
  const groups = { a:[], b:[], shadow:[], light:[], rib:[], fine:[] };
  const leaves = [[47,17,10,2,10,1.4],[48,31,91,12,11,-1],[48,46,7,33,13,1.7],[48,62,96,51,12,-2],[46,81,3,75,12,1],[46,91,79,78,8,-1.1]];
  for (const [i,[x,y,tx,ty,w,bend]] of leaves.entries()) {
    const dx=tx-x,dy=ty-y,len=Math.hypot(dx,dy),u=[dx/len,dy/len],v=[-u[1],u[0]];
    const at=(t,s=0)=>[x+dx*t+v[0]*(s+Math.sin(t*Math.PI)*bend),y+dy*t+v[1]*(s+Math.sin(t*Math.PI)*bend)];
    const a=at(0),tip=at(1),edge1=at(.3,w*.65),edge2=at(.76,w*.82),edge3=at(.78,-w*.65),edge4=at(.2,-w*.6);
    groups[i%2?'a':'b'].push(`M${point(a)}C${point(edge1)} ${point(edge2)} ${point(tip)}C${point(edge3)} ${point(edge4)} ${point(a)}Z`);
    groups.shadow.push(`M${point(a)}C${point(at(.24,-w*.42))} ${point(at(.7,-w*.5))} ${point(tip)}C${point(at(.68,.1))} ${point(at(.28,.15))} ${point(a)}Z`);
    groups.light.push(`M${point(at(.16,w*.22))}C${point(at(.35,w*.5))} ${point(at(.65,w*.53))} ${point(at(.86,w*.15))}C${point(at(.58,w*.28))} ${point(at(.3,w*.25))} ${point(at(.16,w*.22))}Z`);
    groups.rib.push(`M${point(at(0))}C${point(at(.32,.1))} ${point(at(.72,.2))} ${point(at(.94))}`);
    for(const t of [.25,.43,.61,.77])for(const side of [-1,1])groups.fine.push(`M${point(at(t))}Q${point(at(t+.03,side*w*.28))} ${point(at(Math.max(.02,t-.1),side*w*(.48-.2*t)))}`);
  }
  return [
    {d:'M46 100C43 80 51 63 47 46C43 28 43 11 47 2',fill:'none',stroke:mix(stem,shade,.3),strokeWidth:1.7},
    {d:'M45.6 99C42.7 80 50.3 63 46.4 46C42.5 28 42.6 11 46.5 3',fill:'none',stroke:stem,strokeWidth:.7},
    {d:groups.a.join(''),fill:leaf},{d:groups.b.join(''),fill:mix(leaf,shade,.19)},
    {d:groups.shadow.join(''),fill:mix(leaf,shade,.55)},
    {d:groups.light.join(''),fill:mix(leaf,'#FFFFFF',.17)},
    {d:groups.rib.join(''),fill:'none',stroke:vein,strokeWidth:.55},
    {d:groups.fine.join(''),fill:'none',stroke:mix(vein,leaf,.48),strokeWidth:.24},
    {d:'M47 9C39 5 38 1 42 0C47 1 49 5 47 9Z',fill:shade},
  ];
}
export function gardenFlowerPaths({ petal = '#F3D4CF', center = '#D8B65D', vein = '#C58B8D' } = {}) {
  const petals=[[],[]], shadows=[], highlights=[], veins=[], stalks=[], tips=[];
  for(let i=0;i<5;i++){
    const angle=(-94+i*72)*Math.PI/180,u=[Math.cos(angle),Math.sin(angle)],v=[-u[1],u[0]],r=[34,35,33,36,34][i];
    const at=(a,b=0)=>[50+u[0]*a+v[0]*b,50+u[1]*a+v[1]*b];
    petals[i%2].push(`M${point(at(4,-5))}C${point(at(14,-17))} ${point(at(r,-17))} ${point(at(r,-4))}C${point(at(r+7,3))} ${point(at(r-1,18))} ${point(at(r-12,17))}C${point(at(11,14))} ${point(at(5,5))} ${point(at(4,-5))}Z`);
    shadows.push(`M${point(at(4,-3))}C${point(at(11,-11))} ${point(at(r-7,-11))} ${point(at(r-2,-3))}C${point(at(20,-5))} ${point(at(10,3))} ${point(at(4,-3))}Z`);
    highlights.push(`M${point(at(10,5))}C${point(at(18,8))} ${point(at(r-2,8))} ${point(at(r-1,0))}C${point(at(r+2,8))} ${point(at(20,14))} ${point(at(10,5))}Z`);
    veins.push(`M${point(at(10))}Q${point(at(21,2))} ${point(at(r-5,0))}M${point(at(13,2))}Q${point(at(19,6))} ${point(at(25,8))}`);
  }
  for(let i=0;i<11;i++){const a=i*Math.PI*2/11,r=12+(i%3),x=50+Math.cos(a)*r,y=50+Math.sin(a)*r;stalks.push(`M50 50L${n(x)} ${n(y)}`);tips.push(circle(x,y,1.15));}
  return [
    {d:petals[0].join(''),fill:petal},{d:petals[1].join(''),fill:mix(petal,'#FFF6DF',.14)},
    {d:shadows.join(''),fill:mix(petal,vein,.28)},{d:highlights.join(''),fill:mix(petal,'#FFFFFF',.27)},
    {d:veins.join(''),fill:'none',stroke:mix(vein,petal,.4),strokeWidth:.38},
    {d:circle(50,51,10),fill:mix(center,'#6F572A',.22)},
    {d:stalks.join(''),fill:'none',stroke:center,strokeWidth:.65},
    {d:tips.join(''),fill:center},
    {d:circle(49,48,7.5),fill:center},
    {d:[[46,46],[52,44],[54,50],[47,53],[44,49],[50,49],[51,54]].map(([x,y])=>circle(x,y,.85)).join(''),fill:'#FFF1C3'},
  ];
}
export function gardenCupPaths() {
  return [
    {d:'M15 85C15 73 88 73 88 85C88 97 15 97 15 85Z',fill:'#D4C4AB'},
    {d:'M11 79C11 66 90 66 90 79C90 94 11 94 11 79Z',fill:'#FFF7E7',stroke:'#D2B98C',strokeWidth:.9},
    {d:'M21 79C26 87 75 87 82 79',fill:'none',stroke:'#E7D0A6',strokeWidth:1},
    {d:'M70 36C100 24 99 65 74 65L72 57C87 58 90 38 73 44Z',fill:'#FFF2DD',stroke:'#C8AD8B',strokeWidth:.8},
    {d:'M22 34H74L70 65C67 82 30 82 25 64Z',fill:'#FBEEE3'},
    {d:'M63 35H74L70 65C68 75 56 79 46 78C61 73 64 51 63 35Z',fill:'#DDC3BB'},
    {d:'M24 36C25 59 29 69 38 73',fill:'none',stroke:'#FFFAEE',strokeWidth:2.4},
    {d:'M20 34C20 22 76 22 76 34C76 45 20 45 20 34Z',fill:'#FFF9ED',stroke:'#C9AD87',strokeWidth:.7},
    {d:'M25 33C25 26 71 26 71 33C71 40 25 40 25 33Z',fill:'#B78A51'},
    {d:'M28 31C37 27 56 28 64 30',fill:'none',stroke:'#E6C485',strokeWidth:1.5},
    {d:'M46 48C34 42 33 55 42 56C34 64 47 69 49 59C57 70 65 57 55 54C66 48 55 40 50 49ZM48 54a3 3 0 1 0 6 0a3 3 0 1 0-6 0Z',fill:'#C58B91'},
  ];
}
