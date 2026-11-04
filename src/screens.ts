import * as THREE from 'three';
import { DISPLAYS } from './specs';

export type Fit = 'cover' | 'contain';

/** Lienzo con la resolución nativa de la pantalla; la imagen se dibuja girada si la vista lo pide. */
export class ScreenTexture {
  readonly canvas = document.createElement('canvas');
  readonly texture: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;

  constructor(readonly display: 'outer' | 'inner', maxSide = 2048) {
    const [w, h] = DISPLAYS[display].px;
    const k = Math.min(1, maxSide / Math.max(w, h));
    this.canvas.width = Math.round(w * k);
    this.canvas.height = Math.round(h * k);
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
  }

  draw(img: HTMLImageElement | ImageBitmap | null, opts: { rotated: boolean; fit: Fit; off?: boolean; guides?: boolean; fold?: boolean }) {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.fillStyle = opts.off ? '#050607' : img ? '#000000' : '#E9EBEE';
    ctx.fillRect(0, 0, W, H);
    if (img && !opts.off) {
      ctx.translate(W / 2, H / 2);
      // En horizontal el Duo gira 90° a la derecha: la parte de arriba de la imagen va al borde izquierdo
      if (opts.rotated) ctx.rotate(-Math.PI / 2);
      const bw = opts.rotated ? H : W, bh = opts.rotated ? W : H;
      const iw = 'naturalWidth' in img ? img.naturalWidth : img.width, ih = 'naturalHeight' in img ? img.naturalHeight : img.height;
      const s = opts.fit === 'cover' ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
    }
    ctx.restore();
    if (opts.guides && !opts.off) this.drawGuides(opts.fold ?? false);
    this.texture.needsUpdate = true;
  }

  /** Zonas que conviene no tapar: cámara exterior y franja del pliegue. */
  private drawGuides(fold: boolean) {
    const { ctx, canvas } = this, W = canvas.width, H = canvas.height;
    ctx.save();
    ctx.fillStyle = 'rgba(31, 86, 184, 0.28)';
    ctx.strokeStyle = 'rgba(31, 86, 184, 0.9)';
    ctx.lineWidth = Math.max(2, W / 400);
    if (this.display === 'outer') {
      // cámara arriba a la derecha (vista desde afuera)
      const r = W * 0.06, cx = W - W * 0.11, cy = H * 0.058;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (fold) {
      const bw = W * 0.06;
      ctx.fillRect(W / 2 - bw / 2, 0, bw, H);
      ctx.strokeRect(W / 2 - bw / 2, 0, bw, H);
    }
    ctx.restore();
  }
}

export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}
