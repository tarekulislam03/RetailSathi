/**
 * Code 128 Barcode Generator (Type B - Standard ASCII)
 * Generates clean SVG representation of Code 128 barcodes.
 */

// Code 128 encoding patterns (bars & spaces width representation)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP pattern)
];

const START_B = 104;
const STOP = 106;

export function encodeCode128(text: string): { modules: boolean[]; text: string } {
  if (!text) return { modules: [], text: "" };

  const values: number[] = [START_B];
  let checkSum = START_B;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Standard ASCII range 32-127 mapped to 0-95
    const val = code >= 32 && code <= 126 ? code - 32 : 0;
    values.push(val);
    checkSum += val * (i + 1);
  }

  values.push(checkSum % 103);
  values.push(STOP);

  // Convert pattern digits to boolean modules (true = bar, false = space)
  const modules: boolean[] = [];
  for (const val of values) {
    const pattern = CODE128_PATTERNS[val] || CODE128_PATTERNS[0];
    let isBar = true;
    for (let i = 0; i < pattern.length; i++) {
      const width = parseInt(pattern[i], 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar);
      }
      isBar = !isBar;
    }
  }

  return { modules, text };
}

/**
 * Generate an SVG string for a Code 128 barcode
 */
export function generateCode128Svg(
  text: string,
  options?: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    fontSize?: number;
  }
): string {
  const height = options?.height || 45;
  const moduleWidth = options?.moduleWidth || 1.6;
  const showText = options?.showText ?? true;
  const fontSize = options?.fontSize || 11;

  const { modules } = encodeCode128(text);
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
    textElement = `<text x="${(totalWidth / 2).toFixed(2)}" y="${(height + fontSize).toFixed(2)}" text-anchor="middle" font-family="monospace" font-size="${fontSize}px" font-weight="600" fill="#000000">${text}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}" width="${totalWidth.toFixed(2)}" height="${totalHeight.toFixed(2)}">${rects}${textElement}</svg>`;
}
