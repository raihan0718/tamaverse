(function(){

const IMG='assets/pets/Soverign-Nexora.webp?v=nexora-canvas-20261104-1';
let c=null,x=null;
const S=430,F=.906,BX=400,BY=500,W=800,H=560,TAU=Math.PI*2;
const cl=v=>Math.max(0,Math.min(1,v)),lerp=(a,b,t)=>a+(b-a)*t,eo=t=>1-Math.pow(1-t,3),R=Math.random;
let src,tints={},parts=[],cur='idle',t0=0,prev=0;
const stars=Array.from({length:50},()=>({x:R()*W,y:R()*330,p:R()*TAU}));
const L=(fx,fy)=>[(fx-.5)*S,(fy-F)*S];
const im=new Image();im.onload=()=>{const o=document.createElement('canvas');o.width=im.width;o.height=im.height;
  const g=o.getContext('2d');g.drawImage(im,0,0);const d=g.getImageData(0,0,o.width,o.height),p=d.data;
  for(let i=0;i<p.length;i+=4){const m=Math.min(p[i],p[i+1],p[i+2]);if(m>238)p[i+3]=0;else if(m>215)p[i+3]*=(238-m)/23}
  g.putImageData(d,0,0);src=o;t0=performance.now();startLoop()};
function tint(col){if(tints[col])return tints[col];const o=document.createElement('canvas');o.width=src.width;o.height=src.height;
  const g=o.getContext('2d');g.drawImage(src,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=col;g.fillRect(0,0,o.width,o.height);return tints[col]=o}
function part(m,al,x0,x1,y0,y1,pv,ang){x.save();const[p,q]=L(pv[0],pv[1]);x.translate(p,q);x.rotate(ang);x.translate(-p,-q);
  const[a,b]=L(x0,y0),[e,f]=L(x1,y1);x.beginPath();x.rect(a,b,e-a,f-b);x.clip();x.globalAlpha=al;x.drawImage(m,-S/2,-F*S,S,S);x.restore()}
function draw(m,al,P){x.save();x.translate(BX+P.dx,BY+P.dy);x.rotate(P.rot);x.scale(P.sx,P.sy);
  part(m,al,0,.4,0,1,[.4,.45],P.flap);part(m,al,.7,1,0,1,[.7,.45],-P.flap);
  part(m,al,.3,.7,.4,1,[.5,.9],0);part(m,al,.4,.7,0,.4,[.55,.38],P.head);
  if(P.eyes&&m===src){x.save();const[p,q]=L(.55,.38);x.translate(p,q);x.rotate(P.head);x.translate(-p,-q);
    for(const e of[.59,.655]){const[a,b]=L(e,.232);x.fillStyle='#14121a';x.fillRect(a-11,b-8,22,16);
      x.strokeStyle='#8a2236';x.lineWidth=3;x.lineCap='round';x.beginPath();x.moveTo(a-8,b-1);x.quadraticCurveTo(a,b+6,a+8,b-1);x.stroke()}x.restore()}
  x.restore()}
const mp=P=>[BX+P.dx+.18*S,BY+P.dy+(.28-F)*S+P.head*70];
function sp(txt,px,py,vx,vy,m,size,col,g=300){parts.push({txt,x:px,y:py,vx,vy,m,l:0,size,col,g})}
function burst(px,py,n,txt,col){for(let i=0;i<n;i++){const a=R()*TAU,v=80+R()*260;sp(txt,px,py,Math.cos(a)*v,Math.sin(a)*v-60,.6+R()*.4,14+R()*12,col)}}
function glow(px,py,r,col,a){const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(255,60,80,0)');x.globalAlpha=a;x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,TAU);x.fill();x.globalAlpha=1}
const emo=(t,px,py,s,a=1)=>{x.globalAlpha=a;x.font=s+'px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(t,px,py);x.globalAlpha=1};
const heart=()=>sp('❤️',BX+(R()-.3)*200,BY-330,0,-70,1.3,26,'#f55',0);
const hs=(t,hits)=>{let d=9;for(const h of hits)if(t>=h)d=Math.min(d,t-h);return d<.25?1-d/.25:0};
const HITS=[.6,1.2,1.8];
const A={
idle:{T:3,p:t=>{const b=Math.sin(t*TAU/3);return{sy:1+.012*b,sx:1-.004*b,flap:.05*Math.sin(t*TAU/3+1.2),head:.025*b}}},
play:{T:1.6,ev:[[.1,heart],[.5,heart],[.9,heart],[1.3,heart]],p:t=>{const k=(t%.8)/.8,j=Math.sin(k*Math.PI),l=k<.1||k>.9;
  return{dy:-j*70,sy:l?.9:1.03,sx:l?1.06:.98,flap:.28*Math.sin(t*TAU*2.5),rot:.06*Math.sin(t*TAU/.8),head:-.05*j}}},
eat:{T:3.2,ev:[1,1.7,2.4].map(b=>[b,()=>{const m=mp({dx:0,dy:0,head:.2});for(let i=0;i<6;i++)sp('•',m[0]+40,m[1]+34,R()*140-30,-120-R()*80,.5,16,'#d9a066')}]),
  p:t=>{const w=cl(t/.5),ch=t>.9&&t<2.7?1:0;return{head:.14*w*(t<2.9?1:0)+ch*.06*Math.sin(t*22),sy:1+.008*Math.sin(t*TAU/1.6)}},
  fx:(t,P)=>{const n=[1,1.7,2.4].filter(b=>t>b).length;if(n<3){const m=mp(P);emo('🍖',m[0]+46,m[1]+34,56*(1-n*.3),cl(t/.4))}}},
training:{T:2,ev:[[1,()=>sp('💧',BX+50,BY-330,70,-90,.9,22,'#6cf')],[1.5,()=>sp('💧',BX+30,BY-320,-60,-80,.9,22,'#6cf')]],
  p:t=>{const k=(1-Math.cos(t*TAU/2))/2;return{sy:.9+.1*k,sx:1.06-.06*k,head:.05*(1-k),flap:.1*k}},
  fx:t=>{const k=(1-Math.cos(t*TAU/2))/2,px=BX+22,py=lerp(BY-150,BY-395,k);x.fillStyle='#8c8fa0';x.fillRect(px-80,py-4,160,8);
    x.fillStyle='#33364a';for(const s of[-1,1]){x.fillRect(px+s*80-9,py-20,18,40);x.fillRect(px+s*62-8,py-14,16,28)}}},
sleep:{T:4.2,night:1,ev:[0,1.4,2.8].map(b=>[b,()=>sp('Z',BX+110,BY-340,38,-55,3,20,'#cfe6ff',0)]),
  p:t=>{const b=Math.sin(t*TAU/4.2);return{dy:6,sy:1+.014*b,head:.2+.02*b,flap:-.04+.01*b,eyes:1,rot:.015}}},
attack:{T:1.6,ev:[[.56,()=>{burst(BX+250,BY-190,16,'◆','#e8eef7');burst(BX+250,BY-190,8,'◆','#e0304a')}]],
  p:t=>{if(t<.4){const k=eo(t/.4);return{dx:-45*k,sx:1-.06*k,sy:1+.06*k,rot:-.07*k,flap:.25*k}}
    if(t<.55){const k=eo((t-.4)/.15);return{dx:lerp(-45,90,k),rot:lerp(-.07,.12,k),flap:lerp(.25,-.15,k),sx:1.05}}
    if(t<.9)return{dx:90,rot:.12,sx:1.05,flap:-.15,flash:1-cl((t-.55)*4)};
    const k=eo((t-.9)/.7);return{dx:lerp(90,0,k),rot:lerp(.12,0,k),flap:lerp(-.15,0,k)}},
  fx:t=>{if(t>.55&&t<.85){const k=(t-.55)/.3;x.strokeStyle='rgba(235,242,255,'+(1-k)+')';x.lineCap='round';
    for(let i=0;i<3;i++){x.lineWidth=8-i*2;x.beginPath();x.arc(BX+205,BY-190+i*16-16,100+i*14,-1+k*.4,1+k*.4);x.stroke()}}}},
skill:{T:3,ev:[.2,.5,.8,1.1].map(b=>[b,()=>sp('✨',BX+46+(R()-.5)*160,BY-179+(R()-.5)*120,0,-30,.8,20,'#f66',0)]).concat([[2.1,()=>{burst(690,BY-200,18,'🔥','#f84');burst(690,BY-200,10,'✨','#fff')}]]),
  p:t=>{if(t<1.4){const c=t/1.4;return{flap:.1+.18*Math.sin(t*14),sy:1+.02*c,dx:0,head:-.06*c}}
    if(t<1.8){const k=1-(t-1.4)/.4;return{dx:-30*k,rot:-.07*k,flap:.2*k,flash:.5*k,fc:'#ff5a6e'}}
    return{}},
  fx:t=>{const gx=BX+46,gy=BY-179;if(t<1.8)glow(gx,gy,12+55*cl(t/1.4),'rgba(255,90,110,.95)',t<1.5?1:1-(t-1.5)/.3);
    if(t>1.5&&t<2.1){const k=(t-1.5)/.6,ox=BX+.18*S+40,oy=BY-260;const px=lerp(ox,690,k),py=lerp(oy,BY-200,k);glow(px,py,34,'rgba(255,120,130,1)',1);x.fillStyle='#fff';x.beginPath();x.arc(px,py,9,0,TAU);x.fill()}
    if(t>2.1&&t<2.6){const k=(t-2.1)/.5;x.strokeStyle='rgba(255,140,120,'+(1-k)+')';x.lineWidth=8*(1-k)+1;x.beginPath();x.ellipse(690,BY-200,20+k*120,15+k*100,0,0,TAU);x.stroke()}}},
defend:{T:2.4,ev:HITS.map(h=>[h,()=>{burst(BX+250,BY-190+(R()-.5)*80,8,'✨','#bfe9ff')}]),
  p:t=>({dx:-12*hs(t,HITS),dy:12,sy:.92,sx:1.05,head:.1,flap:-.28}),
  fx:t=>{const s=hs(t,HITS),cx=BX+140,cy=BY-190;x.fillStyle='rgba(120,200,255,'+(.1+.3*s)+')';x.strokeStyle='rgba(200,240,255,'+(.6+.4*s)+')';x.lineWidth=4+4*s;
    x.beginPath();x.ellipse(cx,cy,150,200,0,0,TAU);x.fill();x.stroke();
    HITS.forEach((h,i)=>{if(t>=h-.3&&t<h){const k=(t-h+.3)/.3,px=lerp(W+20,cx+140,k),py=cy+(i-1)*45;x.strokeStyle='#ff5a6e';x.lineWidth=5;x.beginPath();x.moveTo(px,py);x.lineTo(px+60,py);x.stroke()}})}},
potion:{T:3.4,ev:[[1.7,()=>{for(let i=0;i<10;i++)sp('+',BX+(R()-.4)*220,BY-80-R()*120,0,-110-R()*60,1.2,26,'#4cd97b',0)}]],
  p:t=>{const dr=t>.7&&t<1.7?Math.sin((t-.7)*Math.PI):0,f=t>1.7&&t<2.4?1-(t-1.7)/.7:0;return{head:-.16*dr,flash:.6*f,fc:'#5dff9a',sy:1+.03*f,flap:.12*f,dr}},
  fx:(t,P)=>{const a=t<.4?t/.4:t>1.9?Math.max(0,1-(t-1.9)/.4):1,m=mp(P);x.save();x.translate(m[0]+44,m[1]-8);x.rotate(-(P.dr||0)*1.0);emo('🧪',0,0,56,a);x.restore();
    const hp=t<1.7?.4:Math.min(1,.4+.6*(t-1.7)/.9);x.fillStyle='rgba(0,0,0,.5)';x.fillRect(BX-70,BY-395,140,12);x.fillStyle='#4cd97b';x.fillRect(BX-70,BY-395,140*hp,12)}}
};
const DEF={dx:0,dy:0,sx:1,sy:1,rot:0,flap:0,head:0,flash:0,fc:'#fff',eyes:0};
let loopRunning=false;
function startLoop(){if(loopRunning||!c||!src)return;loopRunning=true;requestAnimationFrame(loop)}
function mount(){const next=document.getElementById('nexora-animation-canvas');if(!next)return;if(c!==next){c=next;x=c.getContext('2d',{alpha:true});}startLoop()}
function setMode(mode){if(!A[mode])mode='idle';cur=mode;t0=performance.now();prev=-1;parts=[];}
function loop(ts){
  if(!c||!c.isConnected){loopRunning=false;return;}
  const a=A[cur],t=((ts-t0)/1000)%a.T;
  if(t<prev)prev=-1;
  (a.ev||[]).forEach(([te,fn])=>{if(prev<te&&t>=te)fn()});prev=t;
  const P=Object.assign({},DEF,a.p(t)),dt=1/60;
  x.clearRect(0,0,W,H);
  if(a.night){for(const s of stars){x.globalAlpha=.3+.7*Math.abs(Math.sin(ts/900+s.p));x.fillStyle='#fff';x.fillRect(s.x,s.y,2,2)}x.globalAlpha=1;x.fillStyle='#f3ecc8';x.beginPath();x.arc(90,80,38,0,TAU);x.fill();x.fillStyle='#0d0a24';x.beginPath();x.arc(106,72,34,0,TAU);x.fill()}
  x.fillStyle='rgba(0,0,0,.35)';x.beginPath();x.ellipse(BX,BY+4,150-Math.min(60,-P.dy*.6),16,0,0,TAU);x.fill();
  x.imageSmoothingEnabled=false;draw(src,1,P);if(P.flash>0)draw(tint(P.fc),P.flash,P);
  if(a.fx)a.fx(t,P);
  parts.forEach(p=>{p.l+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.g*dt});parts=parts.filter(p=>p.l<p.m);
  for(const p of parts){const k=p.l/p.m,al=cl(Math.min(1,p.l*6)*(1-k*k)),s=p.size*(p.txt==='Z'?1+k:1);x.globalAlpha=al;x.textAlign='center';x.textBaseline='middle';
    if(p.txt==='Z'){x.font='bold '+s+'px monospace';x.lineWidth=5;x.strokeStyle='#1b1a5a';x.lineJoin='round';x.strokeText('Z',p.x,p.y)}else x.font='bold '+s+'px sans-serif';
    x.fillStyle=p.col;x.fillText(p.txt,p.x,p.y)}
  x.globalAlpha=1;requestAnimationFrame(loop)}
window.TamaverseNexoraAnimation={mount,setMode};
})();
