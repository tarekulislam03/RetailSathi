/**
 * EAN-13 Barcode Encoder & Utility
 * Generates ISO/IEC 15420 compliant EAN-13 barcodes.
 * Total width: exactly 95 modules (3 start + 42 left + 5 center + 42 right + 3 stop).
 */

const L_CODE: string[] = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011"
];

const G_CODE: string[] = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111"
];

const R_CODE: string[] = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100"
];

const PARITY_MAP: string[] = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
];

/**
 * Calculates standard EAN-13 modulo-10 check digit for a 12-digit string.
 */
export function calculateEan13CheckDigit(digits12: string): string {
  const clean = digits12.replace(/\D/g, "").slice(0, 12).padStart(12, "0");
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const check = (10 - (sum % 10)) % 10;
  return String(check);
}

/**
 * Converts any invoice number (e.g. INV-20261014-232139-704 or numeric)
 * into a clean, deterministic 13-digit EAN-13 code.
 */
export function invoiceToEan13(invoiceNo: string, fallbackId?: number): string {
  if (!invoiceNo) {
    const idStr = String(fallbackId || 1).padStart(12, "0").slice(-12);
    return idStr + calculateEan13CheckDigit(idStr);
  }

  const str = invoiceNo.trim();

  // If already exactly 13 digits, verify/calculate check digit
  if (/^\d{13}$/.test(str)) {
    return str.slice(0, 12) + calculateEan13CheckDigit(str.slice(0, 12));
  }

  // If standard invoice pattern: INV-YYYYMMDD-HHMMSS-RAND
  // E.g. INV-20261014-232139-704 -> YYMMDDHHMMSS = 261014232139 (12 digits)
  const invMatch = str.match(/^INV-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/i);
  if (invMatch) {
    const [, yyyy, mm, dd, hh, min, ss] = invMatch;
    const yy = yyyy.slice(2);
    const base12 = `${yy}${mm}${dd}${hh}${min}${ss}`;
    return base12 + calculateEan13CheckDigit(base12);
  }

  // Extract all digits from string
  const digitsOnly = str.replace(/\D/g, "");
  if (digitsOnly.length >= 12) {
    const base12 = digitsOnly.slice(0, 12);
    return base12 + calculateEan13CheckDigit(base12);
  } else if (digitsOnly.length > 0) {
    // Pad to 12 digits
    const base12 = digitsOnly.padStart(12, "0");
    return base12 + calculateEan13CheckDigit(base12);
  }

  // Fallback: simple numeric hash of string
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) >>> 0;
  }
  const base12 = String(hash).padStart(12, "0").slice(-12);
  return base12 + calculateEan13CheckDigit(base12);
}

/**
 * Encodes a 12 or 13-digit string into 95 boolean modules (true = bar, false = space).
 */
export function encodeEan13(input: string): { modules: boolean[]; digits: string } {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12) {
    digits += calculateEan13CheckDigit(digits);
  } else if (digits.length !== 13) {
    digits = invoiceToEan13(input);
  } else {
    // Recalculate checksum to guarantee validity
    digits = digits.slice(0, 12) + calculateEan13CheckDigit(digits.slice(0, 12));
  }

  const firstDigit = parseInt(digits[0], 10);
  const parityPattern = PARITY_MAP[firstDigit];
  const modules: boolean[] = [];

  // 1. Normal guard pattern: 101
  modules.push(true, false, true);

  // 2. Left 6 digits (digits 2 to 7)
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(digits[i + 1], 10);
    const pattern = parityPattern[i] === "L" ? L_CODE[digit] : G_CODE[digit];
    for (let c = 0; c < pattern.length; c++) {
      modules.push(pattern[c] === "1");
    }
  }

  // 3. Center guard pattern: 01010
  modules.push(false, true, false, true, false);

  // 4. Right 6 digits (digits 8 to 13)
  for (let i = 0; i < 6; i++) {
    const digit = parseInt(digits[i + 7], 10);
    const pattern = R_CODE[digit];
    for (let c = 0; c < pattern.length; c++) {
      modules.push(pattern[c] === "1");
    }
  }

  // 5. End guard pattern: 101
  modules.push(true, false, true);

  return { modules, digits };
}

/**
 * Generate an SVG string for an EAN-13 barcode.
 */
export function generateEan13Svg(
  code: string,
  options?: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    fontSize?: number;
    align?: "left" | "center";
  }
): string {
  const height = options?.height || 48;
  const moduleWidth = options?.moduleWidth || 1.8;
  const showText = options?.showText ?? true;
  const fontSize = options?.fontSize || 12;
  const align = options?.align || "center";

  const { modules, digits } = encodeEan13(code);
  if (modules.length === 0) return "";

  const totalWidth = modules.length * moduleWidth;
  const totalHeight = showText ? height + fontSize + 4 : height;

  let rects = "";
  let barStart = -1;

  for (let i = 0; i <= modules.length; i++) {
    const isBar = i < modules.length ? modules[i] : false;
    if (isBar && barStart === -1) {
      barStart = i;
    } else if (!isBar && barStart !== -1) {
      const x = barStart * moduleWidth;
      const w = (i - barStart) * moduleWidth;
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${w.toFixed(2)}" height="${height}" fill="#000000" />`;
      barStart = -1;
    }
  }

  let textElement = "";
  if (showText) {
    // Standard EAN-13 human readable format: d1  d2 d3 d4 d5 d6 d7  d8 d9 d10 d11 d12 d13
    const formattedDigits = `${digits[0]} ${digits.slice(1, 7)} ${digits.slice(7)}`;
    const textX = align === "center" ? (totalWidth / 2).toFixed(2) : "0";
    const anchor = align === "center" ? "middle" : "start";
    textElement = `<text x="${textX}" y="${(height + fontSize).toFixed(2)}" text-anchor="${anchor}" font-family="monospace" font-size="${fontSize}px" font-weight="700" letter-spacing="1.5px" fill="#000000">${formattedDigits}</text>`;
  }

  const svgStyle =
    align === "center"
      ? "max-width: 90%; height: auto; display: block; margin: 0 auto;"
      : "max-width: 95%; height: auto; display: block; margin: 0 0;";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" height="${totalHeight.toFixed(2)}" preserveAspectRatio="none" style="${svgStyle}">${rects}${textElement}</svg>`;
}
