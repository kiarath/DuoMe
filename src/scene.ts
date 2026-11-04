import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DuoModel } from './device';

export interface ExportOptions { longSide: number; transparent: boolean; shadow: boolean; background: string }

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(20, 1, 10, 5000);
  readonly controls: OrbitControls;
  readonly duo = new DuoModel();
  private readonly floor: THREE.Mesh;
  private readonly floorMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  private readonly key: THREE.DirectionalLight;
  private clock = new THREE.Clock();
  private dirty = true;
  onCameraChange: () => void = () => {};
  reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Vista 3D del iPhone Duo. Arrastrá para girarlo, usá la rueda para acercarte.');
    this.renderer.domElement.setAttribute('role', 'img');

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;

    this.key = new THREE.DirectionalLight(0xffffff, 1.6);
    this.key.position.set(-120, 420, 260);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -220; sc.right = 220; sc.top = 220; sc.bottom = -220; sc.near = 10; sc.far = 1200;
    this.key.shadow.radius = 12; this.key.shadow.blurSamples = 16; this.key.shadow.bias = -0.0004;
    this.scene.add(this.key, this.key.target);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9dcdf, 0.5));

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), this.floorMat);
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true;
    this.scene.add(this.floor, this.duo.root);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 300; this.controls.maxDistance = 1800;
    this.controls.minPolarAngle = 0.05; this.controls.maxPolarAngle = Math.PI / 2 + 0.25;
    this.controls.addEventListener('change', () => { this.dirty = true; this.onCameraChange(); });
    this.camera.position.set(0, 60, 900);

    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  invalidate() { this.dirty = true; }

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // corre la imagen hacia arriba para que el Duo no quede detrás del dial
    if (this.liftPx > 0) this.camera.setViewOffset(w, h, 0, this.liftPx, w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Píxeles que se sube la vista (0 en pantalla completa). */
  setLift(px: number) { this.liftPx = px; this.resize(); }
  private liftPx = 110;

  private frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const moving = this.duo.tick(dt, this.reducedMotion);
    const damped = this.controls.update();
    if (moving || damped) this.dirty = true;
    if (!this.dirty) return;
    this.placeFloor();
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  }

  /** El piso y la luz siguen al dispositivo para que la sombra quede siempre debajo. */
  private placeFloor() {
    const box = this.duo.worldBox();
    this.floor.position.y = box.min.y - 0.05;
    const c = box.getCenter(new THREE.Vector3());
    this.key.target.position.copy(c);
    this.key.position.set(c.x - 120, c.y + 420, c.z + 260);
  }

  shadowOn = true;
  setShadowEnabled(on: boolean) { this.shadowOn = on; this.floor.visible = on; this.key.castShadow = on; this.dirty = true; }

  setShadow(softness: number) {
    // 0 = sombra marcada, 100 = muy difusa
    this.key.shadow.radius = 2 + softness * 0.3;
    this.floorMat.opacity = 0.34 - softness * 0.0018;
    this.dirty = true;
  }

  /** Coloca la cámara por ángulos relativos al frente del Duo (grados). */
  setView(azimuth: number, elevation: number, distance?: number) {
    const front = this.duo.frontDirection();
    const base = Math.atan2(front.x, front.z);
    const az = base + THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(elevation);
    const d = distance ?? this.camera.position.distanceTo(this.controls.target);
    this.camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.dirty = true;
  }

  /** Ángulos actuales de la cámara relativos al frente del Duo. */
  viewAngles(): { azimuth: number; elevation: number } {
    const p = this.camera.position.clone().sub(this.controls.target);
    const front = this.duo.frontDirection();
    let az = THREE.MathUtils.radToDeg(Math.atan2(p.x, p.z) - Math.atan2(front.x, front.z));
    az = ((az + 540) % 360) - 180;
    const el = THREE.MathUtils.radToDeg(Math.asin(p.y / p.length()));
    return { azimuth: Math.round(az), elevation: Math.round(el) };
  }

  /** Renderiza el Duo recortado a su contorno y devuelve un PNG. */
  async exportPNG(o: ExportOptions): Promise<Blob> {
    const r = this.renderer;
    const prevSize = r.getSize(new THREE.Vector2());
    const prevRatio = r.getPixelRatio();
    this.floor.visible = o.shadow;
    this.placeFloor();
    this.camera.clearViewOffset();
    this.camera.updateMatrixWorld();
    // contorno del dispositivo (y de la sombra si va) proyectado en pantalla
    const box = this.duo.worldBox();
    if (o.shadow) { box.min.y -= 2; box.expandByVector(new THREE.Vector3(18, 0, 18)); }
    const pts: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) pts.push(new THREE.Vector3(x, y, z).project(this.camera));
    let x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
    let y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const mx = (x1 - x0) * 0.04, my = (y1 - y0) * 0.04; x0 -= mx; x1 += mx; y0 -= my; y1 += my;
    const fullW = prevSize.x, fullH = prevSize.y;
    const cw = (x1 - x0) / 2 * fullW, ch = (y1 - y0) / 2 * fullH;
    const scale = o.longSide / Math.max(cw, ch);
    const outW = Math.round(cw * scale), outH = Math.round(ch * scale);
    this.camera.setViewOffset(fullW * scale, fullH * scale, (x0 + 1) / 2 * fullW * scale, (1 - y1) / 2 * fullH * scale, outW, outH);
    r.setPixelRatio(1);
    r.setSize(outW, outH, false);
    const prevClear = r.getClearAlpha();
    if (o.transparent) r.setClearColor(0x000000, 0); else r.setClearColor(new THREE.Color(o.background), 1);
    r.render(this.scene, this.camera);
    const blob = await new Promise<Blob>((res, rej) => r.domElement.toBlob(b => (b ? res(b) : rej(new Error('No se pudo generar el PNG'))), 'image/png'));
    // volver a la vista normal
    r.setClearColor(0x000000, prevClear === 0 ? 0 : 0);
    this.camera.clearViewOffset();
    r.setPixelRatio(prevRatio);
    r.setSize(prevSize.x, prevSize.y, false);
    this.floor.visible = this.shadowOn;
    this.resize();
    return blob;
  }
}
