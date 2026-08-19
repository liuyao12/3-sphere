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

const groups={torus:new THREE.Group(),hopf:new THREE.Group(),cell:new THREE.Group(),boundary:new THREE.Group()};
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

groups.hopf.visible=false;groups.cell.visible=false;groups.boundary.visible=false;
const toggles={torus:document.querySelector('#toggle-torus'),hopf:document.querySelector('#toggle-hopf'),cell:document.querySelector('#toggle-cell'),boundary:document.querySelector('#toggle-boundary')};
const modeLabel=document.querySelector('#mode-label');
function updateLayers(){for(const[k,input]of Object.entries(toggles))groups[k].visible=input.checked;const active=[];if(toggles.hopf.checked)active.push('HOPF FIBERS');if(toggles.cell.checked)active.push('600-CELL');if(toggles.boundary.checked)active.push('100-CELL SEAM');modeLabel.textContent=active.join(' + ')||'SEPARATING TORUS';document.querySelector('#atlas-card').classList.toggle('lit',toggles.boundary.checked)}
Object.values(toggles).forEach(x=>x.addEventListener('change',updateLayers));
const opacity=document.querySelector('#opacity'),opacityValue=document.querySelector('#opacity-value');opacity.addEventListener('input',()=>{torusMat.opacity=+opacity.value/100;opacityValue.value=`${opacity.value}%`});

const atlas=document.querySelector('#atlas-grid');
for(let i=0;i<100;i++){const el=document.createElement('button');el.className='atlas-cell';el.type='button';el.title=`Boundary tetrahedron ${i+1}`;el.setAttribute('aria-label',el.title);el.addEventListener('click',()=>{document.querySelectorAll('.atlas-cell.active').forEach(x=>x.classList.remove('active'));el.classList.add('active');if(!toggles.boundary.checked){toggles.boundary.checked=true;updateLayers()}});atlas.append(el)}

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(stage);resize();
let time=0;function animate(){requestAnimationFrame(animate);time+=.002;if(!controls.dragging){groups.hopf.rotation.y=time*.08;groups.cell.rotation.y=time*.025;groups.boundary.rotation.y=time*.025}controls.update();renderer.render(scene,camera)}animate();
console.info(`600-cell check: ${poly.v.length} vertices, ${poly.edges.length} edges, ${poly.cells.length} tetrahedra; solid torus: ${solid.length} cells; boundary: ${boundaryFaces.length} triangles / ${boundaryCells.length} tetrahedra.`);
