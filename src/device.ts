import * as THREE from 'three';
import { DUO, HALF_W, HINGE_GAP, INNER_MM, OUTER_MM, type Orientation, type Pose } from './specs';

/*
 * Cómo está armado (en milímetros, a escala 1:1):
 * - La mitad derecha (x > 0) queda fija y lleva atrás la isla de cámaras, arriba en el borde exterior.
 * - La mitad izquierda (x < 0) gira sobre la bisagra (x = 0) y lleva atrás la pantalla exterior.
 * - Cerrado y visto de frente: la bisagra queda a la izquierda y la cámara frontal arriba a la derecha,
 *   como en las fotos oficiales. Abierto y visto de atrás: cámaras a la izquierda, pantalla exterior a la derecha.
 */
const R_OUT = 12; // esquinas exteriores del cuerpo
const R_HINGE = 1.5; // esquinas del lado de la bisagra: rectas, abierto las dos mitades forman una sola placa
const R_SCREEN = 9.5; // esquinas de las pantallas del lado redondeado
const R_SCREEN_HINGE = 1.2; // esquinas de la pantalla exterior junto a la bisagra
const EDGE_SIZE = 1.5; // canto redondeado del marco: cuánto entra hacia adentro
const EDGE_DEPTH = 1.7; // y cuánto sube por cada cara

/** Contorno con un radio por esquina: [arriba-izq, arriba-der, abajo-der, abajo-izq]. */
export function roundedShape(x0: number, y0: number, x1: number, y1: number, r: [number, number, number, number]): THREE.Shape {
  const s = new THREE.Shape();
  const [tl, tr, br, bl] = r;
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0);
  if (br) s.absarc(x1 - br, y0 + br, br, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - tr);
  if (tr) s.absarc(x1 - tr, y1 - tr, tr, 0, Math.PI / 2, false);
  s.lineTo(x0 + tl, y1);
  if (tl) s.absarc(x0 + tl, y1 - tl, tl, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + bl);
  if (bl) s.absarc(x0 + bl, y0 + bl, bl, Math.PI, Math.PI * 1.5, false);
  return s;
}
const inset = (r: [number, number, number, number], d: number) => r.map(v => Math.max(0.1, v - d)) as [number, number, number, number];

/** Geometría plana con UV normalizadas al rectángulo de la pantalla. */
function screenGeometry(shape: THREE.Shape, ux0: number, ux1: number, vy0: number, vy1: number, mirrorU = false): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(shape, 24);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    let u = (pos.getX(i) - ux0) / (ux1 - ux0);
    if (mirrorU) u = 1 - u;
    uv.setXY(i, u, (pos.getY(i) - vy0) / (vy1 - vy0));
  }
  uv.needsUpdate = true;
  return g;
}

export interface Finish { swatch: string; frame: string; frameRough: number; back: string; island: string; ring: string }
/** Los dos acabados del iPhone Duo. */
export const FINISHES: Record<string, Finish> = {
  nocturno: { swatch: '#2B3442', frame: '#56617a', frameRough: 0.18, back: '#2d3645', island: '#343e4e', ring: '#5d6880' },
  estelar: { swatch: '#EDEDEB', frame: '#e4e6e9', frameRough: 0.12, back: '#efefed', island: '#f4f4f2', ring: '#d9dbde' },
};

export class DuoModel {
  readonly root = new THREE.Group(); // sujeción (parado o apoyado)
  private readonly body = new THREE.Group(); // recentrado
  private readonly fixed = new THREE.Group(); // mitad derecha, fija
  private readonly pivot = new THREE.Group(); // eje de la bisagra
  private readonly moving = new THREE.Group(); // mitad izquierda, gira
  private readonly spine: THREE.Mesh;
  readonly frameMat: THREE.MeshPhysicalMaterial;
  readonly backMat: THREE.MeshPhysicalMaterial;
  readonly islandMat: THREE.MeshPhysicalMaterial;
  readonly ringMat: THREE.MeshPhysicalMaterial;
  readonly innerMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  readonly outerMat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });
  readonly glareMat: THREE.MeshStandardMaterial;
  private readonly glare: THREE.Mesh[] = [];
  angle = 180;
  ori: Orientation = 'vertical';
  private targetQ = new THREE.Quaternion();

  constructor() {
    const f = FINISHES.nocturno;
    this.frameMat = new THREE.MeshPhysicalMaterial({ color: f.frame, metalness: 1, roughness: f.frameRough, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    // vidrio trasero esmerilado
    this.backMat = new THREE.MeshPhysicalMaterial({ color: f.back, metalness: 0, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5, side: THREE.DoubleSide });
    this.islandMat = new THREE.MeshPhysicalMaterial({ color: f.island, metalness: 0, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    this.ringMat = new THREE.MeshPhysicalMaterial({ color: f.ring, metalness: 1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide });
    // brillo sobre el vidrio: negro con mezcla aditiva, suma solo los reflejos del entorno
    this.glareMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.9, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x07080a, metalness: 0, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide });
    const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x05070a, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, side: THREE.DoubleSide });
    const lensIris = new THREE.MeshPhysicalMaterial({ color: 0x1a2230, metalness: 0.4, roughness: 0.2, side: THREE.DoubleSide });

    const H = DUO.height, T = DUO.thickOpen, W = HALF_W;
    const half = (side: 1 | -1, group: THREE.Group) => {
      const x0 = side > 0 ? 0 : -W, x1 = side > 0 ? W : 0;
      const zf = 0.02, zb = -T - 0.02;
      const r: [number, number, number, number] = side > 0 ? [R_HINGE, R_OUT, R_OUT, R_HINGE] : [R_OUT, R_HINGE, R_HINGE, R_OUT];
      // Marco de metal con el canto redondeado, de z = -T a z = 0
      const geo = new THREE.ExtrudeGeometry(roundedShape(x0 + EDGE_SIZE, -H / 2 + EDGE_SIZE, x1 - EDGE_SIZE, H / 2 - EDGE_SIZE, inset(r, EDGE_SIZE)),
        { depth: T - 2 * EDGE_DEPTH, bevelEnabled: true, bevelThickness: EDGE_DEPTH, bevelSize: EDGE_SIZE, bevelSegments: 8, curveSegments: 32 });
      geo.translate(0, 0, -T + EDGE_DEPTH);
      const frame = new THREE.Mesh(geo, this.frameMat); frame.name = 'Marco'; group.add(frame);
      // Frente: vidrio negro y pantalla interior (una sola imagen para las dos mitades)
      const faceShape = roundedShape(x0 + 0.35, -H / 2 + 0.35, x1 - 0.35, H / 2 - 0.35, inset(r, 0.35));
      const face = new THREE.Mesh(new THREE.ShapeGeometry(faceShape, 32), glassMat); face.position.z = zf; group.add(face);
      const iw = INNER_MM[0] / 2, ih = INNER_MM[1];
      // Abierta, la pantalla interior es una sola: sin esquinas en el pliegue
      const sr: [number, number, number, number] = side > 0 ? [0, R_SCREEN, R_SCREEN, 0] : [R_SCREEN, 0, 0, R_SCREEN];
      const inner = new THREE.Mesh(screenGeometry(roundedShape(side > 0 ? 0 : -iw, -ih / 2, side > 0 ? iw : 0, ih / 2, sr), -iw, iw, -ih / 2, ih / 2), this.innerMat);
      inner.position.z = zf + 0.02; inner.name = 'Pantalla interior'; group.add(inner);
      const g1 = new THREE.Mesh(face.geometry, this.glareMat); g1.position.z = zf + 0.05; group.add(g1); this.glare.push(g1);
      // Dorso
      const back = new THREE.Mesh(new THREE.ShapeGeometry(faceShape, 32), side < 0 ? glassMat : this.backMat); back.position.z = zb; group.add(back);
      const g2 = new THREE.Mesh(back.geometry, this.glareMat); g2.position.z = zb - 0.05; group.add(g2); this.glare.push(g2);
      if (side < 0) {
        // Pantalla exterior en la mitad que gira; vista desde afuera, +x queda a la izquierda, por eso la U va espejada
        const ow = OUTER_MM[0], oh = OUTER_MM[1], cx = -W / 2;
        const os = new THREE.Mesh(screenGeometry(roundedShape(cx - ow / 2, -oh / 2, cx + ow / 2, oh / 2, [R_SCREEN, R_SCREEN_HINGE, R_SCREEN_HINGE, R_SCREEN]), cx - ow / 2, cx + ow / 2, -oh / 2, oh / 2, true), this.outerMat);
        os.position.z = zb - 0.02; os.name = 'Pantalla exterior'; group.add(os);
        // Cámara frontal exterior: perforación arriba, en la esquina lejos de la bisagra
        const hole = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.DoubleSide }));
        hole.position.set(cx - ow / 2 + 7.5, oh / 2 - 7.5, zb - 0.07); group.add(hole);
      } else {
        // Isla de cámaras en cápsula, arriba en el borde exterior de la mitad fija
        const iw2 = 40, ih2 = 19.5, ix1 = W - 5.2, iy1 = H / 2 - 5.2;
        const islandShape = roundedShape(ix1 - iw2, iy1 - ih2, ix1, iy1, [ih2 / 2, ih2 / 2, ih2 / 2, ih2 / 2]);
        const ig = new THREE.ExtrudeGeometry(islandShape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.45, bevelSize: 0.6, bevelSegments: 4, curveSegments: 32 });
        ig.translate(0, 0, -T - 1.35);
        const isl = new THREE.Mesh(ig, this.islandMat); group.add(isl);
        const zi = -T - 1.8; // superficie de la isla
        const cyI = iy1 - ih2 / 2;
        // Vistas desde atrás las lentes quedan del lado exterior (izquierda), el flash del lado de adentro
        for (const lx of [ix1 - 9.75, ix1 - 25.2]) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(7.1, 7.3, 1.6, 64, 1, true), this.ringMat);
          ring.rotation.x = Math.PI / 2; ring.position.set(lx, cyI, zi - 0.8); group.add(ring);
          const cap = new THREE.Mesh(new THREE.RingGeometry(5.6, 7.1, 64), this.ringMat);
          cap.position.set(lx, cyI, zi - 1.6); group.add(cap);
          const lens = new THREE.Mesh(new THREE.CircleGeometry(5.6, 64), lensGlass); lens.position.set(lx, cyI, zi - 1.45); group.add(lens);
          const iris = new THREE.Mesh(new THREE.RingGeometry(1.4, 3.2, 48), lensIris); iris.position.set(lx, cyI, zi - 1.5); group.add(iris);
        }
        const flash = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.35, side: THREE.DoubleSide }));
        flash.position.set(ix1 - 36.2, cyI - 3.6, zi - 0.02); group.add(flash);
        const mic = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x0c0d10, side: THREE.DoubleSide }));
        mic.position.set(ix1 - 36.2, cyI + 3.8, zi - 0.02); group.add(mic);
        // Botones en el canto exterior de la mitad fija
        for (const [by, bl] of [[H / 2 - 32, 21], [H / 2 - 60, 12]] as const) {
          const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, bl - 1.8, 6, 16), this.frameMat);
          b.position.set(W + 0.35, by, -T / 2); group.add(b);
        }
      }
    };
    half(1, this.fixed);
    half(-1, this.moving);
    this.pivot.position.set(0, 0, HINGE_GAP / 2);
    this.moving.position.set(0, 0, -HINGE_GAP / 2);
    this.pivot.add(this.moving);
    // Lomo de la bisagra, visible con el Duo cerrado: canto recto de arriba abajo, esquinas sin redondear
    this.spine = new THREE.Mesh(new THREE.CylinderGeometry(DUO.thickFolded / 2 - 0.05, DUO.thickFolded / 2 - 0.05, H - 1, 48), this.frameMat);
    this.spine.position.set(DUO.thickFolded / 2 - (DUO.widthFolded - HALF_W), 0, HINGE_GAP / 2);
    this.body.add(this.fixed, this.pivot, this.spine);
    this.root.add(this.body);
    this.body.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    for (const g of this.glare) g.castShadow = false;
  }

  setFinish(key: string) {
    const f = FINISHES[key] ?? FINISHES.nocturno;
    this.frameMat.color.set(f.frame); this.frameMat.roughness = f.frameRough;
    this.backMat.color.set(f.back); this.islandMat.color.set(f.island); this.ringMat.color.set(f.ring);
  }

  setReflections(on: boolean) { for (const g of this.glare) g.visible = on; }

  /** Ángulo de la bisagra en grados: 0 cerrado, 180 abierto. */
  setAngle(deg: number) {
    this.angle = THREE.MathUtils.clamp(deg, 0, 180);
    this.pivot.rotation.y = THREE.MathUtils.degToRad(180 - this.angle);
    this.spine.visible = this.angle < 28;
    this.recenter();
  }

  /**
   * Vertical: parado, con la bisagra vertical. Horizontal: apoyado, con la mitad fija sobre la mesa.
   * La sujeción no cambia con el ángulo, así mover la bisagra nunca gira el Duo.
   */
  orientationQuaternion(_pose: Pose, ori: Orientation): THREE.Quaternion {
    if (ori === 'vertical') return new THREE.Quaternion();
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    return qx.multiply(qz);
  }

  setOrientation(pose: Pose, ori: Orientation, instant = false) {
    this.ori = ori;
    this.targetQ.copy(this.orientationQuaternion(pose, ori));
    if (instant) this.root.quaternion.copy(this.targetQ);
  }

  /** Avanza la animación de giro. Devuelve true si todavía se está moviendo. */
  tick(dt: number, reduced: boolean): boolean {
    if (reduced) { this.root.quaternion.copy(this.targetQ); return false; }
    if (this.root.quaternion.angleTo(this.targetQ) < 1e-4) return false;
    this.root.quaternion.slerp(this.targetQ, 1 - Math.pow(0.0005, dt));
    return true;
  }

  private recenter() {
    this.body.position.set(0, 0, 0);
    this.body.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    this.body.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || (m.name !== 'Marco' && m !== this.spine)) return;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    });
    const c = box.getCenter(new THREE.Vector3());
    this.body.position.set(-c.x, -c.y, -c.z);
  }

  /** Caja del dispositivo en coordenadas del mundo. */
  worldBox(): THREE.Box3 {
    this.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.visible && (m.name === 'Marco' || m === this.spine)) box.expandByObject(m, true); });
    return box;
  }

  /** Hacia dónde mira el Duo, para los encuadres de cámara. */
  frontDirection(): THREE.Vector3 {
    if (this.ori === 'horizontal') return new THREE.Vector3(0, 0, 1);
    if (this.angle <= 15) return new THREE.Vector3(0, 0, 1);
    const moved = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(180 - this.angle));
    const n = new THREE.Vector3(0, 0, 1).add(moved);
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    return n.normalize();
  }
}
