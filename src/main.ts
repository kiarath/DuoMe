import './style.css';
import { Stage } from './scene';
import { FINISHES } from './device';
import { ScreenTexture, loadImage, type Fit } from './screens';
import {
  ORI_LABEL, ORIENTATIONS, POSE_ANGLE, POSE_LABEL, POSES, poseFromAngle, slotDisplay, slotPixels,
  type Orientation, type Pose, type SlotKey,
} from './specs';

// ---------- Estado ----------
interface Img { el: HTMLImageElement; name: string; w: number; h: number }
interface State {
  angle: number; ori: Orientation; fit: Fit; guides: boolean; finish: string; bg: string; soft: number; reflections: boolean;
  slots: Partial<Record<SlotKey, string>>; dismissed: string[];
}
const BACKGROUNDS: Record<string, { label: string; color: string | null }> = {
  transparente: { label: 'Transparente', color: null },
  estudio: { label: 'Estudio', color: 'var(--estudio)' },
  blanco: { label: 'Blanco', color: '#FFFFFF' },
  grafito: { label: 'Grafito', color: '#20252B' },
};
const images = new Map<string, Img>();
let state: State = { angle: 90, ori: 'vertical', fit: 'cover', guides: false, finish: 'natural', bg: 'estudio', soft: 60, reflections: true, slots: {}, dismissed: [] };
const past: string[] = [], future: string[] = [];
const snapshot = () => JSON.stringify(state);
function commit(mutate: () => void) {
  past.push(snapshot()); if (past.length > 100) past.shift(); future.length = 0;
  mutate(); render();
}
function undo() { if (!past.length) return; future.push(snapshot()); state = JSON.parse(past.pop()!); render(true); }
function redo() { if (!future.length) return; past.push(snapshot()); state = JSON.parse(future.pop()!); render(true); }

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const key = (p: Pose, o: Orientation) => `${p}|${o}` as SlotKey;
const currentKey = () => key(poseFromAngle(state.angle), state.ori);
const viewName = (k: SlotKey) => { const [p, o] = k.split('|') as [Pose, Orientation]; return `${POSE_LABEL[p]} ${o}`; };

// ---------- Escena ----------
const stage = new Stage($('canvas-host'));
const innerTex = new ScreenTexture('inner');
const outerTex = new ScreenTexture('outer');
stage.duo.innerMat.map = innerTex.texture;
stage.duo.outerMat.map = outerTex.texture;

let lastPose: Pose | null = null;
function updateScene(instant = false) {
  const pose = poseFromAngle(state.angle);
  stage.duo.setAngle(state.angle);
  stage.duo.setOrientation(pose, state.ori, instant);
  stage.duo.setFinish(state.finish);
  stage.duo.setReflections(state.reflections);
  stage.setShadow(state.soft);
  const innerKey = key(pose === 'cerrado' ? 'abierto' : pose, state.ori);
  const outerKey = key('cerrado', state.ori);
  const ii = state.slots[innerKey] ? images.get(state.slots[innerKey]!) : undefined;
  const oi = state.slots[outerKey] ? images.get(state.slots[outerKey]!) : undefined;
  innerTex.draw(ii?.el ?? null, { rotated: slotDisplay(innerKey).rotated, fit: state.fit, guides: state.guides, fold: pose === 'semiabierto' });
  // con el Duo abierto la pantalla exterior se apaga, como en el equipo real
  outerTex.draw(oi?.el ?? null, { rotated: slotDisplay(outerKey).rotated, fit: state.fit, guides: state.guides, off: pose !== 'cerrado' });
  if (lastPose !== pose && lastPose !== null) stage.invalidate();
  lastPose = pose;
  stage.invalidate();
}

// ---------- Grilla de pantallas ----------
const grid = $('grid');
const fileInput = $<HTMLInputElement>('file');
const filesInput = $<HTMLInputElement>('files');
let pendingSlot: SlotKey | null = null;

const ICON_UP = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M5 9V1M1.5 4.5 5 1l3.5 3.5M0 11.5h10"/></svg>';
const ICON_X = '<svg viewBox="0 0 8 8" aria-hidden="true"><path d="m0 0 8 8M8 0 0 8"/></svg>';
const THUMB: Record<SlotKey, [number, number, '' | 'fold-v' | 'fold-h']> = {
  'cerrado|vertical': [32, 50, ''], 'cerrado|horizontal': [50, 32, ''],
  'semiabierto|vertical': [54, 40, 'fold-v'], 'semiabierto|horizontal': [40, 54, 'fold-h'],
  'abierto|vertical': [40, 54, 'fold-h'], 'abierto|horizontal': [54, 40, 'fold-v'],
};

function renderGrid() {
  grid.innerHTML = '';
  for (const o of ORIENTATIONS) {
    const h = document.createElement('div'); h.className = 'col-head';
    h.innerHTML = `<i class="ori ${o === 'vertical' ? 'v' : 'h'}"></i>${ORI_LABEL[o]}`; grid.append(h);
  }
  const cur = currentKey();
  for (const p of POSES) {
    const rh = document.createElement('div'); rh.className = 'row-head';
    rh.innerHTML = `<b>${POSE_LABEL[p]}</b><span>${p === 'cerrado' ? 'pantalla de afuera, 5,4 in' : 'pantalla de adentro, 7,6 in'}</span>`;
    grid.append(rh);
    const notes: HTMLElement[] = [];
    for (const o of ORIENTATIONS) {
      const k = key(p, o), id = state.slots[k], img = id ? images.get(id) : undefined;
      const [px, py] = slotPixels(k), [tw, th, fold] = THUMB[k];
      const slot = document.createElement('div');
      slot.className = 'slot'; slot.tabIndex = 0; slot.setAttribute('role', 'button');
      slot.dataset.key = k;
      slot.setAttribute('aria-label', `${viewName(k)}${img ? ', con imagen' : ', vacío'}. Tamaño recomendado ${px} por ${py} píxeles.`);
      if (k === cur) slot.setAttribute('aria-current', 'true');
      slot.innerHTML = `
        <span class="thumb ${img ? '' : 'empty'} ${fold}" style="width:${tw}px;height:${th}px">${img ? `<img alt="" src="${img.el.src}">` : ''}</span>
        <button class="corner ${img ? 'remove' : 'upload'}" aria-label="${img ? 'Quitar imagen de ' : 'Subir imagen para '}${viewName(k)}">${img ? ICON_X : ICON_UP}</button>
        <span class="size">${px}px x ${py}px</span>`;
      slot.addEventListener('click', e => {
        const corner = (e.target as HTMLElement).closest('.corner');
        if (corner && img) { commit(() => { delete state.slots[k]; }); toast(`Imagen quitada de ${viewName(k)}`); return; }
        selectView(p, o);
        if (!img || corner) { pendingSlot = k; fileInput.value = ''; fileInput.click(); }
      });
      slot.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slot.click(); } });
      wireDrop(slot, k);
      grid.append(slot);
      if (img && !state.dismissed.includes(`${k}:${id}`) && (img.w > img.h) !== (px > py)) notes.push(mismatchNote(k, img, id!));
    }
    for (const n of notes) grid.append(n);
  }
}

function mismatchNote(k: SlotKey, img: Img, id: string): HTMLElement {
  const [p, o] = k.split('|') as [Pose, Orientation];
  const other: Orientation = o === 'vertical' ? 'horizontal' : 'vertical';
  const el = document.createElement('div'); el.className = 'mismatch'; el.setAttribute('role', 'status');
  el.innerHTML = `<div>${img.w > img.h ? 'Esta imagen es horizontal' : 'Esta imagen es vertical'} y el lugar de ${viewName(k)} es ${o}. Se va a recortar a los costados.</div>
    <div class="actions"><button class="primary">Usar en ${ORI_LABEL[other]}</button><button>Recortar</button></div>`;
  const [move, keep] = el.querySelectorAll('button');
  move.addEventListener('click', () => commit(() => { delete state.slots[k]; state.slots[key(p, other)] = id; state.ori = other; }));
  keep.addEventListener('click', () => commit(() => { state.dismissed.push(`${k}:${id}`); }));
  return el;
}

async function addImage(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) { toast('Ese archivo no es una imagen. Usá PNG, JPG o WebP.'); return null; }
  try {
    const el = await loadImage(file);
    const id = crypto.randomUUID();
    images.set(id, { el, name: file.name || 'imagen pegada', w: el.naturalWidth, h: el.naturalHeight });
    return id;
  } catch { toast('No se pudo leer la imagen. Probá con otro archivo.'); return null; }
}
async function putFile(k: SlotKey, file: File) {
  const id = await addImage(file); if (!id) return;
  const [p, o] = k.split('|') as [Pose, Orientation];
  commit(() => { state.slots[k] = id; state.angle = POSE_ANGLE[p]; state.ori = o; });
  toast(`Imagen agregada a ${viewName(k)}`);
}
fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; if (f && pendingSlot) putFile(pendingSlot, f); });
filesInput.addEventListener('change', () => { if (filesInput.files?.length) distribute([...filesInput.files]); });

function filesFrom(e: DragEvent | ClipboardEvent): File[] {
  const dt = 'dataTransfer' in e ? e.dataTransfer : e.clipboardData;
  return dt ? [...dt.files].filter(f => f.type.startsWith('image/')) : [];
}
function wireDrop(slot: HTMLElement, k: SlotKey) {
  let label: HTMLElement | null = null;
  slot.addEventListener('dragover', e => {
    e.preventDefault(); e.stopPropagation();
    if (!slot.classList.contains('dragover')) {
      slot.classList.add('dragover');
      label = document.createElement('span'); label.className = 'drop-label'; label.textContent = `Soltá para ${viewName(k)}`; slot.append(label);
    }
  });
  const leave = () => { slot.classList.remove('dragover'); label?.remove(); label = null; };
  slot.addEventListener('dragleave', leave);
  slot.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation(); leave();
    const files = filesFrom(e);
    if (files.length > 1) distribute(files); else if (files[0]) putFile(k, files[0]);
  });
}

// Soltar varias imágenes: cada una va al lugar que coincide con su forma
async function distribute(files: File[]) {
  const box = $('distribute');
  const entries: { id: string; img: Img; target: SlotKey | '' }[] = [];
  for (const f of files.slice(0, 6)) { const id = await addImage(f); if (id) entries.push({ id, img: images.get(id)!, target: '' }); }
  if (!entries.length) return;
  const taken = new Set<SlotKey>();
  const all: SlotKey[] = POSES.flatMap(p => ORIENTATIONS.map(o => key(p, o)));
  for (const e of entries) {
    const a = Math.log(e.img.w / e.img.h);
    const scored = all.filter(k => !taken.has(k)).map(k => { const [w, h] = slotPixels(k); return { k, d: Math.abs(a - Math.log(w / h)), empty: !state.slots[k] }; })
      .sort((x, y) => x.d - y.d || Number(y.empty) - Number(x.empty));
    const best = scored[0];
    const ties = scored.filter(s => Math.abs(s.d - best.d) < 0.02 && s.empty === best.empty);
    if (best && best.d < 0.25 && ties.length === 1) { e.target = best.k; taken.add(best.k); }
  }
  const options = (sel: string) => `<option value="" ${sel ? '' : 'selected'}>Elegí un lugar</option>` + all.map(k => `<option value="${k}" ${sel === k ? 'selected' : ''}>${viewName(k)}</option>`).join('') + `<option value="none">No usar</option>`;
  box.innerHTML = `<h2>Repartir ${entries.length} ${entries.length === 1 ? 'imagen' : 'imágenes'}</h2>
    <p class="sub">Cada una va al lugar que coincide con su forma. Cambiá lo que haga falta.</p>
    ${entries.map((e, i) => `<div class="item ${e.target ? '' : 'ask'}"><img alt="" src="${e.img.el.src}"><div><small>${e.img.name}</small><select data-i="${i}" aria-label="Lugar para ${e.img.name}">${options(e.target)}</select></div></div>`).join('')}
    ${entries.some(e => !e.target) ? '<p class="sub small">Las marcadas entran en más de un lugar. Elegí cuál.</p>' : ''}
    <div class="actions"><button id="dist-cancel">Cancelar</button><button class="primary" id="dist-apply">Aplicar</button></div>`;
  box.hidden = false;
  box.querySelectorAll('select').forEach(s => s.addEventListener('change', () => {
    const e = entries[Number(s.dataset.i)]; e.target = s.value as SlotKey;
    s.closest('.item')!.classList.toggle('ask', !s.value);
  }));
  $('dist-cancel').onclick = () => { box.hidden = true; };
  $('dist-apply').onclick = () => {
    const chosen = entries.filter(e => e.target && e.target !== ('none' as string));
    commit(() => { for (const e of chosen) state.slots[e.target as SlotKey] = e.id; });
    box.hidden = true; toast(`${chosen.length} ${chosen.length === 1 ? 'imagen agregada' : 'imágenes agregadas'}`);
  };
  (box.querySelector('select') as HTMLSelectElement)?.focus();
}

// Soltar o pegar sobre el lienzo: va a la vista activa
const stageEl = $('stage'), dropzone = $('dropzone');
stageEl.addEventListener('dragover', e => { e.preventDefault(); dropzone.hidden = false; $('dropzone-label').textContent = `Soltá para ${viewName(currentKey())}`; });
stageEl.addEventListener('dragleave', e => { if (!stageEl.contains(e.relatedTarget as Node)) dropzone.hidden = true; });
stageEl.addEventListener('drop', e => { e.preventDefault(); dropzone.hidden = true; const f = filesFrom(e); if (f.length > 1) distribute(f); else if (f[0]) putFile(currentKey(), f[0]); });
document.querySelector('.panel.left')!.addEventListener('dragover', e => e.preventDefault());
document.querySelector('.panel.left')!.addEventListener('drop', e => { e.preventDefault(); const f = filesFrom(e as DragEvent); if (f.length) distribute(f); });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());
window.addEventListener('paste', e => { const f = filesFrom(e); if (f[0]) putFile(currentKey(), f[0]); });

// ---------- Dial de bisagra ----------
const svg = $('dial-svg') as unknown as SVGSVGElement;
const CX = 250, CY = 196, R = 132;
const pt = (a: number, r = R) => { const t = a * Math.PI / 180; return [CX - r * Math.cos(t), CY - r * Math.sin(t)]; };
function drawDial() {
  const a = state.angle, [kx, ky] = pt(a);
  let ticks = '';
  for (let d = 0; d <= 180; d += 10) {
    const major = d % 90 === 0, [x0, y0] = pt(d, R + 8), [x1, y1] = pt(d, R + (major ? 20 : 13));
    ticks += `<line class="tick ${d <= a && a > 0 ? 'on' : ''}" x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke-width="${major ? 1.5 : 1}"/>`;
  }
  const [px, py] = pt(a);
  svg.innerHTML = `<path class="hit" d="M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}"/>
    <path class="track" d="M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}"/>
    ${a > 0 ? `<path class="progress" d="M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${px} ${py}"/>` : ''}
    ${ticks}<circle class="knob" cx="${kx}" cy="${ky}" r="11"/>`;
  $('dial-value').textContent = `${Math.round(a)}°`;
  ($('dial-input') as HTMLInputElement).value = String(Math.round(a));
  document.querySelectorAll<HTMLElement>('.detent').forEach(b => b.setAttribute('aria-current', String(Number(b.dataset.a) === Math.round(a))));
}
function angleFromPointer(e: PointerEvent) {
  const r = svg.getBoundingClientRect();
  const x = (e.clientX - r.left) * 500 / r.width, y = (e.clientY - r.top) * 226 / r.height;
  let a = Math.atan2(CY - y, CX - x) * 180 / Math.PI;
  if (y > CY) a = x < CX ? 0 : 180;
  a = Math.min(180, Math.max(0, a));
  for (const d of [0, 90, 180]) if (Math.abs(a - d) < 4) a = d; // topes
  return Math.round(a);
}
let dialStart: string | null = null;
svg.addEventListener('pointerdown', e => {
  dialStart = snapshot(); svg.setPointerCapture(e.pointerId);
  state.angle = angleFromPointer(e); render();
});
svg.addEventListener('pointermove', e => { if (dialStart === null) return; state.angle = angleFromPointer(e); render(); });
const dialEnd = () => { if (dialStart !== null && dialStart !== snapshot()) { past.push(dialStart); future.length = 0; updateHistoryButtons(); } dialStart = null; };
svg.addEventListener('pointerup', dialEnd); svg.addEventListener('pointercancel', dialEnd);
document.querySelectorAll<HTMLElement>('.detent').forEach(b => b.addEventListener('click', () => commit(() => { state.angle = Number(b.dataset.a); })));
$('dial-input').addEventListener('input', e => commit(() => { state.angle = Number((e.target as HTMLInputElement).value); }));

// ---------- Inspector ----------
const angleField = $<HTMLInputElement>('angle');
angleField.addEventListener('change', () => commit(() => { state.angle = Math.min(180, Math.max(0, Math.round(Number(angleField.value) || 0))); }));
const nudge = (d: number) => (e: MouseEvent) => commit(() => { state.angle = Math.min(180, Math.max(0, state.angle + d * (e.shiftKey ? 10 : 1))); });
$('angle-minus').addEventListener('click', nudge(-1));
$('angle-plus').addEventListener('click', nudge(1));

const PRESETS: Record<string, [number, number]> = { frente: [0, 4], tres: [-28, 12], perfil: [-78, 4], cenital: [0, 78] };
let animating = 0;
function animateView(az: number, el: number) {
  const from = stage.viewAngles();
  if (stage.reducedMotion) { stage.setView(az, el); return; }
  const id = ++animating, t0 = performance.now();
  const step = (t: number) => {
    if (id !== animating) return;
    const k = Math.min(1, (t - t0) / 420), e = 1 - Math.pow(1 - k, 3);
    let dAz = az - from.azimuth; dAz = ((dAz + 540) % 360) - 180;
    stage.setView(from.azimuth + dAz * e, from.elevation + (el - from.elevation) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
document.querySelectorAll<HTMLElement>('#presets button').forEach(b => b.addEventListener('click', () => { const [a, e] = PRESETS[b.dataset.p!]; animateView(a, e); }));
const az = $<HTMLInputElement>('az'), el = $<HTMLInputElement>('el');
const onSlider = () => { animating++; stage.setView(Number(az.value), Number(el.value)); };
az.addEventListener('input', onSlider); el.addEventListener('input', onSlider);
function syncCamera() {
  const v = stage.viewAngles();
  az.value = String(v.azimuth); el.value = String(v.elevation);
  $('az-out').textContent = `${v.azimuth}°`.replace('-', '−'); $('el-out').textContent = `${v.elevation}°`.replace('-', '−');
  document.querySelectorAll<HTMLElement>('#presets button').forEach(b => {
    const [a, e] = PRESETS[b.dataset.p!]; b.setAttribute('aria-pressed', String(Math.abs(a - v.azimuth) <= 2 && Math.abs(e - v.elevation) <= 2));
  });
}
stage.onCameraChange = syncCamera;

function swatches(host: HTMLElement, items: Record<string, { label: string; swatch?: string; color?: string | null }>, get: () => string, set: (k: string) => void) {
  host.innerHTML = '';
  for (const [k, v] of Object.entries(items)) {
    const b = document.createElement('button'); b.setAttribute('role', 'radio'); b.setAttribute('aria-label', v.label); b.title = v.label; b.dataset.k = k;
    const c = v.swatch ?? v.color;
    if (c) b.style.background = c; else b.classList.add('checker');
    b.addEventListener('click', () => commit(() => set(k)));
    host.append(b);
  }
  return () => host.querySelectorAll<HTMLElement>('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.k === get())));
}
const syncFinish = swatches($('finish'), FINISHES, () => state.finish, k => { state.finish = k; });
const syncBg = swatches($('background'), BACKGROUNDS, () => state.bg, k => { state.bg = k; });

const soft = $<HTMLInputElement>('soft');
let softStart: string | null = null;
soft.addEventListener('pointerdown', () => { softStart = snapshot(); });
soft.addEventListener('input', () => { state.soft = Number(soft.value); render(); });
soft.addEventListener('change', () => { if (softStart) { past.push(softStart); future.length = 0; softStart = null; updateHistoryButtons(); } });
$('reflections').addEventListener('change', e => commit(() => { state.reflections = (e.target as HTMLInputElement).checked; }));
$('guides').addEventListener('change', e => commit(() => { state.guides = (e.target as HTMLInputElement).checked; }));

function radioGroup(host: HTMLElement, get: () => string, set: (v: string) => void) {
  host.querySelectorAll<HTMLElement>('[role=radio]').forEach(b => b.addEventListener('click', () => { if (b.dataset.v !== get()) commit(() => set(b.dataset.v!)); }));
  return () => host.querySelectorAll<HTMLElement>('[role=radio]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === get())));
}
const syncFit = radioGroup($('fit'), () => state.fit, v => { state.fit = v as Fit; });
const syncOri = radioGroup($('orientation'), () => state.ori, v => { state.ori = v as Orientation; });

function selectView(p: Pose, o: Orientation) {
  const changed = poseFromAngle(state.angle) !== p || state.ori !== o;
  if (!changed) return;
  commit(() => { state.angle = POSE_ANGLE[p]; state.ori = o; });
  // apoyado como laptop conviene mirarlo un poco más desde arriba
  requestAnimationFrame(() => animateView(PRESETS.tres[0], p === 'semiabierto' && o === 'horizontal' ? 26 : PRESETS.tres[1]));
}

// ---------- Barra superior ----------
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);
window.addEventListener('keydown', e => {
  const t = e.target as HTMLElement;
  if (t.matches('input[type=number], select')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === 'Escape' && app.classList.contains('clean') && !document.fullscreenElement) setClean(false);
  if (e.key === 'Escape') closeExport();
});
function updateHistoryButtons() { ($('undo') as HTMLButtonElement).disabled = !past.length; ($('redo') as HTMLButtonElement).disabled = !future.length; }

const app = $('app');
const ENTER = 'M0 5V0h5M11 0h5v5M16 11v5h-5M5 16H0v-5', EXIT = 'M5 0v5H0M11 0v5h5M16 11h-5v5M0 11h5v5';
function setClean(on: boolean) {
  app.classList.toggle('clean', on);
  stage.setLift(on ? 0 : 110);
  $('fs-icon').innerHTML = `<path d="${on ? EXIT : ENTER}"/>`;
  $('fullscreen').setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
  $('fullscreen').title = on ? 'Salir de pantalla completa (Esc)' : 'Pantalla completa';
}
$('fullscreen').addEventListener('click', async () => {
  if (app.classList.contains('clean')) { setClean(false); if (document.fullscreenElement) await document.exitFullscreen(); return; }
  setClean(true);
  try { await app.requestFullscreen(); } catch { /* el navegador puede negarlo; queda la vista limpia igual */ }
});
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) setClean(false); });
$('preview').addEventListener('click', () => setClean(true));

// ---------- Exportar ----------
const pop = $('export-pop'), openBtn = $('export-open');
let exportSize = 4096;
function closeExport() { pop.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); }
openBtn.addEventListener('click', () => { pop.hidden = !pop.hidden; openBtn.setAttribute('aria-expanded', String(!pop.hidden)); });
document.addEventListener('pointerdown', e => { if (!pop.hidden && !(e.target as HTMLElement).closest('.export-wrap')) closeExport(); });
const syncSize = radioGroup($('export-size'), () => String(exportSize), v => { exportSize = Number(v); });
$('export-go').addEventListener('click', async () => {
  const gl = stage.renderer.getContext();
  const max = Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), (gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array)[0]);
  const longSide = Math.min(exportSize, max);
  const btn = $<HTMLButtonElement>('export-go'); btn.disabled = true; btn.textContent = 'Generando…';
  try {
    const blob = await stage.exportPNG({
      longSide,
      transparent: $<HTMLInputElement>('export-transparent').checked,
      shadow: $<HTMLInputElement>('export-shadow').checked,
      background: resolveColor(BACKGROUNDS[state.bg].color ?? 'var(--estudio)'),
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `duome-${currentKey().replace('|', '-')}-${longSide}px.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast(longSide < exportSize ? `PNG descargado a ${longSide} px, el máximo de esta placa de video` : 'PNG descargado');
    closeExport();
  } catch { toast('No se pudo generar el PNG. Probá con un tamaño menor.'); }
  btn.disabled = false; btn.textContent = 'Descargar PNG';
});

function resolveColor(c: string) {
  const m = c.match(/^var\((--[\w-]+)\)$/);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#D9DCDF' : c;
}

// ---------- Avisos ----------
let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Render ----------
function render(instant = false) {
  updateScene(instant);
  renderGrid();
  drawDial();
  angleField.value = String(Math.round(state.angle));
  syncFit(); syncOri(); syncFinish(); syncBg(); syncSize();
  ($('guides') as HTMLInputElement).checked = state.guides;
  ($('reflections') as HTMLInputElement).checked = state.reflections;
  soft.value = String(state.soft); $('soft-out').textContent = `${state.soft} %`;
  $('finish-name').textContent = FINISHES[state.finish].label;
  $('bg-name').textContent = BACKGROUNDS[state.bg].label;
  const bg = BACKGROUNDS[state.bg].color;
  stageEl.classList.toggle('transparent', !bg);
  if (bg) stageEl.style.setProperty('--canvas-bg', bg); else stageEl.style.removeProperty('--canvas-bg');
  const empty = !Object.keys(state.slots).length;
  $('screens-intro').textContent = empty ? 'Cada pose lleva una imagen por orientación. Arrastrala sobre su lugar o hacé clic para elegirla.' : 'Cada pose lleva una imagen por orientación. Arrastrala sobre su lugar.';
  $('grid-hint').textContent = empty ? 'Hacé clic en un lugar para verlo en el lienzo.' : 'Hacé clic en un lugar para verlo en el lienzo. La X quita la imagen.';
  $('fit-block').hidden = empty;
  updateHistoryButtons();
}

render(true);
stage.setView(...PRESETS.tres, 900);
syncCamera();
