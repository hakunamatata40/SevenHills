// Les sept collines de Yaoundé : un relief en lignes de niveau dorées,
// un soleil qui se lève derrière, de la poussière d'or en suspension.
import * as THREE from 'three';

const HILLS = [
  // x, z, hauteur, rayon
  [-15, -14, 4.6, 5.5],
  [-8, -22, 6.2, 7.0],
  [-4.5, -9, 2.6, 3.6],
  [3, -26, 7.4, 8.0],
  [7, -11, 3.2, 4.2],
  [13, -18, 5.4, 6.0],
  [19, -9, 3.0, 4.6],
];

function heightAt(x, z) {
  let h = 0;
  for (const [hx, hz, hh, r] of HILLS) {
    const d2 = (x - hx) ** 2 + (z - hz) ** 2;
    h += hh * Math.exp(-d2 / (r * r));
  }
  // léger modelé du terrain
  h += Math.sin(x * 0.35) * Math.cos(z * 0.28) * 0.18 + Math.sin(x * 1.1 + z * 0.7) * 0.05;
  return h;
}

const terrainVert = /* glsl */ `
  uniform float uTime;
  varying float vH;
  varying float vDepth;
  varying vec2 vXZ;
  void main() {
    vec3 p = position;
    p.y += sin(p.x * .4 + uTime * .5) * cos(p.z * .3 + uTime * .35) * .06;
    vH = p.y;
    vXZ = p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const terrainFrag = /* glsl */ `
  uniform vec3 uGold;
  uniform vec3 uDeep;
  uniform float uReveal;
  uniform float uTime;
  varying float vH;
  varying float vDepth;
  varying vec2 vXZ;

  float gridLine(float v, float thickness) {
    float w = fwidth(v);
    float f = abs(fract(v - .5) - .5);
    return 1. - smoothstep(0., w * thickness, f);
  }

  void main() {
    // lignes de niveau
    float contour = gridLine(vH * 4.0, 1.25);
    // sillons, comme dans le logo
    float furrow = gridLine(vXZ.y * .9 + sin(vXZ.x * .18) * 1.2, 1.0) * .35 * smoothstep(.6, 0., vH);

    float near = smoothstep(56., 6., vDepth);
    float reveal = smoothstep(uReveal * 60. + 2., uReveal * 60. - 6., vDepth);

    // halo du soleil sur les crêtes
    float glow = smoothstep(-20., -40., vXZ.y) * .5;

    float l = max(contour, furrow);
    vec3 col = mix(uDeep, uGold * (0.9 + vH * .08 + glow), l * near * reveal);
    // pente plus claire vers le sommet
    col += uGold * .035 * vH * near * reveal;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const sunFrag = /* glsl */ `
  uniform vec3 uGold;
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - .5;
    float r = length(p);
    float disc = smoothstep(.15, .145, r) * (.55 + .45 * smoothstep(.15, -.05, p.y + .02));
    float halo = exp(-r * 7.) * .55;
    float a = atan(p.y, p.x);
    float rays = pow(abs(sin(a * 9. + uTime * .05)), 24.) * smoothstep(.5, .18, r) * smoothstep(.16, .2, r) * .5;
    float ring = (1. - smoothstep(0., .004, abs(r - .23))) * .35;
    float v = disc * .75 + halo + rays + ring;
    gl_FragColor = vec4(uGold * v * uIntensity, v * uIntensity);
  }
`;

export function createHills(canvas, { touch = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touch ? 1.5 : 1.75));
  renderer.setClearColor(0x0b0a08, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  const gold = new THREE.Color('#d4ad6c');
  const deep = new THREE.Color('#0b0a08');

  // --- Terrain
  const segs = window.innerWidth < 700 ? 200 : 320;
  const geo = new THREE.PlaneGeometry(80, 70, segs, segs);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -18);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const terrainMat = new THREE.ShaderMaterial({
    vertexShader: terrainVert,
    fragmentShader: terrainFrag,
    uniforms: {
      uGold: { value: gold },
      uDeep: { value: deep },
      uReveal: { value: 0 },
      uTime: { value: 0 },
    },
    extensions: { derivatives: true },
  });
  scene.add(new THREE.Mesh(geo, terrainMat));

  // --- Soleil
  const sunMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: sunFrag,
    uniforms: { uGold: { value: new THREE.Color('#e8c58a') }, uTime: { value: 0 }, uIntensity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), sunMat);
  sun.position.set(-1, -2, -46);
  sun.renderOrder = -1;
  scene.add(sun);

  // --- Poussière d'or
  const N = window.innerWidth < 700 ? 350 : 700;
  const pGeo = new THREE.BufferGeometry();
  const pArr = new Float32Array(N * 3);
  const seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pArr[i * 3] = (Math.random() - 0.5) * 50;
    pArr[i * 3 + 1] = Math.random() * 10 + 0.2;
    pArr[i * 3 + 2] = -Math.random() * 40 + 8;
    seeds[i] = Math.random() * 100;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
  pGeo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uGold: { value: new THREE.Color('#f0d39c') }, uPR: { value: renderer.getPixelRatio() }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime; uniform float uPR;
      varying float vTw;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * .3 + seed) * .4;
        p.x += cos(uTime * .2 + seed * 1.3) * .5;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vTw = .5 + .5 * sin(uTime * 1.5 + seed * 4.);
        gl_PointSize = (2.2 + vTw * 2.) * uPR * (14. / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uGold; uniform float uAlpha; varying float vTw;
      void main(){
        float d = length(gl_PointCoord - .5);
        float a = smoothstep(.5, 0., d) * (.25 + vTw * .6) * uAlpha;
        gl_FragColor = vec4(uGold, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  // --- État piloté depuis l'extérieur
  const state = { reveal: 0, sun: 0, progress: 0, mx: 0, my: 0, cx: 0, cy: 0 };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 58 : 42;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  if (!touch) {
    window.addEventListener('pointermove', (e) => {
      state.mx = (e.clientX / window.innerWidth) * 2 - 1;
      state.my = (e.clientY / window.innerHeight) * 2 - 1;
    });
  } else {
    // Sur mobile : le téléphone incliné fait bouger la caméra (Android),
    // sinon un lent mouvement de balancier remplace la souris.
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      state.tilt = true;
      state.mx = Math.max(-1, Math.min(1, e.gamma / 25));
      state.my = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    });
  }

  let running = true;
  const clock = new THREE.Clock();

  function frame() {
    if (!running) return;
    const t = clock.getElapsedTime();
    if (touch && !state.tilt) {
      state.mx = Math.sin(t * 0.22) * 0.55;
      state.my = Math.cos(t * 0.17) * 0.25;
    }
    state.cx += (state.mx - state.cx) * 0.04;
    state.cy += (state.my - state.cy) * 0.04;

    terrainMat.uniforms.uTime.value = t;
    terrainMat.uniforms.uReveal.value = state.reveal;
    sunMat.uniforms.uTime.value = t;
    sunMat.uniforms.uIntensity.value = state.sun;
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uAlpha.value = state.reveal;

    const p = state.progress;
    // le soleil monte avec l'arrivée puis avec le défilement
    sun.position.y = -4 + state.sun * 13 + p * 6;
    // survol : on avance au-dessus des collines
    camera.position.set(state.cx * 1.8, 6.2 + p * 5 - state.cy * 0.6, 15 - p * 13);
    camera.lookAt(state.cx * 0.6, 1.6 + p * 1.2, -24);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    state,
    pause() { running = false; },
    play() { if (!running) { running = true; requestAnimationFrame(frame); } },
  };
}
