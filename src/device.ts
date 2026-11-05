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
  const [tl, tr, br, bl] = r.map(v => (v < 0.05 ? 0 : v));
  const pts: THREE.Vector2[] = [];
  // Cada esquina: arco con centro adentro, o un vértice recto si el radio es 0. Sin puntos repetidos,
  // porque un tramo de largo casi cero deforma el canto biselado del marco.
  const corner = (cx: number, cy: number, rad: number, a0: number) => {
    if (!rad) { pts.push(new THREE.Vector2(cx, cy)); return; }
    const n = Math.max(6, Math.round(rad * 3));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI / 2) * (i / n);
      pts.push(new THREE.Vector2(cx + rad * Math.cos(a), cy + rad * Math.sin(a)));
    }
  };
  corner(x1 - br, y0 + br, br, -Math.PI / 2); // abajo-der
  corner(x1 - tr, y1 - tr, tr, 0); // arriba-der
  corner(x0 + tl, y1 - tl, tl, Math.PI / 2); // arriba-izq
  corner(x0 + bl, y0 + bl, bl, Math.PI); // abajo-izq
  const clean = pts.filter((p, i) => p.distanceTo(pts[(i + 1) % pts.length]) > 1e-4);
  return new THREE.Shape(clean);
}
const inset = (r: [number, number, number, number], d: number) => r.map(v => Math.max(0, v - d)) as [number, number, number, number];

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
  readonly spineMat: THREE.MeshPhysicalMaterial;
  private readonly crease: THREE.Mesh; // pantalla interior doblada sobre la bisagra
  readonly frameMat: THREE.MeshPhysicalMaterial;
  readonly backMat: THREE.MeshPhysicalMaterial;
  readonly islandMat: THREE.MeshPhysicalMaterial;
  readonly ringMat: THREE.MeshPhysicalMaterial;
  readonly innerMat = new THREE.MeshBasicMaterial({ toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  readonly outerMat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 });
  readonly glareMat: THREE.MeshStandardMaterial;
  private readonly glare: THREE.Mesh[] = [];
  angle = 180;
  ori: Orientation = 'vertical';
  private targetQ = new THREE.Quaternion();

  constructor() {
    const f = FINISHES.nocturno;
    this.frameMat = new THREE.MeshPhysicalMaterial({ color: f.frame, metalness: 1, roughness: f.frameRough, clearcoat: 0.6, clearcoatRoughness: 0.08 });
    // vidrio trasero esmerilado
    this.spineMat = new THREE.MeshPhysicalMaterial({ color: f.frame, metalness: 1, roughness: 0.38, clearcoat: 0.2, clearcoatRoughness: 0.4 });
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
        const hole = new THREE.Mesh(new THREE.CircleGeometry(2.1, 40), new THREE.MeshBasicMaterial({ color: 0x020203, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -16 }));
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
    // Bisagra: barra plana de metal satinado, metida entre los cantos redondeados de las dos mitades.
    // Gira la mitad del ángulo de la mitad móvil, así su cara plana siempre mira hacia afuera del pliegue.
    // Cerrado, su cara queda a 1,8 mm del eje (84,1 - 82,3) y cubre todo el espesor (11,3 mm). Abierto, queda escondida detrás.
    // La cara interior queda a 0,95 mm del eje: más lejos que la pantalla interior (0,41 mm),
    // así la barra nunca atraviesa la pantalla, en ningún ángulo.
    const sw = DUO.thickFolded / 2 - 0.08, sOut = DUO.widthFolded - HALF_W, sIn = 0.95 + 0.35, sLen = H - 3;
    const sGeo = new THREE.ExtrudeGeometry(roundedShape(-sw, sIn, sw, sOut - 0.35, [0.2, 0.2, 0.2, 0.2]),
      { depth: sLen - 0.7, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 4, curveSegments: 8 });
    sGeo.translate(0, 0, -(sLen - 0.7) / 2);
    sGeo.rotateX(-Math.PI / 2); // ancho sobre x, hacia afuera en -z, largo sobre y (abierto)
    this.spine = new THREE.Mesh(sGeo, this.spineMat);
    this.spine.name = 'Bisagra';
    this.spine.position.set(0, 0, HINGE_GAP / 2);
    // Pliegue: la pantalla interior se curva alrededor del eje de la bisagra, así no queda una ranura entre las mitades
    this.crease = new THREE.Mesh(new THREE.BufferGeometry(), this.innerMat);
    this.crease.name = 'Pliegue';
    this.body.add(this.fixed, this.pivot, this.spine, this.crease);
    this.root.add(this.body);
    this.body.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    for (const g of this.glare) g.castShadow = false;
  }

  setFinish(key: string) {
    const f = FINISHES[key] ?? FINISHES.nocturno;
    this.frameMat.color.set(f.frame); this.frameMat.roughness = f.frameRough; this.spineMat.color.set(f.frame);
    this.backMat.color.set(f.back); this.islandMat.color.set(f.island); this.ringMat.color.set(f.ring);
  }

  setReflections(on: boolean) { for (const g of this.glare) g.visible = on; }

  /**
   * Franja curva que une las dos mitades de la pantalla interior. Sigue un arco alrededor del eje de la bisagra,
   * tangente a las dos pantallas, y toma la columna central de la imagen: la imagen se ve continua al plegar.
   */
  private updateCrease() {
    const phi = THREE.MathUtils.degToRad(180 - this.angle);
    this.crease.visible = this.angle > 0.5 && phi > 1e-3;
    if (!this.crease.visible) return;
    const zScreen = 0.04; // la pantalla interior está 0,04 mm delante del vidrio de cada mitad
    const cz = HINGE_GAP / 2, r = cz - zScreen - 0.01, ih = INNER_MM[1], N = 16;
    const E = 0.6, du = E / INNER_MM[0]; // se monta 0,6 mm sobre cada mitad para que no quede una rendija
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const row = (x: number, z: number, u: number) => { pos.push(x, -ih / 2, z, x, ih / 2, z); uv.push(u, 0, u, 1); };
    row(E, cz - r, 0.5 + du); // sobre la mitad fija
    for (let i = 0; i <= N; i++) {
      const a = (phi * i) / N;
      row(-r * Math.sin(a), cz - r * Math.cos(a), 0.5);
    }
    // sobre la mitad que gira, siguiendo su plano
    row(-r * Math.sin(phi) - E * Math.cos(phi), cz - r * Math.cos(phi) + E * Math.sin(phi), 0.5 - du);
    for (let i = 0; i < N + 2; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } // caras hacia el frente
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.crease.geometry.dispose();
    this.crease.geometry = g;
  }

  /** Ángulo de la bisagra en grados: 0 cerrado, 180 abierto. */
  setAngle(deg: number) {
    this.angle = THREE.MathUtils.clamp(deg, 0, 180);
    this.pivot.rotation.y = THREE.MathUtils.degToRad(180 - this.angle);
    this.spine.rotation.y = THREE.MathUtils.degToRad(180 - this.angle) / 2;
    this.updateCrease();
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
