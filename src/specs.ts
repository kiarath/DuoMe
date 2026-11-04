// Medidas reales del iPhone Duo (todas en milímetros).
// Fuentes: fichas técnicas publicadas tras el evento de Apple del 9 de septiembre de 2026.
export const DUO = {
  height: 117.8,
  widthOpen: 164.6,
  widthFolded: 84.1,
  thickOpen: 5.2,
  thickFolded: 11.3,
} as const;

const IN = 25.4;

/** Resolución nativa de cada pantalla, en la orientación en que la monta el hardware. */
export const DISPLAYS = {
  // Pantalla exterior: 5,4 in, 1398 x 2034 px, 460 ppi (vertical)
  outer: { px: [1398, 2034] as const, ppi: 460 },
  // Pantalla interior: 7,6 in, 2670 x 1878 px, 430 ppi (apaisada con el Duo abierto)
  inner: { px: [2670, 1878] as const, ppi: 430 },
};

export const OUTER_MM = [DISPLAYS.outer.px[0] / DISPLAYS.outer.ppi * IN, DISPLAYS.outer.px[1] / DISPLAYS.outer.ppi * IN] as const; // 77,2 x 112,3
export const INNER_MM = [DISPLAYS.inner.px[0] / DISPLAYS.inner.ppi * IN, DISPLAYS.inner.px[1] / DISPLAYS.inner.ppi * IN] as const; // 157,7 x 110,9

export const HALF_W = DUO.widthOpen / 2; // 82,3 por mitad
export const HINGE_GAP = DUO.thickFolded - 2 * DUO.thickOpen; // 0,9 entre pantallas al cerrar

export type Pose = 'cerrado' | 'semiabierto' | 'abierto';
export type Orientation = 'vertical' | 'horizontal';
export type SlotKey = `${Pose}|${Orientation}`;

export const POSES: Pose[] = ['cerrado', 'semiabierto', 'abierto'];
export const ORIENTATIONS: Orientation[] = ['vertical', 'horizontal'];

export const POSE_LABEL: Record<Pose, string> = { cerrado: 'Cerrado', semiabierto: 'Semiabierto', abierto: 'Abierto' };
export const ORI_LABEL: Record<Orientation, string> = { vertical: 'Vertical', horizontal: 'Horizontal' };
export const POSE_ANGLE: Record<Pose, number> = { cerrado: 0, semiabierto: 90, abierto: 180 };

/** Qué pantalla se ve en cada vista y si la imagen va girada respecto del montaje del hardware. */
export function slotDisplay(key: SlotKey): { display: 'outer' | 'inner'; rotated: boolean } {
  const [pose, ori] = key.split('|') as [Pose, Orientation];
  if (pose === 'cerrado') return { display: 'outer', rotated: ori === 'horizontal' };
  if (pose === 'abierto') return { display: 'inner', rotated: ori === 'horizontal' };
  return { display: 'inner', rotated: ori === 'horizontal' };
}

/** Tamaño recomendado de la imagen para cada vista, tal como se ve (ya girada). */
export function slotPixels(key: SlotKey): [number, number] {
  const { display, rotated } = slotDisplay(key);
  const [w, h] = DISPLAYS[display].px;
  return rotated ? [h, w] : [w, h];
}

export function poseFromAngle(a: number): Pose {
  if (a <= 15) return 'cerrado';
  if (a >= 165) return 'abierto';
  return 'semiabierto';
}
