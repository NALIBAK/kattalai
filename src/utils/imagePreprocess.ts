/**
 * imagePreprocess.ts
 * Client-side Canvas API image preprocessing for improved Tesseract OCR accuracy.
 * All processing happens in the browser — no data leaves the device.
 */

/**
 * Loads a File/Blob into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Applies the full preprocessing pipeline to an image file:
 *  1. Resize to max 2000px (Tesseract sweet spot)
 *  2. Grayscale conversion
 *  3. Contrast + brightness boost
 *  4. Unsharp mask (sharpen)
 *  5. Auto-crop whitespace borders
 *
 * Returns a preprocessed Blob (PNG) ready for Tesseract.
 */
export async function preprocessImageForOCR(file: File): Promise<Blob> {
  const img = await loadImage(file);

  // ── Step 1: Resize ────────────────────────────────────────────
  const MAX_DIM = 2000;
  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Fill white background (handles transparent PNGs)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // ── Step 2: Grayscale + Contrast boost ───────────────────────
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  const CONTRAST = 1.4;   // 1.0 = no change, >1.0 = more contrast
  const BRIGHTNESS = 10;  // additive pixel brightness

  for (let i = 0; i < d.length; i += 4) {
    // Luminance-weighted grayscale (perceptual)
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contrast: (val - 128) * contrast + 128 + brightness
    const adjusted = Math.min(255, Math.max(0, (gray - 128) * CONTRAST + 128 + BRIGHTNESS));
    d[i] = d[i + 1] = d[i + 2] = adjusted;
    // d[i+3] alpha stays unchanged
  }

  // ── Step 3: Sharpen (3×3 unsharp kernel) ─────────────────────
  const sharpened = applyConvolution(imageData, width, height, [
     0, -1,  0,
    -1,  5, -1,
     0, -1,  0,
  ]);

  ctx.putImageData(sharpened, 0, 0);

  // ── Step 4: Auto-crop whitespace borders ─────────────────────
  const cropped = autoCrop(canvas, ctx);

  return new Promise<Blob>((resolve, reject) => {
    cropped.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
      'image/png'
    );
  });
}

/**
 * Applies a 3×3 convolution kernel to ImageData.
 */
function applyConvolution(
  src: ImageData,
  width: number,
  height: number,
  kernel: number[]
): ImageData {
  const output = new ImageData(width, height);
  const s = src.data;
  const o = output.data;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const kw = kernel[(ky + 1) * 3 + (kx + 1)];
          r += s[idx] * kw; // grayscale: r=g=b so just use r channel
        }
      }
      const outIdx = (y * width + x) * 4;
      const clamped = Math.min(255, Math.max(0, r));
      o[outIdx] = o[outIdx + 1] = o[outIdx + 2] = clamped;
      o[outIdx + 3] = 255;
    }
  }
  // Copy border pixels as-is
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = (y * width + x) * 4;
      o[idx] = s[idx]; o[idx+1] = s[idx+1]; o[idx+2] = s[idx+2]; o[idx+3] = 255;
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const idx = (y * width + x) * 4;
      o[idx] = s[idx]; o[idx+1] = s[idx+1]; o[idx+2] = s[idx+2]; o[idx+3] = 255;
    }
  }
  return output;
}

/**
 * Auto-crops near-white borders from the canvas.
 * Returns a new canvas with borders removed.
 */
function autoCrop(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): HTMLCanvasElement {
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const THRESHOLD = 240; // pixels brighter than this are "white"

  const isWhiteRow = (y: number) => {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] < THRESHOLD) return false;
    }
    return true;
  };
  const isWhiteCol = (x: number) => {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4] < THRESHOLD) return false;
    }
    return true;
  };

  let top = 0, bottom = height - 1, left = 0, right = width - 1;
  while (top < bottom && isWhiteRow(top)) top++;
  while (bottom > top && isWhiteRow(bottom)) bottom--;
  while (left < right && isWhiteCol(left)) left++;
  while (right > left && isWhiteCol(right)) right--;

  const PADDING = 10;
  top    = Math.max(0, top - PADDING);
  bottom = Math.min(height - 1, bottom + PADDING);
  left   = Math.max(0, left - PADDING);
  right  = Math.min(width - 1, right + PADDING);

  const cw = right - left + 1;
  const ch = bottom - top + 1;

  const cropped = document.createElement('canvas');
  cropped.width = cw;
  cropped.height = ch;
  const cCtx = cropped.getContext('2d')!;
  cCtx.drawImage(canvas, left, top, cw, ch, 0, 0, cw, ch);
  return cropped;
}
