export type Lang = 'en' | 'es';

const en = {
  'doc.title': 'DuoMe, iPhone Duo mockups',
  'lang.label': 'Language',
  'top.undo': 'Undo', 'top.redo': 'Redo', 'top.preview': 'Preview', 'top.export': 'Export',
  'export.title': 'Export PNG', 'export.size': 'Size', 'export.transparent': 'Transparent background', 'export.shadow': 'Include shadow',
  'export.hint': 'The PNG is cropped to the outline of the Duo, using the camera you see on the canvas.',
  'export.go': 'Download PNG', 'export.busy': 'Generating…',
  'export.done': 'PNG downloaded', 'export.capped': 'PNG downloaded at {px} px, the maximum for this graphics card',
  'export.fail': 'Couldn’t generate the PNG. Try a smaller size.',
  'screens.title': 'Screens',
  'screens.intro': 'Each pose takes one image per orientation. Drag it onto its slot.',
  'screens.introEmpty': 'Each pose takes one image per orientation. Drag it onto its slot or use the upload button.',
  'grid.hint': 'Click a slot to see it on the canvas.',
  'grid.hintFilled': 'Click a slot to see it on the canvas. The X removes the image.',
  'grid.outer': 'outer display, 5.4 in', 'grid.inner': 'inner display, 7.6 in',
  'slot.with': '{view}, with image. Recommended size {w} by {h} pixels.',
  'slot.empty': '{view}, empty. Recommended size {w} by {h} pixels.',
  'slot.upload': 'Upload image for {view}', 'slot.remove': 'Remove image from {view}',
  'slot.drop': 'Drop for {view}',
  'fit.title': 'If the image doesn’t fit', 'fit.cover': 'Crop', 'fit.contain': 'Show whole',
  'guides.title': 'Show camera and fold', 'guides.hint': 'See which parts of your screen get covered.',
  'pose.cerrado': 'Closed', 'pose.semiabierto': 'Half-open', 'pose.abierto': 'Open',
  'ori.vertical': 'Vertical', 'ori.horizontal': 'Horizontal',
  'ori.lower.vertical': 'vertical', 'ori.lower.horizontal': 'horizontal',
  'view': '{pose} {ori}',
  'mismatch.h': 'This image is horizontal and the {view} slot is {ori}. The sides will be cropped.',
  'mismatch.v': 'This image is vertical and the {view} slot is {ori}. The top and bottom will be cropped.',
  'mismatch.move': 'Use in {ori}', 'mismatch.keep': 'Crop',
  'img.notImage': 'That file isn’t an image. Use PNG, JPG or WebP.', 'img.unreadable': 'Couldn’t read the image. Try another file.',
  'img.pasted': 'pasted image',
  'toast.added': 'Image added to {view}', 'toast.removed': 'Image removed from {view}',
  'toast.many': '{n} images added', 'toast.one': '1 image added', 'toast.bg': 'Background updated',
  'dist.title.one': 'Place 1 image', 'dist.title.many': 'Place {n} images',
  'dist.sub': 'Each one goes to the slot that matches its shape. Change anything you need.',
  'dist.choose': 'Choose a slot', 'dist.none': 'Don’t use', 'dist.ask': 'The highlighted ones fit more than one slot. Pick one.',
  'dist.for': 'Slot for {name}', 'dist.cancel': 'Cancel', 'dist.apply': 'Apply',
  'dial.label': 'Hinge angle', 'dial.minimize': 'Minimize hinge control', 'dial.show': 'Show hinge control', 'dial.mini': 'Hinge',
  'stage.aria': '3D view of iPhone Duo. Drag to rotate it, use the wheel to zoom.',
  'ori.group': 'Orientation',
  'fs.enter': 'Full screen', 'fs.exit': 'Exit full screen', 'fs.exitHint': 'Exit full screen (Esc)',
  'insp.hinge': 'Hinge', 'insp.hingeField': 'Hinge angle in degrees', 'insp.minus': 'Subtract 1°', 'insp.plus': 'Add 1°',
  'insp.camera': 'Camera', 'cam.frente': 'Front', 'cam.tres': 'Three-quarter', 'cam.perfil': 'Side', 'cam.cenital': 'Top',
  'insp.turn': 'Turn', 'insp.tilt': 'Tilt', 'insp.mouse': 'You can also drag the Duo with the mouse and zoom with the wheel.',
  'insp.finish': 'Finish', 'finish.nocturno': 'Night Sky', 'finish.estelar': 'Star White',
  'insp.bg': 'Background', 'bg.transparente': 'Transparent', 'bg.estudio': 'Studio', 'bg.blanco': 'White', 'bg.grafito': 'Graphite',
  'bg.upload': 'Upload background', 'bg.custom': 'Uploaded background',
  'insp.shadowGlass': 'Shadow and glass', 'insp.shadow': 'Shadow', 'insp.softness': 'Shadow softness', 'insp.reflections': 'Glass reflections',
};

const es: Record<keyof typeof en, string> = {
  'doc.title': 'DuoMe, mockups del iPhone Duo',
  'lang.label': 'Idioma',
  'top.undo': 'Deshacer', 'top.redo': 'Rehacer', 'top.preview': 'Vista previa', 'top.export': 'Exportar',
  'export.title': 'Exportar PNG', 'export.size': 'Tamaño', 'export.transparent': 'Fondo transparente', 'export.shadow': 'Incluir sombra',
  'export.hint': 'El PNG se recorta al contorno del Duo, con la cámara que ves en el lienzo.',
  'export.go': 'Descargar PNG', 'export.busy': 'Generando…',
  'export.done': 'PNG descargado', 'export.capped': 'PNG descargado a {px} px, el máximo de esta placa de video',
  'export.fail': 'No se pudo generar el PNG. Probá con un tamaño menor.',
  'screens.title': 'Pantallas',
  'screens.intro': 'Cada pose lleva una imagen por orientación. Arrastrala sobre su lugar.',
  'screens.introEmpty': 'Cada pose lleva una imagen por orientación. Arrastrala sobre su lugar o usá el botón de subir.',
  'grid.hint': 'Hacé clic en un lugar para verlo en el lienzo.',
  'grid.hintFilled': 'Hacé clic en un lugar para verlo en el lienzo. La X quita la imagen.',
  'grid.outer': 'pantalla de afuera, 5,4 in', 'grid.inner': 'pantalla de adentro, 7,6 in',
  'slot.with': '{view}, con imagen. Tamaño recomendado {w} por {h} píxeles.',
  'slot.empty': '{view}, vacío. Tamaño recomendado {w} por {h} píxeles.',
  'slot.upload': 'Subir imagen para {view}', 'slot.remove': 'Quitar imagen de {view}',
  'slot.drop': 'Soltá para {view}',
  'fit.title': 'Si la imagen no encaja', 'fit.cover': 'Recortar', 'fit.contain': 'Mostrar entera',
  'guides.title': 'Mostrar cámara y pliegue', 'guides.hint': 'Así ves qué partes de tu pantalla quedan tapadas.',
  'pose.cerrado': 'Cerrado', 'pose.semiabierto': 'Semiabierto', 'pose.abierto': 'Abierto',
  'ori.vertical': 'Vertical', 'ori.horizontal': 'Horizontal',
  'ori.lower.vertical': 'vertical', 'ori.lower.horizontal': 'horizontal',
  'view': '{pose} {ori}',
  'mismatch.h': 'Esta imagen es horizontal y el lugar de {view} es {ori}. Se va a recortar a los costados.',
  'mismatch.v': 'Esta imagen es vertical y el lugar de {view} es {ori}. Se va a recortar arriba y abajo.',
  'mismatch.move': 'Usar en {ori}', 'mismatch.keep': 'Recortar',
  'img.notImage': 'Ese archivo no es una imagen. Usá PNG, JPG o WebP.', 'img.unreadable': 'No se pudo leer la imagen. Probá con otro archivo.',
  'img.pasted': 'imagen pegada',
  'toast.added': 'Imagen agregada a {view}', 'toast.removed': 'Imagen quitada de {view}',
  'toast.many': '{n} imágenes agregadas', 'toast.one': '1 imagen agregada', 'toast.bg': 'Fondo actualizado',
  'dist.title.one': 'Repartir 1 imagen', 'dist.title.many': 'Repartir {n} imágenes',
  'dist.sub': 'Cada una va al lugar que coincide con su forma. Cambiá lo que haga falta.',
  'dist.choose': 'Elegí un lugar', 'dist.none': 'No usar', 'dist.ask': 'Las marcadas entran en más de un lugar. Elegí cuál.',
  'dist.for': 'Lugar para {name}', 'dist.cancel': 'Cancelar', 'dist.apply': 'Aplicar',
  'dial.label': 'Ángulo de bisagra', 'dial.minimize': 'Minimizar control de bisagra', 'dial.show': 'Mostrar control de bisagra', 'dial.mini': 'Bisagra',
  'stage.aria': 'Vista 3D del iPhone Duo. Arrastrá para girarlo, usá la rueda para acercarte.',
  'ori.group': 'Orientación',
  'fs.enter': 'Pantalla completa', 'fs.exit': 'Salir de pantalla completa', 'fs.exitHint': 'Salir de pantalla completa (Esc)',
  'insp.hinge': 'Bisagra', 'insp.hingeField': 'Ángulo de bisagra en grados', 'insp.minus': 'Restar 1°', 'insp.plus': 'Sumar 1°',
  'insp.camera': 'Cámara', 'cam.frente': 'Frente', 'cam.tres': 'Tres cuartos', 'cam.perfil': 'Perfil', 'cam.cenital': 'Cenital',
  'insp.turn': 'Giro', 'insp.tilt': 'Inclinación', 'insp.mouse': 'También podés arrastrar el Duo con el mouse y acercarte con la rueda.',
  'insp.finish': 'Acabado', 'finish.nocturno': 'Cielo nocturno', 'finish.estelar': 'Blanco estelar',
  'insp.bg': 'Fondo', 'bg.transparente': 'Transparente', 'bg.estudio': 'Estudio', 'bg.blanco': 'Blanco', 'bg.grafito': 'Grafito',
  'bg.upload': 'Subir fondo', 'bg.custom': 'Fondo subido',
  'insp.shadowGlass': 'Sombra y vidrio', 'insp.shadow': 'Sombra', 'insp.softness': 'Suavidad de la sombra', 'insp.reflections': 'Reflejos en el vidrio',
};

export type Key = keyof typeof en;
const DICT: Record<Lang, Record<Key, string>> = { en, es };

function initial(): Lang {
  try { const s = localStorage.getItem('duome-lang'); if (s === 'en' || s === 'es') return s; } catch { /* sin almacenamiento */ }
  return 'en';
}
export let lang: Lang = initial();

export function t(k: Key, vars: Record<string, string | number> = {}): string {
  return DICT[lang][k].replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? ''));
}

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('duome-lang', l); } catch { /* sin almacenamiento */ }
  applyStatic();
}

/** Textos fijos del HTML: data-i18n (texto), data-i18n-aria (aria-label), data-i18n-title (title). */
export function applyStatic() {
  document.documentElement.lang = lang;
  document.title = t('doc.title');
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n as Key); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria as Key)));
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle as Key); });
}
