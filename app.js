import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { USDZExporter } from 'three/addons/exporters/USDZExporter.js';

/* =====================================================================
   1. EDIT YOUR WEDDING DETAILS HERE
   ===================================================================== */
const CONFIG = {
  name1: 'Kripi',
  name2: 'Divyam',
  dateText: 'November 21, 2026',
  venue: 'Best Western RCC, Manesar',
  rsvpUrl: 'https://example.com/rsvp',            // ← your RSVP form / site
  mapUrl: 'https://maps.app.goo.gl/1Xyc7q2JGZDbqmN28', // ← venue map
  musicUrl: '',   // ← optional: path to an .mp3 (e.g. './music.mp3'). Leave '' to use built-in soft chimes.
  theme: {
    rose: 0xd98a96,
    deep: 0x7a2e3a,
    gold: 0xc9a55c,
    cream: 0xfbf6f1,
    petal: 0xf5c6cf
  }
};

/* =====================================================================
   2. ENGINE STATE
   ===================================================================== */
let renderer, scene, camera, clock;
let reticle, hitTestSource = null, viewerSpace = null, localSpace = null;
let invitation = null;           // the placed/preview invitation group
let placed = false;
let inAR = false;
let controls = null;             // OrbitControls for non-AR preview
let audio = null;

const landing = document.getElementById('landing');
const overlay = document.getElementById('overlay');
const loader = document.getElementById('loader');
const arHint = document.getElementById('ar-hint');
const arActions = document.getElementById('ar-actions');
const enterBtn = document.getElementById('enter-ar');
const enterLabel = document.getElementById('enter-label');
const previewHint = document.getElementById('preview-hint');

// Fill cover text from config
document.getElementById('cover-names').innerHTML =
  `${CONFIG.name1}<span class="amp">and</span>${CONFIG.name2}`;
document.getElementById('cover-date').textContent = CONFIG.dateText;
document.getElementById('cover-venue').textContent = CONFIG.venue;
document.getElementById('rsvp-btn').href = CONFIG.rsvpUrl;
document.getElementById('map-btn').href = CONFIG.mapUrl;

/* =====================================================================
   3. BASE SCENE
   ===================================================================== */
function initEngine() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 50);
  camera.position.set(0, 0.55, 1.4);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.xr.enabled = true;
  document.getElementById('app').appendChild(renderer.domElement);

  // Lighting (used in both AR and preview)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x6b4f3a, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e6, 1.4);
  key.position.set(1.5, 3, 2);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9e0, 0.6);
  rim.position.set(-2, 1.5, -1.5);
  scene.add(rim);

  // Reticle (AR target ring)
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.09, 0.12, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CONFIG.theme.rose, transparent: true, opacity: 0.9 })
  );
  const reticleDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.012, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CONFIG.theme.gold })
  );
  reticle.add(reticleDot);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  window.addEventListener('resize', onResize);
  renderer.setAnimationLoop(render);
}

function onResize() {
  if (inAR) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* =====================================================================
   4. THE 3D INVITATION
   ===================================================================== */
function buildInvitation() {
  const group = new THREE.Group();
  const animated = [];

  // --- Glowing base petal-ring on the floor ---
  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.34, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CONFIG.theme.gold, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  baseRing.position.y = 0.001;
  group.add(baseRing);
  animated.push({ obj: baseRing, fn: (o, t) => { o.rotation.y = t * 0.3; o.material.opacity = 0.25 + 0.12 * Math.sin(t * 2); } });

  // --- Pedestal ---
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.05, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.4 })
  );
  pedestal.position.y = 0.025;
  group.add(pedestal);

  // --- Two interlocked wedding rings (gold) ---
  const ringsGroup = new THREE.Group();
  ringsGroup.position.y = 0.16;
  const goldMat = new THREE.MeshStandardMaterial({ color: CONFIG.theme.gold, metalness: 1.0, roughness: 0.18 });
  const ringGeo = new THREE.TorusGeometry(0.07, 0.014, 24, 80);
  const ringA = new THREE.Mesh(ringGeo, goldMat);
  const ringB = new THREE.Mesh(ringGeo, goldMat.clone());
  ringA.rotation.x = Math.PI / 2;
  ringB.rotation.x = Math.PI / 2;
  ringA.position.x = -0.045;
  ringB.position.x = 0.045;
  ringB.rotation.y = 0.5;
  // little "diamond" on ring A
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.018, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0, transparent: true, opacity: 0.92 })
  );
  diamond.position.set(-0.045, 0.085, 0);
  ringsGroup.add(ringA, ringB, diamond);
  group.add(ringsGroup);
  animated.push({ obj: ringsGroup, fn: (o, t) => { o.rotation.y = t * 0.7; o.position.y = 0.16 + Math.sin(t * 1.5) * 0.012; } });
  animated.push({ obj: diamond, fn: (o, t) => { o.rotation.y = -t * 2; } });

  // --- Floating name banner (canvas texture, billboarded) ---
  const banner = makeTextBanner();
  banner.position.y = 0.42;
  group.add(banner);
  animated.push({ obj: banner, fn: (o, t) => { o.position.y = 0.42 + Math.sin(t * 1.2) * 0.015; }, billboard: true });

  // --- Falling petals ---
  const petals = makePetals(34);
  group.add(petals.group);
  animated.push({ obj: petals.group, fn: (o, t, dt) => petals.update(dt) });

  // --- Rising hearts ---
  const hearts = makeHearts(16);
  group.add(hearts.group);
  animated.push({ obj: hearts.group, fn: (o, t, dt) => hearts.update(dt) });

  group.userData.animated = animated;
  group.userData.spawnTime = clock.getElapsedTime();
  return group;
}

function makeTextBanner() {
  const tex = bannerTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), mat);
  return plane;
}

function bannerTexture() {
  const w = 1024, h = 512;
  const cvs = document.createElement('canvas');
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext('2d');

  // soft card background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(255,255,255,0.96)');
  grad.addColorStop(1, 'rgba(251,240,236,0.96)');
  roundRect(ctx, 24, 24, w - 48, h - 48, 40);
  ctx.fillStyle = grad; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(201,165,92,0.9)'; ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d98a96';
  ctx.font = '500 34px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('TOGETHER WITH THEIR FAMILIES', w / 2, 120);

  ctx.fillStyle = '#7a2e3a';
  ctx.font = '600 120px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(CONFIG.name1, w / 2, 250);
  ctx.fillStyle = '#c9a55c';
  ctx.font = 'italic 60px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('&', w / 2, 312);
  ctx.fillStyle = '#7a2e3a';
  ctx.font = '600 120px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(CONFIG.name2, w / 2, 412);

  ctx.fillStyle = '#2b2326';
  ctx.font = '400 40px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(`${CONFIG.dateText}  •  ${CONFIG.venue}`, w / 2, 470);

  const tex = new THREE.CanvasTexture(cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---- Static, exporter-friendly invitation for iOS AR Quick Look (USDZ) ---- */
function buildInvitationForExport() {
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: CONFIG.theme.gold, metalness: 1.0, roughness: 0.18 });

  // pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.05, 32),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.4 })
  );
  pedestal.position.y = 0.025;
  group.add(pedestal);

  // decorative base ring on the floor (flat halo, matches the live version)
  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.34, 64),
    new THREE.MeshStandardMaterial({
      color: CONFIG.theme.gold, emissive: CONFIG.theme.gold, emissiveIntensity: 0.5,
      metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0.5, side: THREE.DoubleSide
    })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.003;
  group.add(baseRing);

  // interlocked wedding rings
  const ringGeo = new THREE.TorusGeometry(0.07, 0.014, 24, 80);
  const ringA = new THREE.Mesh(ringGeo, gold);
  ringA.rotation.x = Math.PI / 2; ringA.position.set(-0.045, 0.16, 0);
  const ringB = new THREE.Mesh(ringGeo, gold);
  ringB.rotation.x = Math.PI / 2; ringB.rotation.y = 0.5; ringB.position.set(0.045, 0.16, 0);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.018, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.05 })
  );
  diamond.position.set(-0.045, 0.245, 0);
  group.add(ringA, ringB, diamond);

  // name banner (emissive so it stays bright in Quick Look)
  const tex = bannerTexture();
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.25),
    new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85,
      roughness: 0.9, metalness: 0.0, transparent: true, side: THREE.DoubleSide
    })
  );
  banner.position.y = 0.42;
  group.add(banner);

  // static hearts (Quick Look can't run our animated sprites, so bake a few in)
  const htex = heartTexture();
  for (let i = 0; i < 10; i++) {
    const h = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.05),
      new THREE.MeshStandardMaterial({ map: htex, emissive: 0xe0697a, emissiveMap: htex, emissiveIntensity: 0.6, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 0.1 + Math.random() * 0.12;
    h.position.set(Math.cos(a) * r, 0.1 + Math.random() * 0.45, Math.sin(a) * r);
    group.add(h);
  }

  // a few static decorative petals
  const ptex = petalTexture();
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 0.045),
      new THREE.MeshStandardMaterial({ map: ptex, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 })
    );
    const a = Math.random() * Math.PI * 2;
    const r = 0.12 + Math.random() * 0.18;
    m.position.set(Math.cos(a) * r, 0.03 + Math.random() * 0.42, Math.sin(a) * r);
    m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    group.add(m);
  }

  return group;
}

function makePetals(count) {
  const tex = petalTexture();
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.04),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, opacity: 0.95 })
    );
    resetPetal(m, true);
    group.add(m);
    items.push(m);
  }
  function resetPetal(m, initial) {
    const r = 0.3 * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    m.position.set(Math.cos(a) * r, initial ? Math.random() * 0.7 : 0.7 + Math.random() * 0.2, Math.sin(a) * r);
    m.userData.vy = 0.06 + Math.random() * 0.06;
    m.userData.spin = (Math.random() - 0.5) * 2;
    m.userData.sway = Math.random() * Math.PI * 2;
  }
  function update(dt) {
    for (const m of items) {
      m.position.y -= m.userData.vy * dt;
      m.userData.sway += dt;
      m.position.x += Math.sin(m.userData.sway) * 0.0015;
      m.rotation.z += m.userData.spin * dt;
      m.rotation.x += m.userData.spin * dt * 0.5;
      if (m.position.y < 0.01) resetPetal(m, false);
    }
  }
  return { group, update };
}

function makeHearts(count) {
  const tex = heartTexture();
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    resetHeart(s, true);
    group.add(s);
    items.push(s);
  }
  function resetHeart(s, initial) {
    const r = 0.12 + Math.random() * 0.12;
    const a = Math.random() * Math.PI * 2;
    s.position.set(Math.cos(a) * r, initial ? Math.random() * 0.5 : 0.12, Math.sin(a) * r);
    const sc = 0.03 + Math.random() * 0.03;
    s.scale.set(sc, sc, sc);
    s.userData.vy = 0.05 + Math.random() * 0.05;
    s.userData.base = a;
  }
  function update(dt) {
    for (const s of items) {
      s.position.y += s.userData.vy * dt;
      s.material.opacity = Math.max(0, 1 - s.position.y / 0.7);
      if (s.position.y > 0.7) resetHeart(s, false);
    }
  }
  return { group, update };
}

/* ---- procedural textures ---- */
function petalTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f5c6cf';
  x.beginPath();
  x.moveTo(64, 14);
  x.bezierCurveTo(110, 30, 110, 96, 64, 118);
  x.bezierCurveTo(18, 96, 18, 30, 64, 14);
  x.fill();
  x.strokeStyle = 'rgba(217,138,150,0.6)'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(64, 24); x.lineTo(64, 108); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function heartTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#e0697a';
  x.beginPath();
  const cx = 64, cy = 50, s = 34;
  x.moveTo(cx, cy + s * 0.9);
  x.bezierCurveTo(cx - s * 1.4, cy - s * 0.4, cx - s * 0.5, cy - s, cx, cy - s * 0.35);
  x.bezierCurveTo(cx + s * 0.5, cy - s, cx + s * 1.4, cy - s * 0.4, cx, cy + s * 0.9);
  x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* =====================================================================
   5. AUDIO — built-in soft chimes (or your own mp3 via CONFIG.musicUrl)
   ===================================================================== */
function startAudio() {
  if (audio && audio.playing) return;
  if (CONFIG.musicUrl) {
    const el = new Audio(CONFIG.musicUrl);
    el.loop = true; el.volume = 0.6;
    el.play().catch(() => {});
    audio = { playing: true, stop: () => { el.pause(); }, el };
    return;
  }
  // Synthesized gentle harp/chime loop (no external file needed)
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ac = new Ctx();
    const master = ac.createGain();
    master.gain.value = 0.0;
    master.connect(ac.destination);
    master.gain.linearRampToValueAtTime(0.18, ac.currentTime + 1.5);

    const reverb = ac.createGain();
    reverb.gain.value = 0.9;
    reverb.connect(master);

    const scaleNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]; // C major-ish
    let step = 0;
    const interval = setInterval(() => {
      const now = ac.currentTime;
      const f = scaleNotes[step % scaleNotes.length] * (Math.random() < 0.3 ? 0.5 : 1);
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
      osc.connect(g); g.connect(reverb);
      osc.start(now); osc.stop(now + 1.9);
      step++;
    }, 650);

    audio = {
      playing: true,
      stop: () => { clearInterval(interval); master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4); setTimeout(() => ac.close(), 600); }
    };
  } catch (e) {
    audio = { playing: false, stop: () => {} };
  }
}
function stopAudio() { if (audio) { audio.stop(); audio = null; } }

/* =====================================================================
   6. AR SESSION (WebXR surface placement)
   ===================================================================== */
async function startAR() {
  loader.style.display = 'flex';
  try {
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local-floor'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlay }
    });
    inAR = true;
    placed = false;
    overlay.style.display = 'block';
    arActions.classList.remove('show');
    arHint.textContent = 'Move your phone to scan a flat surface…';
    landing.classList.add('hidden');
    if (controls) controls.enabled = false;
    if (invitation) { scene.remove(invitation); invitation = null; }

    renderer.xr.setReferenceSpaceType('local-floor');
    await renderer.xr.setSession(session);

    viewerSpace = await session.requestReferenceSpace('viewer');
    localSpace = renderer.xr.getReferenceSpace();
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    session.addEventListener('select', onSelect);
    session.addEventListener('end', onSessionEnd);

    startAudio();
  } catch (err) {
    console.error(err);
    arHint.textContent = '';
    overlay.style.display = 'none';
    alert('Could not start AR: ' + (err && err.message ? err.message : err));
  } finally {
    loader.style.display = 'none';
  }
}

function onSelect() {
  if (!inAR) return;
  if (!placed && reticle.visible) {
    // Place invitation at reticle
    invitation = buildInvitation();
    invitation.position.setFromMatrixPosition(reticle.matrix);
    // face the user
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    invitation.lookAt(camPos.x, invitation.position.y, camPos.z);
    invitation.scale.setScalar(0.001);
    scene.add(invitation);
    placed = true;
    reticle.visible = false;
    arHint.classList.add('hidden');
    arActions.classList.add('show');
  } else if (placed && relocating) {
    // Re-place at new reticle position
    if (reticle.visible) {
      invitation.position.setFromMatrixPosition(reticle.matrix);
      relocating = false;
      reticle.visible = false;
      arHint.classList.add('hidden');
      arActions.classList.add('show');
    }
  }
}

let relocating = false;
document.getElementById('replace-btn').addEventListener('click', () => {
  if (!placed) return;
  relocating = true;
  arActions.classList.remove('show');
  arHint.classList.remove('hidden');
  arHint.textContent = 'Find a new spot, then tap to move it.';
});

function onSessionEnd() {
  inAR = false;
  placed = false;
  relocating = false;
  hitTestSource = null;
  overlay.style.display = 'none';
  reticle.visible = false;
  stopAudio();
  if (invitation) { scene.remove(invitation); invitation = null; }
  landing.classList.remove('hidden');
  // restore preview
  enterPreview();
}

document.getElementById('ar-exit').addEventListener('click', () => {
  const s = renderer.xr.getSession();
  if (s) s.end();
});

/* =====================================================================
   7. NON-AR PREVIEW (iOS / desktop fallback)
   ===================================================================== */
function enterPreview() {
  if (invitation) { scene.remove(invitation); }
  invitation = buildInvitation();
  invitation.position.set(0, 0, 0);
  scene.add(invitation);

  if (!controls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.6;
    controls.maxDistance = 2.4;
    controls.maxPolarAngle = Math.PI / 1.9;
    controls.target.set(0, 0.3, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
  }
  controls.enabled = true;
  camera.position.set(0, 0.5, 1.3);
  controls.update();
  previewHint.style.opacity = '1';
}

/* =====================================================================
   8. RENDER LOOP
   ===================================================================== */
function render(timestamp, frame) {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  if (frame && inAR) {
    // Hit testing for reticle
    if (hitTestSource && (!placed || relocating)) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length) {
        const pose = results[0].getPose(localSpace);
        if (pose) {
          reticle.visible = true;
          reticle.matrix.fromArray(pose.transform.matrix);
        }
      } else {
        reticle.visible = false;
      }
    }
    // pulse reticle
    if (reticle.visible) {
      const s = 1 + Math.sin(t * 4) * 0.08;
      reticle.scale.set(s, s, s);
    }
  }

  // Animate the invitation
  if (invitation) {
    // grow-in pop animation
    const age = t - invitation.userData.spawnTime;
    if (inAR && age < 0.6) {
      const k = easeOutBack(Math.min(age / 0.6, 1));
      invitation.scale.setScalar(k);
    }
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    for (const a of invitation.userData.animated) {
      a.fn(a.obj, t, dt);
      if (a.billboard) {
        a.obj.lookAt(camPos.x, a.obj.getWorldPosition(new THREE.Vector3()).y, camPos.z);
      }
    }
  }

  if (controls && controls.enabled) controls.update();
  renderer.render(scene, camera);
}

function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/* =====================================================================
   9. iOS AR QUICK LOOK (USDZ) — true in-room AR for iPhone/iPad
   ===================================================================== */
let usdzUrl = null;
let usdzBuilding = false;

async function prepareUSDZ() {
  if (usdzUrl || usdzBuilding) return;
  usdzBuilding = true;
  try {
    const exporter = new USDZExporter();
    const grp = buildInvitationForExport();
    const result = await exporter.parse(grp);
    const blob = new Blob([result], { type: 'model/vnd.usdz+zip' });
    usdzUrl = URL.createObjectURL(blob);
  } catch (e) {
    console.error('USDZ export failed:', e);
  } finally {
    usdzBuilding = false;
  }
}

function quickLookSupported() {
  const a = document.createElement('a');
  return a.relList && a.relList.supports && a.relList.supports('ar');
}

function isIOS() {
  // iPhone/iPod, plus iPadOS (which reports as MacIntel with touch)
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function launchQuickLook() {
  if (usdzUrl) { openQuickLook(); return; }
  // model not ready yet — show loader and open as soon as it is
  loader.style.display = 'flex';
  const waitId = setInterval(() => {
    if (usdzUrl) {
      clearInterval(waitId);
      loader.style.display = 'none';
      openQuickLook();
    }
  }, 120);
  if (!usdzBuilding) prepareUSDZ();
}

function openQuickLook() {
  const link = document.createElement('a');
  link.rel = 'ar';
  link.href = usdzUrl;
  // Quick Look requires an <img> child inside the anchor
  const img = document.createElement('img');
  img.style.display = 'none';
  link.appendChild(img);
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { if (link.parentNode) link.parentNode.removeChild(link); }, 8000);
}

/* =====================================================================
   10. BOOTSTRAP + capability detection
   ===================================================================== */
async function main() {
  initEngine();
  enterPreview(); // show 3D preview behind the cover immediately

  let arSupported = false;
  if (navigator.xr && navigator.xr.isSessionSupported) {
    try { arSupported = await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) {}
  }

  if (arSupported) {
    // Android Chrome etc. — full WebXR surface placement
    enterLabel.textContent = 'View Invitation in AR';
    enterBtn.addEventListener('click', () => {
      startAudio(); // unlock audio on user gesture
      startAR();
    });
  } else if (quickLookSupported() || isIOS()) {
    // iPhone / iPad — native AR Quick Look (USDZ). Works in Safari;
    // Chrome/Edge/Firefox on iOS also use WebKit so we offer it there too.
    enterLabel.textContent = 'View in Your Space (AR)';
    document.getElementById('subnote').textContent =
      'Tap to place the invitation in your room, then drag with one finger to rotate it.';
    prepareUSDZ(); // build the model in the background so the tap is instant
    enterBtn.addEventListener('click', () => {
      startAudio();
      launchQuickLook();
    });
  } else {
    // Desktop / unsupported — interactive 3D invitation
    enterLabel.textContent = 'View 3D Invitation';
    document.getElementById('subnote').innerHTML =
      'Your browser doesn’t support in-room AR placement. Enjoy the interactive 3D invitation — drag to explore.';
    enterBtn.addEventListener('click', () => {
      startAudio();
      landing.classList.add('hidden');
    });
  }
}

main();
