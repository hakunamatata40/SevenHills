import { createHills } from './hills.js?v=6';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const touch = !finePointer;

/* ---------- Qualité selon la connexion ----------
   Le site s'affiche toujours d'abord en version légère.
   La HD n'est chargée qu'ensuite, si la connexion le permet,
   et seulement là où elle se voit (grands visuels). */
const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const saveData = !!(conn && conn.saveData);
const slowNet = saveData || !!(conn && (/2g/.test(conn.effectiveType) || (conn.downlink && conn.downlink < 1.2)));
// Sans API réseau (Safari), on ne prend la HD que sur grand écran.
const allowHD = !slowNet && (conn ? !/3g/.test(conn.effectiveType) : window.innerWidth >= 900);
// Les vidéos légères (0,4 à 1,4 Mo) sont toujours chargées : seule la HD dépend du réseau.
const allowVideo = true;
document.documentElement.classList.toggle('is-touch', touch);

ScrollTrigger.config({ ignoreMobileResize: true });
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

document.querySelectorAll('.year').forEach((el) => (el.textContent = new Date().getFullYear()));

/* ---------- Découpage du texte ---------- */
function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.innerHTML = [...text].map((c) => `<span class="ch" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
  return $$('.ch', el);
}
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  return $$('.w', el);
}

/* ---------- Défilement doux ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.25, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else target.scrollIntoView();
  });
});

/* ---------- Menu mobile ---------- */
const burger = $('.nav-burger');
const overlay = $('.menu-overlay');
function closeMenu() {
  burger.setAttribute('aria-expanded', 'false');
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
}
burger.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') !== 'true';
  burger.setAttribute('aria-expanded', String(open));
  overlay.classList.toggle('is-open', open);
  overlay.setAttribute('aria-hidden', String(!open));
  if (open) gsap.fromTo($$('.menu-overlay nav a'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 1, ease: 'expo.out', delay: 0.2 });
});

/* ---------- Navigation qui se cache ---------- */
const nav = $('.nav');
let lastY = 0;
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onUpdate(self) {
    const y = self.scroll();
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 300 && !overlay.classList.contains('is-open'));
    lastY = y;
  },
});

/* ---------- Curseur ---------- */
const cursor = $('.cursor');
if (finePointer) {
  const label = $('.cursor-label');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { xTo(e.clientX); yTo(e.clientY); });
  $$('a, button').forEach((el) => {
    el.addEventListener('mouseenter', () => cursor.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-hover'));
  });
  $$('[data-cursor]').forEach((el) => {
    el.addEventListener('mouseenter', () => { label.textContent = el.dataset.cursor; cursor.classList.add('is-label'); });
    el.addEventListener('mouseleave', () => cursor.classList.remove('is-label'));
  });

  // boutons aimantés
  $$('[data-magnetic]').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, .4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.3);
      my((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); });
  });
}

/* ---------- Hero 3D ---------- */
let hills = null;
try {
  hills = createHills($('.hero-canvas'), { touch });
} catch (err) {
  console.warn('WebGL indisponible', err);
}

const heroChars = $$('.hero-title .split').flatMap(splitChars);

/* ---------- Préchargement puis entrée ---------- */
function intro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  const strokes = $$('.loader-emblem .e-frame, .loader-emblem .e-line');
  const num = $('.loader-num');
  const counter = { v: 1 };

  tl.to(strokes, { strokeDashoffset: 0, duration: 1.8, stagger: 0.12, ease: 'power2.inOut' })
    .to(counter, {
      v: 7, duration: 1.8, ease: 'power1.inOut',
      onUpdate: () => (num.textContent = String(Math.round(counter.v)).padStart(2, '0')),
    }, 0)
    .to('.loader-emblem, .loader-count, .loader-word', { opacity: 0, y: -20, duration: 0.6, stagger: 0.05, ease: 'power2.in' }, '+=0.15')
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.2, ease: 'expo.inOut' }, '-=0.15')
    .add(() => {
      document.body.classList.remove('is-loading');
      lenis && lenis.start();
      $('.loader').remove();
    })
    .to(hills ? hills.state : {}, { reveal: 1, duration: 3.2, ease: 'power2.out' }, '-=0.9')
    .to(hills ? hills.state : {}, { sun: 1, duration: 3.5, ease: 'power2.out' }, '<0.4')
    .from(heroChars, { yPercent: 110, rotate: 6, duration: 1.6, stagger: 0.05 }, '<0.2')
    .from('.hero-kicker', { opacity: 0, y: 20, duration: 1.2 }, '<0.3')
    .from('.hero-kicker .line', { scaleX: 0, duration: 1.4 }, '<')
    .from('.hero-sub', { opacity: 0, y: 30, duration: 1.4 }, '<0.2')
    .from('.hero-meta > *', { opacity: 0, y: 16, duration: 1.2, stagger: 0.1 }, '<0.2')
    .from('.nav > *', { opacity: 0, y: -20, duration: 1.2, stagger: 0.08 }, '<');
}

if (reduced) {
  $('.loader').remove();
  document.body.classList.remove('is-loading');
  if (hills) Object.assign(hills.state, { reveal: 1, sun: 1 });
} else {
  const ready = Promise.race([
    Promise.all([document.fonts.ready, new Promise((r) => window.addEventListener('load', r, { once: true }))]),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
  ready.then(intro);
}

/* ---------- Animations au défilement ---------- */
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {
  // Survol des collines
  if (hills) {
    ScrollTrigger.create({
      trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (s) => (hills.state.progress = s.progress),
      onLeave: () => hills.pause(),
      onEnterBack: () => hills.play(),
    });
  }
  gsap.to('.hero-inner', {
    yPercent: -30, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Manifeste mot à mot
  const words = splitWords($('[data-words]'));
  gsap.to(words, {
    opacity: 1, stagger: 0.08, ease: 'none',
    scrollTrigger: { trigger: '.manifesto-text', start: 'top 80%', end: 'bottom 45%', scrub: true },
  });
  gsap.from('.fact', {
    y: 50, opacity: 0, duration: 1.4, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.facts', start: 'top 85%' },
  });
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const o = { v: 0 };
    gsap.to(o, {
      v: end, duration: 1.6, ease: 'power2.out',
      onUpdate: () => (el.textContent = Math.round(o.v)),
      scrollTrigger: { trigger: el, start: 'top 90%' },
    });
  });

  // Arche qui s'ouvre sur la salle
  const archTl = gsap.timeline({
    scrollTrigger: {
      trigger: '.arch-reveal', start: 'top top', end: '+=160%', scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
    },
  });
  archTl
    .to('.arch-window', { width: () => window.innerWidth, height: () => window.innerHeight, borderRadius: '0px 0px 0px 0px', ease: 'power2.inOut' })
    .to('.arch-video', { scale: 1, ease: 'power2.inOut' }, 0)
    .fromTo('.arch-l', { xPercent: 0 }, { xPercent: -60, ease: 'none' }, 0)
    .fromTo('.arch-r', { xPercent: 0 }, { xPercent: 60, ease: 'none' }, 0)
    .to('.arch-caption', { opacity: 0, duration: 0.25 }, 0.75);

  // Titres
  $$('.display').forEach((el) => {
    gsap.from(el, {
      yPercent: 40, opacity: 0, rotateX: -40, transformOrigin: '50% 100%', duration: 1.6, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
  $$('.label').forEach((el) => {
    gsap.from(el, { opacity: 0, x: -20, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
  });

  // Défilement horizontal du lieu
  const track = $('.place-track');
  const distance = () => track.scrollWidth - window.innerWidth;
  const horiz = gsap.to(track, {
    x: () => -distance(), ease: 'none',
    scrollTrigger: {
      trigger: '.place-pin', start: 'top top', end: () => '+=' + distance(), scrub: touch ? 0.6 : 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
    },
  });
  $$('.panel-media img').forEach((img) => {
    gsap.fromTo(img, { xPercent: -8 }, {
      xPercent: 8, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, containerAnimation: horiz, start: 'left right', end: 'right left', scrub: true },
    });
  });
  gsap.from('.panel', {
    y: 120, opacity: 0, duration: 1.6, stagger: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: '.place-pin', start: 'top 85%' },
  });

  // Carte
  gsap.from('.dish', {
    y: 60, opacity: 0, duration: 1.2, stagger: 0.07, ease: 'expo.out',
    scrollTrigger: { trigger: '.dishes', start: 'top 80%' },
  });

  // Tactile : le plat au centre de l'écran s'allume, comme au survol sur ordinateur
  if (touch) {
    $$('.dish').forEach((d) => {
      ScrollTrigger.create({ trigger: d, start: 'top 50%', end: 'bottom 50%', toggleClass: 'is-active' });
    });
    // les visuels du bar pivotent avec le défilement à la place de la souris
    $$('[data-tilt]').forEach((el, i) => {
      gsap.fromTo(el, { rotationY: i ? 14 : -14, rotationX: 6 }, {
        rotationY: i ? -14 : 14, rotationX: -6, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
  }

  // Bandeau qui défile, accéléré par le scroll
  const marquee = $('.marquee-track');
  const loop = gsap.to(marquee, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    trigger: '.bar', start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => {
      const v = s.getVelocity() / 400;
      gsap.to(loop, { timeScale: 1 + Math.abs(v), duration: 0.3, overwrite: true });
      gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.3 });
    },
  });

  gsap.from('.bar-v1', { yPercent: 25, rotateY: -25, opacity: 0, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: '.bar-visuals', start: 'top 80%' } });
  gsap.from('.bar-v2', { yPercent: 35, rotateY: 25, opacity: 0, duration: 1.8, delay: 0.15, ease: 'expo.out', scrollTrigger: { trigger: '.bar-visuals', start: 'top 80%' } });
  gsap.fromTo('.bar-float', { yPercent: 40 }, { yPercent: -40, ease: 'none', scrollTrigger: { trigger: '.bar-visuals', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Événements
  gsap.from('.occasions li', {
    y: 60, opacity: 0, duration: 1.3, stagger: 0.1, ease: 'expo.out',
    scrollTrigger: { trigger: '.occasions', start: 'top 82%' },
  });
  gsap.fromTo('.private img', { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.private', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.from('.events', {
    clipPath: 'inset(8% 6% 0% 6% round 60px)', ease: 'none',
    scrollTrigger: { trigger: '.events', start: 'top bottom', end: 'top 30%', scrub: true },
  });

  // Infos
  gsap.from('.info-list > div', { y: 30, opacity: 0, duration: 1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.info-list', start: 'top 85%' } });
  gsap.from('.map-wrap', { clipPath: 'inset(100% 0 0 0)', duration: 1.8, ease: 'expo.inOut', scrollTrigger: { trigger: '.map-wrap', start: 'top 85%' } });

  // Grand mot du pied de page
  const footChars = $$('.footer-word span').flatMap(splitChars);
  gsap.from(footChars, {
    yPercent: 100, opacity: 0, stagger: 0.04, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: '.footer-word', start: 'top 95%' },
  });
});

/* ---------- Aperçu des plats au survol ---------- */
if (finePointer && !reduced) {
  const preview = $('.dish-preview');
  const pImg = $('img', preview);
  const px = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
  const py = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
  let rot = 0;
  let lastX = 0;
  window.addEventListener('pointermove', (e) => {
    px(e.clientX); py(e.clientY);
    rot = gsap.utils.clamp(-14, 14, (e.clientX - lastX) * 0.6);
    lastX = e.clientX;
    gsap.to(preview, { rotate: rot, duration: 0.6, ease: 'power3' });
  });
  $$('.dish').forEach((d) => {
    d.addEventListener('mouseenter', () => {
      pImg.src = (allowHD && d.dataset.imgHd) || d.dataset.img;
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
    });
    d.addEventListener('mouseleave', () => gsap.to(preview, { opacity: 0, scale: 0.6, duration: 0.5, ease: 'expo.out' }));
  });
}

/* ---------- Cartes inclinées en 3D ---------- */
if (finePointer && !reduced) {
  $$('[data-tilt]').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * 16);
      rx(-((e.clientY - r.top) / r.height - 0.5) * 16);
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); });
  });
}

/* ---------- Vidéos : chargées à l'approche, lues seulement à l'écran ---------- */
const videos = $$('video[data-sd]');
const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; };
const tryPlay = (v) => {
  if (!v.src || !onScreen(v)) return;
  const p = v.play();
  if (p) p.catch(() => v.classList.add('needs-gesture'));
};
if (allowVideo) {
  const pickSrc = (v) => (v.dataset.hd && allowHD && window.innerWidth >= 900 ? v.dataset.hd : v.dataset.sd);
  const loader = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const v = en.target;
      loader.unobserve(v);
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = pickSrc(v);
      v.load();
    });
  }, { rootMargin: '600px 0px' });
  const player = new IntersectionObserver((entries) => {
    entries.forEach((en) => (en.isIntersecting ? tryPlay(en.target) : en.target.pause()));
  }, { threshold: 0.15 });
  videos.forEach((v) => {
    loader.observe(v);
    player.observe(v);
    v.addEventListener('loadeddata', () => tryPlay(v));
    v.addEventListener('canplay', () => tryPlay(v));
  });
  // Lecture automatique refusée (iPhone en économie d'énergie, réglages du navigateur) :
  // le premier geste de l'utilisateur relance les vidéos visibles.
  const unlock = () => videos.forEach((v) => { v.classList.remove('needs-gesture'); tryPlay(v); });
  ['touchstart', 'pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  // Filet de sécurité : au défilement, on relance une vidéo visible restée en pause.
  ScrollTrigger.addEventListener('scrollEnd', () => videos.forEach((v) => v.paused && tryPlay(v)));
}

/* ---------- Images HD : remplacent la version légère une fois prêtes ---------- */
if (allowHD) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const upgrader = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const img = en.target;
      upgrader.unobserve(img);
      if (img.getBoundingClientRect().width * dpr < 600) return;
      const hd = new Image();
      hd.decoding = 'async';
      hd.src = img.dataset.hd;
      hd.decode().then(() => { img.src = hd.src; }).catch(() => {});
    });
  }, { rootMargin: '400px 400px' });
  $$('img[data-hd]').forEach((img) => upgrader.observe(img));
}

/* ---------- Anneau 3D des instants ---------- */
(() => {
  const ring = $('.ring');
  const items = $$('figure', ring);
  const n = items.length;
  const stage = $('.ring-stage');

  let radius = 0;
  function layout() {
    radius = Math.round((ring.offsetWidth / 2) / Math.tan(Math.PI / n)) + 40;
    items.forEach((f, i) => (f.style.transform = `rotateY(${(360 / n) * i}deg) translateZ(${radius}px)`));
  }
  layout();
  window.addEventListener('resize', layout);

  const st = { angle: 0, vel: reduced ? 0 : -0.08, tilt: -6 };
  let dragging = false;
  let startX = 0;
  let startAngle = 0;
  let lastX = 0;

  stage.addEventListener('pointerdown', (e) => {
    dragging = true; startX = lastX = e.clientX; startAngle = st.angle;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    st.angle = startAngle + (e.clientX - startX) * 0.25;
    st.vel = (e.clientX - lastX) * 0.12;
    lastX = e.clientX;
  });
  const end = () => { dragging = false; };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  if (!reduced) {
    ScrollTrigger.create({
      trigger: '.ring-section', start: 'top bottom', end: 'bottom top',
      onUpdate: (s) => { if (!dragging) st.vel += s.getVelocity() * -0.00004; },
    });
  }

  let visible = false;
  new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(stage);

  gsap.ticker.add(() => {
    if (!visible) return;
    if (!dragging) {
      st.angle += st.vel;
      st.vel += ((reduced ? 0 : -0.08) - st.vel) * 0.03;
    }
    ring.style.transform = `translateZ(${-radius}px) rotateX(${st.tilt}deg) rotateY(${st.angle}deg)`;
  });
})();

window.addEventListener('load', () => ScrollTrigger.refresh());
