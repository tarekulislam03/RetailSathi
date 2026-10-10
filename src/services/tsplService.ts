import { invoke } from "@tauri-apps/api/core";
import { getActiveOrFirstStore } from "../features/stores/services/storeService";

export interface LabelSettings {
  printerName?: string;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  columnGapMm: number;
  rowGapMm: number;
  paddingMm: number;
  offsetXDots: number;
  offsetYDots: number;
  duplicateOdd?: boolean;
}

export interface BarcodeLabelItem {
  id?: number;
  name: string;
  barcode: string;
  price?: number;
  mrp?: number;
  batch_no?: string;
  storeName?: string;
}

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  printerName: undefined,
  labelWidthMm: 50,
  labelHeightMm: 25,
  columns: 2,
  columnGapMm: 2,
  rowGapMm: 2,
  paddingMm: 2,
  offsetXDots: 0,
  offsetYDots: 0,
  duplicateOdd: false,
};

const STORAGE_KEYS = {
  printer: "selected_barcode_printer",
  width: "label_width_mm",
  height: "label_height_mm",
  columns: "label_columns",
  colGap: "label_column_gap_mm",
  rowGap: "label_row_gap_mm",
  padding: "label_padding_mm",
  offsetX: "label_offset_x_dots",
  offsetY: "label_offset_y_dots",
  duplicateOdd: "label_duplicate_odd",
};

/**
 * Validate label width constraints.
 * Total width must not exceed 104mm (DCode DC421 Pro max width).
 */
export function validateLabelSettings(settings: Partial<LabelSettings>): {
  valid: boolean;
  totalWidthMm: number;
  error?: string;
} {
  const cols = Math.max(1, settings.columns ?? DEFAULT_LABEL_SETTINGS.columns);
  const w = Math.max(10, settings.labelWidthMm ?? DEFAULT_LABEL_SETTINGS.labelWidthMm);
  const gap = Math.max(0, settings.columnGapMm ?? DEFAULT_LABEL_SETTINGS.columnGapMm);
  const totalWidthMm = cols * w + (cols - 1) * gap;

  if (totalWidthMm > 104) {
    return {
      valid: false,
      totalWidthMm,
      error: `Total print width (${totalWidthMm.toFixed(1)}mm) exceeds maximum allowed print width of 104mm for DCode DC421 Pro (${cols} cols × ${w}mm + ${(cols - 1)} gaps × ${gap}mm).`,
    };
  }

  return { valid: true, totalWidthMm };
}

/**
 * Fetch current label printer settings from active store in SQLite / localStorage.
 */
export async function getLabelSettings(): Promise<LabelSettings> {
  try {
    const store = await getActiveOrFirstStore();
    if (store) {
      return {
        printerName:
          store.barcode_printer ||
          (typeof window !== "undefined"
            ? localStorage.getItem(STORAGE_KEYS.printer) || undefined
            : undefined),
        labelWidthMm:
          store.label_width_mm && store.label_width_mm > 0
            ? Number(store.label_width_mm)
            : Number(localStorage.getItem(STORAGE_KEYS.width)) || DEFAULT_LABEL_SETTINGS.labelWidthMm,
        labelHeightMm:
          store.label_height_mm && store.label_height_mm > 0
            ? Number(store.label_height_mm)
            : Number(localStorage.getItem(STORAGE_KEYS.height)) || DEFAULT_LABEL_SETTINGS.labelHeightMm,
        columns:
          store.label_columns && store.label_columns > 0
            ? Number(store.label_columns)
            : Number(localStorage.getItem(STORAGE_KEYS.columns)) || DEFAULT_LABEL_SETTINGS.columns,
        columnGapMm:
          store.label_column_gap_mm !== undefined && store.label_column_gap_mm !== null
            ? Number(store.label_column_gap_mm)
            : Number(localStorage.getItem(STORAGE_KEYS.colGap)) || DEFAULT_LABEL_SETTINGS.columnGapMm,
        rowGapMm:
          store.label_row_gap_mm !== undefined && store.label_row_gap_mm !== null
            ? Number(store.label_row_gap_mm)
            : Number(localStorage.getItem(STORAGE_KEYS.rowGap)) || DEFAULT_LABEL_SETTINGS.rowGapMm,
        paddingMm:
          store.label_padding_mm !== undefined && store.label_padding_mm !== null
            ? Number(store.label_padding_mm)
            : Number(localStorage.getItem(STORAGE_KEYS.padding)) || DEFAULT_LABEL_SETTINGS.paddingMm,
        offsetXDots:
          store.label_offset_x_dots !== undefined && store.label_offset_x_dots !== null
            ? Number(store.label_offset_x_dots)
            : Number(localStorage.getItem(STORAGE_KEYS.offsetX)) || DEFAULT_LABEL_SETTINGS.offsetXDots,
        offsetYDots:
          store.label_offset_y_dots !== undefined && store.label_offset_y_dots !== null
            ? Number(store.label_offset_y_dots)
            : Number(localStorage.getItem(STORAGE_KEYS.offsetY)) || DEFAULT_LABEL_SETTINGS.offsetYDots,
        duplicateOdd:
          store.label_duplicate_odd !== undefined && store.label_duplicate_odd !== null
            ? Boolean(store.label_duplicate_odd)
            : localStorage.getItem(STORAGE_KEYS.duplicateOdd) === "true",
      };
    }
  } catch (err) {
    console.warn("[TSPL] Could not fetch store label settings:", err);
  }

  if (typeof window !== "undefined") {
    return {
      printerName: localStorage.getItem(STORAGE_KEYS.printer) || undefined,
      labelWidthMm: Number(localStorage.getItem(STORAGE_KEYS.width)) || DEFAULT_LABEL_SETTINGS.labelWidthMm,
      labelHeightMm: Number(localStorage.getItem(STORAGE_KEYS.height)) || DEFAULT_LABEL_SETTINGS.labelHeightMm,
      columns: Number(localStorage.getItem(STORAGE_KEYS.columns)) || DEFAULT_LABEL_SETTINGS.columns,
      columnGapMm: Number(localStorage.getItem(STORAGE_KEYS.colGap)) || DEFAULT_LABEL_SETTINGS.columnGapMm,
      rowGapMm: Number(localStorage.getItem(STORAGE_KEYS.rowGap)) || DEFAULT_LABEL_SETTINGS.rowGapMm,
      paddingMm: Number(localStorage.getItem(STORAGE_KEYS.padding)) || DEFAULT_LABEL_SETTINGS.paddingMm,
      offsetXDots: Number(localStorage.getItem(STORAGE_KEYS.offsetX)) || DEFAULT_LABEL_SETTINGS.offsetXDots,
      offsetYDots: Number(localStorage.getItem(STORAGE_KEYS.offsetY)) || DEFAULT_LABEL_SETTINGS.offsetYDots,
      duplicateOdd: localStorage.getItem(STORAGE_KEYS.duplicateOdd) === "true",
    };
  }

  return DEFAULT_LABEL_SETTINGS;
}

/**
 * Save label settings to localStorage.
 */
export function saveLabelSettingsToStorage(settings: Partial<LabelSettings>) {
  if (typeof window === "undefined") return;
  if (settings.printerName !== undefined) {
    if (settings.printerName) localStorage.setItem(STORAGE_KEYS.printer, settings.printerName);
    else localStorage.removeItem(STORAGE_KEYS.printer);
  }
  if (settings.labelWidthMm !== undefined) localStorage.setItem(STORAGE_KEYS.width, String(settings.labelWidthMm));
  if (settings.labelHeightMm !== undefined) localStorage.setItem(STORAGE_KEYS.height, String(settings.labelHeightMm));
  if (settings.columns !== undefined) localStorage.setItem(STORAGE_KEYS.columns, String(settings.columns));
  if (settings.columnGapMm !== undefined) localStorage.setItem(STORAGE_KEYS.colGap, String(settings.columnGapMm));
  if (settings.rowGapMm !== undefined) localStorage.setItem(STORAGE_KEYS.rowGap, String(settings.rowGapMm));
  if (settings.paddingMm !== undefined) localStorage.setItem(STORAGE_KEYS.padding, String(settings.paddingMm));
  if (settings.offsetXDots !== undefined) localStorage.setItem(STORAGE_KEYS.offsetX, String(settings.offsetXDots));
  if (settings.offsetYDots !== undefined) localStorage.setItem(STORAGE_KEYS.offsetY, String(settings.offsetYDots));
  if (settings.duplicateOdd !== undefined) localStorage.setItem(STORAGE_KEYS.duplicateOdd, String(settings.duplicateOdd));
}

/**
 * Sanitize text for TSPL: ASCII only, escape double quotes, strip control characters.
 */
export function sanitizeTsplText(text: string): string {
  if (!text) return "";
  // Strip control chars (ASCII 0-31, except spaces) and non-ASCII characters
  const asciiOnly = text.replace(/[^\x20-\x7E]/g, " ");
  // Escape backslashes and double quotes
  return asciiOnly.replace(/\\/g, "\\\\").replace(/"/g, '\\"').trim();
}

/**
 * Validate 13-digit EAN with checksum calculation.
 */
export function isValidEan13(code: string): boolean {
  const trimmed = (code || "").trim();
  if (!/^\d{13}$/.test(trimmed)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(trimmed.charAt(i), 10);
    // Standard EAN-13: 1st digit (index 0) weight 1, 2nd digit (index 1) weight 3, 3rd weight 1, ...
    sum += i % 2 === 0 ? digit * 1 : digit * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(trimmed.charAt(12), 10);
}

/**
 * Calculate barcode width in dots.
 * Code128 Subset B: 11 * chars + 35 modules.
 * EAN13: 95 modules (plus 7 left + 7 right quiet zones = 109 modules effectively).
 */
export function calculateBarcodeWidthDots(code: string, isEan: boolean, narrowBarWidth: number): number {
  if (isEan) {
    return 95 * narrowBarWidth;
  }
  const modules = code.length * 11 + 35;
  return modules * narrowBarWidth;
}

/**
 * Built-in TSPL font cell widths in dots:
 * font "1" = 8 dots, "2" = 12 dots, "3" = 16 dots, "4" = 24 dots, "5" = 32 dots
 */
export const FONT_CELL_WIDTHS: Record<string, { width: number; height: number }> = {
  "1": { width: 8, height: 12 },
  "2": { width: 12, height: 20 },
  "3": { width: 16, height: 24 },
  "4": { width: 24, height: 32 },
  "5": { width: 32, height: 48 },
};

/**
 * Truncate or shrink product name to fit within inner width.
 */
export function fitTextToWidth(
  text: string,
  maxWidthDots: number,
  fontKey: string = "2"
): { text: string; font: string; widthDots: number } {
  const fontInfo = FONT_CELL_WIDTHS[fontKey] || FONT_CELL_WIDTHS["1"];
  const maxChars = Math.floor(maxWidthDots / fontInfo.width);

  if (text.length <= maxChars) {
    return {
      text,
      font: fontKey,
      widthDots: text.length * fontInfo.width,
    };
  }

  // If font was "2" or higher, try falling back to font "1" (8 dots wide)
  if (fontKey !== "1") {
    const smallerMax = Math.floor(maxWidthDots / FONT_CELL_WIDTHS["1"].width);
    if (text.length <= smallerMax) {
      return {
        text,
        font: "1",
        widthDots: text.length * FONT_CELL_WIDTHS["1"].width,
      };
    }
  }

  // Otherwise truncate with ".."
  const targetFont = fontKey === "1" ? "1" : "2";
  const charW = FONT_CELL_WIDTHS[targetFont].width;
  const limit = Math.max(3, Math.floor(maxWidthDots / charW));
  const truncated = text.slice(0, Math.max(1, limit - 2)) + "..";
  return {
    text: truncated,
    font: targetFont,
    widthDots: truncated.length * charW,
  };
}

/**
 * Pure function: buildLabelRow(products, settings, options)
 * Generates TSPL command string for one row of labels.
 * Follows all TSPL job specifications, safe areas, proportional heights, and centering rules.
 */
export function buildLabelRow(
  products: (BarcodeLabelItem | null | undefined)[],
  settings: LabelSettings,
  options?: { isTestRow?: boolean }
): string {
  const widthMm = Math.max(10, settings.labelWidthMm || DEFAULT_LABEL_SETTINGS.labelWidthMm);
  const heightMm = Math.max(10, settings.labelHeightMm || DEFAULT_LABEL_SETTINGS.labelHeightMm);
  const columns = Math.max(1, settings.columns || DEFAULT_LABEL_SETTINGS.columns);
  const columnGapMm = Math.max(0, settings.columnGapMm ?? DEFAULT_LABEL_SETTINGS.columnGapMm);
  const rowGapMm = Math.max(0, settings.rowGapMm ?? DEFAULT_LABEL_SETTINGS.rowGapMm);
  const paddingMm = Math.max(0, settings.paddingMm ?? DEFAULT_LABEL_SETTINGS.paddingMm);
  const offsetXDots = settings.offsetXDots || 0;
  const offsetYDots = settings.offsetYDots || 0;

  const totalWidthMm = columns * widthMm + (columns - 1) * columnGapMm;

  // Dots conversion: 203 DPI = 8 dots/mm
  const labelWidthDots = Math.round(widthMm * 8);
  const labelHeightDots = Math.round(heightMm * 8);
  const paddingDots = Math.round(paddingMm * 8);
  const innerWidthDots = Math.max(16, labelWidthDots - 2 * paddingDots);
  const innerHeightDots = Math.max(16, labelHeightDots - 2 * paddingDots);

  const lines: string[] = [
    `SIZE ${totalWidthMm.toFixed(1)} mm,${heightMm.toFixed(1)} mm`,
    `GAP ${rowGapMm.toFixed(1)} mm,0 mm`,
    `DIRECTION 1`,
    `REFERENCE 0,0`,
    `CLS`,
  ];

  for (let colIdx = 0; colIdx < columns; colIdx++) {
    const colX = Math.round(
      colIdx * (widthMm + columnGapMm) * 8 + offsetXDots
    );
    const colY = offsetYDots;

    // Draw border box if test label row
    if (options?.isTestRow) {
      // Draw outer label box and inner safe box
      const boxX = colX + paddingDots;
      const boxY = colY + paddingDots;
      const boxEndX = boxX + innerWidthDots;
      const boxEndY = boxY + innerHeightDots;
      lines.push(`BOX ${boxX},${boxY},${boxEndX},${boxEndY},2`);
    }

    const item = products[colIdx];
    if (!item) continue; // Empty label slot

    const storeName = sanitizeTsplText(item.storeName || "");
    const prodName = sanitizeTsplText(item.name || "Item");
    const barcodeRaw = (item.barcode || "").trim();
    const mrpValue = item.mrp && item.mrp > 0 ? item.mrp : item.price || 0;
    const mrpStr = `MRP Rs.${mrpValue.toFixed(2)}`;

    // 1. Font selections and widths
    const storeFontKey = innerHeightDots >= 140 ? "3" : "2";
    const fittedStore = storeName ? fitTextToWidth(storeName, innerWidthDots, storeFontKey) : null;

    const prodFontKey = innerHeightDots < 120 ? "1" : "2";
    const fittedName = fitTextToWidth(prodName, innerWidthDots, prodFontKey);

    const mrpFontKey = innerHeightDots < 100 ? "1" : "2";
    const fittedMrp = fitTextToWidth(mrpStr, innerWidthDots, mrpFontKey);
    const mrpFontH = FONT_CELL_WIDTHS[mrpFontKey].height;

    // 2. Barcode calculation (widen barcode to fill width cleanly without overflowing)
    const isEan = isValidEan13(barcodeRaw);
    const barcodeType = isEan ? "EAN13" : "128";
    const humanReadableReservedDots = 18;

    // Try 3 dots first to widen barcode and fill empty space, fallback to 2 or 1 if needed
    let narrowBar = 2;
    if (calculateBarcodeWidthDots(barcodeRaw, isEan, 3) <= innerWidthDots) {
      narrowBar = 3;
    } else if (calculateBarcodeWidthDots(barcodeRaw, isEan, 2) <= innerWidthDots) {
      narrowBar = 2;
    } else {
      narrowBar = 1;
    }
    const wideBar = narrowBar;
    const bcWidthDots = calculateBarcodeWidthDots(barcodeRaw, isEan, narrowBar);

    // 3. Left-aligned origin within the label safe area
    const startX = colX + paddingDots;

    // 4. Vertical layout calculation (without barcode numbers below bars)
    const storeH = fittedStore ? FONT_CELL_WIDTHS[fittedStore.font].height : 0;
    const gapStoreToName = fittedStore ? 16 : 0; // Distinct margin below store name to separate from product info (~2mm)
    const prodH = FONT_CELL_WIDTHS[fittedName.font].height;
    const gapNameToBarcode = 6;
    const gapBarcodeToMrp = 5; // Tight gap between barcode and MRP

    // Barcode height (without human-readable text)
    const usedNonBarcodeH = storeH + gapStoreToName + prodH + gapNameToBarcode + gapBarcodeToMrp + mrpFontH;
    const barcodeH = Math.max(26, Math.min(65, innerHeightDots - usedNonBarcodeH));

    const totalContentH = usedNonBarcodeH + barcodeH;
    // Vertically center the label content block in the inner safe area
    let currentY = colY + paddingDots + Math.max(0, Math.round((innerHeightDots - totalContentH) / 2));

    // 1. Store Name (bold and left-aligned)
    if (fittedStore) {
      lines.push(`TEXT ${startX},${currentY},"${fittedStore.font}",0,1,1,"${fittedStore.text}"`);
      currentY += storeH + gapStoreToName;
    }

    // 2. Product Name (strictly left-aligned)
    lines.push(`TEXT ${startX},${currentY},"${fittedName.font}",0,1,1,"${fittedName.text}"`);
    currentY += prodH + gapNameToBarcode;

    // 3. Barcode (strictly left-aligned, barcode bars only without human-readable number: human_readable = 0)
    const bcY = currentY;
    lines.push(
      `BARCODE ${startX},${bcY},"${barcodeType}",${barcodeH},0,0,${narrowBar},${wideBar},"${barcodeRaw}"`
    );
    currentY += barcodeH + gapBarcodeToMrp;

    // 4. MRP (strictly left-aligned, directly below barcode bars)
    lines.push(`TEXT ${startX},${currentY},"${fittedMrp.font}",0,1,1,"${fittedMrp.text}"`);
  }

  lines.push("PRINT 1,1");
  lines.push("");

  return lines.join("\r\n");
}

/**
 * Builds TSPL batch string for printing N labels across columns.
 */
export function buildLabelJob(
  itemsWithQuantities: { item: BarcodeLabelItem; quantity: number }[],
  settings: LabelSettings
): string {
  const columns = Math.max(1, settings.columns || DEFAULT_LABEL_SETTINGS.columns);
  const flattened: BarcodeLabelItem[] = [];

  for (const entry of itemsWithQuantities) {
    const qty = Math.max(1, entry.quantity || 1);
    for (let i = 0; i < qty; i++) {
      flattened.push(entry.item);
    }
  }

  const jobChunks: string[] = [];
  const totalItems = flattened.length;
  let idx = 0;

  while (idx < totalItems) {
    const rowItems: (BarcodeLabelItem | null)[] = [];
    for (let c = 0; c < columns; c++) {
      if (idx < totalItems) {
        rowItems.push(flattened[idx]);
        idx++;
      } else if (settings.duplicateOdd && rowItems.length > 0) {
        // Option to duplicate odd item on last label
        rowItems.push(rowItems[rowItems.length - 1]);
      } else {
        rowItems.push(null);
      }
    }
    jobChunks.push(buildLabelRow(rowItems, settings));
  }

  return jobChunks.join("");
}

/**
 * Generate test label TSPL row with border box for alignment check.
 */
export function generateTestLabelTSPL(
  settings: LabelSettings,
  storeName: string = "STORE NAME"
): string {
  const columns = Math.max(1, settings.columns || DEFAULT_LABEL_SETTINGS.columns);
  const sampleItems: BarcodeLabelItem[] = [];

  for (let c = 0; c < columns; c++) {
    sampleItems.push({
      name: "TEST PRODUCT",
      barcode: c % 2 === 0 ? "8901030383701" : "TEST123456",
      price: 80,
      mrp: 80,
      storeName,
    });
  }

  return buildLabelRow(sampleItems, settings, { isTestRow: true });
}

/**
 * Generates TSPL AUTODETECT media calibration command string.
 */
export function generateCalibrationTSPL(): string {
  return [
    "AUTODETECT",
    "",
  ].join("\r\n");
}

/**
 * Sends media calibration command to the printer.
 */
export async function calibratePrinter(printerName?: string): Promise<string> {
  const settings = await getLabelSettings();
  const targetPrinter = printerName || settings.printerName || "";
  const tsplCmd = generateCalibrationTSPL();
  const bytes = new TextEncoder().encode(tsplCmd);

  return await invoke<string>("print_raw", {
    printerName: targetPrinter,
    data: Array.from(bytes),
  });
}

/**
 * Print TSPL test label.
 */
export async function printTestLabel(
  overrideSettings?: Partial<LabelSettings>
): Promise<string> {
  const current = await getLabelSettings();
  const effective: LabelSettings = { ...current, ...overrideSettings };
  const store = await getActiveOrFirstStore().catch(() => null);
  const tspl = generateTestLabelTSPL(effective, store?.name || "RETAIL SATHI");
  const bytes = new TextEncoder().encode(tspl);

  return await invoke<string>("print_raw", {
    printerName: effective.printerName || "",
    data: Array.from(bytes),
  });
}

/**
 * Print a batch of barcode labels using RAW TSPL commands via Windows spooler.
 */
export async function printBarcodeLabels(
  itemsWithQuantities: { item: BarcodeLabelItem; quantity: number }[],
  overrideSettings?: Partial<LabelSettings>
): Promise<string> {
  if (!itemsWithQuantities || itemsWithQuantities.length === 0) {
    throw new Error("No products selected for label printing.");
  }

  const current = await getLabelSettings();
  const effective: LabelSettings = { ...current, ...overrideSettings };

  const validation = validateLabelSettings(effective);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const store = await getActiveOrFirstStore().catch(() => null);
  const itemsWithStore = itemsWithQuantities.map((e) => ({
    ...e,
    item: {
      ...e.item,
      storeName: e.item.storeName || store?.name || "",
    },
  }));

  const tspl = buildLabelJob(itemsWithStore, effective);
  const bytes = new TextEncoder().encode(tspl);

  return await invoke<string>("print_raw", {
    printerName: effective.printerName || "",
    data: Array.from(bytes),
  });
}

/**
 * Single item wrapper for backwards compatibility with modal.
 */
export async function printBarcodeLabel(
  item: BarcodeLabelItem,
  copies: number = 1,
  overrideSettings?: Partial<LabelSettings>
): Promise<string> {
  return await printBarcodeLabels(
    [{ item, quantity: Math.max(1, copies) }],
    overrideSettings
  );
}
