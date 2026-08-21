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
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.enablePan=false;controls.dampingFactor=.055;controls.minDistance=4;controls.maxDistance=32;
let walkView=false,renderFrameId=0;
function requestRender(){if(!renderFrameId)renderFrameId=requestAnimationFrame(renderScene)}
function renderScene(){renderFrameId=0;const moving=!walkView&&controls.update();renderer.render(scene,camera);if(moving)requestRender()}
controls.addEventListener('change',requestRender);

const groups={torus:new THREE.Group(),extremes:new THREE.Group(),hopf:new THREE.Group(),cell:new THREE.Group(),cell120:new THREE.Group(),walk:new THREE.Group()};
Object.values(groups).forEach(g=>scene.add(g));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>Math.sqrt(dot(a,a));
const normalize=a=>{const n=norm(a);return a.map(x=>x/n)};
const d2=(a,b)=>a.reduce((s,x,i)=>s+(x-b[i])**2,0);
let projectionPole,projectionAxes,projectionScale=1.05;
const PROJECTION_LIMIT=44,MAX_PROJECTED_EDGE=3.5,MAX_PROJECTED_FACE_EDGE=1.25;
function project(q){const den=1-dot(q,projectionPole);if(den<1e-9)return new THREE.Vector3(Infinity,Infinity,Infinity);const c=projectionAxes.map(axis=>dot(q,axis)/den);return new THREE.Vector3(c[1],c[2],c[0]).multiplyScalar(projectionScale)}
const projectionVisible=p=>Number.isFinite(p.x)&&p.length()<PROJECTION_LIMIT;
const segmentVisible=(a,b)=>projectionVisible(a)&&projectionVisible(b)&&a.distanceTo(b)<MAX_PROJECTED_EDGE;
const triangleVisible=(a,b,c)=>projectionVisible(a)&&projectionVisible(b)&&projectionVisible(c)&&a.distanceTo(b)<MAX_PROJECTED_FACE_EDGE&&b.distanceTo(c)<MAX_PROJECTED_FACE_EDGE&&c.distanceTo(a)<MAX_PROJECTED_FACE_EDGE;
const torusTriangleVisible=(a,b,c)=>projectionVisible(a)&&projectionVisible(b)&&projectionVisible(c)&&a.distanceTo(b)<MAX_PROJECTED_EDGE&&b.distanceTo(c)<MAX_PROJECTED_EDGE&&c.distanceTo(a)<MAX_PROJECTED_EDGE;

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
function orientProjectedTriangles(positions){for(let i=0;i<positions.length;i+=9){const ax=positions[i],ay=positions[i+1],az=positions[i+2],bx=positions[i+3],by=positions[i+4],bz=positions[i+5],cx=positions[i+6],cy=positions[i+7],cz=positions[i+8],ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(nx*(ax+bx+cx)+ny*(ay+by+cy)+nz*(az+bz+cz)<0){positions[i+3]=cx;positions[i+4]=cy;positions[i+5]=cz;positions[i+6]=bx;positions[i+7]=by;positions[i+8]=bz}}}
function checkerFaceGeometry(vertices,faces,subdivisions=6){
  const positions=[];
  for(const face of faces){
    const center=normalize([0,1,2,3].map(k=>face.reduce((sum,id)=>sum+vertices[id][k],0)));
    // A regular triangle becomes six congruent half-edge sectors; a regular
    // pentagon becomes ten. Paint alternating sectors, leaving equal-area holes.
    for(let i=0;i<face.length;i++){const a=vertices[face[i]],b=vertices[face[(i+1)%face.length]],mid=slerp(a,b,.5);appendSphericalTriangle(positions,center,a,mid,subdivisions)}
  }
  orientProjectedTriangles(positions);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();return geo;
}
function checkerFaces(vertices,faces,color,opacity,subdivisions=5){return new THREE.Mesh(checkerFaceGeometry(vertices,faces,subdivisions),new THREE.MeshPhongMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false,shininess:18}))}

// A decagonal great circle fixes the coordinate splitting used by the torus.
const a=0,b=[...poly.adjacency[a]][0],basisU=poly.v[a];
let raw=poly.v[b].map((x,i)=>x-dot(poly.v[b],basisU)*basisU[i]);const basisV=normalize(raw);

function complement(u,v){const out=[];for(const seed of [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]){let q=seed.map((x,i)=>x-dot(seed,u)*u[i]-dot(seed,v)*v[i]);for(const n of out)q=q.map((x,i)=>x-dot(q,n)*n[i]);if(norm(q)>1e-6)out.push(normalize(q));if(out.length===2)break}return out}
const [basisN,basisM]=complement(basisU,basisV);
// The overview pole moves along the shortest great-circle arc from one core to
// the other. At the endpoints one core becomes a line through infinity; at the
// midpoint the two projected core circles are congruent and Hopf linked.
const overviewCorePole=basisU.map((x,i)=>Math.cos(.17)*x+Math.sin(.17)*basisV[i]),overviewCoreTangent=basisU.map((x,i)=>-Math.sin(.17)*x+Math.cos(.17)*basisV[i]);
projectionPole=[...overviewCorePole];projectionAxes=[[...overviewCoreTangent],[...basisN],[...basisM]];
let overviewPole=[...projectionPole],overviewAxes=projectionAxes.map(axis=>[...axis]),overviewProjectionRevision=0;
const extremeMaterial=new THREE.MeshPhongMaterial({color:0xe32645,transparent:true,opacity:1,depthWrite:true,shininess:70}),extremeAxisMaterial=new THREE.MeshPhongMaterial({color:0xa21caf,transparent:true,opacity:1,depthWrite:true,shininess:70});
const extremeCircleGroup=new THREE.Group(),extremeAxisGroup=new THREE.Group();groups.extremes.add(extremeCircleGroup,extremeAxisGroup);
function clearTubeGroup(group){while(group.children.length){const child=group.children[0];group.remove(child);child.geometry.dispose()}}
function projectedCorePaths(axisA,axisB,steps=360){
  const paths=[];let current=[],previous=null;
  const flush=()=>{if(current.length>1)paths.push(current);current=[]};
  for(let i=0;i<=steps;i++){
    const t=i/steps*Math.PI*2,p=project(axisA.map((x,k)=>Math.cos(t)*x+Math.sin(t)*axisB[k]));
    if(projectionVisible(p)){if(previous&&segmentVisible(previous,p))current.push(p);else{flush();current=[p]}}else flush();previous=p;
  }
  flush();return paths;
}
function buildCoreTube(group,axisA,axisB,material){
  clearTubeGroup(group);
  for(const points of projectedCorePaths(axisA,axisB)){
    const closed=points.length>12&&points[0].distanceTo(points.at(-1))<.08;if(closed)points.pop();
    const curve=new THREE.CatmullRomCurve3(points,closed,'centripetal'),tube=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,points.length-1),.065,10,closed),material);tube.renderOrder=5;group.add(tube);
    if(!closed)for(const point of[points[0],points.at(-1)]){const cap=new THREE.Mesh(new THREE.SphereGeometry(.065,10,7),material);cap.position.copy(point);cap.renderOrder=5;group.add(cap)}
  }
}
function rebuildExtremes(){
  buildCoreTube(extremeCircleGroup,basisN,basisM,extremeAxisMaterial);buildCoreTube(extremeAxisGroup,basisU,basisV,extremeMaterial);
}
rebuildExtremes();

// Construct the dual 120-cell from the 600 tetrahedron centers. Two dual
// vertices share an edge exactly when the corresponding tetrahedra share a face.
const dualVertices=poly.cells.map(c=>normalize([0,1,2,3].map(k=>c.reduce((sum,id)=>sum+poly.v[id][k],0))));
const dualFaceMap=new Map();
poly.cells.forEach((c,ci)=>{for(let k=0;k<4;k++){const key=c.filter((_,j)=>j!==k).sort((x,y)=>x-y).join(',');if(!dualFaceMap.has(key))dualFaceMap.set(key,[]);dualFaceMap.get(key).push(ci)}});
const dualEdges=[...dualFaceMap.values()].filter(x=>x.length===2).map(x=>[x[0],x[1]]);
const cell600Faces=[...dualFaceMap.keys()].map(key=>key.split(',').map(Number));
function projectedSegments(vertices,pairs,color,opacity){return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sphericalSegmentPoints(vertices,pairs)),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}))}

const primalEdgeCells=new Map();
poly.cells.forEach((c,ci)=>{for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const key=[c[i],c[j]].sort((x,y)=>x-y).join(',');if(!primalEdgeCells.has(key))primalEdgeCells.set(key,[]);primalEdgeCells.get(key).push(ci)}});
function orderPentagon(ids){const ordered=[ids[0]],used=new Set(ordered);while(ordered.length<ids.length){const last=ordered.at(-1),next=ids.find(id=>!used.has(id)&&poly.cells[last].filter(x=>poly.cells[id].includes(x)).length===3);if(next===undefined)break;ordered.push(next);used.add(next)}return ordered}
const cell120Faces=[...primalEdgeCells.values()].map(orderPentagon).filter(face=>face.length===5);
const projectedPolytopeRevision={cell600:-1,cell120:-1};
function clearProjectionGroup(group){while(group.children.length){const child=group.children.pop();child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(material=>material.dispose());else child.material?.dispose()}}
function projectedPointCloud(vertices,radius,color,opacity,segments){
  const points=vertices.map(project).filter(projectionVisible),geometry=new THREE.SphereGeometry(radius,segments,segments),material=new THREE.MeshBasicMaterial({color,transparent:true,opacity}),mesh=new THREE.InstancedMesh(geometry,material,points.length),matrix=new THREE.Matrix4();
  points.forEach((point,index)=>{matrix.makeTranslation(point.x,point.y,point.z);mesh.setMatrixAt(index,matrix)});mesh.instanceMatrix.needsUpdate=true;return mesh;
}
function ensureProjectedPolytope(mode){
  if(mode!=='cell600'&&mode!=='cell120'||projectedPolytopeRevision[mode]===overviewProjectionRevision)return;
  if(mode==='cell600'){
    clearProjectionGroup(groups.cell);groups.cell.add(lineSegments(poly.edges,0x9b6700,.15),checkerFaces(poly.v,cell600Faces,0xb47700,.045,4),projectedPointCloud(poly.v,.035,0xb47700,.42,7));
  }else{
    clearProjectionGroup(groups.cell120);groups.cell120.add(projectedSegments(dualVertices,dualEdges,0x9f8cff,.14),checkerFaces(dualVertices,cell120Faces,0x8f78e8,.04,4),projectedPointCloud(dualVertices,.022,0xb8aaff,.3,5));
  }
  projectedPolytopeRevision[mode]=overviewProjectionRevision;
}
let torusEta=Math.acos(Math.sqrt((5+Math.sqrt(5))/10));
function torusPoint(u,v){const torusR=Math.cos(torusEta),torusr=Math.sin(torusEta);return basisU.map((_,i)=>torusR*(Math.cos(u)*basisU[i]+Math.sin(u)*basisV[i])+torusr*(Math.cos(v)*basisN[i]+Math.sin(v)*basisM[i]))}
const AMBIENT_HOPF_COUNT=48,goldenAngle=Math.PI*(3-Math.sqrt(5));
function hopfFiberPoint(eta,delta,t){return basisU.map((_,i)=>
  Math.cos(eta)*(Math.cos(t)*basisU[i]+Math.sin(t)*basisV[i])+
  Math.sin(eta)*(Math.cos(t+delta)*basisN[i]+Math.sin(t+delta)*basisM[i])
)}
const ambientHopfFibers=new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({color:0x6846c7,transparent:true,opacity:.2,depthWrite:false})
),selectedHopfFiber=new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({color:0x245bd6,transparent:true,opacity:1,depthWrite:false})
);
groups.hopf.add(ambientHopfFibers,selectedHopfFiber);
function rebuildAmbientHopf(){
  const points=[];
  for(let fiber=0;fiber<AMBIENT_HOPF_COUNT;fiber++){
    const baseZ=1-2*(fiber+.5)/AMBIENT_HOPF_COUNT,eta=.5*Math.acos(baseZ),delta=(fiber*goldenAngle)%(Math.PI*2);let previous=null;
    for(let step=0;step<=360;step++){const t=step/360*Math.PI*2,p=project(hopfFiberPoint(eta,delta,t));if(previous&&segmentVisible(previous,p))points.push(previous,p);previous=p}
  }
  ambientHopfFibers.geometry.dispose();ambientHopfFibers.geometry=new THREE.BufferGeometry().setFromPoints(points);
}
function updateSelectedHopfFiber(base){
  const eta=.5*Math.acos(THREE.MathUtils.clamp(base.z,-1,1)),delta=Math.atan2(base.y,base.x),points=[];
  let previous=null;
  for(let step=0;step<=720;step++){
    const t=step/720*Math.PI*2,p=project(hopfFiberPoint(eta,delta,t));
    if(previous&&segmentVisible(previous,p))points.push(previous,p);
    previous=p;
  }
  selectedHopfFiber.geometry.dispose();
  selectedHopfFiber.geometry=new THREE.BufferGeometry().setFromPoints(points);
}
rebuildAmbientHopf();
function colorGraph(count,edges){const neighbors=Array.from({length:count},()=>new Set());for(const[a,b]of edges){neighbors[a].add(b);neighbors[b].add(a)}const colors=Array(count).fill(-1);for(let done=0;done<count;done++){let pick=-1,bestSat=-1,bestDegree=-1;for(let i=0;i<count;i++)if(colors[i]<0){const sat=new Set([...neighbors[i]].map(n=>colors[n]).filter(c=>c>=0)).size,degree=neighbors[i].size;if(sat>bestSat||sat===bestSat&&degree>bestDegree){pick=i;bestSat=sat;bestDegree=degree}}const used=new Set([...neighbors[pick]].map(n=>colors[n]).filter(c=>c>=0));let color=0;while(used.has(color))color++;colors[pick]=color}return colors}
const torusPalettes={hopf:[0x245bd6,0x7255d9]};
const torusColorings={cell600:colorGraph(dualVertices.length,dualEdges),cell120:colorGraph(poly.v.length,poly.edges)};
const walkPalettes={cell600:[0x245bd6,0x00a0a8,0x7656d4],cell120:[0x245bd6,0x00a0a8,0x7656d4,0x16976f,0xb04fbf]};
function walkCellColor(mode,id){
  const source=mode==='cell120'?'cell120':'cell600',colorIndex=torusColorings[source][id],palette=walkPalettes[source];
  if(colorIndex<palette.length)return palette[colorIndex];
  return new THREE.Color().setHSL((colorIndex*.61803398875)%1,.68,.48).getHex();
}
let visualMode='hopf';
const torusMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false});
const torusSurface=new THREE.Mesh(new THREE.BufferGeometry(),torusMaterial);
const torusRulingA=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x007c91,transparent:true,opacity:.86,depthWrite:false}));
const torusRulingB=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x6846c7,transparent:true,opacity:.8,depthWrite:false}));
groups.torus.add(torusSurface,torusRulingA,torusRulingB);
function setTorusSurface(positions,colors){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));torusSurface.geometry.dispose();torusSurface.geometry=geo}
function midpointDeviation2(p,a,b){const x=p.x-(a.x+b.x)/2,y=p.y-(a.y+b.y)/2,z=p.z-(a.z+b.z)/2;return x*x+y*y+z*z}
function centerDeviation2(p,a,b,c,d){const x=p.x-(a.x+b.x+c.x+d.x)/4,y=p.y-(a.y+b.y+c.y+d.y)/4,z=p.z-(a.z+b.z+c.z+d.z)/4;return x*x+y*y+z*z}
function appendAdaptiveTorusPatch(pointAt,positions,colors,color,maxDepth=4){
  const sample=(s,t)=>{const [u,v]=pointAt(s,t);return project(torusPoint(u,v))};
  const addTriangle=(a,b,c)=>{if(!torusTriangleVisible(a,b,c))return;for(const p of[a,b,c]){positions.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b)}};
  function subdivide(s0,t0,s1,t1,p00,p10,p01,p11,depth){
    const sm=(s0+s1)/2,tm=(t0+t1)/2,p0m=sample(s0,tm),p1m=sample(s1,tm),pm0=sample(sm,t0),pm1=sample(sm,t1),pmm=sample(sm,tm);
    const samples=[p00,p10,p01,p11,p0m,p1m,pm0,pm1,pmm],allVisible=samples.every(projectionVisible);
    let refine=!allVisible;
    if(allVisible){
      const maxEdge2=Math.max(p00.distanceToSquared(p10),p10.distanceToSquared(p11),p11.distanceToSquared(p01),p01.distanceToSquared(p00));
      const maxCurve2=Math.max(midpointDeviation2(pm0,p00,p10),midpointDeviation2(pm1,p01,p11),midpointDeviation2(p0m,p00,p01),midpointDeviation2(p1m,p10,p11),centerDeviation2(pmm,p00,p10,p01,p11));
      refine=maxEdge2>.18||maxCurve2>.00032;
    }
    if(refine&&depth<maxDepth){
      subdivide(s0,t0,sm,tm,p00,pm0,p0m,pmm,depth+1);
      subdivide(sm,t0,s1,tm,pm0,p10,pmm,p1m,depth+1);
      subdivide(s0,tm,sm,t1,p0m,pmm,p01,pm1,depth+1);
      subdivide(sm,tm,s1,t1,pmm,p1m,pm1,p11,depth+1);
      return;
    }
    addTriangle(p00,p10,p01);addTriangle(p10,p11,p01);
  }
  subdivide(0,0,1,1,sample(0,0),sample(1,0),sample(0,1),sample(1,1),0);
}
function buildHopfTorusGrid(){
  const N=12,step=Math.PI*2/N,positions=[],colors=[],rulings=[[],[]],color=new THREE.Color(torusPalettes.hopf[1]);
  // In Hopf coordinates a=v-u and b=u+v, each tile edge is itself a fiber.
  // b runs through 4π so this rectangle covers the torus exactly once.
  for(let ia=0;ia<N;ia++)for(let ib=0;ib<2*N;ib++){
    if(((ia+ib)&1)===0)continue;
    const a0=ia*step,b0=ib*step;
    appendAdaptiveTorusPatch((s,t)=>{const a=a0+s*step,b=b0+t*step;return[(b-a)/2,(a+b)/2]},positions,colors,color);
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
  setTorusSurface(positions,colors);
  torusRulingA.geometry.dispose();
  torusRulingA.geometry=new THREE.BufferGeometry().setFromPoints(rulings[0]);
  torusRulingB.geometry.dispose();
  torusRulingB.geometry=new THREE.BufferGeometry().setFromPoints(rulings[1]);
  document.querySelector('#grid-description').textContent=`${AMBIENT_HOPF_COUNT} fibers through S³ · 12 + 12 on torus`;
}
function buildPlainTorus(){
  const NU=24,NV=16,du=Math.PI*2/NU,dv=Math.PI*2/NV,positions=[],colors=[];
  const color=new THREE.Color(visualMode==='cell120'?0x7656d4:0x245bd6);
  for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){
    const u0=i*du,v0=j*dv;
    appendAdaptiveTorusPatch((s,t)=>[u0+s*du,v0+t*dv],positions,colors,color);
  }
  setTorusSurface(positions,colors);
  for(const ruling of[torusRulingA,torusRulingB]){ruling.geometry.dispose();ruling.geometry=new THREE.BufferGeometry()}
  document.querySelector('#grid-description').textContent=`Full ${visualMode==='cell120'?'120':'600'}-cell · unpartitioned torus`;
}
function updateLimitCurves(){groups.extremes.visible=true}
function updateTorusGeometry(){if(visualMode==='hopf')buildHopfTorusGrid();else buildPlainTorus();updateLimitCurves()}
scene.add(new THREE.HemisphereLight(0xffffff,0xd9e3f0,1.45));const keyLight=new THREE.DirectionalLight(0xffffff,2.15);keyLight.position.set(4,7,5);scene.add(keyLight);

// A cell-centered atlas. The projection pole is kept antipodal to the current
// cell center, where stereographic scale is smallest and isotropic. Clicking a
// wall carries the tangent frame by the minimal rotation in S³.
let walkCell600=0,walkCell120=0,walkAnimating=false,hoveredPortal=null,insideYaw=0,insidePitch=0,insidePointer=false;
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),pointerDown=new THREE.Vector2();
const insideStartQuaternion=new THREE.Quaternion(),insideDeltaQuaternion=new THREE.Quaternion(),insideGrabDirection=new THREE.Vector3(),insideCandidateDirection=new THREE.Vector3();
const walkHint=document.querySelector('#walk-hint'),walkToggle=document.querySelector('#walk-toggle'),stageHelp=document.querySelector('#stage-help');
function nearestCenter(centers,target){let best=0,score=-Infinity;for(let i=0;i<centers.length;i++){const s=dot(centers[i],target);if(s>score){score=s;best=i}}return best}
const initialChartCenter=overviewPole.map(x=>-x);
walkCell600=nearestCenter(dualVertices,initialChartCenter);walkCell120=nearestCenter(poly.v,initialChartCenter);
function disposeGroup(group){while(group.children.length){const child=group.children.pop();child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else child.material?.dispose()}}
function faceNeighbor600(cellId,face){const owners=dualFaceMap.get([...face].sort((x,y)=>x-y).join(','));return owners?.find(id=>id!==cellId)}
const cell600Adjacency=Array.from({length:poly.cells.length},()=>new Set());for(const[a,b]of dualEdges){cell600Adjacency[a].add(b);cell600Adjacency[b].add(a)}
function walkNeighbors(mode,id){return mode==='cell120'?[...poly.adjacency[id]]:[...cell600Adjacency[id]]}
function walkCellFaces(mode,id){
  if(mode==='cell120')return walkNeighbors(mode,id).map(neighbor=>({neighbor,vertices:dualVertices,face:orderPentagon(primalEdgeCells.get([id,neighbor].sort((x,y)=>x-y).join(',')))}));
  const cell=poly.cells[id];return cell.map((_,k)=>{const face=cell.filter((__,j)=>j!==k);return{neighbor:faceNeighbor600(id,face),vertices:poly.v,face}});
}
function walkFaces(){
  return walkCellFaces(visualMode,visualMode==='cell120'?walkCell120:walkCell600);
}
function portalPatternGeometry(vertices,face){
  return checkerFaceGeometry(vertices,[face],6);
}
function rebuildWalkCell(includeContext=true){
  disposeGroup(groups.walk);
  const faces=walkFaces(),currentId=visualMode==='cell120'?walkCell120:walkCell600,currentColor=walkCellColor(visualMode,currentId);
  const allPairs=[],seen=new Set();
  faces.forEach((entry,index)=>{
    // The face is one geometric sheet. Its tint previews the cell reached by
    // crossing it; after crossing, the reverse portal is tinted with the old
    // cell's stable graph color. This avoids doubled coplanar transparent walls.
    const destinationColor=walkCellColor(visualMode,entry.neighbor),innerGeometry=portalPatternGeometry(entry.vertices,entry.face),outerGeometry=innerGeometry.clone();
    const innerPattern=new THREE.Mesh(innerGeometry,new THREE.MeshPhongMaterial({color:currentColor,side:THREE.BackSide,shininess:25})),outerPattern=new THREE.Mesh(outerGeometry,new THREE.MeshPhongMaterial({color:destinationColor,side:THREE.FrontSide,shininess:25}));innerPattern.renderOrder=2;outerPattern.renderOrder=2;
    const mesh=new THREE.Mesh(sphericalFaceGeometry(entry.vertices,[entry.face],8),new THREE.MeshBasicMaterial({transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,colorWrite:false}));
    mesh.userData={portal:true,neighbor:entry.neighbor,face:index,visuals:[innerPattern,outerPattern]};mesh.renderOrder=3;groups.walk.add(innerPattern,outerPattern,mesh);
    for(let i=0;i<entry.face.length;i++){const a=entry.face[i],b=entry.face[(i+1)%entry.face.length],key=a<b?`${a},${b}`:`${b},${a}`;if(!seen.has(key)){seen.add(key);allPairs.push([a,b])}}
  });
  const vertices=faces[0]?.vertices||poly.v;
  const outline=projectedSegments(vertices,allPairs,currentColor,.96);outline.renderOrder=3;groups.walk.add(outline);
  if(!includeContext)return;

  // Neighbor shells remain visible through the current transparent walls.
  // Immediate neighbors get faint surfaces; graph-distance-two cells are only
  // edge traces, so the complex recedes without becoming an opaque thicket.
  const immediate=walkNeighbors(visualMode,currentId),nearSet=new Set([currentId,...immediate]),faceBuckets=new Map(),nearEdgeBuckets=new Map(),seenFaces=new Set();
  for(const cellId of immediate){
    const color=walkCellColor(visualMode,cellId);if(!nearEdgeBuckets.has(color))nearEdgeBuckets.set(color,{pairs:[],seen:new Set()});const edgeBucket=nearEdgeBuckets.get(color);
    for(const entry of walkCellFaces(visualMode,cellId)){
      for(let i=0;i<entry.face.length;i++){const a=entry.face[i],b=entry.face[(i+1)%entry.face.length],edgeKey=a<b?`${a},${b}`:`${b},${a}`;if(!edgeBucket.seen.has(edgeKey)){edgeBucket.seen.add(edgeKey);edgeBucket.pairs.push([a,b])}}
      if(entry.neighbor===currentId)continue;
      const key=[...entry.face].sort((a,b)=>a-b).join(',');if(seenFaces.has(key))continue;seenFaces.add(key);if(!faceBuckets.has(color))faceBuckets.set(color,[]);faceBuckets.get(color).push(entry.face);
    }
  }
  for(const[color,shellFaces]of faceBuckets){const shell=new THREE.Mesh(checkerFaceGeometry(vertices,shellFaces,5),new THREE.MeshPhongMaterial({color,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false,shininess:18}));shell.renderOrder=0;groups.walk.add(shell)}
  for(const[color,bucket]of nearEdgeBuckets){const trace=projectedSegments(vertices,bucket.pairs,color,.52);trace.renderOrder=1;groups.walk.add(trace)}
  const far=new Set();for(const cellId of immediate)for(const next of walkNeighbors(visualMode,cellId))if(!nearSet.has(next))far.add(next);
  const edgeBuckets=new Map();
  for(const cellId of far){const color=walkCellColor(visualMode,cellId);if(!edgeBuckets.has(color))edgeBuckets.set(color,{pairs:[],seen:new Set()});const bucket=edgeBuckets.get(color);for(const entry of walkCellFaces(visualMode,cellId))for(let i=0;i<entry.face.length;i++){const a=entry.face[i],b=entry.face[(i+1)%entry.face.length],key=a<b?`${a},${b}`:`${b},${a}`;if(!bucket.seen.has(key)){bucket.seen.add(key);bucket.pairs.push([a,b])}}}
  for(const[color,bucket]of edgeBuckets){const trace=projectedSegments(vertices,bucket.pairs,color,.2);trace.renderOrder=-1;groups.walk.add(trace)}
}
function rotateFromTo(v,a,b){
  const c=Math.max(-1,Math.min(1,dot(a,b)));if(c>.999999)return [...v];
  const s=Math.sqrt(Math.max(1e-12,1-c*c)),e2=b.map((x,i)=>(x-c*a[i])/s),x=dot(v,a),y=dot(v,e2);
  return v.map((value,i)=>value+((x*c-y*s)-x)*a[i]+((x*s+y*c)-y)*e2[i]);
}
function setWalkChart(center,axes){projectionPole=center.map(x=>-x);projectionAxes=axes;projectionScale=7.2}
function updateInsideCamera(){const cp=Math.cos(insidePitch),direction=new THREE.Vector3(cp*Math.cos(insideYaw),cp*Math.sin(insideYaw),Math.sin(insidePitch));camera.position.set(0,0,0);camera.up.set(0,0,1);camera.lookAt(direction);camera.updateMatrixWorld()}
function aimInsideAtFirstFace(){const entry=walkFaces()[0];if(!entry)return;const center=normalize([0,1,2,3].map(k=>entry.face.reduce((sum,id)=>sum+entry.vertices[id][k],0))),p=project(center),r=p.length();if(!Number.isFinite(r)||r<1e-6)return;insideYaw=Math.atan2(p.y,p.x);insidePitch=Math.asin(Math.max(-1,Math.min(1,p.z/r)));updateInsideCamera()}
function tangentFrame(center,seeds){
  const frame=[];
  for(const seed of [...seeds,basisU,basisV,basisN,basisM]){
    let q=seed.map((x,i)=>x-dot(seed,center)*center[i]);
    for(const axis of frame)q=q.map((x,i)=>x-dot(q,axis)*axis[i]);
    if(norm(q)>1e-5)frame.push(normalize(q));
    if(frame.length===3)break;
  }
  return frame;
}
function rebuildChart(includeTorus=true){
  rebuildExtremes();
  if(visualMode==='hopf'){rebuildAmbientHopf();updateSelectedHopfFiber(hopfBaseVector)}
  rebuildWalkCell();
  if(includeTorus)updateTorusGeometry();
}
function currentWalkCenter(){return visualMode==='cell120'?poly.v[walkCell120]:dualVertices[walkCell600]}
function enterWalkCell(neighbor){
  if(walkAnimating||neighbor===undefined)return;
  const startCenter=currentWalkCenter(),startAxes=projectionAxes.map(axis=>[...axis]);
  if(visualMode==='cell120')walkCell120=neighbor;else walkCell600=neighbor;
  const endCenter=currentWalkCenter(),started=performance.now();walkAnimating=true;hoveredPortal=null;
  function frame(now){
    const raw=Math.min(1,(now-started)/520),t=raw*raw*(3-2*raw),center=slerp(startCenter,endCenter,t),axes=startAxes.map(axis=>rotateFromTo(axis,startCenter,center));
    setWalkChart(center,axes);rebuildWalkCell(false);requestRender();
    if(visualMode==='hopf'){rebuildAmbientHopf();updateSelectedHopfFiber(hopfBaseVector)}
    if(raw<1)requestAnimationFrame(frame);else{walkAnimating=false;rebuildChart(false);writeViewUrl('replace')}
  }
  requestAnimationFrame(frame);
}
function writeViewUrl(action){
  if(!action)return;const url=new URL(location.href);if(walkView){url.searchParams.set('view','walk');url.searchParams.set('cell',String(visualMode==='cell120'?walkCell120:walkCell600))}else{url.searchParams.delete('view');url.searchParams.delete('cell')}history[`${action}State`](null,'',url);
}
function setWalkView(active,urlAction='push'){
  walkView=active;document.body.classList.toggle('walking',active);walkToggle.setAttribute('aria-pressed',String(active));walkToggle.textContent=active?'OUTSIDE VIEW':'INSIDE VIEW';walkHint.hidden=!active;groups.walk.visible=active;groups.torus.visible=!active;groups.extremes.visible=!active;groups.cell.visible=!active&&visualMode==='cell600';groups.cell120.visible=!active&&visualMode==='cell120';
  const label=visualMode==='hopf'?'HOPF':visualMode==='cell600'?'600-CELL':'120-CELL';modeLabel.textContent=`${label} · ${active?'INSIDE':'OUTSIDE'} VIEW`;
  if(active){
    const requested=Number(new URL(location.href).searchParams.get('cell'));
    if(Number.isInteger(requested)){if(visualMode==='cell120'&&requested>=0&&requested<120)walkCell120=requested;else if(visualMode!=='cell120'&&requested>=0&&requested<600)walkCell600=requested}
    const center=currentWalkCenter(),baseAxis=tangentFrame(center,overviewAxes);setWalkChart(center,baseAxis);
    controls.enabled=false;camera.near=.015;camera.fov=72;camera.updateProjectionMatrix();rebuildChart(false);aimInsideAtFirstFace();
  }else{
    controls.enabled=true;camera.near=.05;camera.fov=38;camera.updateProjectionMatrix();projectionPole=[...overviewPole];projectionAxes=overviewAxes.map(axis=>[...axis]);projectionScale=1.05;ensureProjectedPolytope(visualMode);controls.minDistance=4;controls.maxDistance=32;camera.up.set(0,0,1);camera.position.set(7.4,8.8,13);controls.target.set(0,0,0);camera.lookAt(controls.target);controls.update();groups.walk.visible=false;groups.torus.visible=true;groups.extremes.visible=true;rebuildExtremes();rebuildAmbientHopf();updateSelectedHopfFiber(hopfBaseVector);updateTorusGeometry();
  }
  stageHelp.textContent=active?'DRAG TO LOOK · CLICK A FACE TO CROSS':'DRAG TO ORBIT · SCROLL TO ZOOM';
  requestRender();
  writeViewUrl(urlAction);
}
walkToggle.addEventListener('click',()=>setWalkView(!walkView));
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&walkView)setWalkView(false)});
function portalAtEvent(event){const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(groups.walk.children.filter(x=>x.userData.portal))[0]?.object||null}
function setPortalHover(portal,active){for(const visual of portal?.userData.visuals||[]){visual.material.emissive.setHex(active?0xffffff:0x000000);visual.material.emissiveIntensity=active?.2:0}requestRender()}
function localRayAtEvent(event){
  const rect=renderer.domElement.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*2-1,y=-(event.clientY-rect.top)/rect.height*2+1,tanHalfFov=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));
  return new THREE.Vector3(x*tanHalfFov*camera.aspect,y*tanHalfFov,-1).normalize();
}
renderer.domElement.addEventListener('pointerdown',event=>{
  pointerDown.set(event.clientX,event.clientY);insidePointer=walkView;renderer.domElement.setPointerCapture(event.pointerId);
  if(insidePointer){insideStartQuaternion.copy(camera.quaternion);insideGrabDirection.copy(localRayAtEvent(event)).applyQuaternion(insideStartQuaternion);renderer.domElement.style.cursor='grabbing'}
});
renderer.domElement.addEventListener('pointermove',event=>{
  if(!walkView||walkAnimating)return;if(insidePointer){insideCandidateDirection.copy(localRayAtEvent(event)).applyQuaternion(insideStartQuaternion);insideDeltaQuaternion.setFromUnitVectors(insideCandidateDirection,insideGrabDirection);camera.quaternion.copy(insideDeltaQuaternion).multiply(insideStartQuaternion);camera.position.set(0,0,0);camera.updateMatrixWorld();requestRender()}
  const hit=portalAtEvent(event);if(hit===hoveredPortal)return;setPortalHover(hoveredPortal,false);hoveredPortal=hit;setPortalHover(hoveredPortal,true);renderer.domElement.style.cursor=insidePointer?'grabbing':hoveredPortal?'pointer':'grab';
});
renderer.domElement.addEventListener('pointerup',event=>{insidePointer=false;renderer.domElement.style.cursor=hoveredPortal?'pointer':'grab';renderer.domElement.releasePointerCapture(event.pointerId);if(!walkView||walkAnimating||Math.hypot(event.clientX-pointerDown.x,event.clientY-pointerDown.y)>5)return;const portal=portalAtEvent(event);if(portal)enterWalkCell(portal.userData.neighbor)});
renderer.domElement.addEventListener('pointercancel',event=>{insidePointer=false;if(renderer.domElement.hasPointerCapture(event.pointerId))renderer.domElement.releasePointerCapture(event.pointerId);renderer.domElement.style.cursor=walkView?'grab':''});

groups.extremes.visible=false;groups.hopf.visible=false;groups.cell.visible=false;groups.cell120.visible=false;
const modeLabel=document.querySelector('#mode-label'),sidebarMode=document.querySelector('#sidebar-mode');
const modeInputs=[...document.querySelectorAll('input[name="view-mode"]')];
const hopfBaseControl=document.querySelector('#hopf-base-control'),hopfBase=document.querySelector('#hopf-base'),hopfBasePoint=document.querySelector('#hopf-base-point'),hopfBaseHalo=document.querySelector('#hopf-base-halo');
const hopfPoleNorth=document.querySelector('#hopf-pole-north'),hopfPoleSouth=document.querySelector('#hopf-pole-south'),hopfGridPaths=[document.querySelector('#base-grid-x'),document.querySelector('#base-grid-y'),document.querySelector('#base-grid-z')],hopfTorusFront=document.querySelector('#hopf-torus-front'),hopfTorusBack=document.querySelector('#hopf-torus-back'),hopfTorusHandle=document.querySelector('#hopf-torus-handle'),hopfTorusHandleHit=document.querySelector('#hopf-torus-handle-hit');
const hopfBaseVector=new THREE.Vector3(Math.sqrt(1-.42**2)*Math.cos(-.62),Math.sqrt(1-.42**2)*Math.sin(-.62),.42);
const hopfBaseOrientation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),hopfDragStartOrientation=new THREE.Quaternion(),hopfDragStartVector=new THREE.Vector3(),hopfDragDelta=new THREE.Quaternion();
let hopfDragMode='',hopfSelectionFrame=0,torusSelectionFrame=0;
function basePath(pointAt){let path='';for(let i=0;i<=96;i++){const p=pointAt(i/96*Math.PI*2).applyQuaternion(hopfBaseOrientation);path+=`${i?'L':'M'}${p.x.toFixed(4)},${(-p.y).toFixed(4)}`}return path}
function updateHopfTorusCircle(){
  const z=Math.cos(2*torusEta),radius=Math.sqrt(Math.max(0,1-z*z));let front='',back='',previousSide='',handlePoint=null;
  for(let i=0;i<=128;i++){const t=i/128*Math.PI*2,p=new THREE.Vector3(radius*Math.cos(t),radius*Math.sin(t),z).applyQuaternion(hopfBaseOrientation),side=p.z>=0?'front':'back',command=side===previousSide?'L':'M',part=`${command}${p.x.toFixed(4)},${(-p.y).toFixed(4)}`;if(side==='front')front+=part;else back+=part;previousSide=side;if(!handlePoint||p.z>handlePoint.z)handlePoint=p}
  hopfTorusFront.setAttribute('d',front);hopfTorusBack.setAttribute('d',back);
  for(const handle of[hopfTorusHandle,hopfTorusHandleHit]){handle.setAttribute('cx',handlePoint.x);handle.setAttribute('cy',-handlePoint.y)}
  hopfTorusHandle.setAttribute('aria-valuenow',z.toFixed(3));
}
function updateHopfBaseDisplay(){
  const display=hopfBaseVector.clone().applyQuaternion(hopfBaseOrientation);
  for(const point of[hopfBasePoint,hopfBaseHalo]){point.setAttribute('cx',display.x);point.setAttribute('cy',-display.y);point.style.opacity=String(.45+.55*Math.max(0,display.z))}
  const poles=[[hopfPoleNorth,new THREE.Vector3(0,0,1)],[hopfPoleSouth,new THREE.Vector3(0,0,-1)]];
  for(const[element,pole]of poles){const p=pole.applyQuaternion(hopfBaseOrientation);element.setAttribute('cx',p.x);element.setAttribute('cy',-p.y);element.style.opacity=String(p.z>=0?1:.38)}
  hopfGridPaths[0].setAttribute('d',basePath(t=>new THREE.Vector3(0,Math.cos(t),Math.sin(t))));
  hopfGridPaths[1].setAttribute('d',basePath(t=>new THREE.Vector3(Math.cos(t),0,Math.sin(t))));
  hopfGridPaths[2].setAttribute('d',basePath(t=>new THREE.Vector3(Math.cos(t),Math.sin(t),0)));
  updateHopfTorusCircle();
}
function setHopfBaseVector(vector){
  hopfBaseVector.copy(vector).normalize();updateHopfBaseDisplay();cancelAnimationFrame(hopfSelectionFrame);
  hopfSelectionFrame=requestAnimationFrame(()=>{if(visualMode==='hopf')updateSelectedHopfFiber(hopfBaseVector);requestRender()});
}
function setTorusLatitude(z){
  torusEta=.5*Math.acos(THREE.MathUtils.clamp(z,-1,1));updateHopfBaseDisplay();cancelAnimationFrame(torusSelectionFrame);
  torusSelectionFrame=requestAnimationFrame(()=>{if(!walkView)updateTorusGeometry();requestRender()});
}
function hopfScreenPoint(event){const rect=hopfBase.getBoundingClientRect();return new THREE.Vector2((event.clientX-rect.left)/rect.width*2.24-1.12,-((event.clientY-rect.top)/rect.height*2.24-1.12))}
function hopfTrackball(point){const vector=new THREE.Vector3(point.x,point.y,0),r2=vector.x*vector.x+vector.y*vector.y;if(r2>1)vector.multiplyScalar(1/Math.sqrt(r2));else vector.z=Math.sqrt(1-r2);return vector}
function setHopfBaseFromScreen(point){
  const displayedPoles=[[new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,1).applyQuaternion(hopfBaseOrientation)],[new THREE.Vector3(0,0,-1),new THREE.Vector3(0,0,-1).applyQuaternion(hopfBaseOrientation)]];
  for(const[pole,display]of displayedPoles)if(Math.hypot(point.x-display.x,point.y-display.y)<.11){setHopfBaseVector(pole);return}
  const display=hopfTrackball(point),inverse=hopfBaseOrientation.clone().invert();setHopfBaseVector(display.applyQuaternion(inverse));
}
function setTorusFromScreen(point){const display=hopfTrackball(point),inverse=hopfBaseOrientation.clone().invert();setTorusLatitude(display.applyQuaternion(inverse).z)}
hopfBase.addEventListener('pointerdown',event=>{
  const point=hopfScreenPoint(event),pole=event.target.closest?.('[data-pole]');hopfBase.setPointerCapture(event.pointerId);hopfBase.classList.add('dragging');
  if(event.target===hopfTorusHandle||event.target===hopfTorusHandleHit){event.preventDefault();hopfDragMode='torus';setTorusFromScreen(point)}
  else if(pole){hopfDragMode='point';setHopfBaseVector(new THREE.Vector3(0,0,pole.dataset.pole==='north'?1:-1))}
  else if(event.target===hopfBasePoint||event.target===hopfBaseHalo){hopfDragMode='point';setHopfBaseFromScreen(point)}
  else{hopfDragMode='sphere';hopfDragStartVector.copy(hopfTrackball(point));hopfDragStartOrientation.copy(hopfBaseOrientation)}
});
hopfBase.addEventListener('pointermove',event=>{if(!hopfBase.hasPointerCapture(event.pointerId))return;const point=hopfScreenPoint(event);if(hopfDragMode==='point')setHopfBaseFromScreen(point);else if(hopfDragMode==='torus')setTorusFromScreen(point);else if(hopfDragMode==='sphere'){hopfDragDelta.setFromUnitVectors(hopfDragStartVector,hopfTrackball(point));hopfBaseOrientation.copy(hopfDragDelta).multiply(hopfDragStartOrientation).normalize();updateHopfBaseDisplay()}});
function endHopfDrag(event){hopfDragMode='';hopfBase.classList.remove('dragging');if(hopfBase.hasPointerCapture(event.pointerId))hopfBase.releasePointerCapture(event.pointerId)}
hopfBase.addEventListener('pointerup',endHopfDrag);hopfBase.addEventListener('pointercancel',endHopfDrag);
hopfBase.addEventListener('keydown',event=>{const step=event.shiftKey ? .1 : .035,display=hopfBaseVector.clone().applyQuaternion(hopfBaseOrientation);if(event.key==='ArrowLeft')display.x-=step;else if(event.key==='ArrowRight')display.x+=step;else if(event.key==='ArrowUp')display.y+=step;else if(event.key==='ArrowDown')display.y-=step;else return;setHopfBaseFromScreen(display);event.preventDefault()});
hopfTorusHandle.addEventListener('keydown',event=>{const step=event.shiftKey?.1:.035,z=Math.cos(2*torusEta);if(event.key==='ArrowUp'||event.key==='ArrowRight')setTorusLatitude(z+step);else if(event.key==='ArrowDown'||event.key==='ArrowLeft')setTorusLatitude(z-step);else return;event.stopPropagation();event.preventDefault()});
updateHopfBaseDisplay();updateSelectedHopfFiber(hopfBaseVector);
const publicModeNames={hopf:'hopf',cell600:'600-cell',cell120:'120-cell'};
const internalModeNames={hopf:'hopf','600-cell':'cell600','120-cell':'cell120'};
function modeFromUrl(){return internalModeNames[new URL(location.href).searchParams.get('mode')]||'hopf'}
function writeModeUrl(mode,action){
  if(!action)return;
  const url=new URL(location.href),publicName=publicModeNames[mode];
  if(action==='push'&&url.searchParams.get('mode')===publicName)return;
  url.searchParams.set('mode',publicName);
  history[`${action}State`](null,'',url);
}
function applyMode(mode,urlAction){
  visualMode=mode;groups.hopf.visible=mode==='hopf';hopfBaseControl.hidden=false;groups.cell.visible=!walkView&&mode==='cell600';groups.cell120.visible=!walkView&&mode==='cell120';
  const label=mode==='hopf'?'HOPF':mode==='cell600'?'600-CELL':'120-CELL';sidebarMode.textContent=`${label} MODE`;modeLabel.textContent=`${label} · ${walkView?'INSIDE':'OUTSIDE'} VIEW`;document.title=`${label} — Seeing the 3-sphere, from within`;writeModeUrl(mode,urlAction);
  if(walkView){const center=currentWalkCenter();setWalkChart(center,tangentFrame(center,projectionAxes));rebuildChart(false);writeViewUrl('replace')}else{ensureProjectedPolytope(mode);updateTorusGeometry()}
  requestRender();
}
function selectMode(mode,urlAction){const input=modeInputs.find(candidate=>candidate.value===mode);if(input)input.checked=true;applyMode(mode,urlAction)}
modeInputs.forEach(input=>input.addEventListener('change',()=>{if(input.checked)applyMode(input.value,'push')}));
window.addEventListener('popstate',()=>{selectMode(modeFromUrl());setWalkView(new URL(location.href).searchParams.get('view')==='walk',null)});
const sidebar=document.querySelector('.controls'),sidebarTrigger=document.querySelector('#sidebar-trigger');sidebarTrigger.addEventListener('click',()=>{const open=sidebar.classList.toggle('open');sidebarTrigger.setAttribute('aria-expanded',String(open));if(!open)sidebarTrigger.blur()});
const opacity=document.querySelector('#opacity'),opacityValue=document.querySelector('#opacity-value');opacity.addEventListener('input',()=>{torusMaterial.opacity=+opacity.value/100;opacityValue.value=`${opacity.value}%`;requestRender()});
const projectionControl=document.querySelector('#projection-point'),projectionStops=[...document.querySelectorAll('[data-projection-stop]')];let projectionFrame=0,projectionSnapFrame=0,lastPolytopeProjection=0;
function updateOverviewProjection(forcePolytope=false){
  const amount=+projectionControl.value/100,angle=amount*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);
  overviewPole=overviewCorePole.map((x,i)=>c*x+s*basisN[i]);overviewAxes=[overviewCoreTangent.map((x,i)=>c*x+s*basisM[i]),basisN.map((x,i)=>c*x-s*overviewCorePole[i]),basisM.map((x,i)=>c*x-s*overviewCoreTangent[i])];
  if(walkView)return;projectionPole=[...overviewPole];projectionAxes=overviewAxes.map(axis=>[...axis]);projectionScale=1.05;overviewProjectionRevision++;
  const now=performance.now();if(forcePolytope||now-lastPolytopeProjection>180){ensureProjectedPolytope(visualMode);lastPolytopeProjection=now}
  rebuildExtremes();rebuildAmbientHopf();updateSelectedHopfFiber(hopfBaseVector);updateTorusGeometry();requestRender();
}
projectionControl.addEventListener('input',()=>{cancelAnimationFrame(projectionSnapFrame);cancelAnimationFrame(projectionFrame);projectionFrame=requestAnimationFrame(()=>updateOverviewProjection(false))});
projectionControl.addEventListener('change',()=>updateOverviewProjection(true));
function glideProjectionTo(target){
  cancelAnimationFrame(projectionSnapFrame);const start=+projectionControl.value,started=performance.now(),duration=900;
  function glide(now){const raw=Math.min(1,(now-started)/duration),t=raw<.5?4*raw*raw*raw:1-(-2*raw+2)**3/2;projectionControl.value=start+(target-start)*t;updateOverviewProjection(raw===1);if(raw<1)projectionSnapFrame=requestAnimationFrame(glide)}
  projectionSnapFrame=requestAnimationFrame(glide);
}
projectionStops.forEach(stop=>stop.addEventListener('click',()=>glideProjectionTo(+stop.dataset.projectionStop)));
selectMode(modeFromUrl(),'replace');if(new URL(location.href).searchParams.get('view')==='walk')setWalkView(true,null);

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(walkView){camera.position.set(0,0,0);camera.updateMatrixWorld()}else{controls.target.set(0,0,0);camera.lookAt(controls.target);controls.update()}requestRender()}new ResizeObserver(resize).observe(stage);resize();
requestRender();
console.info(`600-cell: ${poly.v.length} vertices, ${poly.edges.length} edges, ${poly.cells.length} tetrahedra. 120-cell: ${dualVertices.length} vertices, ${dualEdges.length} edges.`);
