import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const PHI=(1+Math.sqrt(5))/2, EPS=1e-7;
const stage=document.querySelector('#stage');
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x080d14,.025);
const camera=new THREE.PerspectiveCamera(38,1,.05,160);
camera.position.set(8.2,5.6,9.4);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.append(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=4;controls.maxDistance=32;

const groups={torus:new THREE.Group(),hopf:new THREE.Group(),cell:new THREE.Group(),cell120:new THREE.Group(),boundary:new THREE.Group(),seam120:new THREE.Group()};
Object.values(groups).forEach(g=>scene.add(g));
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const norm=a=>Math.sqrt(dot(a,a));
const normalize=a=>{const n=norm(a);return a.map(x=>x/n)};
const d2=(a,b)=>a.reduce((s,x,i)=>s+(x-b[i])**2,0);
let projectionPole,projectionAxes;
function project(q){const den=Math.max(.04,1-dot(q,projectionPole));return new THREE.Vector3(...projectionAxes.map(axis=>dot(q,axis)/den)).multiplyScalar(1.05)}

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
function lineSegments(pairs,color,opacity){const pts=[];for(const[a,b]of pairs){const pa=project(poly.v[a]),pb=project(poly.v[b]);if(pa.length()<42&&pb.length()<42)pts.push(pa,pb)}const geo=new THREE.BufferGeometry().setFromPoints(pts),mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});return new THREE.LineSegments(geo,mat)}

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
groups.cell.add(lineSegments(poly.edges,0xf3c75b,.28));
const vertexGeo=new THREE.SphereGeometry(.035,7,7),vertexMat=new THREE.MeshBasicMaterial({color:0xffd971,transparent:true,opacity:.8});
for(const q of poly.v){const p=project(q);if(p.length()<42){const m=new THREE.Mesh(vertexGeo,vertexMat);m.position.copy(p);groups.cell.add(m)}}

// Construct the dual 120-cell from the 600 tetrahedron centers. Two dual
// vertices share an edge exactly when the corresponding tetrahedra share a face.
const dualVertices=poly.cells.map(c=>normalize([0,1,2,3].map(k=>c.reduce((sum,id)=>sum+poly.v[id][k],0))));
const dualFaceMap=new Map();
poly.cells.forEach((c,ci)=>{for(let k=0;k<4;k++){const key=c.filter((_,j)=>j!==k).sort((x,y)=>x-y).join(',');if(!dualFaceMap.has(key))dualFaceMap.set(key,[]);dualFaceMap.get(key).push(ci)}});
const dualEdges=[...dualFaceMap.values()].filter(x=>x.length===2).map(x=>[x[0],x[1]]);
function projectedSegments(vertices,pairs,color,opacity){const pts=[];for(const[a,b]of pairs){const pa=project(vertices[a]),pb=project(vertices[b]);if(pa.length()<42&&pb.length()<42)pts.push(pa,pb)}return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}))}
groups.cell120.add(projectedSegments(dualVertices,dualEdges,0x9f8cff,.34));
const dualPointGeo=new THREE.SphereGeometry(.022,5,5),dualPointMat=new THREE.MeshBasicMaterial({color:0xb8aaff,transparent:true,opacity:.68});
for(const q of dualVertices){const p=project(q);if(p.length()<42){const m=new THREE.Mesh(dualPointGeo,dualPointMat);m.position.copy(p);groups.cell120.add(m)}}

// The 60 vertices belonging to the decagonal solid torus select 60 dual
// dodecahedra. A primal edge crossing that partition is dual to one pentagonal
// face in the common torus boundary.
const solidVertexSet=new Set(solid.flatMap(({c})=>c));
const crossingEdges=poly.edges.filter(([x,y])=>solidVertexSet.has(x)!==solidVertexSet.has(y));
const primalEdgeCells=new Map();
poly.cells.forEach((c,ci)=>{for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const key=[c[i],c[j]].sort((x,y)=>x-y).join(',');if(!primalEdgeCells.has(key))primalEdgeCells.set(key,[]);primalEdgeCells.get(key).push(ci)}});
function orderPentagon(ids){const ordered=[ids[0]],used=new Set(ordered);while(ordered.length<ids.length){const last=ordered.at(-1),next=ids.find(id=>!used.has(id)&&poly.cells[last].filter(x=>poly.cells[id].includes(x)).length===3);if(next===undefined)break;ordered.push(next);used.add(next)}return ordered}
const seamPairs=[];
for(const edge of crossingEdges){const ids=primalEdgeCells.get([...edge].sort((x,y)=>x-y).join(',')),cycle=orderPentagon(ids);if(cycle.length===5)for(let i=0;i<5;i++)seamPairs.push([cycle[i],cycle[(i+1)%5]])}
groups.seam120.add(projectedSegments(dualVertices,seamPairs,0xe58cff,.78));
const torusR=Math.sqrt((5+Math.sqrt(5))/10),torusr=Math.sqrt(1-torusR*torusR);
function torusPoint(u,v){return basisU.map((_,i)=>torusR*(Math.cos(u)*basisU[i]+Math.sin(u)*basisV[i])+torusr*(Math.cos(v)*basisN[i]+Math.sin(v)*basisM[i]))}
const NU=80,NV=42,positions=[],indices=[];
for(let i=0;i<=NU;i++)for(let j=0;j<=NV;j++){const p=project(torusPoint(i/NU*Math.PI*2,j/NV*Math.PI*2));positions.push(p.x,p.y,p.z)}
for(let i=0;i<NU;i++)for(let j=0;j<NV;j++){const k=i*(NV+1)+j,kn=(i+1)*(NV+1)+j;indices.push(k,kn,k+1,kn,kn+1,k+1)}
const torusGeo=new THREE.BufferGeometry();torusGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));torusGeo.setIndex(indices);torusGeo.computeVertexNormals();
const torusMat=new THREE.MeshPhongMaterial({color:0xff6338,emissive:0x311006,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false,shininess:55});
groups.torus.add(new THREE.Mesh(torusGeo,torusMat));
function torusGridCurve(points,color,opacity){const geo=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false});groups.torus.add(new THREE.Line(geo,mat))}
for(let k=0;k<10;k++){
  const fixed=k/10*Math.PI*2,uCurve=[],vCurve=[];
  for(let s=0;s<=180;s++){const t=s/180*Math.PI*2;uCurve.push(project(torusPoint(t,fixed)));vCurve.push(project(torusPoint(fixed,t)))}
  torusGridCurve(uCurve,0xffb08d,.62);torusGridCurve(vCurve,0xffd5c5,.48);
}
scene.add(new THREE.HemisphereLight(0xbbeeff,0x18100d,1.25));const keyLight=new THREE.DirectionalLight(0xffb08d,2.3);keyLight.position.set(4,7,5);scene.add(keyLight);

const facePositions=[],faceColors=[];
boundaryFaces.forEach((face,i)=>{const col=new THREE.Color().setHSL(.035+(i%10)*.006,.92,.56);for(const id of face.ids){const p=project(poly.v[id]);facePositions.push(p.x,p.y,p.z);faceColors.push(col.r,col.g,col.b)}});
const faceGeo=new THREE.BufferGeometry();faceGeo.setAttribute('position',new THREE.Float32BufferAttribute(facePositions,3));faceGeo.setAttribute('color',new THREE.Float32BufferAttribute(faceColors,3));
const faceMat=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.56,side:THREE.DoubleSide,depthWrite:false});groups.boundary.add(new THREE.Mesh(faceGeo,faceMat));
const cellEdgeSet=new Set(),cellPairs=[];
for(const ci of boundaryCells){const c=poly.cells[ci];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){const key=[c[i],c[j]].sort((x,y)=>x-y).join(',');if(!cellEdgeSet.has(key)){cellEdgeSet.add(key);cellPairs.push([c[i],c[j]])}}}
groups.boundary.add(lineSegments(cellPairs,0xff8b5e,.8));

function addCurve(points,color,opacity=.82){const geo=new THREE.BufferGeometry().setFromPoints(points),mat=new THREE.LineBasicMaterial({color,transparent:true,opacity});groups.hopf.add(new THREE.Line(geo,mat))}
const palette=[0x5ce1e6,0x74b9ff,0xcf8cff,0x68f0b0];
for(let lat=0;lat<4;lat++){const eta=.18+(lat+.5)/4*1.20;for(let k=0;k<5;k++){const alpha=k/5*Math.PI*2+lat*.23,beta=-k/5*Math.PI*2*.62+lat*.71,pts=[];for(let s=0;s<=180;s++){const t=s/180*Math.PI*2,q=[Math.cos(eta)*Math.cos(alpha+t),Math.cos(eta)*Math.sin(alpha+t),Math.sin(eta)*Math.cos(beta+t),Math.sin(eta)*Math.sin(beta+t)],p=project(q);if(p.length()<42)pts.push(p)}addCurve(pts,palette[lat],.76)}}

groups.hopf.visible=false;groups.cell.visible=false;groups.cell120.visible=false;groups.boundary.visible=false;groups.seam120.visible=false;
const toggles={torus:document.querySelector('#toggle-torus'),hopf:document.querySelector('#toggle-hopf'),cell:document.querySelector('#toggle-cell'),cell120:document.querySelector('#toggle-cell120'),boundary:document.querySelector('#toggle-boundary'),seam120:document.querySelector('#toggle-seam120')};
const modeLabel=document.querySelector('#mode-label');
const numberEls=[...document.querySelectorAll('.numbers div')];
function updateLayers(){for(const[k,input]of Object.entries(toggles))groups[k].visible=input.checked;const active=[];if(toggles.hopf.checked)active.push('HOPF FIBERS');if(toggles.cell.checked)active.push('600-CELL');if(toggles.cell120.checked)active.push('120-CELL');if(toggles.boundary.checked)active.push('100-TET SEAM');if(toggles.seam120.checked)active.push('200-PENTAGON SEAM');modeLabel.textContent=active.join(' + ')||'SEPARATING TORUS';document.querySelector('#atlas-card').classList.toggle('lit',toggles.boundary.checked);const stats=toggles.cell120.checked&&!toggles.cell.checked?[[600,'VERTICES'],['1,200','EDGES'],[720,'PENTAGONS'],[120,'DODECAHEDRA']]:[[120,'VERTICES'],[720,'EDGES'],['1,200','TRIANGLES'],[600,'TETRAHEDRA']];numberEls.forEach((el,i)=>{el.querySelector('strong').textContent=stats[i][0];el.querySelector('span').textContent=stats[i][1]})}
Object.values(toggles).forEach(x=>x.addEventListener('change',updateLayers));
const opacity=document.querySelector('#opacity'),opacityValue=document.querySelector('#opacity-value');opacity.addEventListener('input',()=>{torusMat.opacity=+opacity.value/100;opacityValue.value=`${opacity.value}%`});

const atlas=document.querySelector('#atlas-grid');
for(let i=0;i<100;i++){const el=document.createElement('button');el.className='atlas-cell';el.type='button';el.title=`Boundary tetrahedron ${i+1}`;el.setAttribute('aria-label',el.title);el.addEventListener('click',()=>{document.querySelectorAll('.atlas-cell.active').forEach(x=>x.classList.remove('active'));el.classList.add('active');if(!toggles.boundary.checked){toggles.boundary.checked=true;updateLayers()}});atlas.append(el)}

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(stage);resize();
let time=0;function animate(){requestAnimationFrame(animate);time+=.002;if(!controls.dragging){groups.hopf.rotation.y=time*.08;groups.cell.rotation.y=time*.025;groups.boundary.rotation.y=time*.025;groups.cell120.rotation.y=time*.025;groups.seam120.rotation.y=time*.025}controls.update();renderer.render(scene,camera)}animate();
console.info(`600-cell: ${poly.v.length} vertices, ${poly.edges.length} edges, ${poly.cells.length} tetrahedra. 120-cell: ${dualVertices.length} vertices, ${dualEdges.length} edges. Torus seams: ${boundaryFaces.length} triangles / ${boundaryCells.length} tetrahedra; ${solidVertexSet.size}+${poly.v.length-solidVertexSet.size} dual cells / ${crossingEdges.length} pentagons.`);
