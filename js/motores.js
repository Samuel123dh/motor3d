// ============================================================
// ENGINE 3D — motores.js (MODO DE TESTE VISUAL)
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createAnimator } from './animations.js';

const registry = new Map();

function makeMaterials() {
  return {
    // Carcaça do motor agora é semitransparente para ver o interior
    block:    new THREE.MeshStandardMaterial({ color: 0x444444, transparent: true, opacity: 0.3, metalness: 0.8, roughness: 0.5 }),
    head:     new THREE.MeshStandardMaterial({ color: 0x555555, transparent: true, opacity: 0.3, metalness: 0.8, roughness: 0.5 }),
    // Pistões e peças internas em cores bem claras
    piston:   new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.9, roughness: 0.1 }), // Laranja brilhante
    rod:      new THREE.MeshStandardMaterial({ color: 0x00ffcc, metalness: 0.9, roughness: 0.1 }), // Ciano
    crank:    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 }), // Branco
    valve:    new THREE.MeshStandardMaterial({ color: 0x00aaff, metalness: 0.9, roughness: 0.1 }), // Azul
    rotor:    new THREE.MeshStandardMaterial({ color: 0xff00ff, metalness: 0.9, roughness: 0.1 }),
    accent:   new THREE.MeshStandardMaterial({ color: 0xff4b1f, emissive: 0x551000 }),
    injector: new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x3a1400 }),
    glass:    new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.1 }),
  };
}

function makeCylinderBlock({ count, spacing, radius, height, materials }) {
  const group = new THREE.Group();
  const totalW = spacing * (count - 1) + radius * 2.4;
  const block = new THREE.Mesh(new THREE.BoxGeometry(totalW, height * 1.15, radius * 2.8), materials.block);
  group.add(block);
  const head = new THREE.Mesh(new THREE.BoxGeometry(totalW, height * 0.35, radius * 2.9), materials.head);
  head.position.y = height * 0.75;
  group.add(head);
  return group;
}

function makePistonAssembly({ x, z, radius, strokeLength, materials }) {
  const pistonGeo = new THREE.CylinderGeometry(radius * 0.92, radius * 0.92, radius * 0.9, 24);
  const piston = new THREE.Mesh(pistonGeo, materials.piston);
  const rodGeo = new THREE.BoxGeometry(radius * 0.35, strokeLength * 0.85, radius * 0.35);
  rodGeo.translate(0, -strokeLength * 0.42, 0);
  const rod = new THREE.Mesh(rodGeo, materials.rod);
  const pinGeo = new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, radius * 2.0, 12);
  pinGeo.rotateZ(Math.PI / 2);
  const pin = new THREE.Mesh(pinGeo, materials.rod);
  piston.position.set(x, 0, z);
  rod.position.set(x, 0, z);
  return { piston, rod, pin, baseX: x, baseZ: z, radius, strokeLength };
}

function buildInlineEngine({ count, materials }) {
  const root = new THREE.Group();
  const radius = 0.45; const stroke = 1.1; const spacing = 1.15; const crankY = -stroke * 0.6;
  root.add(makeCylinderBlock({ count, spacing, radius, height: stroke * 1.6, materials }));
  const crankGeo = new THREE.CylinderGeometry(0.22, 0.22, spacing * (count - 1) + 1.6, 20);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  crank.position.y = crankY;
  root.add(crank);
  const pistons = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const p = makePistonAssembly({ x, z: 0, radius, strokeLength: stroke, materials });
    p.piston.position.y = crankY + stroke * 0.5;
    p.rod.position.set(x, crankY + stroke * 0.5, 0);
    p.phase = (i % 2) * Math.PI;
    root.add(p.piston, p.rod, p.pin);
    pistons.push(p);
  }
  const valves = [];
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    for (const side of [-1, 1]) {
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 10), materials.valve);
      v.position.set(x + side * 0.12, stroke * 1.2, 0);
      v.userData.side = side;
      v.userData.phase = (i * Math.PI) + (side === 1 ? Math.PI : 0);
      root.add(v); valves.push(v);
    }
  }
  return { root, parts: { pistons, valves, crank, crankY, stroke }, type: 'inline' };
}

function buildVEngine({ totalCylinders, angleDeg, materials }) {
  const root = new THREE.Group();
  const perBank = totalCylinders / 2; const radius = 0.42; const stroke = 1.0; const spacing = 1.1; const crankY = 0;
  const halfAngle = THREE.MathUtils.degToRad(angleDeg / 2);
  const crankGeo = new THREE.CylinderGeometry(0.22, 0.22, spacing * (perBank - 1) + 2.0, 20);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  root.add(crank);
  const pistons = []; const valves = [];
  for (const side of [-1, 1]) {
    const bank = new THREE.Group(); bank.rotation.x = side * halfAngle; root.add(bank);
    const block = makeCylinderBlock({ count: perBank, spacing, radius, height: stroke * 1.6, materials });
    block.position.y = stroke * 0.6; bank.add(block);
    for (let i = 0; i < perBank; i++) {
      const x = (i - (perBank - 1) / 2) * spacing;
      const p = makePistonAssembly({ x, z: 0, radius, strokeLength: stroke, materials });
      p.bankSide = side; p.phase = (i * Math.PI) + (side === 1 ? Math.PI : 0);
      bank.add(p.piston, p.rod, p.pin); pistons.push(p);
      for (const vs of [-1, 1]) {
        const v = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.45, 10), materials.valve);
        v.position.set(x + vs * 0.1, stroke * 1.8, 0);
        v.userData.phase = (i * Math.PI) + (vs === 1 ? Math.PI : 0);
        bank.add(v); valves.push(v);
      }
    }
  }
  return { root, parts: { pistons, valves, crank, crankY, stroke }, type: 'v' };
}

function buildBoxerEngine({ pairs, materials }) {
  const root = new THREE.Group();
  const radius = 0.42; const stroke = 1.0; const spacing = 1.15;
  const crankGeo = new THREE.CylinderGeometry(0.22, 0.22, spacing * (pairs - 1) + 2.0, 20);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  root.add(crank);
  const pistons = []; const valves = [];
  for (let i = 0; i < pairs; i++) {
    const x = (i - (pairs - 1) / 2) * spacing;
    for (const side of [-1, 1]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.9, radius * 2.2, 1.6), materials.block);
      block.position.set(x, 0, side * (stroke * 0.6 + radius));
      root.add(block);
      const pistonGeo = new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, radius * 0.9, 20);
      pistonGeo.rotateX(Math.PI / 2);
      const piston = new THREE.Mesh(pistonGeo, materials.piston);
      piston.position.set(x, 0, side * stroke * 0.55);
      root.add(piston);
      const rodGeo = new THREE.BoxGeometry(radius * 0.35, radius * 0.35, stroke * 0.85);
      rodGeo.translate(0, 0, stroke * 0.42);
      const rod = new THREE.Mesh(rodGeo, materials.rod);
      root.add(rod);
      pistons.push({ piston, rod, baseX: x, side, phase: (i % 2) * Math.PI });
      for (const vs of [-1, 1]) {
        const vGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.4, 10);
        vGeo.rotateX(Math.PI / 2);
        const v = new THREE.Mesh(vGeo, materials.valve);
        v.position.set(x + vs * 0.15, 0, side * (stroke * 1.35));
        v.userData.side = side; v.userData.phase = (i * Math.PI) + (vs === 1 ? Math.PI : 0);
        root.add(v); valves.push(v);
      }
    }
  }
  return { root, parts: { pistons, valves, crank, crankY: 0, stroke }, type: 'boxer' };
}

function buildWEngine({ materials }) {
  const root = new THREE.Group();
  const radius = 0.34; const stroke = 0.8; const spacing = 0.95; const perBank = 3;
  const halfAngle = THREE.MathUtils.degToRad(15);
  const crankGeo = new THREE.CylinderGeometry(0.18, 0.18, spacing * (perBank - 1) + 1.6, 18);
  crankGeo.rotateZ(Math.PI / 2);
  const crank = new THREE.Mesh(crankGeo, materials.crank);
  root.add(crank);
  const pistons = []; const valves = [];
  const bankConfigs = [
    { tilt: -halfAngle, offsetY: 0.6 }, { tilt: halfAngle, offsetY: 0.6 },
    { tilt: -halfAngle * 2.6, offsetY: -0.4 }, { tilt: halfAngle * 2.6, offsetY: -0.4 },
  ];
  for (const cfg of bankConfigs) {
    const bank = new THREE.Group(); bank.rotation.x = cfg.tilt; bank.position.y = cfg.offsetY; root.add(bank);
    const block = makeCylinderBlock({ count: perBank, spacing, radius, height: stroke * 1.4, materials });
    block.position.y = stroke * 0.4; bank.add(block);
    for (let i = 0; i < perBank; i++) {
      const x = (i - (perBank - 1) / 2) * spacing;
      const p = makePistonAssembly({ x, z: 0, radius, strokeLength: stroke, materials });
      p.phase = (i * Math.PI) + (cfg.tilt < 0 ? 0 : Math.PI);
      bank.add(p.piston, p.rod, p.pin); pistons.push(p);
      for (const vs of [-1, 1]) {
        const v = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 10), materials.valve);
        v.position.set(x + vs * 0.1, stroke * 1.5, 0);
        v.userData.phase = (i * Math.PI) + (vs === 1 ? Math.PI : 0);
        bank.add(v); valves.push(v);
      }
    }
  }
  return { root, parts: { pistons, valves, crank, crankY: 0, stroke }, type: 'w' };
}

function buildRotaryEngine({ materials }) {
  const root = new THREE.Group();
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.85, 6), materials.block);
  housing.rotation.x = Math.PI / 2; root.add(housing);
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.86, 6), materials.glass);
  chamber.rotation.x = Math.PI / 2; root.add(chamber);
  const shaftGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.4, 16);
  shaftGeo.rotateX(Math.PI / 2);
  const shaft = new THREE.Mesh(shaftGeo, materials.crank);
  root.add(shaft);
  const rotorShape = new THREE.Shape();
  const R = 0.95;
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2; const x = Math.cos(a) * R; const y = Math.sin(a) * R;
    if (k === 0) rotorShape.moveTo(x, y); else rotorShape.lineTo(x, y);
  }
  rotorShape.closePath();
  const rotorGeo = new THREE.ExtrudeGeometry(rotorShape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  rotorGeo.translate(0, 0, -0.25);
  const rotor = new THREE.Mesh(rotorGeo, materials.rotor);
  root.add(rotor);
  const seals = [];
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const seal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), materials.valve);
    seal.userData.angle = a; root.add(seal); seals.push(seal);
  }
  const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 10), materials.injector);
  plug.position.y = 1.1; root.add(plug);
  return { root, parts: { rotor, shaft, seals, plug }, type: 'rotary' };
}

function buildDieselEngine({ materials }) {
  const base = buildInlineEngine({ count: 4, materials });
  const injectors = []; const count = 4, spacing = 1.15;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const inj = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.6, 12), materials.injector);
    inj.position.set(x, base.parts.stroke * 1.55, 0); base.root.add(inj); injectors.push(inj);
  }
  base.parts.injectors = injectors; base.type = 'diesel';
  return base;
}

function buildFlexEngine({ materials }) {
  const base = buildInlineEngine({ count: 4, materials });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.18, 0.3), materials.accent);
  rail.position.y = base.parts.stroke * 1.35; base.root.add(rail);
  const injectors = []; const count = 4, spacing = 1.15;
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const inj = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.45, 10), materials.injector);
    inj.position.set(x, base.parts.stroke * 1.05, 0); base.root.add(inj); injectors.push(inj);
  }
  base.parts.injectors = injectors; base.parts.rail = rail; base.type = 'flex';
  return base;
}

const BUILDERS = {
  L3: (m) => buildInlineEngine({ count: 3, materials: m }),
  L4: (m) => buildInlineEngine({ count: 4, materials: m }),
  L6: (m) => buildInlineEngine({ count: 6, materials: m }),
  V6: (m) => buildVEngine({ totalCylinders: 6, angleDeg: 60, materials: m }),
  V8: (m) => buildVEngine({ totalCylinders: 8, angleDeg: 90, materials: m }),
  V10: (m) => buildVEngine({ totalCylinders: 10, angleDeg: 90, materials: m }),
  V12: (m) => buildVEngine({ totalCylinders: 12, angleDeg: 60, materials: m }),
  BOXER: (m) => buildBoxerEngine({ pairs: 2, materials: m }),
  W: (m) => buildWEngine({ materials: m }),
  ROTARY: (m) => buildRotaryEngine({ materials: m }),
  DIESEL: (m) => buildDieselEngine({ materials: m }),
  FLEX: (m) => buildFlexEngine({ materials: m }),
};

function createScene(canvasEl, id) {
  const container = canvasEl;
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 400;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d10);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(12, 10, 16); // Câmera bem afastada
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // ILUMINAÇÃO MUITO FORTE PARA NÃO TER ERRO
  scene.add(new THREE.AmbientLight(0xffffff, 2.0));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3.0));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
  keyLight.position.set(10, 20, 10);
  scene.add(keyLight);

  const grid = new THREE.GridHelper(20, 20, 0x2a2e37, 0x1a1d22);
  grid.position.y = -3; scene.add(grid);

  const materials = makeMaterials();
  let built;
  try { built = BUILDERS[id](materials); } catch (err) { return null; }

  scene.add(built.root);
  const box = new THREE.Box3().setFromObject(built.root);
  const center = box.getCenter(new THREE.Vector3());
  built.root.position.sub(center);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.rotateSpeed = 1.0;
  controls.minDistance = 3; controls.maxDistance = 40;
  controls.update();

  const animator = createAnimator(built, materials);
  const state = { running: true, time: 0 };
  const clock = new THREE.Clock();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state.running) { state.time += dt; animator.update(state.time, dt); }
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(tick);

  const ro = new ResizeObserver(() => {
    const w = container.clientWidth; const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
  });
  ro.observe(container);
  return { scene, camera, renderer, controls, animator, state };
}

function buildControlButtons(targetId, controller) {
  const wrap = document.querySelector(`.engine-controls[data-target="${targetId}"]`);
  if (!wrap) return;
  const defs = [
    { label: '▶ Play', action: () => { controller.state.running = true; setActive(0); } },
    { label: '⏸ Pause', action: () => { controller.state.running = false; setActive(1); } },
    { label: '⟲ Reiniciar', action: () => { controller.state.time = 0; controller.state.running = true; setActive(0); } },
    { label: '⌂ Reset Câmera', action: () => { controller.camera.position.set(12, 10, 16); controller.controls.target.set(0, 0, 0); controller.controls.update(); } },
  ];
  function setActive(i) { els.forEach((el, k) => el.classList.toggle('active', k === i)); }
  const els = defs.map((b) => {
    const el = document.createElement('button'); el.textContent = b.label;
    el.addEventListener('click', b.action); wrap.appendChild(el); return el;
  });
  els[0].classList.add('active');
}

export function initAllMotors() {
  const canvasEls = document.querySelectorAll('.engine-canvas');
  canvasEls.forEach((el) => {
    const id = el.id.replace('canvas-', '');
    if (!BUILDERS[id]) return;
    const loader = document.createElement('div'); loader.className = 'canvas-loader'; loader.textContent = `Carregando ${id}`;
    el.appendChild(loader);
    requestAnimationFrame(() => {
      const controller = createScene(el, id);
      if (!controller) return;
      loader.remove(); registry.set(id, controller); buildControlButtons(id, controller);
    });
  });
  const heroEl = document.getElementById('hero-canvas');
  if (heroEl) {
    const heroController = createScene(heroEl, 'L4');
    if (heroController) {
      heroController.controls.enablePan = false; heroController.controls.autoRotate = true; heroController.controls.autoRotateSpeed = 1.0;
    }
  }
}
