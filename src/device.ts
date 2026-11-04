import * as THREE from 'three';
import { DUO, HALF_W, HINGE_GAP, INNER_MM, OUTER_MM, type Orientation, type Pose } from './specs';

/** Radios de esquina estimados a partir de las fotos oficiales (mm). */
const R_OUT = 11.5; // esquinas exteriores del cuerpo
const R_HINGE = 2.4; // esquinas del lado de la bisagra
const R_SCREEN = 8.6; // esquinas de las pantallas
const BEVEL = 0.7;

/** Contorno de un rectángulo con un radio por esquina: [arriba-izq, arriba-der, abajo-der, abajo-izq]. */
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

/** Geometría plana con UV normalizadas al rectángulo [ux0..ux1] x [vy0..vy1]. */
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

export interface Finish { frame: string; back: string; island: string }
export const FINISHES: Record<string, Finish & { label: string; swatch: string }> = {
  natural: { label: 'Titanio natural', swatch: '#B9B4AB', frame: '#bdb7ad', back: '#c9c4bb', island: '#b3ada3' },
  grafito: { label: 'Grafito', swatch: '#3A3C40', frame: '#4a4c51', back: '#3b3d42', island: '#45474c' },
  blanco: { label: 'Blanco', swatch: '#E6E3DD', frame: '#dcd8d1', back: '#ece9e3', island: '#dfdbd4' },
  niebla: { label: 'Azul niebla', swatch: '#8E9DB0', frame: '#8f9cad', back: '#a3afbf', island: '#97a3b3' },
};

export class DuoModel {
  readonly root = new THREE.Group(); // orientación (rol / apoyo)
  private readonly body = new THREE.Group(); // recentrado
  private readonly left = new THREE.Group(); // mitad fija
  private readonly pivot = new THREE.Group(); // eje de la bisagra
  private readonly right = new THREE.Group(); // mitad que gira
  private readonly spine: THREE.Mesh;
  readonly frameMat: THREE.MeshPhysicalMaterial;
  readonly backMat: THREE.MeshPhysicalMaterial;
  readonly islandMat: THREE.MeshPhysicalMaterial;
  readonly innerMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  readonly outerMat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });
  readonly glareMat: THREE.MeshStandardMaterial;
  private readonly glare: THREE.Mesh[] = [];
  angle = 180;
  private targetQ = new THREE.Quaternion();

  constructor() {
    this.frameMat = new THREE.MeshPhysicalMaterial({ color: FINISHES.natural.frame, metalness: 1, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.4 });
    this.backMat = new THREE.MeshPhysicalMaterial({ color: FINISHES.natural.back, metalness: 0.15, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide });
    this.islandMat = new THREE.MeshPhysicalMaterial({ color: FINISHES.natural.island, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
    // Reflejo sobre el vidrio: material negro con mezcla aditiva, solo suma los brillos del entorno.
    this.glareMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 0.9, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, metalness: 0, roughness: 0.15, clearcoat: 1, side: THREE.DoubleSide });

    const H = DUO.height, T = DUO.thickOpen, W = HALF_W;
    const half = (side: 1 | -1, group: THREE.Group) => {
      // Cuerpo: contorno con bisel, de z = -T a z = 0
      const x0 = side > 0 ? 0 : -W, x1 = side > 0 ? W : 0;
      const r: [number, number, number, number] = side > 0 ? [R_HINGE, R_OUT, R_OUT, R_HINGE] : [R_OUT, R_HINGE, R_HINGE, R_OUT];
      const inner = roundedShape(x0 + BEVEL, -H / 2 + BEVEL, x1 - BEVEL, H / 2 - BEVEL, r.map(v => Math.max(0.1, v - BEVEL)) as typeof r);
      const geo = new THREE.ExtrudeGeometry(inner, { depth: T - 2 * BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 4, curveSegments: 24 });
      geo.translate(0, 0, -T + BEVEL);
      const bodyMesh = new THREE.Mesh(geo, this.frameMat); bodyMesh.castShadow = true; bodyMesh.name = 'Marco';
      group.add(bodyMesh);
      const z0 = 0.02, zb = -T - 0.02;
      // Cara interior: vidrio negro y pantalla interior (la imagen atraviesa las dos mitades)
      const face = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(x0 + 0.4, -H / 2 + 0.4, x1 - 0.4, H / 2 - 0.4, r.map(v => Math.max(0.1, v - 0.4)) as typeof r), 24), glassMat);
      face.position.z = z0; group.add(face);
      const iw = INNER_MM[0] / 2, ih = INNER_MM[1];
      const sx0 = side > 0 ? 0 : -iw, sx1 = side > 0 ? iw : 0;
      const sr: [number, number, number, number] = side > 0 ? [0, R_SCREEN, R_SCREEN, 0] : [R_SCREEN, 0, 0, R_SCREEN];
      const scr = new THREE.Mesh(screenGeometry(roundedShape(sx0, -ih / 2, sx1, ih / 2, sr), -iw, iw, -ih / 2, ih / 2), this.innerMat);
      scr.position.z = z0 + 0.02; scr.name = 'Pantalla interior'; group.add(scr);
      const gl = new THREE.Mesh(face.geometry, this.glareMat); gl.position.z = z0 + 0.05; group.add(gl); this.glare.push(gl);
      // Cara exterior (se mira desde -z; los materiales son de dos caras)
      const back = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(x0 + 0.4, -H / 2 + 0.4, x1 - 0.4, H / 2 - 0.4, r.map(v => Math.max(0.1, v - 0.4)) as typeof r), 24), side > 0 ? glassMat : this.backMat);
      back.position.z = zb; group.add(back);
      const glb = new THREE.Mesh(back.geometry, this.glareMat); glb.position.z = zb - 0.05; group.add(glb); this.glare.push(glb);
      if (side > 0) {
        // Pantalla exterior centrada en la mitad que gira. Vista desde atrás, +x queda a la izquierda: la U va espejada.
        const ow = OUTER_MM[0], oh = OUTER_MM[1], cx = W / 2;
        const so = roundedShape(cx - ow / 2, -oh / 2, cx + ow / 2, oh / 2, [R_SCREEN, R_SCREEN, R_SCREEN, R_SCREEN]);
        const os = new THREE.Mesh(screenGeometry(so, cx - ow / 2, cx + ow / 2, -oh / 2, oh / 2, true), this.outerMat);
        os.position.z = zb - 0.02; os.name = 'Pantalla exterior'; group.add(os);
        // Cámara frontal exterior: esquina superior del lado de la bisagra (vista desde afuera, arriba a la derecha)
        const cam = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: 0x050607, side: THREE.DoubleSide }));
        cam.position.set(cx - ow / 2 + 7, oh / 2 - 6.5, zb - 0.06); group.add(cam);
      } else {
        // Módulo de cámaras traseras en la mitad fija
        const ig = new THREE.ExtrudeGeometry(roundedShape(-W + 6, H / 2 - 32, -W + 32, H / 2 - 6, [8, 8, 8, 8]), { depth: 1.2, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 2, curveSegments: 20 });
        ig.translate(0, 0, -T - 1.5);
        const isl = new THREE.Mesh(ig, this.islandMat); isl.castShadow = true; group.add(isl);
        const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x07090c, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide });
        for (const [lx, ly] of [[-W + 13, H / 2 - 13], [-W + 25, H / 2 - 25]]) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 1.4, 40), this.frameMat);
          ring.rotation.x = Math.PI / 2; ring.position.set(lx, ly, -T - 2.5); ring.castShadow = true; group.add(ring);
          const lens = new THREE.Mesh(new THREE.CircleGeometry(3.9, 40), lensMat);
          lens.position.set(lx, ly, -T - 3.22); group.add(lens);
        }
        const flash = new THREE.Mesh(new THREE.CircleGeometry(1.9, 24), new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.4, side: THREE.DoubleSide }));
        flash.position.set(-W + 25, H / 2 - 13, -T - 1.82); group.add(flash);
      }
    };
    half(-1, this.left);
    half(1, this.right);
    // La mitad derecha gira alrededor de un eje a HINGE_GAP / 2 sobre la cara interior
    this.pivot.position.set(0, 0, HINGE_GAP / 2);
    this.right.position.set(0, 0, -HINGE_GAP / 2);
    this.pivot.add(this.right);
    // Lomo de la bisagra: visible con el Duo cerrado
    const spineGeo = new THREE.CapsuleGeometry(DUO.thickFolded / 2 - 0.05, H - DUO.thickFolded - 2, 12, 32);
    this.spine = new THREE.Mesh(spineGeo, this.frameMat);
    this.spine.position.set(-(DUO.thickFolded / 2) + (DUO.widthFolded - HALF_W), 0, HINGE_GAP / 2);
    this.spine.castShadow = true;
    this.body.add(this.left, this.pivot, this.spine);
    this.root.add(this.body);
    this.left.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    this.right.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  }

  setFinish(key: string) {
    const f = FINISHES[key] ?? FINISHES.natural;
    this.frameMat.color.set(f.frame); this.backMat.color.set(f.back); this.islandMat.color.set(f.island);
  }

  setReflections(on: boolean) { for (const g of this.glare) g.visible = on; }

  /** Ángulo de la bisagra en grados: 0 cerrado, 180 abierto. */
  setAngle(deg: number) {
    this.angle = THREE.MathUtils.clamp(deg, 0, 180);
    this.pivot.rotation.y = -THREE.MathUtils.degToRad(180 - this.angle);
    this.spine.visible = this.angle < 28;
    this.recenter();
  }

  /** Cómo se apoya el Duo en cada pose y orientación. */
  orientationQuaternion(pose: Pose, ori: Orientation): THREE.Quaternion {
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    if (pose === 'cerrado') return ori === 'horizontal' ? qz : new THREE.Quaternion();
    if (pose === 'abierto') return ori === 'vertical' ? qz : new THREE.Quaternion();
    return ori === 'horizontal' ? qx.multiply(qz) : new THREE.Quaternion(); // apoyado como laptop o parado como libro
  }

  setOrientation(pose: Pose, ori: Orientation, instant = false) {
    this.targetQ.copy(this.orientationQuaternion(pose, ori));
    if (instant) this.root.quaternion.copy(this.targetQ);
  }

  /** Avanza la animación de giro. Devuelve true si todavía se está moviendo. */
  tick(dt: number, reduced: boolean): boolean {
    if (reduced) { this.root.quaternion.copy(this.targetQ); return false; }
    const d = this.root.quaternion.angleTo(this.targetQ);
    if (d < 1e-4) return false;
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
      if (!m.isMesh || !m.visible || m.name !== 'Marco' && m !== this.spine) return;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      box.union(b);
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

  /** Dirección hacia donde "mira" el Duo, para los encuadres de cámara. */
  frontDirection(): THREE.Vector3 {
    const n = this.angle <= 15 ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 0, 1).add(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(180 - this.angle))).normalize();
    if (n.lengthSq() < 1e-6) n.set(0, 0, 1);
    return n.applyQuaternion(this.targetQ).normalize();
  }
}
