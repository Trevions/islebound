// ISLEBOUND 3D renderer (Three.js r128, global THREE).
// The game simulates on a flat plane (x, y). Here that plane becomes the ground (x, z),
// seen by a tilted camera. Every model is built from primitives: toon shading +
// inverted-hull outlines in the realm's accent colour give the soft "claymation" look.
import { mixHex, TAU, hexA } from '../core/util.js';
import { WEAPONS } from '../data/weapons.js';
import { tileHash } from '../core/draw.js';

const T = () => window.THREE;
const PITCH = 56 * Math.PI / 180;
const MAXI = 260;

function toonGradient() {
  const THREE = T();
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return tex;
}

// soft additive glow points with per-point size & colour
function glowMaterial() {
  const THREE = T();
  return new THREE.ShaderMaterial({
    uniforms: { scale: { value: 800 } },
    vertexShader: `uniform float scale; attribute float size; attribute vec3 gcolor; attribute float alpha; varying vec3 vC; varying float vA;
      void main(){ vC = gcolor; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
      gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA;
      void main(){ vec2 p = gl_PointCoord - 0.5; float d = length(p)*2.0; float a = smoothstep(1.0, 0.0, d);
      a = a*a; gl_FragColor = vec4(vC * a * vA * 1.4, 1.0); }`,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  });
}

class GlowPool {
  constructor(scene, n = 3000) {
    const THREE = T();
    this.n = n; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n); this.alpha = new Float32Array(n);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('gcolor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo = g; this.mat = glowMaterial();
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    scene.add(this.points);
    this.c = new THREE.Color();
  }
  begin() { this.i = 0; }
  add(x, y, z, size, color, alpha = 1) {
    if (this.i >= this.n) return;
    const k = this.i++;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.c.set(color); this.col[k * 3] = this.c.r; this.col[k * 3 + 1] = this.c.g; this.col[k * 3 + 2] = this.c.b;
    this.size[k] = size; this.alpha[k] = alpha;
  }
  end() {
    this.geo.setDrawRange(0, this.i);
    for (const a of ['position', 'gcolor', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
}

// An InstancedMesh wrapper with an optional inverted-hull outline twin.
class Inst {
  constructor(scene, geo, mat, n = MAXI, outlineColor = null, outlineScale = 1.12) {
    const THREE = T();
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    if (outlineColor) {
      this.outline = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: outlineColor, side: THREE.BackSide }), n);
      this.outline.frustumCulled = false; this.outlineScale = outlineScale;
      scene.add(this.outline);
    }
    this.n = n; this.i = 0;
    this.o = new THREE.Object3D(); this.col = new THREE.Color();
    this.white = new THREE.Color('#ffffff');
    for (let i = 0; i < n; i++) this.mesh.setColorAt(i, this.white); // allocate instanceColor up-front
    this.hasColor = true;
  }
  begin() { this.i = 0; }
  add(x, y, z, sx, sy, sz, ry = 0, color = null, rx = 0, rz = 0) {
    if (this.i >= this.n) return;
    const o = this.o;
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    this.mesh.setMatrixAt(this.i, o.matrix);
    this.mesh.setColorAt(this.i, color ? this.col.set(color) : this.white);
    if (this.outline) { const k = this.outlineScale; o.scale.set(sx * k, sy * k, sz * k); o.updateMatrix(); this.outline.setMatrixAt(this.i, o.matrix); }
    this.i++;
  }
  end() {
    this.mesh.count = this.i; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.hasColor && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.outline) { this.outline.count = this.i; this.outline.instanceMatrix.needsUpdate = true; }
  }
  dispose(scene) { scene.remove(this.mesh); if (this.outline) scene.remove(this.outline); }
}

export class Renderer3D {
  constructor(canvas) {
    const THREE = T();
    this.THREE = THREE;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.camera = new THREE.PerspectiveCamera(42, 1, 20, 5000);
    this.grad = toonGradient();
    this.v = new THREE.Vector3();
    this.scene = null;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const vf = (this.camera.fov * Math.PI) / 180;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    // portrait: ~470 world units across; landscape: ~560 units tall
    this.dist = this.camera.aspect < 1 ? 410 / (2 * Math.tan(hf / 2)) : 520 / (2 * Math.tan(vf / 2));
    this.camera.updateProjectionMatrix();
    this.worldW = this.camera.aspect < 1 ? 410 : 520 * this.camera.aspect;
    this.worldH = (this.worldW / this.camera.aspect) / Math.sin(PITCH);
  }

  toon(color, extra = {}) { return new this.THREE.MeshToonMaterial({ color, gradientMap: this.grad, ...extra }); }
  basic(color, extra = {}) { return new this.THREE.MeshBasicMaterial({ color, ...extra }); }

  // Build a scene for one dive
  build(run) {
    const THREE = this.THREE;
    if (this.scene) this.disposeScene();
    const R = run.realm;
    this.realm = R;
    const scene = (this.scene = new THREE.Scene());
    const fogCol = new THREE.Color(mixHex(R.void, R.groundDark, 0.18));
    scene.background = fogCol;
    scene.fog = new THREE.Fog(fogCol, this.dist * 1.05, this.dist * 2.0);
    scene.add(new THREE.HemisphereLight(mixHex(R.glow, '#ffffff', 0.5), mixHex(R.groundDark, '#000000', 0.4), 0.55));
    const sun = new THREE.DirectionalLight(0xfff1dc, 0.6); sun.position.set(-0.6, 1, 0.5); scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.18));

    // ground: a big plane with a painted tile texture, anchored to world space
    const tc = document.createElement('canvas'); tc.width = tc.height = 512;
    const g = tc.getContext('2d');
    const base = mixHex(R.groundDark, R.void, 0.35), light = mixHex(R.groundDark, R.ground, 0.3);
    g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 7; i++) {
      const h = tileHash(i, 7, R.id.length);
      const gx = h % 512, gy = (h >>> 9) % 512, rr = 60 + (h % 70);
      const grd = g.createRadialGradient(gx, gy, 0, gx, gy, rr);
      grd.addColorStop(0, hexA(light, 0.35)); grd.addColorStop(1, hexA(light, 0));
      g.fillStyle = grd; g.fillRect(gx - rr, gy - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < 160; i++) { const h = tileHash(i, 3, 9); g.fillStyle = hexA(i % 3 ? R.ground : '#000000', 0.12); g.beginPath(); g.arc(h % 512, (h >>> 9) % 512, 1 + (h % 3), 0, TAU); g.fill(); }
    const tex = new THREE.CanvasTexture(tc); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(4096, 4096), new THREE.MeshLambertMaterial({ map: tex }));
    this.ground.rotation.x = -Math.PI / 2;
    scene.add(this.ground);

    // launch island at the origin
    const isle = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(70, 60, 14, 28), this.toon(R.ground)); top.position.y = 4; isle.add(top);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(60, 60, 20), this.toon(R.groundDark)); rock.rotation.x = Math.PI; rock.position.y = -30; isle.add(rock);
    for (const sx of [-28, 28]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 42, 8), this.toon('#8a6a32')); post.position.set(sx, 30, 0); isle.add(post); }
    scene.add(isle); this.isle = isle;
    const bandGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
    this.band = new THREE.Line(bandGeo, new THREE.LineBasicMaterial({ color: 0xffe0c0 })); scene.add(this.band);
    this.nestRing = this.ringMesh(80, 84, R.accent, 0.8); scene.add(this.nestRing);
    this.aimRing = this.ringMesh(0.94, 1, '#ffffff', 0.8); scene.add(this.aimRing);

    // decorations (instanced, recycled around the camera)
    this.deco = {
      tuft: new Inst(scene, new THREE.ConeGeometry(1, 3, 5), this.toon(mixHex(R.ground, R.groundDark, 0.3)), 700),
      rock: new Inst(scene, new THREE.DodecahedronGeometry(1, 0), this.toon(mixHex(R.groundDark, '#000000', 0.2)), 200),
      bloom: new Inst(scene, new THREE.SphereGeometry(1, 8, 6), this.basic(R.accent), 300),
      crystal: new Inst(scene, new THREE.OctahedronGeometry(1, 0), this.toon(R.glow, { emissive: new THREE.Color(R.accent), emissiveIntensity: 0.35 }), 120),
    };
    this.decoKey = null;

    // shadows (blob decals)
    const shGeo = new THREE.CircleGeometry(1, 20); shGeo.rotateX(-Math.PI / 2);
    this.shadows = new Inst(scene, shGeo, this.basic('#000000', { transparent: true, opacity: 0.28, depthWrite: false }), 600);

    // hero
    this.hero = this.buildHero(run); scene.add(this.hero);

    // enemies — one instanced mesh per silhouette, dark body + accent outline
    const body = mixHex('#4a3a78', R.void, 0.25);
    const mk = (geo, n = MAXI) => { const m = new Inst(scene, geo, this.toon('#ffffff'), n, R.accent, 1.14); m.body = body; return m; };
    const sph = new THREE.SphereGeometry(1, 16, 12);
    const cone = new THREE.ConeGeometry(0.9, 2.2, 10); cone.rotateX(Math.PI / 2);
    this.en = {
      blob: mk(sph), bat: mk(new THREE.OctahedronGeometry(1, 0)), brute: mk(new THREE.BoxGeometry(1.8, 1.6, 1.6)),
      dasher: mk(cone), spitter: mk(new THREE.CylinderGeometry(0.75, 1, 1.5, 12)), splitter: mk(new THREE.IcosahedronGeometry(1, 1)),
      bomber: mk(sph), shielder: mk(sph), orbiter: mk(new THREE.OctahedronGeometry(1.1, 0)), blinker: mk(new THREE.IcosahedronGeometry(1, 0)),
      healer: mk(sph), minelayer: mk(new THREE.DodecahedronGeometry(1, 0)),
    };
    this.wisp = new Inst(scene, sph, this.basic(mixHex(R.glow, '#ffffff', 0.3), { transparent: true, opacity: 0.55, depthWrite: false }), 120);
    this.sprite = new Inst(scene, new THREE.OctahedronGeometry(1, 1), this.toon('#ffd166', { emissive: new THREE.Color('#6a4200') }), 8, '#6a4a00', 1.1);
    this.eyes = new Inst(scene, new THREE.SphereGeometry(1, 10, 8), this.basic('#ffffff'), 700);
    this.pupils = new Inst(scene, new THREE.SphereGeometry(1, 8, 6), this.basic('#12091a'), 700);
    this.crowns = new Inst(scene, new THREE.CylinderGeometry(1, 0.8, 0.9, 5, 1, true), this.toon('#ffd166', { side: THREE.DoubleSide, emissive: new THREE.Color('#6a4a00') }), 60);
    this.shields = new Inst(scene, new THREE.CylinderGeometry(1, 1, 1, 16, 1, true, -1, 2), this.basic('#cfe9ff', { transparent: true, opacity: 0.75, side: THREE.DoubleSide }), 120);
    this.crosses = new Inst(scene, new THREE.BoxGeometry(1, 1, 1), this.basic('#7dffc8'), 240);

    // projectiles, pickups
    this.pr = {
      bolt: new Inst(scene, new THREE.OctahedronGeometry(1, 0), this.basic('#ffffff'), 400),
      shard: new Inst(scene, (() => { const c = new THREE.ConeGeometry(0.5, 2.2, 5); c.rotateX(Math.PI / 2); return c; })(), this.basic('#dff6ff'), 200),
      boomer: new Inst(scene, new THREE.TorusGeometry(1, 0.28, 6, 14, Math.PI * 1.3), this.toon('#9df28a'), 30),
      stone: new Inst(scene, new THREE.DodecahedronGeometry(1, 0), this.toon('#e8d2b0'), 60),
      bee: new Inst(scene, new THREE.SphereGeometry(1, 8, 6), this.basic('#ffc94d'), 80),
      petal: new Inst(scene, new THREE.SphereGeometry(1, 10, 6), this.toon('#ff9fd0'), 40, '#a0406a', 1.12),
      block: new Inst(scene, new THREE.BoxGeometry(1, 1, 1), this.toon('#ffffff'), 80, '#1a1030', 1.08),
    };
    this.ebul = new Inst(scene, new THREE.SphereGeometry(1, 10, 8), this.basic('#ff4d6d'), 420);
    this.ebulCore = new Inst(scene, new THREE.SphereGeometry(1, 8, 6), this.basic('#ffe0e6'), 420);
    this.gemI = new Inst(scene, new THREE.OctahedronGeometry(1, 0), this.basic('#ffffff'), 300);
    this.coinI = new Inst(scene, new THREE.CylinderGeometry(1, 1, 0.3, 18), this.toon('#ffcc4d', { emissive: new THREE.Color('#5a3a00') }), 170, '#7a4a00', 1.12);
    this.mines = new Inst(scene, new THREE.IcosahedronGeometry(1, 0), this.basic('#ff4d6d'), 80);
    this.chests = new Inst(scene, new THREE.BoxGeometry(1.4, 1, 1), this.toon('#b8742a'), 12, '#3a2008', 1.08);
    this.chestBands = new Inst(scene, new THREE.BoxGeometry(1.45, 0.22, 1.05), this.toon('#ffd166', { emissive: new THREE.Color('#6a4a00') }), 12);
    this.hearts = new Inst(scene, new THREE.SphereGeometry(1, 12, 10), this.toon('#ff6b8a', { emissive: new THREE.Color('#5a0018') }), 12);
    this.magnets = new Inst(scene, new THREE.TorusGeometry(1, 0.35, 8, 16, Math.PI), this.toon('#ff4d6d'), 6);

    this.glow = new GlowPool(scene, 3500);
    // pools of simple meshes for rings/telegraphs/chomps/lines
    this.rings = []; this.teles = []; this.lines = []; this.chomps = [];
    this.bolts = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending }));
    this.boltPos = new Float32Array(6 * 400); this.bolts.geometry.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3)); this.bolts.frustumCulled = false;
    this.boltCol = new Float32Array(6 * 400); this.bolts.geometry.setAttribute('color', new THREE.BufferAttribute(this.boltCol, 3)); this.bolts.material.vertexColors = true;
    scene.add(this.bolts);
    const lg = new THREE.PlaneGeometry(1, 1); lg.rotateX(-Math.PI / 2);
    this.laserMesh = new THREE.Mesh(lg, this.basic('#ffffff', { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.laserMesh.visible = false; scene.add(this.laserMesh);

    // cages / creatures / stones / boss are individual groups
    this.cageObjs = new Map();
    this.stoneObj = null;
    this.bossObj = null;
    this.floaters = this.buildFloaters();
  }

  disposeScene() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
    this.scene = null;
  }

  ringMesh(inner, outer, color, opacity = 0.8) {
    const THREE = this.THREE;
    const geo = new THREE.RingGeometry(inner, outer, 48); geo.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geo, this.basic(color, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  }
  poolGet(pool, make) {
    let m = pool.find((x) => !x.visible);
    if (!m) { m = make(); pool.push(m); this.scene.add(m); }
    m.visible = true; return m;
  }

  buildFloaters() {
    // distant floating islands drifting in the fog beyond the playfield
    const THREE = this.THREE, R = this.realm;
    const grp = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const s = 30 + (i % 3) * 25;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.85, s * 0.25, 10), this.toon(R.ground)); g.add(top);
      const bottom = new THREE.Mesh(new THREE.ConeGeometry(s * 0.85, s * 1.2, 10), this.toon(R.groundDark)); bottom.rotation.x = Math.PI; bottom.position.y = -s * 0.7; g.add(bottom);
      g.userData = { a: (i / 8) * TAU, r: 900 + (i % 3) * 200, h: 120 + (i % 4) * 60, s: 0.02 + (i % 3) * 0.01 };
      this.scene.add(g); grp.push(g);
    }
    return grp;
  }

  // ── hero model ─────────────────────────────────
  buildHero(run) {
    const THREE = this.THREE;
    const S = run.S, scarf = run.app.scarfColor();
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    const outline = (geo, s = 1.1) => { const m = new THREE.Mesh(geo, this.basic('#3a2a3f', { side: THREE.BackSide })); m.scale.setScalar(s); return m; };
    const ball = new THREE.SphereGeometry(13, 24, 18);
    const b = new THREE.Mesh(ball, this.toon('#fff6e8')); body.add(b); body.add(outline(ball, 1.08));
    const scarfRing = new THREE.Mesh(new THREE.TorusGeometry(11.5, 3.2, 8, 24), this.toon(scarf)); scarfRing.rotation.x = Math.PI / 2; scarfRing.position.y = -3; body.add(scarfRing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 14), this.toon(scarf)); tail.position.set(0, -4, -15); tail.rotation.x = 0.4; body.add(tail); this.heroTail = tail;
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(2.3, 10, 8), this.basic('#231a2b')); eye.scale.set(1, 1.4, 0.7); eye.position.set(s * 4.5, 2.5, 11.6); body.add(eye);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6), this.basic('#ffffff')); hl.position.set(s * 4.5 + 0.8, 4, 12.9); body.add(hl);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(2.2, 12), this.basic('#ff8aa0', { transparent: true, opacity: 0.6 })); blush.position.set(s * 7.5, -0.5, 10.6); blush.lookAt(s * 16, -1, 30); body.add(blush);
    }
    const hat = this.buildHat(S.cosmetics.hat || 'none'); hat.position.y = 12; body.add(hat); this.heroHat = hat;
    const sh = new THREE.Mesh(new THREE.CircleGeometry(12, 20), this.basic('#000000', { transparent: true, opacity: 0.3, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.5;
    this.heroShadow = sh; this.scene.add(sh);
    this.heroBody = body;
    return root;
  }
  buildHat(id) {
    const THREE = this.THREE, g = new THREE.Group();
    const add = (geo, color, x = 0, y = 0, z = 0, extra = {}) => { const m = new THREE.Mesh(geo, this.toon(color, extra)); m.position.set(x, y, z); g.add(m); return m; };
    switch (id) {
      case 'cap': add(new THREE.SphereGeometry(9, 16, 8, 0, TAU, 0, Math.PI / 2), '#4cc9f0', 0, -2); add(new THREE.CylinderGeometry(7, 7, 1, 16), '#4cc9f0', 0, -2, 7); break;
      case 'crown': { const c = add(new THREE.CylinderGeometry(7, 6, 6, 6, 1, true), '#ffd166', 0, 2, 0, { side: THREE.DoubleSide, emissive: new THREE.Color('#5a3a00') }); c.rotation.y = 0.3; break; }
      case 'wizard': add(new THREE.ConeGeometry(9, 20, 16), '#5b4bdb', 0, 8); add(new THREE.CylinderGeometry(12, 12, 1.2, 20), '#5b4bdb', 0, -1); break;
      case 'flower': for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; add(new THREE.SphereGeometry(2.4, 8, 6), ['#ff9fd0', '#ffd166', '#9df28a', '#8fe3ff'][i % 4], Math.cos(a) * 8, -1, Math.sin(a) * 8); } break;
      case 'horns': for (const s of [-1, 1]) { const h = add(new THREE.ConeGeometry(2.4, 10, 8), '#2b1f3a', s * 6, 2); h.rotation.z = -s * 0.5; } break;
      case 'halo': { const h = new THREE.Mesh(new THREE.TorusGeometry(8, 1.2, 8, 24), this.basic('#ffe27a')); h.rotation.x = Math.PI / 2; h.position.y = 7; g.add(h); break; }
      case 'beanie': add(new THREE.SphereGeometry(10, 16, 8, 0, TAU, 0, Math.PI / 2), '#ff8a3d', 0, -3); add(new THREE.SphereGeometry(3, 8, 6), '#fff6e8', 0, 7); break;
      case 'propeller': { add(new THREE.SphereGeometry(8, 14, 8, 0, TAU, 0, Math.PI / 2), '#ffd166', 0, -2); const p = add(new THREE.BoxGeometry(18, 0.8, 2.5), '#ff6b6b', 0, 6); g.userData.spin = p; break; }
      case 'bunny': for (const s of [-1, 1]) { const e = add(new THREE.SphereGeometry(2.8, 10, 8), '#fff6e8', s * 4, 8); e.scale.set(1, 3, 0.8); e.rotation.z = -s * 0.2; } break;
      default: { // sprout
        add(new THREE.CylinderGeometry(0.7, 0.9, 7, 6), '#3e8f5a', 0, 2);
        for (const s of [-1, 1]) { const l = add(new THREE.SphereGeometry(3, 10, 6), '#7bd389', s * 3.4, 6); l.scale.set(1.4, 0.4, 0.8); l.rotation.z = s * 0.5; }
        g.userData.sway = true;
      }
    }
    return g;
  }

  creatureModel(look, r) {
    const THREE = this.THREE, g = new THREE.Group();
    const col = look.color;
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), this.toon(col));
    if (look.body === 'tall') b.scale.set(0.8, 1.1, 0.8); else if (look.body === 'wide') b.scale.set(1.2, 0.85, 1); else if (look.body === 'drop') b.scale.set(0.9, 1.05, 0.9);
    g.add(b);
    const ol = new THREE.Mesh(b.geometry, this.basic('#2b1f33', { side: THREE.BackSide })); ol.scale.copy(b.scale).multiplyScalar(1.1); g.add(ol);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 12, 8), this.toon(look.belly)); belly.position.set(0, -r * 0.3, r * 0.55); belly.scale.z = 0.5; g.add(belly);
    const ear = (x, y, geo, c = col) => { const m = new THREE.Mesh(geo, this.toon(c)); m.position.set(x, y, 0); g.add(m); return m; };
    if (look.ears === 'cat') for (const s of [-1, 1]) ear(s * r * 0.55, r * 0.85, new THREE.ConeGeometry(r * 0.3, r * 0.6, 4));
    if (look.ears === 'bunny') for (const s of [-1, 1]) { const e = ear(s * r * 0.35, r * 1.2, new THREE.SphereGeometry(r * 0.2, 8, 6)); e.scale.y = 2.6; }
    if (look.ears === 'horn') ear(0, r * 1.1, new THREE.ConeGeometry(r * 0.15, r * 0.7, 8), '#fff4d6');
    if (look.ears === 'antenna') for (const s of [-1, 1]) ear(s * r * 0.4, r * 1.25, new THREE.SphereGeometry(r * 0.14, 8, 6), look.belly);
    if (look.ears === 'fin') { const f = ear(0, r * 0.95, new THREE.ConeGeometry(r * 0.35, r * 0.7, 3)); f.rotation.z = 0.4; }
    if (look.ears === 'leaf') { const l = ear(r * 0.2, r * 1.05, new THREE.SphereGeometry(r * 0.25, 8, 6), '#7bd389'); l.scale.set(0.6, 1.5, 0.3); }
    if (look.ears === 'crown') ear(0, r * 1.0, new THREE.CylinderGeometry(r * 0.4, r * 0.35, r * 0.35, 5, 1, true), '#ffd166');
    const ey = new THREE.Mesh(new THREE.SphereGeometry(r * (look.eyes === 2 ? 0.28 : 0.14), 8, 6), this.basic('#1b1422'));
    if (look.eyes === 2) { ey.position.set(0, r * 0.15, r * 0.88); g.add(ey); }
    else for (const s of [-1, 1]) { const e = ey.clone(); e.position.set(s * r * 0.32, r * 0.15, r * 0.88); g.add(e); }
    return g;
  }

  buildCage(c) {
    const THREE = this.THREE, g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(28, 30, 6, 20), this.toon('#8a6a32')); base.position.y = 3; g.add(base);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 44, 6), this.toon('#e8d2b0')); bar.position.set(Math.cos(a) * 24, 26, Math.sin(a) * 24); g.add(bar); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(25, 16, 8, 0, TAU, 0, Math.PI / 2), this.toon('#e8d2b0', { transparent: true, opacity: 0.5 })); dome.position.y = 48; g.add(dome);
    const cr = this.creatureModel(c.creature.look, 12); cr.position.y = 20; g.add(cr); g.userData.creature = cr;
    const prog = this.ringMesh(34, 39, '#7dffc8', 0.9); prog.position.y = 1; g.add(prog); g.userData.prog = prog;
    return g;
  }

  buildBoss(b) {
    const THREE = this.THREE, g = new THREE.Group();
    const c = b.def.color, dark = mixHex(c, '#120a1a', 0.5), r = b.r;
    const mat = this.toon(dark, { emissive: new THREE.Color('#000000') });
    const add = (geo, x = 0, y = 0, z = 0, m = mat) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    const rim = (geo, x = 0, y = 0, z = 0, s = 1.08) => { const o = new THREE.Mesh(geo, this.basic(c, { side: THREE.BackSide })); o.position.set(x, y, z); o.scale.setScalar(s); g.add(o); return o; };
    const shape = b.def.shape;
    let core;
    if (shape === 'gear') { core = new THREE.CylinderGeometry(r, r, r * 0.6, 12); add(core); rim(core); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const tooth = add(new THREE.BoxGeometry(r * 0.35, r * 0.5, r * 0.3), Math.cos(a) * r * 1.1, 0, Math.sin(a) * r * 1.1); tooth.rotation.y = -a; } }
    else if (shape === 'prism') { core = new THREE.OctahedronGeometry(r * 1.1, 0); add(core); rim(core); }
    else if (shape === 'moth') { core = new THREE.SphereGeometry(r * 0.6, 16, 12); add(core); rim(core); for (const s of [-1, 1]) { const w = add(new THREE.SphereGeometry(r * 0.8, 12, 8), s * r * 0.9, r * 0.2, 0, this.toon(c, { transparent: true, opacity: 0.8 })); w.scale.set(1, 0.7, 0.12); w.userData.wing = s; } }
    else if (shape === 'wyrm') { for (let i = 0; i < 5; i++) { const seg = add(new THREE.SphereGeometry(r * (0.9 - i * 0.12), 14, 10), 0, 0, -i * r * 0.7); seg.userData.seg = i; if (i === 0) rim(seg.geometry, 0, 0, 0); } }
    else if (shape === 'heart') { for (const s of [-1, 1]) { add(new THREE.SphereGeometry(r * 0.6, 16, 12), s * r * 0.4, r * 0.2); } const cn = add(new THREE.ConeGeometry(r * 0.95, r * 1.2, 16), 0, -r * 0.5); cn.rotation.z = Math.PI; }
    else if (shape === 'bloom') { core = new THREE.SphereGeometry(r * 0.55, 16, 12); add(core, 0, 0, 0, this.toon(b.def.eye)); for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; const p = add(new THREE.SphereGeometry(r * 0.45, 12, 8), Math.cos(a) * r * 0.7, 0, Math.sin(a) * r * 0.7, this.toon(c)); p.scale.y = 0.5; } }
    else if (shape === 'lantern') { core = new THREE.BoxGeometry(r * 1.3, r * 1.8, r * 1.3); add(core); rim(core); add(new THREE.SphereGeometry(r * 0.5, 12, 8), 0, 0, 0, this.basic(c)); }
    else if (shape === 'aurora') { core = new THREE.SphereGeometry(r * 0.6, 16, 12); add(core); for (let i = 0; i < 3; i++) { const t = add(new THREE.TorusGeometry(r * (0.9 + i * 0.2), r * 0.06, 6, 32), 0, 0, 0, this.basic(i % 2 ? c : b.def.eye)); t.userData.spinRing = i; } }
    else if (shape === 'bramble') { core = new THREE.IcosahedronGeometry(r * 0.85, 1); add(core); rim(core); for (let i = 0; i < 14; i++) { const v = new THREE.Vector3().setFromSphericalCoords(r * 0.85, Math.acos(1 - (2 * (i + 0.5)) / 14), i * 2.4); const sp = add(new THREE.ConeGeometry(r * 0.12, r * 0.5, 6), v.x, v.y, v.z, this.toon(c)); sp.lookAt(v.clone().multiplyScalar(2)); sp.rotateX(Math.PI / 2); } }
    else if (shape === 'crown') { core = new THREE.SphereGeometry(r, 18, 14); add(core); rim(core); const cr = add(new THREE.CylinderGeometry(r * 0.7, r * 0.6, r * 0.6, 6, 1, true), 0, r * 1.05, 0, this.toon('#ffd166', { side: THREE.DoubleSide, emissive: new THREE.Color('#6a4a00') })); cr.userData.crown = true; }
    else { core = new THREE.SphereGeometry(r, 18, 14); add(core); rim(core); if (shape === 'maw') { const mouth = add(new THREE.SphereGeometry(r * 0.55, 14, 8), 0, -r * 0.25, r * 0.7, this.basic('#12091a')); mouth.scale.set(1.2, 0.4, 0.5); mouth.userData.mouth = true; } }
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(r * 0.16, 10, 8), s * r * 0.3, r * 0.2, r * 0.85, this.basic(b.def.eye));
    g.userData.mat = mat;
    return g;
  }

  // ── projection for the 2D overlay ───────────────
  project(x, y, h = 0) {
    const v = this.v.set(x, h, y).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  // ── per-frame sync ─────────────────────────────
  render(run, tt) {
    if (!this.scene) return;
    const THREE = this.THREE, R = this.realm;
    const P = run.player;
    // camera
    let sx = 0, sy = 0;
    if (run.shakeMag > 0) { sx = (Math.random() - 0.5) * run.shakeMag * 2; sy = (Math.random() - 0.5) * run.shakeMag * 2; }
    const cx = run.cam.x + sx, cz = run.cam.y + sy;
    this.camera.position.set(cx, Math.sin(PITCH) * this.dist, cz + Math.cos(PITCH) * this.dist);
    this.camera.lookAt(cx, 0, cz);
    this.camera.updateMatrixWorld();
    // ground follows the camera in whole tiles so the texture stays world-anchored
    const tile = 4096 / 8;
    this.ground.position.set(Math.round(cx / tile) * tile, 0, Math.round(cz / tile) * tile);
    this.updateDeco(cx, cz, tt);
    for (const f of this.floaters) { const u = f.userData; u.a += u.s * 0.016; f.position.set(cx + Math.cos(u.a) * u.r, -u.h - 200, cz + Math.sin(u.a) * u.r * 0.6 - 500); f.rotation.y += 0.002; }
    this.glow.begin();
    this.shadows.begin();

    // launch island & slingshot
    const launching = run.phase === 'launch';
    this.isle.visible = launching || Math.hypot(cx, cz) < 900;
    this.band.visible = launching && !run.launch.fly;
    this.nestRing.visible = launching;
    this.nestRing.position.set(run.nest.x, 1, run.nest.y);
    this.aimRing.visible = launching && run.launch.pulling && Math.hypot(run.launch.px, run.launch.py) > 10;
    if (this.band.visible) {
      const p = this.band.geometry.attributes.position;
      p.setXYZ(0, -28, 50, 0); p.setXYZ(1, P.x, 16, P.y); p.setXYZ(2, 28, 50, 0); p.needsUpdate = true;
    }
    if (this.aimRing.visible) {
      const tx = -run.launch.px * 3.4, ty = -run.launch.py * 3.4, rr = 70 + (Math.hypot(run.launch.px, run.launch.py) / 110) * 60;
      this.aimRing.position.set(tx, 1.5, ty); this.aimRing.scale.setScalar(rr);
      for (let i = 1; i <= 16; i++) { const k = i / 16; this.glow.add(P.x + (tx - P.x) * k, 14 + Math.sin(k * Math.PI) * 90, P.y + (ty - P.y) * k, 10 - k * 4, '#ffffff', 1 - k * 0.5); }
    }

    // hero
    const h = this.hero;
    const lift = P.lift || 0;
    h.position.set(P.x, 13 + lift + (P.moving > 0.1 ? Math.abs(Math.sin(tt * 12)) * 3 : Math.sin(tt * 3) * 1), P.y);
    const target = P.moving > 0.05 || run.phase === 'launch' ? Math.atan2(Math.cos(P.faceA), Math.sin(P.faceA)) : h.rotation.y;
    let dr = target - h.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    h.rotation.y += dr * 0.2;
    const sq = P.squash || 0;
    this.heroBody.scale.set(1 + sq, 1 - sq, 1 + sq);
    h.visible = !(P.iframe > 0 && Math.sin(tt * 40) > 0);
    this.heroTail.rotation.x = 0.4 + Math.sin(tt * 10) * 0.25;
    if (this.heroHat.userData.spin) this.heroHat.userData.spin.rotation.y = tt * 20;
    if (this.heroHat.userData.sway) this.heroHat.rotation.z = Math.sin(tt * 2.4) * 0.15;
    this.heroShadow.position.set(P.x, 0.6, P.y); this.heroShadow.scale.setScalar(Math.max(0.4, 1 - lift / 250));

    // enemies
    for (const k in this.en) this.en[k].begin();
    this.wisp.begin(); this.sprite.begin(); this.eyes.begin(); this.pupils.begin(); this.crowns.begin(); this.shields.begin(); this.crosses.begin();
    const flashCol = '#ffffff', frozenCol = '#9fd8ff';
    for (const e of run.enemies) {
      const r = e.r;
      const ang = Math.atan2(P.x - e.x, P.y - e.y);
      const wob = Math.sin(tt * 8 + e.seed) * 0.08;
      const y = r * 0.85 + (e.ai === 'swoop' || e.shape === 'bat' ? 14 + Math.sin(tt * 6 + e.seed) * 4 : 0) + (e.ai === 'ghost' ? 10 : 0);
      const col = e.flash > 0 ? flashCol : e.frozen > 0 ? frozenCol : e.fuse > 0 && Math.sin(tt * 40) > 0 ? '#ff4d6d' : e.elite ? mixHex(this.en.blob.body, '#6a4a00', 0.35) : this.en.blob.body;
      this.shadows.add(e.x, 0.4, e.y, r * 0.9, 1, r * 0.9);
      if (e.type === 'sprite') { this.sprite.add(e.x, y + 6, e.y, r, r, r, tt * 3); this.glow.add(e.x, y + 6, e.y, 50, '#ffd166', 0.5); continue; }
      if (e.ai === 'ghost') {
        const al = e.ghostAlpha ?? 0.85;
        this.wisp.add(e.x, y, e.y, r, r * 1.15, r, 0); this.glow.add(e.x, y, e.y, r * 5, R.accent, 0.45 * al);
      } else {
        const m = this.en[e.shape] || this.en.blob;
        let sxx = r * (1 + wob), syy = r * (0.9 - wob), szz = r;
        let ry = ang, rx = 0, rz = 0;
        if (e.shape === 'bat') { sxx = r * (1.6 + Math.sin(tt * 22 + e.seed) * 0.5); syy = r * 0.45; }
        if (e.shape === 'dasher') ry = Math.atan2(e.vx, e.vy) || ang;
        if (e.shape === 'orbiter' || e.shape === 'blinker') { ry = tt * 3 + e.seed; }
        if (e.shape === 'minelayer') { ry = tt * 2; }
        if (e.shape === 'brute') { sxx = szz = r * 0.75; syy = r * 0.8; }
        if (e.blinkT > 0) { const s = 1 - e.blinkT / 0.3; sxx *= s; syy *= s; szz *= s; }
        m.add(e.x, y, e.y, sxx, syy, szz, ry, col, rx, rz);
      }
      // glowing eye facing the hero
      const ex = e.x + Math.sin(ang) * r * 0.78, ez = e.y + Math.cos(ang) * r * 0.78, eyY = y + r * 0.2;
      this.eyes.add(ex, eyY, ez, r * 0.3, r * 0.34, r * 0.18, ang, e.flash > 0 ? '#ff4d6d' : R.glow);
      this.pupils.add(e.x + Math.sin(ang) * r * 0.9, eyY, e.y + Math.cos(ang) * r * 0.9, r * 0.13, r * 0.15, r * 0.08, ang);
      if (e.elite) { this.crowns.add(e.x, y + r * 1.15, e.y, r * 0.5, r * 0.45, r * 0.5, tt); this.glow.add(e.x, 4, e.y, r * 3, '#ffd166', e.champion ? 0.35 : 0.18); }
      if (e.ai === 'shield') this.shields.add(e.x + Math.sin(ang) * r * 0.2, y, e.y + Math.cos(ang) * r * 0.2, r * 1.35, r * 1.4, r * 1.35, ang + Math.PI / 2);
      if (e.ai === 'healer') { this.crosses.add(e.x, y + r * 1.1, e.y, r * 0.2, r * 0.7, r * 0.2, tt); this.crosses.add(e.x, y + r * 1.1, e.y, r * 0.7, r * 0.2, r * 0.2, tt); if (e.healPulse > 0) this.glow.add(e.x, 5, e.y, 260 * (1 - e.healPulse), '#7dffc8', e.healPulse * 0.4); }
      if (e.ai === 'kamikaze') this.glow.add(e.x, y + r * 1.3, e.y, 14, '#ffd166', 0.8 + Math.sin(tt * 30) * 0.2);
      if (e.st === 'wind') { for (let i = 0; i < 12; i++) this.glow.add(e.x + Math.cos(e.lockA) * i * 16, 4, e.y + Math.sin(e.lockA) * i * 16, 14, '#ff4d6d', 0.8); }
    }
    for (const k in this.en) this.en[k].end();
    this.wisp.end(); this.sprite.end(); this.eyes.end(); this.pupils.end(); this.crowns.end(); this.shields.end(); this.crosses.end();

    // boss
    const b = run.boss;
    if (b && !b.dead) {
      if (!this.bossObj) { this.bossObj = this.buildBoss(b); this.scene.add(this.bossObj); }
      const o = this.bossObj;
      o.position.set(b.x, b.r * 1.05 + Math.sin(tt * 2) * 4, b.y);
      o.rotation.y = Math.atan2(P.x - b.x, P.y - b.y);
      const br = 1 + Math.sin(tt * 2.5) * 0.04; o.scale.set(br, 2 - br, br);
      o.userData.mat.emissive.set(b.flash > 0 ? '#ffffff' : '#000000');
      o.children.forEach((ch) => {
        if (ch.userData.wing) ch.rotation.z = ch.userData.wing * (0.3 + Math.sin(tt * 8) * 0.4);
        if (ch.userData.spinRing !== undefined) { ch.rotation.x = tt * (0.6 + ch.userData.spinRing * 0.3); ch.rotation.y = tt * 0.4; }
        if (ch.userData.seg !== undefined) ch.position.x = Math.sin(tt * 5 - ch.userData.seg) * b.r * 0.3;
        if (ch.userData.mouth) ch.scale.y = 0.3 + Math.abs(Math.sin(tt * 3)) * 0.4;
      });
      this.shadows.add(b.x, 0.4, b.y, b.r * 1.1, 1, b.r * 1.1);
      this.glow.add(b.x, b.r, b.y, b.r * 7, b.def.color, 0.35 + Math.sin(tt * 3) * 0.1);
    } else if (this.bossObj) { this.scene.remove(this.bossObj); this.bossObj = null; }

    // projectiles
    for (const k in this.pr) this.pr[k].begin();
    for (const p of run.projs) {
      const y = 14;
      if (p.kind === 'boomer') this.pr.boomer.add(p.x, y, p.y, p.r, p.r, p.r, p.spin || 0, null, Math.PI / 2);
      else if (p.kind === 'shard') this.pr.shard.add(p.x, y, p.y, p.r, p.r, p.r, Math.atan2(p.vx, p.vy));
      else if (p.kind === 'stone') this.pr.stone.add(p.x, y, p.y, p.r, p.r, p.r, tt * 6, null, tt * 4);
      else if (p.kind === 'bee') this.pr.bee.add(p.x, y + Math.sin(tt * 30 + p.id) * 2, p.y, 4, 3.4, 5, Math.atan2(p.vx, p.vy));
      else this.pr.bolt.add(p.x, y, p.y, p.r * 1.1, p.r * 1.1, p.r * 1.1, tt * 8, null, tt * 5);
      this.glow.add(p.x, y, p.y, p.r * 6, p.color, 0.8);
    }
    for (const w of run.weapons) if (w.id === 'petals' && w.pos) for (const [px, py, a] of w.pos) { const s = run.stats.area; this.pr.petal.add(px, 14, py, 10 * s, 3 * s, 5 * s, -a * 2); this.glow.add(px, 14, py, 18, WEAPONS.petals.color, 0.4); }
    for (const tl of run.teles) if (tl.block) { const k = 1 - tl.t / tl.max; this.pr.block.add(tl.x, 14 + (1 - k) * 260, tl.y, 24, 24, 24, tt, tl.color); }
    for (const l of run.fx.lines) { const s = 26, n = Math.ceil(l.w / s); for (let i = 0; i < n; i++) this.pr.block.add(l.x - l.w / 2 + i * s, 14, l.y, s * 0.95, s * 0.95, s * 0.95, 0, ['#7ef0ff', '#ffd166', '#ff8ccf', '#9df28a'][i % 4]); }
    for (const k in this.pr) this.pr[k].end();

    // enemy bullets — always the same coral "danger" read
    this.ebul.begin(); this.ebulCore.begin();
    for (const bl of run.ebullets) { this.ebul.add(bl.x, 12, bl.y, bl.r, bl.r, bl.r); this.ebulCore.add(bl.x, 12, bl.y, bl.r * 0.5, bl.r * 0.5, bl.r * 0.5); this.glow.add(bl.x, 12, bl.y, bl.r * 5, '#ff4d6d', 0.7); }
    this.ebul.end(); this.ebulCore.end();

    // gems & coins
    this.gemI.begin();
    for (const g of run.gems) {
      const s = g.big ? 7 : 4.5, c = g.v >= 10 ? '#ff8ccf' : g.v >= 4 ? '#7ef0ff' : '#9df28a';
      const y = 8 + Math.sin(tt * 4 + g.t) * 2;
      this.gemI.add(g.x, y, g.y, s * 0.7, s, s * 0.7, tt * 2 + g.t, c);
      this.glow.add(g.x, y, g.y, s * 4, c, 0.5);
    }
    this.gemI.end();
    this.coinI.begin();
    for (const c of run.coins) { const s = c.big ? 9 : 6, y = 9 + Math.sin(tt * 3 + c.t) * 2; this.coinI.add(c.x, y, c.y, s, s, s, 0, null, 0.9 + Math.sin(tt * 4 + c.t) * 0.35, Math.cos(tt * 3 + c.t) * 0.3); this.glow.add(c.x, y, c.y, s * 3.5, '#ffd166', 0.35); }
    this.coinI.end();

    // pickups
    this.chests.begin(); this.chestBands.begin(); this.hearts.begin(); this.magnets.begin();
    for (const pk of run.pickups) {
      const bob = Math.sin(tt * 3 + pk.x) * 3;
      if (pk.kind === 'chest') { const s = pk.gold ? 22 : 15; this.chests.add(pk.x, s * 0.5 + 2 + bob, pk.y, s, s, s, tt * 0.8, pk.gold ? '#ffcc4d' : '#b8742a'); this.chestBands.add(pk.x, s * 0.55 + 2 + bob, pk.y, s, s, s, tt * 0.8); this.glow.add(pk.x, 12, pk.y, 90, '#ffd166', 0.6); }
      else if (pk.kind === 'heart') { this.hearts.add(pk.x, 12 + bob, pk.y, 7, 7, 7); this.glow.add(pk.x, 12, pk.y, 40, '#ff6b8a', 0.5); }
      else { this.magnets.add(pk.x, 14 + bob, pk.y, 8, 8, 8, tt * 2); this.glow.add(pk.x, 12, pk.y, 40, '#7ef0ff', 0.5); }
    }
    this.chests.end(); this.chestBands.end(); this.hearts.end(); this.magnets.end();

    // zones
    this.mines.begin();
    for (const z of run.zones) {
      if (z.kind === 'fire') { const k = z.life / z.max; this.glow.add(z.x, 4, z.y, z.r * 3.5, z.color, 0.55 * k); this.glow.add(z.x, 10 + Math.sin(tt * 20 + z.x) * 3, z.y, z.r * 1.4, '#ffd166', 0.6 * k); }
      else if (z.kind === 'mine') { const on = z.arm <= 0 && Math.sin(tt * 12) > 0; this.mines.add(z.x, 6, z.y, z.r * 0.8, z.r * 0.6, z.r * 0.8, tt, on ? '#ff4d6d' : '#6a5a7a'); if (z.arm <= 0) this.glow.add(z.x, 6, z.y, 50, '#ff4d6d', 0.4); }
    }
    this.mines.end();

    // telegraphs (circles & lines)
    for (const m of this.teles) m.visible = false;
    for (const tl of run.teles) {
      if (tl.block) continue;
      const k = 1 - tl.t / tl.max;
      if (tl.line) {
        const m = this.poolGet(this.teles, () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0.5, 0, 0); return new THREE.Mesh(g, this.basic('#ff4d6d', { transparent: true, opacity: 0.3, depthWrite: false })); });
        m.position.set(tl.x, 1.2, tl.y); m.rotation.set(0, -tl.a, 0); m.scale.set(tl.len, 1, tl.w); m.material.opacity = 0.15 + 0.3 * k; m.material.color.set(tl.color);
        continue;
      }
      const m = this.poolGet(this.teles, () => { const g = new THREE.CircleGeometry(1, 40); g.rotateX(-Math.PI / 2); return new THREE.Mesh(g, this.basic('#ff4d6d', { transparent: true, opacity: 0.3, depthWrite: false })); });
      m.position.set(tl.x, 1.2, tl.y); m.rotation.set(0, 0, 0); m.scale.set(tl.r, 1, tl.r); m.material.color.set(tl.color); m.material.opacity = 0.12 + 0.3 * k;
      const ring = this.poolGet(this.teles, () => this.ringMesh(0.9, 1, '#ff4d6d', 0.9));
      ring.position.set(tl.x, 1.4, tl.y); ring.rotation.set(0, 0, 0); ring.scale.set(tl.r * Math.max(0.05, k), 1, tl.r * Math.max(0.05, k)); ring.material.color.set(tl.color); ring.material.opacity = 0.9;
    }
    // laser
    if (run.laser) {
      const L = run.laser;
      this.laserMesh.visible = true;
      this.laserMesh.position.set(L.x + Math.cos(L.a) * L.len / 2, 10, L.y + Math.sin(L.a) * L.len / 2);
      this.laserMesh.rotation.set(0, -L.a, 0);
      this.laserMesh.scale.set(L.len, 1, L.live ? L.w : 4);
      this.laserMesh.material.color.set(L.live ? (b ? b.def.color : '#ffffff') : '#ff4d6d');
      this.laserMesh.material.opacity = L.live ? 0.9 : 0.5;
    } else this.laserMesh.visible = false;

    // fx: particles, rings, lightning, chomps
    for (const p of run.fx.parts) this.glow.add(p.x, 10 + (1 - p.life / p.max) * 20, p.y, p.size * 5, p.color.startsWith('hsl') ? '#ffffff' : p.color, Math.max(0, p.life / p.max));
    for (const m of this.rings) m.visible = false;
    for (const r of run.fx.rings) {
      const k = r.t / r.dur;
      const m = this.poolGet(this.rings, () => this.ringMesh(0.9, 1, '#ffffff', 0.9));
      const rad = r.r * (0.2 + 0.8 * Math.sqrt(k));
      m.position.set(r.x, 2, r.y); m.scale.set(rad, 1, rad); m.material.color.set(r.color); m.material.opacity = (1 - k) * 0.9;
    }
    let bi = 0;
    const bc = new THREE.Color();
    for (const bo of run.fx.bolts) {
      bc.set(bo.color);
      for (let i = 1; i < bo.pts.length && bi < 390; i++) {
        const [ax, ay] = bo.pts[i - 1], [bx, by] = bo.pts[i];
        const segs = 4; let px = ax, py = ay;
        for (let s = 1; s <= segs && bi < 390; s++) {
          const k = s / segs; const nx = ax + (bx - ax) * k + (s < segs ? (Math.random() - 0.5) * 14 : 0), ny = ay + (by - ay) * k + (s < segs ? (Math.random() - 0.5) * 14 : 0);
          this.boltPos.set([px, 16, py, nx, 16, ny], bi * 6); this.boltCol.set([bc.r, bc.g, bc.b, bc.r, bc.g, bc.b], bi * 6);
          px = nx; py = ny; bi++;
        }
        this.glow.add(bx, 16, by, 40, bo.color, 0.7);
      }
    }
    this.bolts.geometry.setDrawRange(0, bi * 2); this.bolts.geometry.attributes.position.needsUpdate = true; this.bolts.geometry.attributes.color.needsUpdate = true;
    for (const m of this.chomps) m.visible = false;
    for (const c of run.fx.chomps) {
      const m = this.poolGet(this.chomps, () => new THREE.Mesh(new THREE.CircleGeometry(1, 30, 0, TAU), this.basic('#ffe066', { transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })));
      const open = Math.max(0.05, Math.sin((c.life / 0.22) * Math.PI) * c.arc);
      m.geometry.dispose(); m.geometry = new THREE.CircleGeometry(1, 24, -open, open * 2); m.geometry.rotateX(-Math.PI / 2);
      m.position.set(c.x, 6, c.y); m.rotation.set(0, -c.a, 0); m.scale.set(c.r, 1, c.r); m.material.color.set(c.color); m.material.opacity = 0.2 + 0.3 * (c.life / 0.22);
    }

    // cages & memory stone
    for (const c of run.cages) {
      let o = this.cageObjs.get(c);
      if (!o) { o = this.buildCage(c); this.cageObjs.set(c, o); this.scene.add(o); }
      o.position.set(c.x, 0, c.y);
      o.userData.creature.visible = !c.open;
      o.userData.creature.position.y = 20 + Math.sin(tt * 3 + c.t) * 2; o.userData.creature.rotation.y = Math.sin(tt + c.t) * 0.6;
      o.userData.prog.scale.setScalar(Math.max(0.01, c.progress));
      o.children.forEach((ch) => { if (ch.material && ch !== o.userData.prog) { ch.material.transparent = true; ch.material.opacity = c.open ? 0.3 : ch.material.opacity; } });
      if (!c.open) this.glow.add(c.x, 30, c.y, 140, c.creature.look.color, 0.35 + Math.sin(tt * 3) * 0.1);
      this.shadows.add(c.x, 0.4, c.y, 32, 1, 32);
    }
    if (run.stone && !run.stone.taken) {
      if (!this.stoneObj) {
        const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 34, 6), this.toon('#4a4063', { emissive: new THREE.Color('#2a1f4a') })); m.position.y = 17; g.add(m);
        const rune = new THREE.Mesh(new THREE.BoxGeometry(8, 14, 1), this.basic('#d9ccff')); rune.position.set(0, 20, 10.5); g.add(rune);
        this.stoneObj = g; this.scene.add(g);
      }
      this.stoneObj.position.set(run.stone.x, Math.sin(tt * 2) * 2, run.stone.y); this.stoneObj.rotation.y = tt * 0.5;
      this.glow.add(run.stone.x, 20, run.stone.y, 110, '#b5a1ff', 0.45 + Math.sin(tt * 3) * 0.15);
    } else if (this.stoneObj) { this.scene.remove(this.stoneObj); this.stoneObj = null; }

    this.shadows.add(P.x, 0.3, P.y, 0.01, 1, 0.01);
    this.shadows.end();
    // ambient motes drifting upward — we are falling
    for (let i = 0; i < 60; i++) {
      const ox = ((i * 137.5) % 900) - 450, oz = ((i * 91.3) % 900) - 450;
      const yy = ((tt * (20 + (i % 5) * 8) + i * 40) % 300);
      this.glow.add(cx + ox, yy, cz + oz, 6 + (i % 3) * 3, R.glow, 0.4 * (1 - yy / 300));
    }
    this.glow.mat.uniforms.scale.value = this.h * 0.9;
    this.glow.end();
    this.renderer.render(this.scene, this.camera);
  }

  updateDeco(cx, cz, tt) {
    const cell = 96;
    const key = `${Math.floor(cx / cell)},${Math.floor(cz / cell)}`;
    if (key === this.decoKey) return;
    this.decoKey = key;
    const d = this.deco, R = this.realm;
    for (const k in d) d[k].begin();
    const ix0 = Math.floor(cx / cell) - 9, iz0 = Math.floor(cz / cell) - 11;
    for (let iz = iz0; iz < iz0 + 20; iz++) for (let ix = ix0; ix < ix0 + 19; ix++) {
      const h = tileHash(ix, iz, R.id.length);
      const x = ix * cell + (h % 80) + 8, z = iz * cell + ((h >>> 8) % 80) + 8;
      const kind = (h >>> 16) % 12;
      if (Math.hypot(x, z) < 90) continue; // keep the launch island clear
      if (kind < 4) for (let t = 0; t < 3; t++) d.tuft.add(x + (t - 1) * 5, 3, z + ((h >>> t) % 7) - 3, 2.2, 3 + (t % 2) * 1.5, 2.2, 0, null, (t - 1) * 0.3);
      else if (kind === 4 || kind === 5) { const s = 5 + (h % 9); d.rock.add(x, s * 0.4, z, s, s * 0.75, s, h % 6); }
      else if (kind === 6 || kind === 7) { d.bloom.add(x, 2.5, z, 2.6, 2.6, 2.6); d.tuft.add(x, 2, z, 1.2, 2.5, 1.2); }
      else if (kind === 8 && (h & 3) === 0) { const s = 6 + (h % 8); d.crystal.add(x, s, z, s * 0.6, s * 1.6, s * 0.6, h % 5); }
    }
    for (const k in d) d[k].end();
  }
}
