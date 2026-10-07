/**
 * Zero-dependency QR Code Generator (Model 2)
 * Generates dynamic 2D QR matrices and SVG for UPI payment links & URLs.
 */

// Helper to construct standard UPI payment link
export function generateUpiUri(params: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  invoiceNo?: string;
  note?: string;
}): string {
  const pa = encodeURIComponent(params.upiId.trim());
  const pn = encodeURIComponent((params.payeeName || "Retail Sathi").trim());
  const cu = "INR";
  let uri = `upi://pay?pa=${pa}&pn=${pn}&cu=${cu}`;

  if (params.amount !== undefined && params.amount > 0) {
    uri += `&am=${params.amount.toFixed(2)}`;
  }
  const note = params.invoiceNo ? `Invoice ${params.invoiceNo}` : params.note || "POS Bill";
  uri += `&tn=${encodeURIComponent(note)}`;

  return uri;
}

/**
 * Minimalist QR Code Matrix Encoder for byte mode (UTF-8/ASCII)
 */
// QR Code Generator using basic byte mode & standard Reed-Solomon tables
export class QrMatrix {
  public size: number;
  public modules: boolean[][];

  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => Array(size).fill(false));
  }

  set(r: number, c: number, val: boolean) {
    if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
      this.modules[r][c] = val;
    }
  }

  get(r: number, c: number): boolean {
    if (r >= 0 && r < this.size && c >= 0 && c < this.size) {
      return this.modules[r][c];
    }
    return false;
  }
}

// Simple Galois Field & Reed-Solomon polynomial math for QR
const GF_EXP: number[] = new Array(512);
const GF_LOG: number[] = new Array(256);

(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsCompute(data: number[], numEc: number): number[] {
  // Generate generator polynomial
  let gen = [1];
  for (let i = 0; i < numEc; i++) {
    const nextGen: number[] = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      nextGen[j] ^= gfMul(gen[j], GF_EXP[i]);
      nextGen[j + 1] ^= gen[j];
    }
    gen = nextGen;
  }

  const result = new Array(numEc).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < numEc; i++) {
      result[i] ^= gfMul(gen[i], factor);
    }
  }
  return result;
}

// QR Version table for Byte mode (Version 1-10) Level M
const QR_CAPACITIES_M = [
  { version: 1, size: 21, dataBytes: 16, ecBytes: 10 },
  { version: 2, size: 25, dataBytes: 28, ecBytes: 16 },
  { version: 3, size: 29, dataBytes: 44, ecBytes: 26 },
  { version: 4, size: 33, dataBytes: 64, ecBytes: 18 * 2 },
  { version: 5, size: 37, dataBytes: 86, ecBytes: 24 * 2 },
  { version: 6, size: 41, dataBytes: 108, ecBytes: 16 * 4 },
  { version: 7, size: 45, dataBytes: 124, ecBytes: 18 * 4 },
  { version: 8, size: 49, dataBytes: 154, ecBytes: 22 * 4 },
  { version: 9, size: 53, dataBytes: 182, ecBytes: 22 * 5 },
  { version: 10, size: 57, dataBytes: 216, ecBytes: 26 * 5 },
];

export function generateQrMatrix(text: string): QrMatrix {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const totalLength = textBytes.length;

  // Pick suitable QR version
  const config =
    QR_CAPACITIES_M.find((c) => c.dataBytes >= totalLength + 3) ||
    QR_CAPACITIES_M[QR_CAPACITIES_M.length - 1];

  const size = config.size;
  const qr = new QrMatrix(size);
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  function setFunction(r: number, c: number, val: boolean) {
    qr.set(r, c, val);
    isFunction[r][c] = true;
  }

  // 1. Finder patterns (7x7 at top-left, top-right, bottom-left)
  function drawFinder(r: number, c: number) {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
          const isMiddle = dr >= 1 && dr <= 5 && dc >= 1 && dc <= 5;
          const isCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          const val = (isOuter && !isMiddle) || isCenter;
          setFunction(nr, nc, val);
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment patterns (for version >= 2)
  if (config.version >= 2) {
    const alignPos = size - 7;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = alignPos + dr;
        const nc = alignPos + dc;
        if (!isFunction[nr][nc]) {
          const val = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunction(nr, nc, val);
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) setFunction(6, i, i % 2 === 0);
    if (!isFunction[i][6]) setFunction(i, 6, i % 2 === 0);
  }

  // Dark module
  setFunction(size - 8, 8, true);

  // 4. Format info dummy reserve
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) setFunction(8, i, false);
    if (!isFunction[i][8]) setFunction(i, 8, false);
    if (i < 8) {
      if (!isFunction[8][size - 1 - i]) setFunction(8, size - 1 - i, false);
      if (!isFunction[size - 1 - i][8]) setFunction(size - 1 - i, 8, false);
    }
  }

  // 5. Encode Bit Stream (Byte mode: 0100 + charCount + bytes)
  const bitBuf: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitBuf.push((val >>> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(textBytes.length, 8); // Character count
  for (const b of textBytes) {
    pushBits(b, 8);
  }
  // Terminator
  for (let i = 0; i < 4 && bitBuf.length < config.dataBytes * 8; i++) {
    bitBuf.push(0);
  }
  while (bitBuf.length % 8 !== 0) {
    bitBuf.push(0);
  }

  // Pad bytes (0xEC, 0x11 alternating)
  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (bitBuf.length < config.dataBytes * 8) {
    pushBits(padPatterns[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bit stream to data bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bitBuf.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bitBuf[i + j];
    }
    dataBytes.push(b);
  }

  // 6. Error Correction
  const ecBytes = rsCompute(dataBytes, config.ecBytes);
  const allBytes = [...dataBytes, ...ecBytes];

  // 7. Place data bits in matrix (Zig-zag right to left)
  let bitIndex = 0;
  const totalBits = allBytes.length * 8;
  let up = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    for (let vert = 0; vert < size; vert++) {
      const r = up ? size - 1 - vert : vert;
      for (let c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          let bit = false;
          if (bitIndex < totalBits) {
            const byteVal = allBytes[Math.floor(bitIndex / 8)];
            const bitPos = 7 - (bitIndex % 8);
            bit = ((byteVal >>> bitPos) & 1) === 1;
            bitIndex++;
          }
          // Apply mask pattern 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          qr.set(r, c, bit !== mask);
        }
      }
    }
    up = !up;
  }

  // 8. Format Information (Level M, Mask 0: 0x5412)
  const formatInfo = 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >>> (14 - i)) & 1) === 1;
    // Top-left
    if (i <= 5) qr.set(8, i, bit);
    else if (i === 6) qr.set(8, 7, bit);
    else if (i === 7) qr.set(8, 8, bit);
    else if (i === 8) qr.set(7, 8, bit);
    else qr.set(14 - i, 8, bit);

    // Split across right/bottom
    if (i < 8) qr.set(size - 1 - i, 8, bit);
    else qr.set(8, size - 15 + i, bit);
  }

  return qr;
}

/**
 * Generate an SVG string from dynamic QR text
 */
export function generateQrSvg(
  text: string,
  options?: {
    size?: number;
    margin?: number;
    color?: string;
    bgColor?: string;
  }
): string {
  const qr = generateQrMatrix(text);
  const margin = options?.margin ?? 2;
  const pixelSize = options?.size || 140;
  const color = options?.color || "#000000";
  const bgColor = options?.bgColor || "#ffffff";

  const totalCols = qr.size + margin * 2;
  const scale = pixelSize / totalCols;

  let rects = `<rect width="${pixelSize}" height="${pixelSize}" fill="${bgColor}" />`;

  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.get(r, c)) {
        const x = (c + margin) * scale;
        const y = (r + margin) * scale;
        rects += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(scale + 0.05).toFixed(2)}" height="${(scale + 0.05).toFixed(2)}" fill="${color}" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pixelSize} ${pixelSize}" width="${pixelSize}" height="${pixelSize}">${rects}</svg>`;
}
