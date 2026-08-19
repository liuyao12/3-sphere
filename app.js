import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PHI=(1+Math.sqrt(5))/2, EPS=1e-7;
const stage=document.querySelector('#stage');
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0xf1f5fa,.025);
const camera=new THREE.PerspectiveCamera(38,1,.05,160);
camera.up.set(0,0,1);
camera.position.set(7.4,8.8,13);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.enablePan=false;controls.dampingFactor=.055;controls.minDistance=4;controls.maxDistance=32;

const groups={torus:new THREE.Group(),extremes:new THREE.Group(),hopf:new THREE.Group(),cell:new THREE.Group(),intersections:new THREE.Group(),cell120:new THREE.Group(),boundary:new THREE.Group(),seam120:new THREE.Group()};
Object.values(groups).forEach(g=>scene.add(g));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>Math.sqrt(dot(a,a));
const normalize=a=>{const n=norm(a);return a.map(x=>x/n)};
const d2=(a,b)=>a.reduce((s,x,i)=>s+(x-b[i])**2,0);
let projectionPole,projectionAxes;
const PROJECTION_LIMIT=44,MAX_PROJECTED_EDGE=3.5,MAX_PROJECTED_FACE_EDGE=1.25;
function project(q){const den=1-dot(q,projectionPole);if(den<1e-9)return new THREE.Vector3(Infinity,Infinity,Infinity);const c=projectionAxes.map(axis=>dot(q,axis)/den);return new THREE.Vector3(c[1],c[2],c[0]).multiplyScalar(1.05)}
const projectionVisible=p=>Number.isFinite(p.x)&&p.length()<PROJECTION_LIMIT;
const segmentVisible=(a,b)=>projectionVisible(a)&&projectionVisible(b)&&a.distanceTo(b)<MAX_PROJECTED_EDGE;
const triangleVisible=(a,b,c)=>projectionVisible(a)&&projectionVisible(b)&&projectionVisible(c)&&a.distanceTo(b)<MAX_PROJECTED_FACE_EDGE&&b.distanceTo(c)<MAX_PROJECTED_FACE_EDGE&&c.distanceTo(a)<MAX_PROJECTED_FACE_EDGE;

function permutations(a){const out=[];function go(k){if(k===a.length){out.push([...a]);return}for(let i=k;i<a.length;i++){[a[k],a[i]]=[a[i],a[k]];go(k+1);[a[k],a[i]]=[a[i],a[k]]}}go(0);return out}
function parity(p){let n=0;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)n+=p[i]>p[j];return n%2}
function make600(){
  const v=[];
  for(let i=0;i<4;i++)for(const s of[-1,1]){const q=[0,0,0,0];q[i]=s;v.push(q)}
  for(let m=0;m<16;m++)v.push([0,1,2,3].map(i=>((m>>i)&1?1:-1)/2));
  for(const p of permutations([0,1,2,3]).filter(p=>parity(p)===0))for(let m=0;m<8;m++){
    const q=[0,(m&1?1:-1)/2,(m&2?1:-1)*PHI/2,(m&4?1:-1)/(2*PHI)];v.push(p.map(i=>q[i]));
  }
  const adjacency=v.map(()=>new Set()),edges=[],edge2=2-PHI;
  for(let i=0;i<v.length;i++)for(let j=i+1;j<v.length;j++)if(Math.abs(d2(v[i],v[j])-edge2)<EPS){adjacency[i].add(j);adjacency[j].add(i);edges.push([i,j])}
  const cells=[];
  for(let a=0;a<v.length;a++)for(const b of adjacency[a])if(b>a)for(const c of adjacency[a])if(c>b&&adjacency[b].has(c))for(const d of adjacency[a])if(d>c&&adjacency[b].has(d)&&adjacency[c].has(d))cells.push([a,b,c,d]);
  return {v,adjacency,edges,cells};
}

const poly=make600();
function slerp(a,b,t){const d=Math.max(-1,Math.min(1,dot(a,b))),angle=Math.acos(d);if(angle<1e-7)return normalize(a.map((x,i)=>(1-t)*x+t*b[i]));const s=Math.sin(angle);return a.map((x,i)=>(Math.sin((1-t)*angle)*x+Math.sin(t*angle)*b[i])/s)}
function sphericalSegmentPoints(vertices,pairs,steps=48){const pts=[];for(const[a,b]of pairs)for(let k=0;k<steps;k++){const pa=project(slerp(vertices[a],vertices[b],k/steps)),pb=project(slerp(vertices[a],vertices[b],(k+1)/steps));if(segmentVisible(pa,pb))pts.push(pa,pb)}return pts}
function lineSegments(pairs,color,opacity){const geo=new THREE.BufferGeometry().setFromPoints(sphericalSegmentPoints(poly.v,pairs)),mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});return new THREE.LineSegments(geo,mat)}
function sphericalPoint(a,b,c,wa,wb,wc){return normalize(a.map((x,i)=>wa*x+wb*b[i]+wc*c[i]))}
function appendSphericalTriangle(positions,a,b,c,subdivisions=8){const point=(i,j)=>project(sphericalPoint(a,b,c,1-(i+j)/subdivisions,i/subdivisions,j/subdivisions));for(let i=0;i<subdivisions;i++)for(let j=0;j<subdivisions-i;j++){const p0=point(i,j),p1=point(i+1,j),p2=point(i,j+1);if(triangleVisible(p0,p1,p2))for(const p of[p0,p1,p2])positions.push(p.x,p.y,p.z);if(j<subdivisions-i-1){const p3=point(i+1,j+1);if(triangleVisible(p1,p3,p2))for(const p of[p1,p3,p2])positions.push(p.x,p.y,p.z)}}}
function sphericalFaceGeometry(vertices,faces,subdivisions=8){const positions=[];for(const face of faces){const center=normalize([0,1,2,3].map(k=>face.reduce((sum,id)=>sum+vertices[id][k],0)));for(let i=0;i<face.length;i++)appendSphericalTriangle(positions,center,vertices[face[i]],vertices[face[(i+1)%face.length]],subdivisions)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo}
function sphericalFaces(vertices,faces,color,opacity){return new THREE.Mesh(sphericalFaceGeometry(vertices,faces),new THREE.MeshPhongMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,shininess:18}))}

// A decagonal great circle, its 150-cell solid torus, and the 100-face boundary.
const a=0,b=[...poly.adjacency[a]][0],basisU=poly.v[a];
let raw=poly.v[b].map((x,i)=>x-dot(poly.v[b],basisU)*basisU[i]);const basisV=normalize(raw);
const ring=poly.v.map((q,i)=>({q,i})).filter(({q})=>{const r=q.map((x,k)=>x-dot(q,basisU)*basisU[k]-dot(q,basisV)*basisV[k]);return dot(r,r)<1e-10}).map(x=>x.i);
const ringSet=new Set(ring);
const solid=poly.cells.map((c,i)=>({c,i})).filter(({c})=>c.some(x=>ringSet.has(x)));
const faceMap=new Map();
for(const {c,i} of solid)for(let k=0;k<4;k++){const ids=c.filter((_,j)=>j!==k).sort((x,y)=>x-y),key=ids.join(',');if(!faceMap.has(key))faceMap.set(key,[]);faceMap.get(key).push(i)}
const boundaryFaces=[...faceMap].filter(([,owners])=>owners.length===1).map(([key,owners])=>({ids:key.split(',').map(Number),cell:owners[0]}));
const boundaryCells=[...new Set(boundaryFaces.map(f=>f.cell))];

function complement(u,v){const out=[];for(const seed of [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]){let q=seed.map((x,i)=>x-dot(seed,u)*u[i]-dot(seed,v)*v[i]);for(const n of out)q=q.map((x,i)=>x-dot(q,n)*n[i]);if(norm(q)>1e-6)out.push(normalize(q));if(out.length===2)break}return out}
const [basisN,basisM]=complement(basisU,basisV);
// Put the projection pole in the decagon plane, between vertices. It is outside
// the separating Clifford torus, so the torus projects to a compact ring.
projectionPole=basisU.map((x,i)=>Math.cos(.17)*x+Math.sin(.17)*basisV[i]);
projectionAxes=[basisU.map((x,i)=>-Math.sin(.17)*x+Math.cos(.17)*basisV[i]),basisN,basisM];
const extremeMaterial=new THREE.LineBasicMaterial({color:0x5ce1e6,transparent:true,opacity:.76,depthWrite:false});
const extremeCircle=[];
for(let i=0;i<=180;i++){const t=i/180*Math.PI*2;extremeCircle.push(project(basisN.map((x,k)=>Math.cos(t)*x+Math.sin(t)*basisM[k])))}
const extremeCircleLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(extremeCircle),extremeMaterial),extremeAxisMaterial=new THREE.LineBasicMaterial({color:0x8ff3d5,transparent:true,opacity:.82,depthWrite:false}),extremeAxisLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-PROJECTION_LIMIT),new THREE.Vector3(0,0,PROJECTION_LIMIT)]),extremeAxisMaterial);
groups.extremes.add(extremeCircleLine,extremeAxisLine);
groups.cell.add(lineSegments(poly.edges,0x9b6700,.15));
const vertexGeo=new THREE.SphereGeometry(.035,7,7),vertexMat=new THREE.MeshBasicMaterial({color:0xb47700,transparent:true,opacity:.42});
for(const q of poly.v){const p=project(q);if(projectionVisible(p)){const m=new THREE.Mesh(vertexGeo,vertexMat);m.position.copy(p);groups.cell.add(m)}}

// Construct the dual 120-cell from the 600 tetrahedron centers. Two dual
// vertices share an edge exactly when the corresponding tetrahedra share a face.
const dualVertices=poly.cells.map(c=>normalize([0,1,2,3].map(k=>c.reduce((sum,id)=>sum+poly.v[id][k],0))));
const dualFaceMap=new Map();
poly.cells.forEach((c,ci)=>{for(let k=0;k<4;k++){const key=c.filter((_,j)=>j!==k).sort((x,y)=>x-y).join(',');if(!dualFaceMap.has(key))dualFaceMap.set(key,[]);dualFaceMap.get(key).push(ci)}});
const dualEdges=[...dualFaceMap.values()].filter(x=>x.length===2).map(x=>[x[0],x[1]]);
const cell600Faces=[...dualFaceMap.keys()].map(key=>key.split(',').map(Number));
groups.cell.add(sphericalFaces(poly.v,cell600Faces,0xb47700,.012));
function projectedSegments(vertices,pairs,color,opacity){return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sphericalSegmentPoints(vertices,pairs)),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}))}
groups.cell120.add(projectedSegments(dualVertices,dualEdges,0x9f8cff,.14));
const dualPointGeo=new THREE.SphereGeometry(.022,5,5),dualPointMat=new THREE.MeshBasicMaterial({color:0xb8aaff,transparent:true,opacity:.3});
for(const q of dualVertices){const p=project(q);if(projectionVisible(p)){const m=new THREE.Mesh(dualPointGeo,dualPointMat);m.position.copy(p);groups.cell120.add(m)}}

// The 60 vertices belonging to the decagonal solid torus select 60 dual
// dodecahedra. A primal edge crossing that partition is dual to one pentagonal
// face in the common torus boundary.
const solidVertexSet=new Set(solid.flatMap(({c})=>c));
const crossingEdges=poly.edges.filter(([x,y])=>solidVertexSet.has(x)!==solidVertexSet.has(y));
const primalEdgeCells=new Map();
poly.cells.forEach((c,ci)=>{for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const key=[c[i],c[j]].sort((x,y)=>x-y).join(',');if(!primalEdgeCells.has(key))primalEdgeCells.set(key,[]);primalEdgeCells.get(key).push(ci)}});
function orderPentagon(ids){const ordered=[ids[0]],used=new Set(ordered);while(ordered.length<ids.length){const last=ordered.at(-1),next=ids.find(id=>!used.has(id)&&poly.cells[last].filter(x=>poly.cells[id].includes(x)).length===3);if(next===undefined)break;ordered.push(next);used.add(next)}return ordered}
const cell120Faces=[...primalEdgeCells.values()].map(orderPentagon).filter(face=>face.length===5);
groups.cell120.add(sphericalFaces(dualVertices,cell120Faces,0x9f8cff,.01));
const seamPairs=[];
for(const edge of crossingEdges){const ids=primalEdgeCells.get([...edge].sort((x,y)=>x-y).join(',')),cycle=orderPentagon(ids);if(cycle.length===5)for(let i=0;i<5;i++)seamPairs.push([cycle[i],cycle[(i+1)%5]])}
groups.seam120.add(projectedSegments(dualVertices,seamPairs,0xe58cff,.78));
let torusEta=Math.acos(Math.sqrt((5+Math.sqrt(5))/10));
function torusPoint(u,v){const torusR=Math.cos(torusEta),torusr=Math.sin(torusEta);return basisU.map((_,i)=>torusR*(Math.cos(u)*basisU[i]+Math.sin(u)*basisV[i])+torusr*(Math.cos(v)*basisN[i]+Math.sin(v)*basisM[i]))}
function colorGraph(count,edges){const neighbors=Array.from({length:count},()=>new Set());for(const[a,b]of edges){neighbors[a].add(b);neighbors[b].add(a)}const colors=Array(count).fill(-1);for(let done=0;done<count;done++){let pick=-1,bestSat=-1,bestDegree=-1;for(let i=0;i<count;i++)if(colors[i]<0){const sat=new Set([...neighbors[i]].map(n=>colors[n]).filter(c=>c>=0)).size,degree=neighbors[i].size;if(sat>bestSat||sat===bestSat&&degree>bestDegree){pick=i;bestSat=sat;bestDegree=degree}}const used=new Set([...neighbors[pick]].map(n=>colors[n]).filter(c=>c>=0));let color=0;while(used.has(color))color++;colors[pick]=color}return colors}
const torusPalettes={cell600:[0x245bd6,0x6c50d6,0x2183c4,0x8975e6,0x3a6aad,0x7653aa],cell120:[0x6948cf,0x2b78cf,0x3c9bb7,0x8b66da,0x4966b7,0x7453a8],hopf:[0x245bd6,0x7255d9]};
let visualMode='hopf',torusGridSource='hopf';
const torusMaterial=new THREE.MeshPhongMaterial({vertexColors:true,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false,shininess:55});
const torusSurface=new THREE.Mesh(new THREE.BufferGeometry(),torusMaterial);
const torusCellLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x183f94,transparent:true,opacity:.72,depthWrite:false}));
const torusRulingA=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x007c91,transparent:true,opacity:.86,depthWrite:false}));
const torusRulingB=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x6846c7,transparent:true,opacity:.8,depthWrite:false}));
groups.torus.add(torusSurface,torusCellLines,torusRulingA,torusRulingB);
function torusCellAt(q){const centers=torusGridSource==='cell120'?poly.v:dualVertices;let best=0,bestDot=-Infinity;for(let i=0;i<centers.length;i++){const c=centers[i],score=q[0]*c[0]+q[1]*c[1]+q[2]*c[2]+q[3]*c[3];if(score>bestDot){bestDot=score;best=i}}return best}
function setTorusSurface(positions,colors,linePts){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();torusSurface.geometry.dispose();torusSurface.geometry=geo;torusCellLines.geometry.dispose();torusCellLines.geometry=new THREE.BufferGeometry().setFromPoints(linePts)}
function buildHopfTorusGrid(){
  const N=12,SUBDIVISIONS=6,step=Math.PI*2/N,positions=[],colors=[],rulings=[[],[]],palette=torusPalettes.hopf;
  const point=(a,b)=>torusPoint((b-a)/2,(a+b)/2);
  const addTriangle=(qs,colorIndex)=>{
    if(colorIndex===0)return;
    const ps=qs.map(project);
    if(!triangleVisible(ps[0],ps[1],ps[2]))return;
    const color=new THREE.Color(palette[colorIndex]);
    for(const p of ps){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b)}
  };
  // In Hopf coordinates a=v-u and b=u+v, each tile edge is itself a fiber.
  // b runs through 4π so this rectangle covers the torus exactly once.
  for(let ia=0;ia<N;ia++)for(let ib=0;ib<2*N;ib++){
    const shade=(ia+ib)&1;
    for(let i=0;i<SUBDIVISIONS;i++)for(let j=0;j<SUBDIVISIONS;j++){
      const a0=(ia+i/SUBDIVISIONS)*step,a1=(ia+(i+1)/SUBDIVISIONS)*step;
      const b0=(ib+j/SUBDIVISIONS)*step,b1=(ib+(j+1)/SUBDIVISIONS)*step;
      const q00=point(a0,b0),q10=point(a1,b0),q01=point(a0,b1),q11=point(a1,b1);
      addTriangle([q00,q10,q01],shade);
      addTriangle([q10,q11,q01],shade);
    }
  }
  for(const[family,sign]of[-1,1].entries())for(let k=0;k<N;k++){
    const offset=k/N*Math.PI*2;
    let previous=null;
    for(let s=0;s<=360;s++){
      const u=s/360*Math.PI*2,v=sign===1?u+offset:offset-u,p=project(torusPoint(u,v));
      if(previous&&segmentVisible(previous,p))rulings[family].push(previous,p);
      previous=p;
    }
  }
  setTorusSurface(positions,colors,[]);
  torusRulingA.geometry.dispose();
  torusRulingA.geometry=new THREE.BufferGeometry().setFromPoints(rulings[0]);
  torusRulingB.geometry.dispose();
  torusRulingB.geometry=new THREE.BufferGeometry().setFromPoints(rulings[1]);
  document.querySelector('#grid-description').textContent='Hopf rulings · 12 + 12 circles';
  document.querySelector('#intersection-count').value=24;
  document.querySelector('#intersection-label').textContent='CIRCLES IN TWO RULINGS';
}
function buildTorusCellGrid(){
  const NU=180,NV=120,du=Math.PI*2/NU,dv=Math.PI*2/NV;
  const centers=torusGridSource==='cell120'?poly.v:dualVertices;
  const centerCount=centers.length,palette=torusPalettes[torusGridSource];
  const labels=Array.from({length:NU+1},()=>new Int32Array(NV+1));
  const positions=[],colors=[],linePts=[],used=new Set(),adjacency=[],seenAdjacency=new Set();

  for(let i=0;i<=NU;i++)for(let j=0;j<=NV;j++){
    const id=torusCellAt(torusPoint(i*du,j*dv));
    labels[i][j]=id;
    used.add(id);
  }

  const triangles=[];
  const registerTriangle=vs=>{
    triangles.push(vs);
    const ids=[...new Set(vs.map(v=>v.id))];
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
      const lo=Math.min(ids[a],ids[b]),hi=Math.max(ids[a],ids[b]),key=`${lo},${hi}`;
      if(!seenAdjacency.has(key)){seenAdjacency.add(key);adjacency.push([lo,hi])}
    }
  };
  for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){
    const u=i*du,v=j*dv;
    const a={u,v,q:torusPoint(u,v),id:labels[i][j]};
    const b={u:u+du,v,q:torusPoint(u+du,v),id:labels[i+1][j]};
    const c={u,v:v+dv,q:torusPoint(u,v+dv),id:labels[i][j+1]};
    const d={u:u+du,v:v+dv,q:torusPoint(u+du,v+dv),id:labels[i+1][j+1]};
    registerTriangle([a,b,c]);
    registerTriangle([b,d,c]);
  }

  const coloring=colorGraph(centerCount,adjacency);
  const colorCount=Math.max(...[...used].map(id=>coloring[id]))+1;
  const addTriangle=(qs,id)=>{
    if(torusGridSource==='cell600'&&(coloring[id]&1)===0)return;
    const ps=qs.map(project);
    if(!triangleVisible(ps[0],ps[1],ps[2]))return;
    const color=new THREE.Color(palette[coloring[id]%palette.length]);
    for(const p of ps){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b)}
  };
  const addPolygon=(qs,id)=>{
    for(let k=1;k+1<qs.length;k++)addTriangle([qs[0],qs[k],qs[k+1]],id);
  };
  const crossing=(a,b)=>{
    const ca=centers[a.id],cb=centers[b.id];
    let lo=0,hi=1;
    for(let k=0;k<16;k++){
      const t=(lo+hi)/2,q=torusPoint(a.u+(b.u-a.u)*t,a.v+(b.v-a.v)*t);
      const f=dot(q,ca)-dot(q,cb);
      if(f>=0)lo=t;else hi=t;
    }
    const t=(lo+hi)/2;
    return torusPoint(a.u+(b.u-a.u)*t,a.v+(b.v-a.v)*t);
  };

  for(const vs of triangles){
    const ids=[...new Set(vs.map(v=>v.id))];
    if(ids.length===1){addTriangle(vs.map(v=>v.q),ids[0]);continue}
    const edgeCrossings=new Array(3);
    for(let e=0;e<3;e++){
      const a=vs[e],b=vs[(e+1)%3];
      if(a.id!==b.id)edgeCrossings[e]=crossing(a,b);
    }
    if(ids.length===2){
      for(const id of ids){
        const polygon=[];
        for(let e=0;e<3;e++){
          const a=vs[e],b=vs[(e+1)%3];
          if(a.id===id)polygon.push(a.q);
          if(a.id!==b.id&&(a.id===id||b.id===id))polygon.push(edgeCrossings[e]);
        }
        addPolygon(polygon,id);
      }
      const cuts=edgeCrossings.filter(Boolean).map(project);
      if(cuts.length===2&&segmentVisible(cuts[0],cuts[1]))linePts.push(cuts[0],cuts[1]);
    }else{
      const junction=torusPoint(
        (vs[0].u+vs[1].u+vs[2].u)/3,
        (vs[0].v+vs[1].v+vs[2].v)/3
      );
      for(let i=0;i<3;i++){
        const next=edgeCrossings[i],previous=edgeCrossings[(i+2)%3];
        addPolygon([vs[i].q,next,junction,previous],vs[i].id);
      }
      const jp=project(junction);
      for(const q of edgeCrossings){const p=project(q);if(segmentVisible(p,jp))linePts.push(p,jp)}
    }
  }
  setTorusSurface(positions,colors,linePts);
  for(const ruling of[torusRulingA,torusRulingB]){ruling.geometry.dispose();ruling.geometry=new THREE.BufferGeometry()}
  document.querySelector('#grid-description').textContent=`${torusGridSource==='cell120'?'120':'600'}-cell · ${used.size} patches · ${colorCount} colors`;
  document.querySelector('#intersection-count').value=used.size;
  document.querySelector('#intersection-label').textContent=torusGridSource==='cell120'?'DODECAHEDRA MEET TORUS':'TETRAHEDRA MEET TORUS';
  return [...used];
}
const intersectionLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x6d28d9,transparent:true,opacity:.82,depthWrite:false}));
const intersectionWalls=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshPhongMaterial({color:0x6d28d9,transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false,shininess:28}));
groups.intersections.add(intersectionWalls,intersectionLines);
function updateIntersectedCells(ids){
  const selected=new Set(ids),pairs=[],faces=[],seenPairs=new Set(),seenFaces=new Set();
  const addPair=(a,b)=>{const key=a<b?`${a},${b}`:`${b},${a}`;if(!seenPairs.has(key)){seenPairs.add(key);pairs.push([a,b])}};
  const addFace=face=>{const key=[...face].sort((a,b)=>a-b).join(',');if(!seenFaces.has(key)){seenFaces.add(key);faces.push(face)}};
  let vertices,color;
  if(visualMode==='cell600'){
    vertices=poly.v;color=0x245bd6;
    for(const ci of selected){
      const cell=poly.cells[ci];
      for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)addPair(cell[i],cell[j]);
      for(let k=0;k<4;k++)addFace(cell.filter((_,i)=>i!==k));
    }
  }else{
    vertices=dualVertices;color=0x6948cf;
    for(const [edgeKey,incidentCells] of primalEdgeCells){
      const [a,b]=edgeKey.split(',').map(Number);
      if(!selected.has(a)&&!selected.has(b))continue;
      const face=orderPentagon(incidentCells);
      if(face.length!==5)continue;
      addFace(face);
      for(let i=0;i<5;i++)addPair(face[i],face[(i+1)%5]);
    }
  }
  intersectionLines.material.color.setHex(color);
  intersectionWalls.material.color.setHex(color);
  intersectionLines.geometry.dispose();
  intersectionLines.geometry=new THREE.BufferGeometry().setFromPoints(sphericalSegmentPoints(vertices,pairs,32));
  intersectionWalls.geometry.dispose();
  intersectionWalls.geometry=sphericalFaceGeometry(vertices,faces,6);
}
function updateLimitCurves(){groups.extremes.visible=true}
function updateTorusGeometry(){if(visualMode==='hopf')buildHopfTorusGrid();else updateIntersectedCells(buildTorusCellGrid());updateLimitCurves()}
scene.add(new THREE.HemisphereLight(0xffffff,0xd9e3f0,1.45));const keyLight=new THREE.DirectionalLight(0xffffff,2.15);keyLight.position.set(4,7,5);scene.add(keyLight);

const facePositions=[],faceColors=[];
boundaryFaces.forEach((face,i)=>{const col=new THREE.Color().setHSL(.59+(i%10)*.006,.76,.48),ps=face.ids.map(id=>project(poly.v[id]));if(triangleVisible(ps[0],ps[1],ps[2]))for(const p of ps){facePositions.push(p.x,p.y,p.z);faceColors.push(col.r,col.g,col.b)}});
const faceGeo=new THREE.BufferGeometry();faceGeo.setAttribute('position',new THREE.Float32BufferAttribute(facePositions,3));faceGeo.setAttribute('color',new THREE.Float32BufferAttribute(faceColors,3));
const faceMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.56,side:THREE.DoubleSide,depthWrite:false});groups.boundary.add(new THREE.Mesh(faceGeo,faceMat));
const cellEdgeSet=new Set(),cellPairs=[];
for(const ci of boundaryCells){const c=poly.cells[ci];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const key=[c[i],c[j]].sort((x,y)=>x-y).join(',');if(!cellEdgeSet.has(key)){cellEdgeSet.add(key);cellPairs.push([c[i],c[j]])}}}
groups.boundary.add(lineSegments(cellPairs,0x194fb7,.82));

groups.extremes.visible=false;groups.hopf.visible=false;groups.cell.visible=false;groups.intersections.visible=false;groups.cell120.visible=false;groups.boundary.visible=false;groups.seam120.visible=false;
const modeLabel=document.querySelector('#mode-label'),sidebarMode=document.querySelector('#sidebar-mode');
const modeInputs=[...document.querySelectorAll('input[name="view-mode"]')];
function applyMode(mode){visualMode=mode;torusGridSource=mode;groups.cell.visible=mode==='cell600';groups.intersections.visible=mode!=='hopf';groups.cell120.visible=mode==='cell120';const label=mode==='hopf'?'HOPF':mode==='cell600'?'600-CELL':'120-CELL';sidebarMode.textContent=`${label} MODE`;modeLabel.textContent=mode==='hopf'?'HOPF FIBRATION':`${label} INTERSECTION`;document.querySelector('#atlas-card').classList.toggle('lit',mode==='cell600');updateTorusGeometry()}
modeInputs.forEach(input=>input.addEventListener('change',()=>{if(input.checked)applyMode(input.value)}));
const sidebar=document.querySelector('.controls'),sidebarTrigger=document.querySelector('#sidebar-trigger');sidebarTrigger.addEventListener('click',()=>{const open=sidebar.classList.toggle('open');sidebarTrigger.setAttribute('aria-expanded',String(open));if(!open)sidebarTrigger.blur()});
const opacity=document.querySelector('#opacity'),opacityValue=document.querySelector('#opacity-value');opacity.addEventListener('input',()=>{torusMaterial.opacity=+opacity.value/100;opacityValue.value=`${opacity.value}%`});
const morph=document.querySelector('#morph'),morphValue=document.querySelector('#morph-value');morph.value=(torusEta/(Math.PI/2)*100).toFixed(1);morphValue.value=`η ${(torusEta*180/Math.PI).toFixed(1)}°`;let morphFrame=0;morph.addEventListener('input',()=>{torusEta=+morph.value/100*Math.PI/2;morphValue.value=`η ${(torusEta*180/Math.PI).toFixed(1)}°`;cancelAnimationFrame(morphFrame);morphFrame=requestAnimationFrame(updateTorusGeometry)});applyMode('hopf');

const atlas=document.querySelector('#atlas-grid');
for(let i=0;i<100;i++){const el=document.createElement('button');el.className='atlas-cell';el.type='button';el.title=`Boundary tetrahedron ${i+1}`;el.setAttribute('aria-label',el.title);el.addEventListener('click',()=>{document.querySelectorAll('.atlas-cell.active').forEach(x=>x.classList.remove('active'));el.classList.add('active');const input600=document.querySelector('input[value="cell600"]');input600.checked=true;applyMode('cell600')});atlas.append(el)}

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();controls.target.set(0,0,0);camera.lookAt(controls.target);controls.update()}new ResizeObserver(resize).observe(stage);resize();
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
console.info(`600-cell: ${poly.v.length} vertices, ${poly.edges.length} edges, ${poly.cells.length} tetrahedra. 120-cell: ${dualVertices.length} vertices, ${dualEdges.length} edges. Torus seams: ${boundaryFaces.length} triangles / ${boundaryCells.length} tetrahedra; ${solidVertexSet.size}+${poly.v.length-solidVertexSet.size} dual cells / ${crossingEdges.length} pentagons.`);
