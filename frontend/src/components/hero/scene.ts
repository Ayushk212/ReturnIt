import {
  BoxGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  Path,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Raycaster,
  Scene,
  Shape,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ */
/* Palette and materials                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  night: '#070B18',
  cobalt: '#2F45FF',
  cobaltFabric: '#2536E8',
  cobaltDeep: '#16228F',
  lime: '#C8F04A',
  coral: '#FF7A59',
  paper: '#F2EFE7',
  ink: '#1A2140',
  steel: '#C9CED8',
  brass: '#D9B45E',
};

function plastic(color: string, extra: Partial<ConstructorParameters<typeof MeshPhysicalMaterial>[0]> = {}) {
  return new MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.22, ...extra });
}

function fabric(color: string) {
  return new MeshPhysicalMaterial({
    color,
    envMapIntensity: 0.45,
    roughness: 0.7,
    sheen: 0.45,
    sheenRoughness: 0.45,
    sheenColor: new Color(color).lerp(new Color('#ffffff'), 0.2),
  });
}

function metal(color: string) {
  return new MeshStandardMaterial({ color, roughness: 0.2, metalness: 1 });
}

function makeMaterials() {
  return {
    cobaltFabric: fabric(PALETTE.cobaltFabric),
    cobaltDeepFabric: fabric(PALETTE.cobaltDeep),
    inkFabric: fabric(PALETTE.ink),
    lime: plastic(PALETTE.lime),
    coral: plastic(PALETTE.coral),
    paper: plastic(PALETTE.paper, { roughness: 0.5 }),
    paperMatte: new MeshStandardMaterial({ color: '#FBFAF6', roughness: 0.95 }),
    cobalt: plastic(PALETTE.cobalt),
    ink: plastic(PALETTE.ink, { roughness: 0.3 }),
    steel: metal(PALETTE.steel),
    brass: metal(PALETTE.brass),
  };
}
type Materials = ReturnType<typeof makeMaterials>;

const mesh = (geometry: ConstructorParameters<typeof Mesh>[0], material: Material, setup?: (m: Mesh) => void) => {
  const m = new Mesh(geometry, material);
  setup?.(m);
  return m;
};

/* ------------------------------------------------------------------ */
/* Objects. Each is built around its own centre, roughly 2 units tall. */
/* ------------------------------------------------------------------ */

function backpack(mt: Materials): Group {
  const g = new Group();
  g.add(mesh(new RoundedBoxGeometry(1.7, 2.1, 0.95, 6, 0.36), mt.cobaltFabric));
  g.add(mesh(new RoundedBoxGeometry(1.24, 0.86, 0.36, 5, 0.16), mt.cobaltDeepFabric, (m) => m.position.set(0, -0.46, 0.5)));
  g.add(mesh(new RoundedBoxGeometry(1.0, 0.05, 0.05, 2, 0.02), mt.lime, (m) => m.position.set(0, -0.06, 0.69)));
  g.add(mesh(new RoundedBoxGeometry(0.1, 0.26, 0.05, 2, 0.024), mt.lime, (m) => m.position.set(0.34, -0.2, 0.71)));
  // Main zip running over the top of the bag.
  g.add(mesh(new TorusGeometry(0.62, 0.028, 8, 40, Math.PI), mt.lime, (m) => {
    m.position.set(0, 0.42, 0.47);
    m.scale.set(1, 0.95, 1);
  }));
  g.add(mesh(new TorusGeometry(0.26, 0.055, 12, 32, Math.PI), mt.ink, (m) => m.position.set(0, 1.03, -0.08)));
  // Shoulder straps on the back, flattened against it.
  for (const x of [-0.45, 0.45]) {
    g.add(mesh(new TorusGeometry(0.86, 0.075, 10, 36, Math.PI), mt.inkFabric, (m) => {
      m.rotation.set(0, -Math.PI / 2, Math.PI / 2);
      m.scale.set(1, 0.36, 1);
      m.position.set(x, -0.05, -0.47);
    }));
  }
  return g;
}

function headphones(mt: Materials): Group {
  const g = new Group();
  g.add(mesh(new TorusGeometry(1.0, 0.085, 16, 64, Math.PI), mt.paper));
  g.add(mesh(new TorusGeometry(0.99, 0.075, 12, 40, Math.PI * 0.5), mt.ink, (m) => (m.rotation.z = Math.PI * 0.25)));
  for (const s of [-1, 1]) {
    const cup = new Group();
    cup.position.set(s * 1.0, -0.28, 0);
    cup.add(mesh(new CylinderGeometry(0.45, 0.45, 0.34, 40), mt.paper, (m) => (m.rotation.z = Math.PI / 2)));
    cup.add(mesh(new CylinderGeometry(0.3, 0.3, 0.06, 40), mt.cobalt, (m) => {
      m.rotation.z = Math.PI / 2;
      m.position.x = s * 0.19;
    }));
    cup.add(mesh(new TorusGeometry(0.3, 0.13, 16, 40), mt.lime, (m) => {
      m.rotation.y = Math.PI / 2;
      m.position.x = -s * 0.2;
    }));
    g.add(cup);
  }
  g.position.y = -0.2;
  const wrap = new Group();
  wrap.add(g);
  return wrap;
}

/** A fictional, clearly non-functional sample ID drawn onto a canvas. */
function idTexture(): CanvasTexture {
  const w = 1024;
  const h = 648;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const round = (x: number, y: number, rw: number, rh: number, r: number) => {
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, rw, rh, r);
      else ctx.rect(x, y, rw, rh);
    };
    ctx.fillStyle = '#F8F7F2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PALETTE.cobalt;
    ctx.fillRect(0, 0, w, 170);
    ctx.fillStyle = 'rgba(7,11,24,0.55)';
    round(w / 2 - 90, 36, 180, 30, 15);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 58px system-ui, sans-serif';
    ctx.fillText('RETURNIT', 64, 140);
    ctx.font = '600 26px ui-monospace, monospace';
    ctx.fillStyle = PALETTE.lime;
    ctx.fillText('CAMPUS ID', w - 230, 140);
    // Portrait placeholder
    ctx.fillStyle = PALETTE.lime;
    round(64, 220, 250, 320, 26);
    ctx.fill();
    ctx.fillStyle = 'rgba(26,33,64,0.85)';
    ctx.beginPath();
    ctx.arc(189, 345, 62, 0, Math.PI * 2);
    ctx.fill();
    round(99, 425, 180, 140, 80);
    ctx.fill();
    // Text lines (deliberately blank bars, no personal data)
    ctx.fillStyle = PALETTE.ink;
    ctx.font = '600 24px ui-monospace, monospace';
    ctx.fillText('STUDENT · SAMPLE', 360, 250);
    ctx.fillStyle = 'rgba(26,33,64,0.18)';
    [[360, 290, 480], [360, 340, 380], [360, 390, 300]].forEach(([x, y, lw]) => {
      round(x, y, lw, 26, 13);
      ctx.fill();
    });
    // Barcode
    ctx.fillStyle = PALETTE.ink;
    let x = 360;
    for (let i = 0; i < 46; i += 1) {
      const bw = 3 + ((i * 7) % 5) * 2;
      if (i % 3 !== 1) ctx.fillRect(x, 470, bw, 90);
      x += bw + 4;
      if (x > w - 70) break;
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function idCard(mt: Materials, textures: Texture[], maxAniso: number): Group {
  const g = new Group();
  g.add(mesh(new RoundedBoxGeometry(1.75, 1.12, 0.045, 2, 0.02), mt.paper));
  const tex = idTexture();
  tex.anisotropy = maxAniso;
  textures.push(tex);
  g.add(mesh(new PlaneGeometry(1.7, 1.075), new MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.1 }), (m) => (m.position.z = 0.0235)));
  g.add(mesh(new RoundedBoxGeometry(0.18, 0.24, 0.07, 2, 0.03), mt.steel, (m) => m.position.set(0, 0.64, 0)));
  const loop = new CatmullRomCurve3(
    [new Vector3(0, 0.74, 0), new Vector3(-0.3, 1.25, -0.08), new Vector3(-0.08, 1.85, -0.2), new Vector3(0.3, 1.5, -0.12), new Vector3(0.05, 0.76, 0)],
    false,
    'catmullrom',
    0.5,
  );
  g.add(mesh(new TubeGeometry(loop, 64, 0.032, 8, false), mt.lime, (m) => m.scale.set(1, 1, 0.6)));
  g.position.y = -0.35;
  const wrap = new Group();
  wrap.add(g);
  return wrap;
}

function keyGeometry() {
  const r = 0.3;
  const w = 0.075;
  const join = Math.sqrt(r * r - w * w);
  const s = new Shape();
  s.moveTo(-w, -1.27);
  s.lineTo(-w, -join);
  s.absarc(0, 0, r, Math.atan2(-join, -w), Math.atan2(-join, w), true);
  s.lineTo(w, -0.56);
  s.lineTo(w + 0.09, -0.62);
  s.lineTo(w + 0.09, -0.72);
  s.lineTo(w, -0.78);
  s.lineTo(w, -0.88);
  s.lineTo(w + 0.1, -0.95);
  s.lineTo(w + 0.06, -1.05);
  s.lineTo(w, -1.1);
  s.lineTo(w, -1.27);
  s.lineTo(0, -1.35);
  s.lineTo(-w, -1.27);
  const hole = new Path();
  hole.absarc(0, 0.1, 0.085, 0, Math.PI * 2, false);
  s.holes.push(hole);
  const geo = new ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 });
  geo.translate(0, 0, -0.025);
  return geo;
}

function tagGeometry() {
  const s = new Shape();
  s.moveTo(-0.34, -1.0);
  s.lineTo(0.34, -1.0);
  s.lineTo(0.34, -0.3);
  s.lineTo(0.14, -0.02);
  s.lineTo(-0.14, -0.02);
  s.lineTo(-0.34, -0.3);
  s.lineTo(-0.34, -1.0);
  const hole = new Path();
  hole.absarc(0, -0.18, 0.065, 0, Math.PI * 2, false);
  s.holes.push(hole);
  const geo = new ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.014, bevelSegments: 2 });
  geo.translate(0, 0, -0.02);
  return geo;
}

function keys(mt: Materials): Group {
  const g = new Group();
  const ringR = 0.42;
  g.add(mesh(new TorusGeometry(ringR, 0.045, 12, 48), mt.steel));
  const hang = (child: Object3D, angle: number) => {
    const pivot = new Group();
    pivot.rotation.z = angle + Math.PI / 2;
    pivot.add(child);
    g.add(pivot);
  };
  const keyGeo = keyGeometry();
  hang(mesh(keyGeo, mt.brass, (m) => {
    m.position.y = -ringR - 0.1;
    m.rotation.y = Math.PI / 2 + 0.25;
  }), -Math.PI / 2 - 0.4);
  hang(mesh(keyGeo, mt.steel, (m) => {
    m.position.y = -ringR - 0.1;
    m.rotation.y = Math.PI / 2 - 0.35;
    m.scale.setScalar(0.85);
  }), -Math.PI / 2 + 0.05);
  const tag = new Group();
  tag.position.y = -ringR + 0.18;
  tag.rotation.y = 0.3;
  tag.add(mesh(tagGeometry(), mt.coral));
  tag.add(mesh(new TorusGeometry(0.07, 0.018, 8, 24), mt.paper, (m) => m.position.y = -0.18));
  tag.add(mesh(new BoxGeometry(0.36, 0.035, 0.05), mt.ink, (m) => m.position.set(0, -0.52, 0)));
  tag.add(mesh(new BoxGeometry(0.24, 0.035, 0.05), mt.ink, (m) => m.position.set(-0.06, -0.62, 0)));
  hang(tag, -Math.PI / 2 + 0.55);
  g.position.y = 0.55;
  const wrap = new Group();
  wrap.add(g);
  return wrap;
}

function notebook(mt: Materials): Group {
  const g = new Group();
  g.add(mesh(new RoundedBoxGeometry(1.35, 1.75, 0.07, 3, 0.03), mt.lime, (m) => (m.position.z = 0.125)));
  g.add(mesh(new RoundedBoxGeometry(1.35, 1.75, 0.07, 3, 0.03), mt.lime, (m) => (m.position.z = -0.125)));
  g.add(mesh(new BoxGeometry(1.28, 1.68, 0.18), mt.paperMatte, (m) => (m.position.x = 0.02)));
  const ringGeo = new TorusGeometry(0.14, 0.02, 8, 20);
  for (let i = 0; i < 10; i += 1) {
    g.add(mesh(ringGeo, mt.steel, (m) => {
      m.rotation.x = Math.PI / 2;
      m.position.set(-0.66, -0.75 + i * 0.167, 0);
    }));
  }
  g.add(mesh(new BoxGeometry(0.06, 1.78, 0.33), mt.ink, (m) => (m.position.x = 0.44)));
  g.add(mesh(new RoundedBoxGeometry(0.6, 0.3, 0.012, 2, 0.005), mt.paper, (m) => m.position.set(0.0, 0.45, 0.165)));
  return g;
}

function bottle(mt: Materials): Group {
  const g = new Group();
  const profile = [
    [0, 0], [0.34, 0], [0.4, 0.04], [0.42, 0.12], [0.42, 1.25], [0.4, 1.38], [0.32, 1.5], [0.24, 1.56], [0.24, 1.64],
  ].map(([x, y]) => new Vector2(x, y));
  g.add(mesh(new LatheGeometry(profile, 48), mt.coral));
  g.add(mesh(new CylinderGeometry(0.425, 0.425, 0.2, 48, 1, true), mt.ink, (m) => (m.position.y = 0.62)));
  g.add(mesh(new CylinderGeometry(0.27, 0.27, 0.32, 32), mt.paper, (m) => (m.position.y = 1.78)));
  g.add(mesh(new TorusGeometry(0.14, 0.035, 10, 24), mt.paper, (m) => (m.position.y = 2.0)));
  g.position.y = -1.0;
  const wrap = new Group();
  wrap.add(g);
  return wrap;
}

function watch(mt: Materials): Group {
  const g = new Group();
  g.add(mesh(new CylinderGeometry(0.48, 0.48, 0.16, 48), mt.steel, (m) => (m.rotation.x = Math.PI / 2)));
  g.add(mesh(new TorusGeometry(0.47, 0.035, 12, 48), mt.steel, (m) => (m.position.z = 0.08)));
  g.add(mesh(new CylinderGeometry(0.43, 0.43, 0.02, 48), mt.cobalt, (m) => {
    m.rotation.x = Math.PI / 2;
    m.position.z = 0.08;
  }));
  g.add(mesh(new BoxGeometry(0.035, 0.3, 0.01), mt.paper, (m) => {
    m.position.set(0.05, 0.11, 0.1);
    m.rotation.z = -0.4;
  }));
  g.add(mesh(new BoxGeometry(0.03, 0.22, 0.01), mt.lime, (m) => {
    m.position.set(-0.08, -0.05, 0.1);
    m.rotation.z = 1.1;
  }));
  g.add(mesh(new CylinderGeometry(0.06, 0.06, 0.1, 16), mt.steel, (m) => {
    m.rotation.z = Math.PI / 2;
    m.position.x = 0.53;
  }));
  for (const s of [-1, 1]) {
    g.add(mesh(new RoundedBoxGeometry(0.42, 1.0, 0.07, 3, 0.03), mt.paper, (m) => {
      m.position.set(0, s * 0.92, -0.05);
      m.rotation.x = s * 0.28;
    }));
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

type Builder = (mt: Materials, textures: Texture[], maxAniso: number) => Group;

interface PropSpec {
  build: Builder;
  category: string;
  /** Position as a fraction of the visible half-width / half-height, plus depth. */
  fx: number;
  fy: number;
  z: number;
  scale: number;
  rot: [number, number, number];
}

// Desktop composition is arranged around the two floating listing tags (top-right and lower-left).
const DESKTOP: PropSpec[] = [
  { build: backpack, category: 'wallets-bags', fx: 0.62, fy: -0.02, z: 0, scale: 1.0, rot: [0.16, -0.55, 0.06] },
  { build: headphones, category: 'electronics', fx: 0.17, fy: 0.55, z: -1.4, scale: 0.9, rot: [0.4, 0.5, -0.28] },
  { build: idCard, category: 'documents', fx: 0.84, fy: -0.32, z: -1, scale: 0.92, rot: [0.08, -0.5, -0.18] },
  { build: keys, category: 'keys', fx: 0.05, fy: -0.3, z: 1.4, scale: 0.74, rot: [0.15, 0.5, 0.3] },
  { build: bottle, category: 'other', fx: 0.9, fy: 0.3, z: -2, scale: 0.8, rot: [0.25, 0, -0.45] },
  { build: notebook, category: 'books', fx: 0.3, fy: 0.12, z: -5, scale: 0.9, rot: [0.5, -0.65, 0.3] },
  { build: watch, category: 'jewelry', fx: 0.58, fy: -0.5, z: 0.6, scale: 0.56, rot: [0.6, -0.5, 0.15] },
];

const COMPACT: PropSpec[] = [
  { build: backpack, category: 'wallets-bags', fx: 0.02, fy: -0.08, z: 0, scale: 1.0, rot: [0.16, -0.5, 0.06] },
  { build: headphones, category: 'electronics', fx: -0.6, fy: 0.42, z: -1.2, scale: 0.8, rot: [0.4, 0.5, -0.28] },
  { build: keys, category: 'keys', fx: 0.6, fy: -0.42, z: 1.2, scale: 0.72, rot: [0.15, 0.5, 0.3] },
  { build: idCard, category: 'documents', fx: 0.62, fy: 0.5, z: -1.6, scale: 0.85, rot: [0.08, -0.45, 0.22] },
];

interface Prop {
  spec: PropSpec;
  group: Group;
  base: Vector3;
  phase: number;
  delay: number;
  hover: number;
  spin: number;
  spinVel: number;
}

export interface HeroSceneOptions {
  canvas: HTMLCanvasElement;
  compact: boolean;
  reducedMotion: boolean;
  interactive: boolean;
  onHover?: (category: string | null) => void;
  onSelect?: (category: string) => void;
  onFirstFrame?: () => void;
}

export interface HeroSceneHandle {
  setPointer(clientX: number, clientY: number): void;
  setScroll(progress: number): void;
  dispose(): void;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeOutBack = (t: number) => {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export function createHeroScene(opts: HeroSceneOptions): HeroSceneHandle {
  const { canvas, compact, reducedMotion, interactive } = opts;
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 1.75));
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new Scene();
  scene.fog = new Fog(PALETTE.night, 17, 34);
  const pmrem = new PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 1.1;

  const camZ = compact ? 11.5 : 14;
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, camZ);

  // Physically based light units: roughly π is needed for a white surface to read as white.
  scene.add(new HemisphereLight('#E4E8FF', '#1B2347', 1.3));
  const key = new DirectionalLight('#FFF4E6', 4.6);
  key.position.set(-5, 6, 8);
  scene.add(key);
  const rim = new DirectionalLight('#6A7BFF', 6);
  rim.position.set(6, 3, -6);
  scene.add(rim);
  const bounce = new PointLight(PALETTE.lime, 60, 22, 2);
  bounce.position.set(-3, -5, 5);
  scene.add(bounce);

  const materials = makeMaterials();
  const textures: Texture[] = [];
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const root = new Group();
  scene.add(root);

  const specs = compact ? COMPACT : DESKTOP;
  const props: Prop[] = specs.map((spec, i) => {
    const group = spec.build(materials, textures, maxAniso);
    group.userData.propIndex = i;
    root.add(group);
    return { spec, group, base: new Vector3(), phase: i * 1.7, delay: 0.2 + i * 0.11, hover: 0, spin: 0, spinVel: 0 };
  });

  function layout(width: number, height: number) {
    const aspect = width / Math.max(height, 1);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camZ;
    const halfW = halfH * aspect;
    props.forEach((p) => {
      // Keep the on-screen position stable regardless of depth.
      const depthFactor = (camZ - p.spec.z) / camZ;
      p.base.set(p.spec.fx * halfW * depthFactor, p.spec.fy * halfH * depthFactor, p.spec.z);
    });
  }

  const pointer = new Vector2(0, 0);
  const pointerNdc = new Vector2(2, 2);
  const smooth = new Vector2(0, 0);
  let pointerDirty = false;
  let scroll = 0;
  let hovered: Prop | null = null;
  const raycaster = new Raycaster();
  const meshes: Object3D[] = props.map((p) => p.group);

  function findProp(obj: Object3D | null): Prop | null {
    let o: Object3D | null = obj;
    while (o) {
      if (typeof o.userData.propIndex === 'number') return props[o.userData.propIndex as number] ?? null;
      o = o.parent;
    }
    return null;
  }

  function updateHover() {
    if (!interactive || !pointerDirty) return;
    pointerDirty = false;
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(meshes, true)[0];
    const next = hit ? findProp(hit.object) : null;
    if (next !== hovered) {
      hovered = next;
      canvas.style.cursor = hovered ? 'pointer' : '';
      opts.onHover?.(hovered ? hovered.spec.category : null);
    }
  }

  let elapsed = 0;
  const createdAt = performance.now();
  let last = createdAt;
  let raf = 0;
  let running = false;
  let disposed = false;
  let firstFrame = true;

  function frame(now: number) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    elapsed += dt;
    const t = elapsed;
    // The entrance runs on wall-clock time so it completes even on throttled frame rates.
    const introT = (now - createdAt) / 1000;

    smooth.lerp(pointer, 1 - Math.exp(-dt * 3));
    root.rotation.y = smooth.x * 0.16;
    root.rotation.x = -smooth.y * 0.08;
    root.position.y = scroll * 1.4;

    updateHover();

    props.forEach((p) => {
      const local = reducedMotion ? 1 : MathUtils.clamp((introT - p.delay) / 1.3, 0, 1);
      const enter = easeOutCubic(local);
      const pop = reducedMotion ? 1 : easeOutBack(local);
      const isHovered = hovered === p;
      p.hover += ((isHovered ? 1 : 0) - p.hover) * (1 - Math.exp(-dt * 8));
      p.spinVel += ((isHovered && !reducedMotion ? 1.6 : 0) - p.spinVel) * (1 - Math.exp(-dt * 3));
      p.spin += p.spinVel * dt;

      const float = reducedMotion ? 0 : Math.sin(t * 0.7 + p.phase) * 0.16;
      const drift = reducedMotion ? 0 : Math.cos(t * 0.45 + p.phase) * 0.06;
      const depthParallax = scroll * (p.spec.z + 3) * 0.32;
      p.group.position.set(
        p.base.x + drift,
        p.base.y + float + (1 - enter) * -0.9 + depthParallax,
        p.base.z + (1 - enter) * -2.5,
      );
      const sway = reducedMotion ? 0 : Math.sin(t * 0.32 + p.phase) * 0.28;
      p.group.rotation.set(
        p.spec.rot[0] + (reducedMotion ? 0 : Math.sin(t * 0.4 + p.phase) * 0.06),
        p.spec.rot[1] + sway + p.spin + (1 - enter) * -1.4,
        p.spec.rot[2],
      );
      p.group.scale.setScalar(Math.max(p.spec.scale * pop * (1 + p.hover * 0.08), 0.0001));
    });

    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      opts.onFirstFrame?.();
    }
    if (running && !reducedMotion) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    // Drop any one-off frame queued by renderOnce so exactly one loop runs.
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  const renderOnce = () => {
    if (running) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    const parent = canvas.parentElement;
    const w = parent?.clientWidth ?? canvas.clientWidth;
    const h = parent?.clientHeight ?? canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    layout(w, h);
    if (reducedMotion || !running) renderOnce();
  };
  resize();
  const ro = new ResizeObserver(resize);
  if (canvas.parentElement) ro.observe(canvas.parentElement);

  // Only animate while the hero is on screen and the tab is visible.
  let inView = true;
  const sync = () => {
    if (reducedMotion) return;
    if (inView && document.visibilityState === 'visible') start();
    else stop();
  };
  const io = new IntersectionObserver(([entry]) => {
    inView = Boolean(entry?.isIntersecting);
    sync();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', sync);
  if (reducedMotion) renderOnce();
  else start();

  const onClick = () => {
    if (hovered) opts.onSelect?.(hovered.spec.category);
  };
  if (interactive) canvas.addEventListener('click', onClick);

  return {
    setPointer(clientX, clientY) {
      if (reducedMotion) return;
      pointer.set((clientX / window.innerWidth) * 2 - 1, -((clientY / window.innerHeight) * 2 - 1));
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      pointerDirty = true;
    },
    setScroll(progress) {
      scroll = MathUtils.clamp(progress, 0, 1.5);
      if (reducedMotion) renderOnce();
    },
    dispose() {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('click', onClick);
      const geometries = new Set<{ dispose(): void }>();
      scene.traverse((o) => {
        if (o instanceof Mesh) {
          geometries.add(o.geometry);
          const mat = o.material as Material | Material[];
          (Array.isArray(mat) ? mat : [mat]).forEach((m) => geometries.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      textures.forEach((tx) => tx.dispose());
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
