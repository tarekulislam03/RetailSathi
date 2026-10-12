import QRCode from "qrcode";

/**
 * Robust QR Code Generator (Standard ISO/IEC 18004 compliant)
 * Generates dynamic 2D QR matrices and SVG for UPI payment links & URLs.
 */

// Helper to construct standard UPI payment link compliant with NPCI specification
export function generateUpiUri(params: {
  upiId: string;
  payeeName?: string;
  amount?: number;
  invoiceNo?: string;
  note?: string;
}): string {
  let cleanUpi = (params.upiId || "").trim();
  if (cleanUpi.toLowerCase().startsWith("upi://pay")) {
    return cleanUpi;
  }
  // Remove any internal spaces
  cleanUpi = cleanUpi.replace(/\s+/g, "");

  const cleanName = (params.payeeName || "Retail Sathi").trim();
  const pn = encodeURIComponent(cleanName);
  const cu = "INR";

  // In NPCI UPI spec, 'pa' is the VPA and MUST contain the literal '@', not '%40'
  let uri = `upi://pay?pa=${cleanUpi}&pn=${pn}&cu=${cu}`;

  if (params.amount !== undefined && params.amount > 0) {
    uri += `&am=${params.amount.toFixed(2)}`;
  }

  const note = params.invoiceNo ? `Invoice ${params.invoiceNo}` : params.note || "POS Bill";
  uri += `&tn=${encodeURIComponent(note)}`;

  return uri;
}

/**
 * 2D QR Matrix data model
 */
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

/**
 * Generate standard ISO/IEC 18004 compliant QR matrix with Level M error correction
 */
export function generateQrMatrix(text: string): QrMatrix {
  const qrData = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qrData.modules.size;
  const qr = new QrMatrix(size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      qr.set(r, c, Boolean(qrData.modules.get(r, c)));
    }
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
