// three.js special-effects layer, drawn on a transparent canvas stacked over the 2D sprite canvas.
// Fire, candle flames, lightning, power-up auras, shockwaves, magic circles, rain/mist, flickering light + darkness.
// Everything is positioned in WORLD pixels; the camera just scrolls the ortho view.
import * as THREE from 'three';
import { W, H, rand, clamp, noise1, TAU } from './util.js';
import { Cloak } from './cloak.js';

const FXS = 2;   // effect canvas is rendered at 2x the pixel-art resolution (soft glows over crisp sprites)

const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
const NORMAL_PM = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

// ---------------------------------------------------------------- particle shaders
const PVERT = /* glsl */`
attribute float aSize; attribute vec4 aColor; attribute float aKind; attribute float aRot;
varying vec4 vColor; varying float vKind; varying float vRot;
uniform float uScale;
void main(){ vColor=aColor; vKind=aKind; vRot=aRot; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale; }`;
const pfrag = additive => /* glsl */`
precision highp float;
varying vec4 vColor; varying float vKind; varying float vRot;
uniform float uTime;
void main(){
  vec2 p = gl_PointCoord*2.0-1.0;
  float c=cos(vRot), s=sin(vRot); p = vec2(c*p.x - s*p.y, s*p.x + c*p.y);
  vec2 q = vec2(p.x,-p.y);
  float k=vKind; float a=0.0; vec3 col=vColor.rgb;
  if(k<0.5){ float d=length(p); a=pow(max(0.0,1.0-d),2.0); }
  else if(k<1.5){ a=step(max(abs(p.x),abs(p.y)),0.75); }
  else if(k<2.5){ float h=(q.y+1.0)*0.5; float w=(1.0-pow(h,0.85))*0.6+0.02; float x=abs(q.x);
    a=smoothstep(w,w*0.5,x)*smoothstep(0.0,0.14,h)*(1.0-h*0.3); float core=smoothstep(w*0.75,0.0,x)*(1.0-h)*smoothstep(0.0,0.3,h+0.2); col=mix(col,vec3(1.0,0.96,0.78),core*0.85); }
  else if(k<3.5){ float d=length(p); a=smoothstep(0.76,0.9,d)*smoothstep(1.0,0.94,d); }
  else if(k<4.5){ a=step(abs(q.y),0.14)*smoothstep(1.0,0.5,abs(q.x)); }
  else if(k<5.5){ float d=length(p); a=smoothstep(1.0,0.05,d)*0.85; }
  else if(k<6.5){ float g=pow(max(0.0,1.0-length(p)),2.5); float cx=pow(max(0.0,1.0-abs(p.x)*5.0),2.0)*(1.0-abs(p.y)); float cy=pow(max(0.0,1.0-abs(p.y)*5.0),2.0)*(1.0-abs(p.x)); a=clamp(g+cx+cy,0.0,1.0); }
  else { // candle flame with sway; vRot carries a per-flame seed
    float sway=sin(uTime*11.0+vRot*7.0+q.y*3.0)*0.09+sin(uTime*17.0+vRot*3.0)*0.05; q.x+=sway*(q.y+1.0);
    float h=(q.y+1.0)*0.5; float w=sin(clamp(h,0.0,1.0)*3.14159)*0.5*(1.0-h*0.35)+0.01; float x=abs(q.x);
    a=smoothstep(w,w*0.35,x)*smoothstep(0.0,0.08,h)*step(h,0.98);
    float core=smoothstep(w*0.7,0.0,x)*(1.0-h*0.7); col=mix(col,vec3(1.0,0.97,0.82),core); col=mix(vec3(0.25,0.4,1.0),col,smoothstep(0.0,0.25,h)); }
  ${additive ? 'gl_FragColor=vec4(col*a*vColor.a,0.0);' : 'gl_FragColor=vec4(col*a*vColor.a,a*vColor.a);'}
}`;

// ---------------------------------------------------------------- quad (ring/beam/circle/glow/rays) shader
const QVERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const QFRAG = /* glsl */`
precision highp float; varying vec2 vUv;
uniform float uKind; uniform vec3 uColor; uniform float uAlpha; uniform float uTime; uniform vec4 uP;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec2 p=vUv*2.0-1.0; float d=length(p); float a=0.0; vec3 col=uColor;
  if(uKind<0.5){ // ring: uP.x = thickness
    float t=uP.x; a=smoothstep(1.0-t,1.0-t*0.4,d)*smoothstep(1.0,1.0-t*0.5,d); }
  else if(uKind<1.5){ // vertical light beam: soft edges, drifting streaks
    float e=pow(max(0.0,1.0-abs(p.x)),2.2); float s=0.65+0.35*noise(vec2(p.x*6.0,p.y*2.0-uTime*3.0)); a=e*s*smoothstep(1.0,0.6,abs(p.y)); col=mix(col,vec3(1.0),pow(e,4.0)*0.8); }
  else if(uKind<2.5){ // magic circle (uP.x = spin, uP.y = rune count)
    float r=d; float ang=atan(p.y,p.x)+uP.x;
    float ring1=smoothstep(0.03,0.0,abs(r-0.92)); float ring2=smoothstep(0.02,0.0,abs(r-0.74)); float ring3=smoothstep(0.02,0.0,abs(r-0.35));
    float ticks=smoothstep(0.1,0.0,abs(fract(ang/6.28318*uP.y)-0.5)-0.38)*step(0.76,r)*step(r,0.9);
    float tri=0.0; for(int i=0;i<2;i++){ float aa=ang+float(i)*1.0472; float edge=cos(floor(0.5+aa/2.0944)*2.0944-aa)*r; tri=max(tri,smoothstep(0.025,0.0,abs(edge-0.66))); }
    a=clamp(ring1+ring2*0.7+ring3*0.6+ticks*0.9+tri*0.8,0.0,1.0)*step(r,1.0); a*=0.75+0.25*sin(uTime*6.0+ang*3.0); }
  else if(uKind<3.5){ // soft radial glow
    a=pow(max(0.0,1.0-d),uP.x>0.0?uP.x:2.0); }
  else if(uKind<4.5){ // god rays (uP.x spin, uP.y rays)
    float ang=atan(p.y,p.x)+uP.x; float rays=pow(0.5+0.5*cos(ang*uP.y),3.0); a=rays*smoothstep(1.0,0.0,d)*smoothstep(0.0,0.15,d)+pow(max(0.0,1.0-d*1.3),2.0)*0.7; }
  else { // horizontal beam/jet (flame wall, breath): uP.x = softness
    float e=pow(max(0.0,1.0-abs(p.y)),1.8); a=e*smoothstep(1.0,0.7,abs(p.x))*(0.7+0.3*noise(vec2(p.x*8.0-uTime*12.0,p.y*3.0))); }
  gl_FragColor=vec4(col*a*uAlpha,0.0);
}`;

// ---------------------------------------------------------------- bolt (lightning ribbon) shader
const BVERT = `attribute float aSide; attribute vec2 aNorm; varying float vSide; uniform float uWidth;
void main(){ vSide=aSide; vec3 pos=position+vec3(aNorm*aSide*uWidth*0.5,0.0); gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0); }`;
const BFRAG = `precision highp float; varying float vSide; uniform vec3 uColor; uniform float uAlpha; uniform float uPow;
void main(){ float f=1.0-abs(vSide); float a=pow(max(f,0.0),uPow); gl_FragColor=vec4(uColor*a*uAlpha,0.0); }`;

// ---------------------------------------------------------------- darkness / lights / hurt overlay
const DARK_FLOOR = 0.30, DARK_SLOPE = 0.30, VIG_SCALE = 0.7;      // darkness of a room = floor + its ambient * slope  (ambient 0.1 -> 0.33, 0.35 -> 0.41, 0.58 -> 0.47); an ambient of 0 = a lit scene with no darkness at all
const WARM = [1, 0.66, 0.34];
const DFRAG = /* glsl */`
precision highp float; varying vec2 vUv;
uniform vec4 uLights[24]; uniform vec3 uLightCol[24]; uniform int uCount;
uniform float uAmbient; uniform float uMax; uniform vec3 uTint; uniform float uVig; uniform float uHurt; uniform vec2 uRes; uniform float uPulse;
void main(){
  vec2 px=vec2(vUv.x*uRes.x,vUv.y*uRes.y);   // camera is y-down, so plane v grows downward on screen
  float lit=0.0; vec3 pool=vec3(0.0);
  for(int i=0;i<24;i++){ if(i>=uCount) break; float d=distance(px,uLights[i].xy); float f=uLights[i].w*pow(smoothstep(uLights[i].z,0.0,d),1.6); lit+=f; pool+=uLightCol[i]*f; }
  lit=clamp(lit,0.0,1.0);
  float dark=uAmbient*(1.0-lit);
  vec2 v=vUv*2.0-1.0; float vig=uVig*smoothstep(0.55,1.45,length(v*vec2(0.9,1.1)));
  dark=clamp(dark+vig*(1.0-lit*0.6),0.0,uMax);
  float hv=uHurt*smoothstep(0.35,1.3,length(v));
  vec3 rgb=uTint*dark+vec3(0.55,0.0,0.02)*hv+min(pool,vec3(1.2))*0.17*step(0.001,uAmbient); float al=dark+hv*(1.0-dark);          // a pool of coloured light round every light (so lights stand out without a dark room)
  gl_FragColor=vec4(rgb,al);
}`;

// ---------------------------------------------------------------- rolling ground fog
// A bank of fog that lies along the floor of a room: dense at and below the ground line, with a ragged, slowly rolling top.  Two layers of domain-warped noise drift past at different
// speeds (the near one faster) and leave wispy gaps, so it is thick without being a flat curtain.  It is drawn in front of everything (hero included) and under the darkness overlay,
// so a dark room's fog is dark too.  Gusts (the swish of the sword, a dash) shove the noise sideways and thin the fog where they pass.
const FOGFRAG = /* glsl */`
precision highp float; varying vec2 vUv;
uniform vec2 uCam; uniform vec2 uRes; uniform float uTime; uniform float uBase; uniform float uHeight; uniform float uDensity; uniform vec3 uColor;
uniform vec4 uG[6]; uniform vec2 uGP[6]; uniform vec4 uW[6];
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return s; }
void main(){
  vec2 w = uCam + vec2(vUv.x*uRes.x, vUv.y*uRes.y);
  vec2 q = w; float carve = 0.0;
  for(int i=0;i<6;i++){ vec2 d = w - uG[i].xy; float f = max(0.0, 1.0 - length(d)/uGP[i].x); f = f*f*uGP[i].y; q -= uG[i].zw * f * 30.0; carve += f; }      // blown along the gust, and torn open where it passed
  float t = uTime;
  vec2 pA = vec2(q.x/130.0 - t*0.03, q.y/48.0);
  vec2 pB = vec2(q.x/66.0 + t*0.055 + 11.0, q.y/30.0 + 3.0);
  float wa = fbm(pA + 1.4*vec2(fbm(pA*0.8 + t*0.02), fbm(pA*0.8 + 7.0 - t*0.02)));
  float wb = fbm(pB + 1.1*vec2(fbm(pB*0.9 - t*0.03), fbm(pB*0.9 + 5.0)));
  float n = 0.6*wa + 0.4*wb;
  float up = uBase - q.y;                                                       // pixels above the ground line (negative below it)
  float top = uHeight * (0.65 + 0.7*fbm(vec2(q.x/90.0 + t*0.03, 3.0)));         // the ragged top of the bank
  float hv = 1.0 - smoothstep(top*0.12, top, up);
  float d = hv * smoothstep(0.16, 0.74, n + 0.2*hv) * uDensity;                  // wispy: clear gaps where the noise is low
  float clearW = 0.0; for(int i=0;i<6;i++){ float k = uW[i].w; if(k>0.0){ float dd = length(w - uW[i].xy)/uW[i].z; clearW = max(clearW, k*(1.0 - smoothstep(0.0, 1.0, dd))); } }        // the mist thins to almost nothing around a wisp
  d = clamp(d * (1.0 - clamp(carve, 0.0, 0.85)) * (1.0 - 0.92*clearW), 0.0, 0.9);
  vec3 col = uColor * (0.78 + 0.34*n);
  gl_FragColor = vec4(col*d, d);
}`;

// ---------------------------------------------------------------- water
// Every stream and waterfall of the room is one rectangle in a single full-screen pass (like the fog): uR = [x0, y0, x1, y1] in the world, uQ = [type (0 a stream along the floor, 1 a waterfall), speed in
// px/s (a stream's sign is its direction), seed].  A stream is a shallow channel with a wavering surface, drifting ripples and streaks of foam; a fall is a sheet with streaks racing down it, foam
// along its edges and a mist where it lands.  All patterns are carried along WITH the water, so the water looks like it flows rather than like lines painted on the screen.
const WATERFRAG = /* glsl */`
precision highp float; varying vec2 vUv;
uniform vec2 uCam; uniform vec2 uRes; uniform float uTime; uniform int uN; uniform vec4 uR[10]; uniform vec4 uQ[10];
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return s; }
void main(){
  vec2 w = uCam + vec2(vUv.x*uRes.x, vUv.y*uRes.y);
  vec4 acc = vec4(0.0);
  for(int i=0;i<10;i++){
    if(i>=uN) break;
    vec4 r=uR[i]; vec4 q=uQ[i];
    if(w.x < r.x-6.0 || w.x > r.z+6.0 || w.y < r.y-30.0 || w.y > r.w+30.0) continue;
    float wd=r.z-r.x, ht=r.w-r.y, px=w.x-r.x, py=w.y-r.y, v=q.y; vec3 col=vec3(0.0); float a=0.0;
    if(q.x < 0.5){
      float xs = w.x - v*uTime;                                                    // the water's own x: everything below moves with it
      float surf = 1.1*sin(xs*0.23 + q.z) + 0.8*sin(xs*0.51 + q.z*2.0 + uTime*1.3);
      float inside = smoothstep(-0.6, 0.9, py - surf) * step(py, ht + 0.5) * step(0.0, px) * step(px, wd);
      float dpt = clamp((py - surf)/ht, 0.0, 1.0);
      float n = fbm(vec2(xs*0.07 + q.z, py*0.22));
      float streak = smoothstep(0.56, 0.86, fbm(vec2(xs*0.05 + q.z*1.7, py*0.45 + uTime*0.25)));
      col = mix(vec3(0.50,0.78,0.88), vec3(0.09,0.26,0.40), dpt) + vec3(0.55,0.75,0.8)*streak*0.55 + vec3(0.18)*(n-0.4);
      a = inside*(0.42 + 0.26*dpt);
      float line = smoothstep(1.8, 0.0, abs(py - surf - 0.7)) * step(0.0, px) * step(px, wd);
      col = mix(col, vec3(0.92,0.99,1.0), line*0.85); a = max(a, line*0.8);
      float foam = (smoothstep(6.0,0.0,px) + smoothstep(6.0,0.0,wd-px)) * inside * (0.5 + 0.5*n);
      col = mix(col, vec3(0.94,0.99,1.0), clamp(foam,0.0,1.0)*0.6); a = max(a, foam*0.5);
    } else {
      float edge = smoothstep(0.0,2.5,px)*smoothstep(0.0,2.5,wd-px);
      float inside = edge*step(0.0,py)*step(py,ht);
      float ys = w.y - v*uTime;                                                    // falling with the water
      float s1 = fbm(vec2(px*0.5 + q.z, ys*0.05));
      float s2 = fbm(vec2(px*1.25 + q.z*3.0, ys*0.1));
      float streak = smoothstep(0.34, 0.8, s1*0.6 + s2*0.5);
      col = mix(vec3(0.34,0.60,0.74), vec3(0.88,0.97,1.0), streak);
      a = inside*(0.28 + 0.36*streak)*smoothstep(0.0,20.0,py);
      float fe = (smoothstep(4.0,0.0,px)+smoothstep(4.0,0.0,wd-px)) * step(0.5, fbm(vec2(ys*0.13, px*0.3+q.z)));
      col = mix(col, vec3(1.0), clamp(fe,0.0,1.0)*0.7); a = max(a, inside*fe*0.6);
      float mx = (w.x-(r.x+r.z)*0.5)/(wd*0.5+12.0), my = (r.w-w.y)/24.0;
      float mist = smoothstep(1.0, 0.0, length(vec2(mx, my*1.2))) * step(-0.4, my) * (0.55 + 0.45*fbm(vec2(w.x*0.09 + uTime*0.4, w.y*0.09 - uTime*0.3)));
      col = mix(col, vec3(0.9,0.98,1.0), clamp(mist,0.0,1.0)*0.6); a = max(a, mist*0.5);
    }
    acc.rgb += col*a*(1.0-acc.a); acc.a += a*(1.0-acc.a);
  }
  gl_FragColor = acc;
}`;

// ---------------------------------------------------------------- particle storage
const STR = 24; // floats per particle
const [X, Y, VX, VY, GX, GY, DRAG, LIFE, MAXL, S0, S1, R0, G0, B0, R1, G1, B1, A0, A1, KIND, ROT, VROT] = Array.from({ length: 22 }, (_, i) => i);

class PSystem {
  constructor(max, additive, scene, order) {
    this.max = max; this.n = 0; this.p = new Float32Array(max * STR);
    const g = this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.size = new Float32Array(max); this.col = new Float32Array(max * 4); this.kind = new Float32Array(max); this.rot = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({ vertexShader: PVERT, fragmentShader: pfrag(additive), transparent: true, depthTest: false, depthWrite: false, ...(additive ? ADD : NORMAL_PM), uniforms: { uScale: { value: FXS }, uTime: { value: 0 } } });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = order; scene.add(this.points);
  }
  add(o) {
    if (this.n >= this.max) return; const i = this.n++ * STR, p = this.p;
    p[i + X] = o.x; p[i + Y] = o.y; p[i + VX] = o.vx || 0; p[i + VY] = o.vy || 0; p[i + GX] = o.gx || 0; p[i + GY] = o.gy || 0; p[i + DRAG] = o.drag === undefined ? 1 : o.drag;
    p[i + LIFE] = 0; p[i + MAXL] = o.life || 30; p[i + S0] = o.s0 === undefined ? 4 : o.s0; p[i + S1] = o.s1 === undefined ? p[i + S0] : o.s1;
    const c0 = o.c0 || [1, 1, 1], c1 = o.c1 || c0;
    p[i + R0] = c0[0]; p[i + G0] = c0[1]; p[i + B0] = c0[2]; p[i + R1] = c1[0]; p[i + G1] = c1[1]; p[i + B1] = c1[2];
    p[i + A0] = o.a0 === undefined ? 1 : o.a0; p[i + A1] = o.a1 === undefined ? 0 : o.a1; p[i + KIND] = o.kind || 0; p[i + ROT] = o.rot || 0; p[i + VROT] = o.vrot || 0;
  }
  update(dt) {
    const p = this.p;
    for (let k = 0; k < this.n;) {
      const i = k * STR;
      p[i + LIFE] += dt;
      if (p[i + LIFE] > p[i + MAXL]) { this.n--; if (k < this.n) p.copyWithin(i, this.n * STR, this.n * STR + STR); continue; }
      const d = Math.pow(p[i + DRAG], dt);
      p[i + VX] = p[i + VX] * d + p[i + GX] * dt; p[i + VY] = p[i + VY] * d + p[i + GY] * dt;
      p[i + X] += p[i + VX] * dt; p[i + Y] += p[i + VY] * dt; p[i + ROT] += p[i + VROT] * dt; k++;
    }
  }
  // a gust shoves the light, long-lived particles near it (smoke, embers, mist, glints) along its direction; the flame glows (1 frame) and quick sparks are left alone
  push(g) {
    const p = this.p, r2 = g.r * g.r, K = g.k * 0.13;
    for (let k = 0; k < this.n; k++) {
      const i = k * STR; if (p[i + MAXL] < 12) continue;
      const dx = p[i + X] - g.x, dy = p[i + Y] - g.y, d2 = dx * dx + dy * dy; if (d2 >= r2) continue;
      const f = 1 - Math.sqrt(d2) / g.r, m = f * f * K; p[i + VX] += g.vx * m; p[i + VY] += g.vy * m;
    }
  }
  upload() {
    const p = this.p;
    for (let k = 0; k < this.n; k++) {
      const i = k * STR, t = p[i + LIFE] / p[i + MAXL], it = 1 - t;
      this.pos[k * 3] = p[i + X]; this.pos[k * 3 + 1] = p[i + Y]; this.pos[k * 3 + 2] = 0;
      this.size[k] = p[i + S0] * it + p[i + S1] * t;
      this.col[k * 4] = p[i + R0] * it + p[i + R1] * t; this.col[k * 4 + 1] = p[i + G0] * it + p[i + G1] * t; this.col[k * 4 + 2] = p[i + B0] * it + p[i + B1] * t;
      this.col[k * 4 + 3] = p[i + A0] * it + p[i + A1] * t; this.kind[k] = p[i + KIND]; this.rot[k] = p[i + ROT];
    }
    const g = this.geo; for (const n of ['position', 'aSize', 'aColor', 'aKind', 'aRot']) g.attributes[n].needsUpdate = true;
    g.setDrawRange(0, this.n);
  }
}

export const COLORS = {
  fire: [[1, 0.78, 0.25], [0.95, 0.2, 0.04]], warm: [[1, 0.72, 0.28], [0.8, 0.22, 0.05]], blue: [[0.55, 0.85, 1], [0.1, 0.3, 1]],
  green: [[0.6, 1, 0.55], [0.1, 0.55, 0.2]], purple: [[0.85, 0.55, 1], [0.35, 0.1, 0.75]], white: [[1, 1, 1], [0.6, 0.7, 1]],
  gold: [[1, 0.92, 0.45], [1, 0.55, 0.1]], red: [[1, 0.35, 0.3], [0.6, 0.05, 0.05]], ice: [[0.8, 0.95, 1], [0.3, 0.6, 1]],
};

// ---------------------------------------------------------------- will-o'-the-wisps
// Cold blue lights that drift through a haunted place, in and out of the background.  Each has a depth z (0 = in the hero's own plane, 1 = far behind): deeper means smaller, fainter
// and slower across the screen.  They shed real light (the darkness overlay lifts around them), and the ground mist thins to almost nothing where they float, so the place near a
// wisp is easy to see.  But the hero can never get near one: as he closes in, a wisp bolts away into the background, and if he keeps coming it fades out and is gone for a while.
class Wisps {
  constructor(fx) { this.fx = fx; this.list = []; }
  set(n) { this.list = Array.from({ length: n }, (_, i) => ({ i, x: 0, y: 0, vx: 0, vy: 0, z: 0.4, zt: 0.4, ph: rand(0, TAU), age: 0, life: 0, a: 0, fade: 0, rx: 0, ry: 0, state: 'wait', wait: 20 + i * 45 + rand(0, 60) })); }
  spawn(w) {
    const f = this.fx, fo = f.focus;
    for (let tries = 0; tries < 10; tries++) {
      w.x = f.camX + rand(0.08, 0.92) * W; w.y = f.camY + rand(0.22, 0.82) * H;
      if (!fo || Math.hypot(w.x - fo.x, w.y - fo.y) > 130) break;                                       // never appear next to the hero
    }
    w.vx = rand(-0.25, 0.25); w.vy = rand(-0.12, 0.12); w.z = w.zt = rand(0.2, 0.9); w.age = 0; w.life = rand(520, 1100); w.a = 0; w.fade = 0; w.state = 'live'; w.rx = w.x; w.ry = w.y;
  }
  update(dt) {
    const f = this.fx, fo = f.focus, cxm = f.camX + W / 2, cym = f.camY + H / 2;
    for (const w of this.list) {
      if (w.state === 'wait') { w.wait -= dt; if (w.wait <= 0) this.spawn(w); w.a = 0; continue; }
      w.age += dt;
      // a slow wander: a wavering push, soft walls at the edge of the view
      w.vx += (Math.sin(w.age * 0.013 + w.ph) * 0.010 + Math.sin(w.age * 0.0047 + w.ph * 2.3) * 0.006) * dt; w.vy += (Math.cos(w.age * 0.017 + w.ph * 1.7) * 0.008 + Math.sin(w.age * 0.05 + w.ph) * 0.004) * dt;
      if (w.x < f.camX - 10) w.vx += 0.012 * dt; else if (w.x > f.camX + W + 10) w.vx -= 0.012 * dt;
      if (w.y < f.camY + 24) w.vy += 0.012 * dt; else if (w.y > f.camY + H - 30) w.vy -= 0.012 * dt;
      // in and out of the background
      w.zt = 0.5 + 0.45 * Math.sin(w.age * 0.0042 + w.ph);
      let threat = 0;
      if (fo) {
        const dx = w.x - fo.x, dy = w.y - fo.y, d = Math.hypot(dx, dy) || 1, R = 84 + 26 * (1 - w.z);
        if (d < R) { threat = 1 - d / R; w.vx += (dx / d) * 0.16 * threat * dt; w.vy += (dy / d) * 0.12 * threat * dt; w.zt = 1; w.z += 0.035 * threat * dt; }       // bolts away - and into the background
        if (d < 38 || (d < R * 0.55 && w.z > 0.92)) w.fade = Math.min(1, w.fade + 0.07 * dt);                                                                   // too close: it winks out
      }
      if (threat === 0) w.fade = Math.max(0, w.fade - 0.012 * dt);
      w.z += (w.zt - w.z) * 0.02 * dt; w.z = clamp(w.z, 0, 1);
      const drag = Math.pow(0.986, dt); w.vx *= drag; w.vy *= drag; const sp = Math.hypot(w.vx, w.vy), mx = 1.9; if (sp > mx) { w.vx *= mx / sp; w.vy *= mx / sp; }
      w.x += w.vx * dt * (1 - 0.35 * w.z); w.y += w.vy * dt * (1 - 0.35 * w.z);
      const env = Math.min(1, w.age / 60) * Math.min(1, (w.life - w.age) / 80);
      w.a = Math.max(0, env * (1 - w.fade));
      if (w.age > w.life || (w.fade >= 1 && w.a <= 0.02)) { w.state = 'wait'; w.wait = rand(90, 300); w.a = 0; w.fade = 0; continue; }
      // where it is drawn: far ones are pulled toward the middle of the view as the camera moves (slower parallax)
      w.rx = w.x + (cxm - w.x) * 0.3 * w.z; w.ry = w.y + (cym - w.y) * 0.3 * w.z;
      const sc = 1 - 0.55 * w.z, br = (1 - 0.55 * w.z) * w.a, fl = 1 + 0.12 * Math.sin(w.age * 0.31 + w.ph) + 0.06 * Math.sin(w.age * 0.77);
      f.add.add({ x: w.rx, y: w.ry, life: 1, s0: 104 * sc * fl, s1: 104 * sc * fl, c0: [0.12, 0.34, 1], a0: 0.36 * br, a1: 0.36 * br, kind: 0 });          // halo
      f.add.add({ x: w.rx, y: w.ry, life: 1, s0: 46 * sc * fl, s1: 46 * sc * fl, c0: [0.38, 0.72, 1], a0: 0.8 * br, a1: 0.8 * br, kind: 0 });          // glow
      f.add.add({ x: w.rx, y: w.ry, life: 1, s0: 14 * sc * fl, s1: 14 * sc * fl, c0: [0.9, 0.98, 1], a0: 1.0 * br, a1: 1.0 * br, kind: 6 });             // core
      if (Math.floor(w.age) % 3 < dt) f.add.add({ x: w.rx + rand(-2, 2), y: w.ry + rand(-2, 2), vx: -w.vx * 0.25 + rand(-0.08, 0.08), vy: -rand(0.05, 0.25), life: rand(34, 60), s0: 9 * sc, s1: 1, c0: [0.3, 0.62, 1], c1: [0.1, 0.2, 0.8], a0: 0.55 * br, a1: 0, kind: 0, drag: 0.98 });     // a fading tail
      if (dt >= 1 && f.lights.length < 22) f.lights.push([w.rx, w.ry, 104 * (1 - 0.3 * w.z), 0.95 * br, [0.35, 0.62, 1]]);                                                       // it lights the dark
    }
  }
  // what the fog shader needs: where mist is cleared [x, y, radius, strength]
  fog(i) { const w = this.list[i]; if (!w || w.state !== 'live' || w.a < 0.02) return [0, 0, 1, 0]; return [w.rx, w.ry, 160 * (1 - 0.3 * w.z), Math.min(1, w.a * (1 - 0.3 * w.z) * 1.1)]; }          // (about three times the area it used to clear)
}

export class FX {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1); this.renderer.setSize(W * FXS, H * FXS, false); this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(0, W, 0, H, 0.1, 100); this.cam.position.z = 10;
    this.camX = 0; this.camY = 0; this.time = 0; this.shakeX = 0; this.shakeY = 0;

    // darkness / vignette / hurt overlay (screen space quad that follows the camera)
    this.darkU = {
      uLights: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uLightCol: { value: Array.from({ length: 24 }, () => new THREE.Vector3(1, 0.7, 0.4)) },
      uCount: { value: 0 }, uAmbient: { value: 0.3 }, uMax: { value: 0.86 }, uTint: { value: new THREE.Vector3(0.015, 0.01, 0.05) }, uVig: { value: 0.5 }, uHurt: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uPulse: { value: 0 },
    };
    this.darkMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({ vertexShader: QVERT, fragmentShader: DFRAG, uniforms: this.darkU, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...NORMAL_PM }));
    this.darkMesh.renderOrder = 0; this.darkMesh.frustumCulled = false; this.scene.add(this.darkMesh);

    this.fogU = { uCam: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 }, uBase: { value: 0 }, uHeight: { value: 105 }, uDensity: { value: 0 }, uColor: { value: new THREE.Vector3(0.64, 0.7, 0.8) },
      uG: { value: Array.from({ length: 6 }, () => new THREE.Vector4()) }, uGP: { value: Array.from({ length: 6 }, () => new THREE.Vector2(1, 0)) }, uW: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 1, 0)) } };
    this.fogMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({ vertexShader: QVERT, fragmentShader: FOGFRAG, uniforms: this.fogU, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...NORMAL_PM }));
    this.fogMesh.renderOrder = -2; this.fogMesh.frustumCulled = false; this.fogMesh.visible = false; this.scene.add(this.fogMesh);
    this.waterU = { uCam: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 }, uN: { value: 0 }, uR: { value: Array.from({ length: 10 }, () => new THREE.Vector4()) }, uQ: { value: Array.from({ length: 10 }, () => new THREE.Vector4()) } };
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({ vertexShader: QVERT, fragmentShader: WATERFRAG, uniforms: this.waterU, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...NORMAL_PM }));
    this.waterMesh.renderOrder = -3; this.waterMesh.frustumCulled = false; this.waterMesh.visible = false; this.scene.add(this.waterMesh);
    this.gusts = [];                              // bursts of moving air (see gust())
    this.wisps = new Wisps(this);                  // will-o'-the-wisps (see Wisps)
    this.focus = null;                              // the hero's position {x, y}: wisps will not let it come near
    this.cloak = new Cloak(this.scene);          // the hero's white cloak (see cloak.js)
    this.alpha = new PSystem(800, false, this.scene, 1);
    this.add = new PSystem(5000, true, this.scene, 2);
    this.quads = []; this.quadPool = []; this.bolts = []; this.lights = []; this.flameList = [];
    this.flashA = 0; this.flashCol = [1, 1, 1];
    this.flashMesh = this.makeQuad(); this.flashMesh.userData.mat.uniforms.uKind.value = 3; this.flashMesh.userData.mat.uniforms.uP.value.set(0.3, 0, 0, 0); this.flashMesh.scale.set(W * 2.2, H * 2.2, 1); this.flashMesh.visible = false; this.flashMesh.renderOrder = 9;
    this.ambient = null; this.ambAcc = 0; this.storm = null; this.stormT = 0; this.hurt = 0; this.pendingThunder = [];
    this.onThunder = null;
  }

  // wipe everything (used when changing rooms)
  reset() {
    this.waterU.uN.value = 0; this.waterMesh.visible = false;
    this.add.n = 0; this.alpha.n = 0; this.gusts.length = 0; this.wisps.set(0); this.lights.length = 0; this.pendingThunder.length = 0; this.flashA = 0; this.hurt = 0;
    for (const q of this.quads) { q.m.visible = false; this.quadPool.push(q.m); } this.quads.length = 0;
    for (const b of this.bolts) { for (const m of b.parts) { this.scene.remove(m); m.material.dispose(); } for (const g of b.geos) g.dispose(); } this.bolts.length = 0;
  }

  // the room's water: [{ type: 0 stream | 1 fall, x0, y0, x1, y1 (world px), v (px/s, signed for a stream) }]
  setWater(list) {
    const u = this.waterU, n = Math.min(10, list.length); u.uN.value = n;
    for (let i = 0; i < n; i++) { const o = list[i]; u.uR.value[i].set(o.x0, o.y0, o.x1, o.y1); u.uQ.value[i].set(o.type, o.v, (Math.abs(o.x0 * 0.137) % 6.28), 0); }
    this.waterMesh.visible = n > 0;
  }
  setCamera(x, y) { this.camX = x; this.camY = y; this.cam.position.x = x + this.shakeX; this.cam.position.y = y + this.shakeY; this.darkMesh.position.set(x + W / 2 + this.shakeX, y + H / 2 + this.shakeY, -1); this.fogMesh.position.set(x + W / 2 + this.shakeX, y + H / 2 + this.shakeY, -1); this.waterMesh.position.set(x + W / 2 + this.shakeX, y + H / 2 + this.shakeY, -1); this.flashMesh.position.set(x + W / 2, y + H / 2, 0); }
  setShake(sx, sy) { this.shakeX = sx; this.shakeY = sy; }

  // ------------------------------------------------------------ quads
  makeQuad() {
    const mat = new THREE.ShaderMaterial({ vertexShader: QVERT, fragmentShader: QFRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...ADD,
      uniforms: { uKind: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 1 }, uTime: { value: 0 }, uP: { value: new THREE.Vector4(0.2, 0, 0, 0) } } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.userData.mat = mat; m.frustumCulled = false; m.renderOrder = 3; this.scene.add(m); return m;
  }
  // o: {kind:'ring'|'beam'|'circle'|'glow'|'rays'|'jet', x,y,w,h, color:[r,g,b], life, a0,a1, grow, spin, p:[..], follow:fn}
  quad(o) {
    const kinds = { ring: 0, beam: 1, circle: 2, glow: 3, rays: 4, jet: 5 };
    const m = this.quadPool.pop() || this.makeQuad(); m.visible = true;
    const u = m.userData.mat.uniforms; u.uKind.value = kinds[o.kind]; u.uColor.value.setRGB(...(o.color || [1, 1, 1]));
    const p = o.p || [0.2, 0, 0, 0]; u.uP.value.set(p[0], p[1] || 0, p[2] || 0, p[3] || 0);
    const q = { m, x: o.x, y: o.y, w: o.w, h: o.h || o.w, w1: o.w1 === undefined ? o.w : o.w1, h1: o.h1 === undefined ? (o.h || o.w) : o.h1, life: 0, max: o.life || 30, a0: o.a0 === undefined ? 1 : o.a0, a1: o.a1 === undefined ? 0 : o.a1, spin: o.spin || 0, rot: o.rot || 0, follow: o.follow, kind: o.kind, uP0: p[0], uP1: p[1] || 0, hold: o.hold || false, pulse: o.pulse || 0 };
    m.renderOrder = o.order || 3; this.quads.push(q); return q;
  }
  // persistent quad (does not expire until q.kill = true)
  killQuad(q) { if (q) q.kill = true; }

  // ------------------------------------------------------------ emitters / presets
  emit(o) { (o.layer === 'alpha' ? this.alpha : this.add).add(o); }
  glow(x, y, r, c = [1, 0.7, 0.3], a = 0.5, life = 1) { this.add.add({ x, y, life, s0: r * 2, s1: r * 2, c0: c, a0: a, a1: a, kind: 0 }); }

  sparks(x, y, n = 8, color = COLORS.gold, speed = 2.5, o = {}) {
    for (let i = 0; i < n; i++) { const a = o.dir !== undefined ? o.dir + rand(-(o.spread || 0.8), o.spread || 0.8) : rand(TAU), v = rand(speed * 0.4, speed);
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, gy: o.gy === undefined ? 0.1 : o.gy, drag: 0.96, life: rand(14, 30), s0: o.size || 3, s1: 1, c0: color[0], c1: color[1], a0: 1, a1: 0, kind: o.kind === undefined ? 1 : o.kind }); }
  }
  burst(x, y, n = 20, color = COLORS.fire, o = {}) {
    for (let i = 0; i < n; i++) { const a = rand(TAU), v = rand(0.3, o.speed || 2.5);
      this.emit({ x: x + rand(-2, 2), y: y + rand(-2, 2), vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), gy: o.gy || 0, drag: o.drag || 0.93, life: rand(o.l0 || 18, o.l1 || 38), s0: o.s0 || 14, s1: o.s1 || 2, c0: color[0], c1: color[1], a0: o.a0 || 0.9, a1: 0, kind: o.kind === undefined ? 0 : o.kind, rot: rand(TAU), vrot: rand(-0.1, 0.1) }); }
  }
  ring(x, y, r1, color = [1, 1, 1], life = 24, thick = 0.18, r0 = 4) { return this.quad({ kind: 'ring', x, y, w: r0 * 2, w1: r1 * 2, life, color, p: [thick], a0: 0.9, a1: 0 }); }
  flash(color = [1, 1, 1], a = 0.6) { this.flashCol = color; this.flashA = Math.max(this.flashA, a); }
  hurtFlash(a = 1) { this.hurt = Math.max(this.hurt, a); }

  smoke(x, y, n = 1, o = {}) { for (let i = 0; i < n; i++) this.emit({ layer: 'alpha', x: x + rand(-3, 3), y, vx: rand(-0.2, 0.2) + (o.drift || 0), vy: -rand(0.2, 0.6), life: rand(40, 80) * (o.l || 1), s0: o.s0 || 8, s1: o.s1 || 22, c0: o.c0 || [0.1, 0.08, 0.14], c1: o.c1 || [0.04, 0.03, 0.06], a0: o.a || 0.5, a1: 0, kind: 5, drag: 0.99 }); }

  // Candle / torch / fire flame, drawn for a single frame.  Call every logic step while visible.
  flame(x, y, o = {}) {
    const sc = o.scale || 1, pal = COLORS[o.color || 'warm'], t = this.time, seed = o.seed || 0;
    const fl = 0.8 + 0.2 * noise1(t * 7 + seed * 13) + 0.1 * Math.sin(t * 31 + seed);                // flicker
    this.add.add({ x, y: y - 3 * sc, life: 1, s0: 10 * sc, s1: 10 * sc, c0: pal[0], a0: 1, a1: 1, kind: 7, rot: seed });                                 // the flame itself
    this.add.add({ x, y: y - 4 * sc, life: 1, s0: (o.glow || 1) * 54 * sc * fl, s1: (o.glow || 1) * 54 * sc * fl, c0: pal[1], a0: 0.28 * fl, a1: 0.28 * fl, kind: 0 });
    if (o.sparks !== false && Math.random() < 0.08 * sc) this.emit({ x: x + rand(-2, 2), y: y - 6 * sc, vx: rand(-0.15, 0.15), vy: -rand(0.4, 0.9), life: rand(24, 50), s0: 2, s1: 0.5, c0: pal[0], c1: pal[1], a0: 1, a1: 0, kind: 1, gx: 0, drag: 0.99 });
  }
  // a fireball in flight, made of light and flame (no sprite): a halo, a glowing body, a white-hot core, and a tail of flames licking back and up.  Call every logic step.
  fireOrb(x, y, vx, vy, sc = 1) {
    const fl = 0.88 + 0.12 * Math.sin(this.time * 41 + x * 0.3) + 0.06 * Math.sin(this.time * 67);
    this.add.add({ x, y, life: 1, s0: 40 * sc * fl, s1: 40 * sc * fl, c0: [1, 0.42, 0.08], a0: 0.3, a1: 0.3, kind: 0 });
    this.add.add({ x, y, life: 1, s0: 22 * sc * fl, s1: 22 * sc * fl, c0: [1, 0.72, 0.22], a0: 0.85, a1: 0.85, kind: 0 });
    this.add.add({ x, y, life: 1, s0: 10 * sc, s1: 10 * sc, c0: [1, 0.97, 0.82], a0: 1, a1: 1, kind: 0 });
    for (let i = 0; i < 2; i++) this.emit({ x: x - vx * rand(0, 2.5) + rand(-1.5, 1.5), y: y - vy * rand(0, 2.5) + rand(-2, 2), vx: -vx * 0.15 + rand(-0.2, 0.2), vy: -rand(0.2, 0.75) - vy * 0.1, drag: 0.97, life: rand(12, 22), s0: 14 * sc, s1: 2, c0: [1, 0.8, 0.3], c1: [0.9, 0.2, 0.05], a0: 0.9, a1: 0, kind: 2 });
  }
  // bigger roaring fire (brazier, burning enemies, fire patches)
  fire(x, y, o = {}) {
    const sc = o.scale || 1, pal = COLORS[o.color || 'fire'], n = o.n || 2;
    for (let i = 0; i < n; i++) this.emit({ x: x + rand(-4, 4) * sc, y, vx: rand(-0.3, 0.3), vy: -rand(0.7, 1.5) * sc, drag: 0.98, life: rand(16, 30), s0: 14 * sc, s1: 3 * sc, c0: pal[0], c1: pal[1], a0: 0.95, a1: 0, kind: 2, rot: rand(-0.15, 0.15) });
    this.glow(x, y - 6 * sc, 36 * sc, pal[1], 0.22 + 0.06 * Math.sin(this.time * 20 + x));
    if (Math.random() < 0.15) this.emit({ x: x + rand(-5, 5), y: y - 4, vx: rand(-0.3, 0.3), vy: -rand(0.5, 1.2), life: rand(40, 80), s0: 2, s1: 0.5, c0: pal[0], c1: pal[1], kind: 1 });
  }
  // fire breath cone: from (x,y) toward angle, length px
  jet(x, y, ang, color = COLORS.fire, o = {}) {
    for (let i = 0; i < (o.n || 4); i++) { const a = ang + rand(-(o.spread || 0.18), o.spread || 0.18), v = rand(2.2, o.speed || 4.2);
      this.emit({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, drag: 0.975, life: rand(14, 26), s0: 6, s1: o.size || 22, c0: color[0], c1: color[1], a0: 0.9, a1: 0, kind: 2, rot: a - Math.PI / 2 }); }
  }
  souls(x, y, n = 6, color = COLORS.blue) { for (let i = 0; i < n; i++) this.emit({ x: x + rand(-8, 8), y: y + rand(-10, 4), vx: rand(-0.3, 0.3), vy: -rand(0.5, 1.4), gx: -0.004, drag: 0.99, life: rand(40, 80), s0: 7, s1: 1, c0: color[0], c1: color[1], a0: 0.95, a1: 0, kind: 6 }); }

  // ---- lightning --------------------------------------------------
  bolt(x0, y0, x1, y1, o = {}) {
    const pts = [[x0, y0]]; const segs = o.segs || 18, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, amp = o.amp || len * 0.07;
    for (let i = 1; i < segs; i++) { const t = i / segs, off = (Math.random() * 2 - 1) * amp * Math.sin(Math.PI * t) ** 0.5; pts.push([x0 + dx * t + nx * off, y0 + dy * t + ny * off]); }
    pts.push([x1, y1]);
    const lines = [pts];
    const branches = o.branches === undefined ? 3 : o.branches;
    for (let b = 0; b < branches; b++) {
      const si = 2 + Math.floor(Math.random() * (pts.length - 5)), s = pts[si], ang = Math.atan2(dy, dx) + (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.9), bl = len * rand(0.12, 0.3), bp = [s];
      for (let i = 1; i <= 7; i++) { const t = i / 7, a2 = ang + rand(-0.35, 0.35); bp.push([s[0] + Math.cos(ang) * bl * t + Math.cos(a2 + 1.57) * rand(-4, 4), s[1] + Math.sin(ang) * bl * t + Math.sin(a2 + 1.57) * rand(-4, 4)]); }
      lines.push(bp);
    }
    const bolt = { life: 0, max: o.life || 22, parts: [], col: o.color || [0.75, 0.85, 1] };
    lines.forEach((pl, li) => {
      const n = pl.length, pos = new Float32Array(n * 2 * 3), side = new Float32Array(n * 2), norm = new Float32Array(n * 2 * 2), idx = [];
      for (let i = 0; i < n; i++) {
        const a = pl[Math.max(0, i - 1)], b = pl[Math.min(n - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, px = -ty / tl, py = tx / tl;
        for (let s = 0; s < 2; s++) { const k = i * 2 + s; pos[k * 3] = pl[i][0]; pos[k * 3 + 1] = pl[i][1]; pos[k * 3 + 2] = 0; side[k] = s ? 1 : -1; norm[k * 2] = px; norm[k * 2 + 1] = py; }
        if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSide', new THREE.BufferAttribute(side, 1)); g.setAttribute('aNorm', new THREE.BufferAttribute(norm, 2)); g.setIndex(idx);
      const k = li === 0 ? 1 : 0.55;
      for (const [w, pw, c, ord] of [[(o.width || 16) * k, 2.2, bolt.col, 4], [(o.width || 16) * 0.22 * k, 1.2, [1, 1, 1], 5]]) {
        const mat = new THREE.ShaderMaterial({ vertexShader: BVERT, fragmentShader: BFRAG, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...ADD, uniforms: { uWidth: { value: w }, uColor: { value: new THREE.Color(...c) }, uAlpha: { value: 1 }, uPow: { value: pw } } });
        const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = ord; this.scene.add(m); bolt.parts.push(m);
      }
      bolt.geos = (bolt.geos || []).concat(g);
    });
    this.bolts.push(bolt);
    // impact sparks
    if (o.impact !== false) { this.sparks(x1, y1, 14, COLORS.white, 3.5, { dir: -Math.PI / 2, spread: 1.4 }); this.glow(x1, y1, 40, [0.7, 0.8, 1], 0.8, 8); }
    return bolt;
  }
  // screen-wide sky strike for storm rooms
  strike(x, groundY, o = {}) {
    const top = this.camY - 30; this.bolt(x + rand(-30, 30), top, x, groundY, { width: o.width || 18, segs: 22, branches: 4, life: 26 });
    this.flash([0.7, 0.8, 1], o.flash === undefined ? 0.55 : o.flash);
    this.pendingThunder.push({ t: o.thunderDelay === undefined ? rand(10, 50) : o.thunderDelay, power: o.power || 1 });
  }
  // storm: random lightning while a room has weather
  setStorm(on, rate = 0.0025) { this.storm = on ? rate : null; }

  setWisps(n) { const k = n / 3, f = Math.floor(k); this.wisps.set(f + (Math.random() < k - f ? 1 : 0)); }          // (a third as many as a room asks for: 4 -> 1, sometimes 2)
  // ---- gusts and fog ----------------------------------------------
  // a puff of moving air at (x, y) travelling (vx, vy) px/step: s = strength, r = reach.  The swish of a sword, a dash.  It shoves smoke, embers and fog (and the game leans flames away from it).
  gust(x, y, vx, vy, r = 32, s = 1, life = 26) { this.gusts.push({ x, y, vx, vy, r, s, k: s, life: 0, max: life }); if (this.gusts.length > 6) this.gusts.shift(); }
  // rolling ground fog: density 0 = none; base = world y of the ground line; color = its tint
  setFog(density, base, color = [0.64, 0.7, 0.8], height = 105) { const u = this.fogU; u.uDensity.value = (density || 0) * 0.9; u.uBase.value = base; u.uColor.value.set(color[0], color[1], color[2]); u.uHeight.value = height; }

  // ---- lights / darkness ---------------------------------------
  // A room's `ambient` (0..~0.6, how gloomy it is relative to the others) is lifted onto a floor of darkness: even the lightest room is dim enough that a torch, a candle, a brazier or a lightning flash
  // visibly lights what is around it (before this, a 0.1-0.35 veil made the lights almost invisible).  Lightning and other big flashes pull the veil back for a moment (render()).
  setAmbient(amount, tint = [0.015, 0.01, 0.05], vig = 0.5) {
    const lit = !(amount > 0);                                                                          // 0 = a lit scene (the title screen, the ending): no darkness and no vignette
    this.ambBase = lit ? 0 : DARK_FLOOR + amount * DARK_SLOPE; this.darkU.uMax.value = 0.86; this.darkU.uAmbient.value = this.ambBase; this.darkU.uTint.value.set(...tint); this.darkU.uVig.value = lit ? 0 : vig * VIG_SCALE;
  }
  // a DARK room (def.dark): almost black; only a light - the wisp, a candle, a flame - shows what is round it
  setDark(level = 1.1) { this.ambBase = level; this.darkU.uAmbient.value = level; this.darkU.uMax.value = 0.975; }
  clearLights() { this.lights.length = 0; }
  light(x, y, r, intensity = 1, col = null) { if (this.lights.length < 24) this.lights.push([x, y, r, intensity, col]); }       // col: the colour of its pool of light (default a warm flame colour)   // world coords; made screen-relative at render time

  // ---- ambient weather ------------------------------------------
  setAmbientFx(type) { this.ambient = type; }
  weather(dt) {
    const t = this.ambient; if (!t || !(dt > 0)) return;                          // (dt 0 = the world is held, e.g. behind a dialogue box: nothing may fall, or it would all come down at once afterwards)
    const cx = this.camX, cy = this.camY; let n = 0;
    if (t === 'rain') { this.rainAcc = (this.rainAcc || 0) + 3 * dt; n = Math.floor(this.rainAcc); this.rainAcc -= n; }          // 3 drops per full step, scaled by the step length (slow-motion and hit-stop run at half steps)
    if (t === 'rain') for (let i = 0; i < n; i++) this.emit({ x: cx + rand(-60, W + 100), y: cy - 10, vx: -1.6, vy: rand(7, 9.5), life: 40, s0: 9, s1: 9, c0: [0.55, 0.65, 0.9], a0: 0.45, a1: 0.35, kind: 4, rot: Math.atan2(9, -1.6) });
    else if (t === 'mist') { if (Math.random() < 0.12 * dt) this.emit({ layer: 'alpha', x: cx + rand(-30, W + 30), y: cy + rand(H * 0.6, H), vx: rand(0.1, 0.35), vy: rand(-0.04, 0.02), life: 260, s0: 90, s1: 130, c0: [0.28, 0.32, 0.4], a0: 0.0, a1: 0.0, kind: 5 }); }
    else if (t === 'dust') { if (Math.random() < 0.25 * dt) this.emit({ x: cx + rand(0, W), y: cy + rand(0, H), vx: rand(-0.1, 0.1), vy: rand(-0.08, 0.05), life: rand(120, 240), s0: 2.5, s1: 1.5, c0: [1, 0.85, 0.55], a0: 0.0, a1: 0.0, kind: 6 }); }
    else if (t === 'embers') { if (Math.random() < 0.3 * dt) this.emit({ x: cx + rand(0, W), y: cy + H + 4, vx: rand(-0.3, 0.3), vy: -rand(0.3, 0.9), life: rand(120, 240), s0: 2.5, s1: 1, c0: [1, 0.55, 0.2], c1: [0.7, 0.1, 0.05], a0: 0.9, a1: 0, kind: 1 }); }
    else if (t === 'wisps') { if (Math.random() < 0.06 * dt) this.emit({ x: cx + rand(0, W), y: cy + rand(H * 0.3, H), vx: rand(-0.15, 0.15), vy: -rand(0.1, 0.35), life: rand(160, 300), s0: 9, s1: 3, c0: [0.5, 0.75, 1], c1: [0.4, 0.3, 0.9], a0: 0.8, a1: 0, kind: 6 }); }
    else if (t === 'sparks') { if (Math.random() < 0.12 * dt) this.emit({ x: cx + rand(0, W), y: cy + rand(0, H * 0.5), vx: rand(-0.6, 0.6), vy: rand(0, 0.5), gy: 0.05, life: rand(30, 60), s0: 2.5, s1: 1, c0: [1, 0.85, 0.4], c1: [1, 0.4, 0.1], a0: 1, a1: 0, kind: 1 }); }
  }

  // ------------------------------------------------------------ per-step update
  update(dt = 1) {
    this.time += dt / 60;
    this.add.update(dt); this.alpha.update(dt);
    for (let i = this.gusts.length - 1; i >= 0; i--) {
      const g = this.gusts[i]; g.life += dt; if (g.life > g.max) { this.gusts.splice(i, 1); continue; }
      g.x += g.vx * 0.35 * dt; g.y += g.vy * 0.35 * dt; g.k = g.s * Math.pow(1 - g.life / g.max, 1.5); this.add.push(g); this.alpha.push(g);
    }
    for (let i = this.quads.length - 1; i >= 0; i--) {
      const q = this.quads[i]; q.life += dt; if (q.follow) q.follow(q);
      const t = q.hold ? 0.5 : q.life / q.max;
      if (q.kill || (!q.hold && q.life > q.max)) { q.m.visible = false; this.quadPool.push(q.m); this.quads.splice(i, 1); continue; }
      q.rot += q.spin * dt;
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.life += dt;
      if (b.life > b.max) { for (const m of b.parts) { this.scene.remove(m); m.material.dispose(); } for (const g of b.geos) g.dispose(); this.bolts.splice(i, 1); }
    }
    this.flashA = Math.max(0, this.flashA - 0.035 * dt); this.hurt = Math.max(0, this.hurt - 0.03 * dt);
    if (this.storm && Math.random() < this.storm * dt) {
      this.strike(this.camX + rand(20, W - 20), this.camY + H * 0.85);
      if (Math.random() < 0.35) setTimeout(() => this.flash([0.7, 0.8, 1], 0.4), 90);
    }
    for (let i = this.pendingThunder.length - 1; i >= 0; i--) { const p = this.pendingThunder[i]; p.t -= dt; if (p.t <= 0) { if (this.onThunder) this.onThunder(p.power); this.pendingThunder.splice(i, 1); } }
    this.weather(dt);
    if (dt > 0) this.wisps.update(dt);
  }

  // ------------------------------------------------------------ render
  render() {
    const u = this.darkU; u.uCount.value = this.lights.length;
    for (let i = 0; i < this.lights.length; i++) { const l = this.lights[i], c = l[4] || WARM; u.uLights.value[i].set(l[0] - this.camX, l[1] - this.camY, l[2], l[3]); u.uLightCol.value[i].set(c[0], c[1], c[2]); }
    u.uHurt.value = this.hurt; u.uAmbient.value = (this.ambBase === undefined ? u.uAmbient.value : this.ambBase) * (1 - Math.min(0.85, this.flashA * 1.15));        // a flash (lightning...) lights the whole scene while it lasts
    { const F = this.fogU; this.fogMesh.visible = F.uDensity.value > 0.01;
      if (this.fogMesh.visible) { F.uCam.value.set(this.camX + this.shakeX, this.camY + this.shakeY); F.uTime.value = this.time;
        for (let i = 0; i < 6; i++) { const wf = this.wisps.fog(i); F.uW.value[i].set(wf[0], wf[1], wf[2], wf[3]); }
        if (this.lantern) F.uW.value[5].set(this.lantern.x, this.lantern.y, 150, 0.92);          // (the Marshlight Lantern's wisp)
        for (let i = 0; i < 6; i++) { const g = this.gusts[i]; if (g) { F.uG.value[i].set(g.x, g.y, g.vx, g.vy); F.uGP.value[i].set(g.r, g.k); } else { F.uG.value[i].set(0, 0, 0, 0); F.uGP.value[i].set(1, 0); } } } }
    if (this.waterMesh.visible) { this.waterU.uCam.value.set(this.camX + this.shakeX, this.camY + this.shakeY); this.waterU.uTime.value = this.time; }
    this.add.mat.uniforms.uTime.value = this.time; this.alpha.mat.uniforms.uTime.value = this.time;
    this.add.upload(); this.alpha.upload();
    for (const q of this.quads) {
      const t = q.hold ? 0.5 : clamp(q.life / q.max, 0, 1), m = q.m, uu = m.userData.mat.uniforms;
      const w = q.w + (q.w1 - q.w) * (q.hold ? 1 : 1 - Math.pow(1 - t, 2)), h = q.h + (q.h1 - q.h) * (q.hold ? 1 : 1 - Math.pow(1 - t, 2));
      m.position.set(q.x, q.y, 0); m.scale.set(w, h, 1); m.rotation.z = q.rot;
      uu.uAlpha.value = (q.a0 + (q.a1 - q.a0) * t) * (q.pulse ? 0.75 + 0.25 * Math.sin(this.time * q.pulse) : 1); uu.uTime.value = this.time;
      if (q.kind === 'circle') uu.uP.value.x = q.rot;
      if (q.kind === 'rays') uu.uP.value.x = q.rot;
    }
    for (const b of this.bolts) {
      const t = b.life / b.max; const fl = t < 0.15 ? 1 : (0.55 + 0.45 * Math.sin(b.life * 2.4 + 1)) * (1 - (t - 0.15) / 0.85) ** 1.2;
      for (const m of b.parts) m.material.uniforms.uAlpha.value = Math.max(0, fl);
    }
    const fm = this.flashMesh; fm.visible = this.flashA > 0.01;
    if (fm.visible) { const uu = fm.userData.mat.uniforms; uu.uAlpha.value = this.flashA; uu.uColor.value.setRGB(...this.flashCol); }
    this.renderer.render(this.scene, this.cam);
  }
}
