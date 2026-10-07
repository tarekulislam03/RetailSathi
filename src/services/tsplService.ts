import { invoke } from "@tauri-apps/api/core";
import { getActiveOrFirstStore } from "../features/stores/services/storeService";

export interface LabelSettings {
  printerName?: string;
  widthMm: number;
  heightMm: number;
  gapMm: number;
}

export interface BarcodeLabelItem {
  id?: number;
  name: string;
  barcode: string;
  price: number;
  mrp?: number;
  batch_no?: string;
  storeName?: string;
}

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  printerName: undefined,
  widthMm: 50,
  heightMm: 30,
  gapMm: 3,
};

const LABEL_PRINTER_STORAGE_KEY = "selected_barcode_printer";
const LABEL_WIDTH_STORAGE_KEY = "label_width_mm";
const LABEL_HEIGHT_STORAGE_KEY = "label_height_mm";
const LABEL_GAP_STORAGE_KEY = "label_gap_mm";

/**
 * Fetch current label printer settings from active store in SQLite,
 * with fallback to localStorage.
 */
export async function getLabelSettings(): Promise<LabelSettings> {
  try {
    const store = await getActiveOrFirstStore();
    if (store) {
      return {
        printerName:
          store.barcode_printer ||
          (typeof window !== "undefined"
            ? localStorage.getItem(LABEL_PRINTER_STORAGE_KEY) || undefined
            : undefined),
        widthMm:
          store.label_width_mm && store.label_width_mm > 0
            ? Number(store.label_width_mm)
            : Number(localStorage.getItem(LABEL_WIDTH_STORAGE_KEY)) || DEFAULT_LABEL_SETTINGS.widthMm,
        heightMm:
          store.label_height_mm && store.label_height_mm > 0
            ? Number(store.label_height_mm)
            : Number(localStorage.getItem(LABEL_HEIGHT_STORAGE_KEY)) || DEFAULT_LABEL_SETTINGS.heightMm,
        gapMm:
          store.label_gap_mm !== undefined && store.label_gap_mm !== null
            ? Number(store.label_gap_mm)
            : Number(localStorage.getItem(LABEL_GAP_STORAGE_KEY)) || DEFAULT_LABEL_SETTINGS.gapMm,
      };
    }
  } catch (err) {
    console.warn("[TSPL] Could not fetch store label settings:", err);
  }

  // Fallback to localStorage
  if (typeof window !== "undefined") {
    return {
      printerName: localStorage.getItem(LABEL_PRINTER_STORAGE_KEY) || undefined,
      widthMm: Number(localStorage.getItem(LABEL_WIDTH_STORAGE_KEY)) || DEFAULT_LABEL_SETTINGS.widthMm,
      heightMm: Number(localStorage.getItem(LABEL_HEIGHT_STORAGE_KEY)) || DEFAULT_LABEL_SETTINGS.heightMm,
      gapMm: Number(localStorage.getItem(LABEL_GAP_STORAGE_KEY)) || DEFAULT_LABEL_SETTINGS.gapMm,
    };
  }

  return DEFAULT_LABEL_SETTINGS;
}

/**
 * Save label settings to localStorage for immediate client-side availability
 */
export function saveLabelSettingsToStorage(settings: Partial<LabelSettings>) {
  if (typeof window === "undefined") return;
  if (settings.printerName !== undefined) {
    if (settings.printerName) {
      localStorage.setItem(LABEL_PRINTER_STORAGE_KEY, settings.printerName);
    } else {
      localStorage.removeItem(LABEL_PRINTER_STORAGE_KEY);
    }
  }
  if (settings.widthMm !== undefined) {
    localStorage.setItem(LABEL_WIDTH_STORAGE_KEY, String(settings.widthMm));
  }
  if (settings.heightMm !== undefined) {
    localStorage.setItem(LABEL_HEIGHT_STORAGE_KEY, String(settings.heightMm));
  }
  if (settings.gapMm !== undefined) {
    localStorage.setItem(LABEL_GAP_STORAGE_KEY, String(settings.gapMm));
  }
}

/**
 * Generates TSPL calibration command string for die-cut label stock.
 * Uses GAP not BLINE for standard gap-sensor detection.
 */
export function generateCalibrationTSPL(
  widthMm: number,
  heightMm: number,
  gapMm: number
): string {
  const safeW = Math.max(10, widthMm || 50);
  const safeH = Math.max(10, heightMm || 30);
  const safeGap = Math.max(0, gapMm !== undefined ? gapMm : 3);

  return [
    `SIZE ${safeW} mm, ${safeH} mm`,
    `GAP ${safeGap} mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `~T`,
    "",
  ].join("\r\n");
}

/**
 * Generates TSPL command sequence to print a 2-column barcode label for an item.
 * Layout: 2 Columns side-by-side across the label roll.
 * Each column includes:
 *   - Store Name (optional header if height permits)
 *   - Item Name (centered)
 *   - Code128 Barcode with human-readable numbers below (centered)
 *   - Only MRP at centre (Selling price removed)
 * Coordinates are calculated based on 203 DPI (8 dots per mm).
 */
export function generateItemLabelTSPL(
  item: BarcodeLabelItem,
  settings: LabelSettings,
  copies: number = 1
): string {
  const widthMm = Math.max(10, settings.widthMm || 50);
  const heightMm = Math.max(10, settings.heightMm || 30);
  const gapMm = Math.max(0, settings.gapMm !== undefined ? settings.gapMm : 3);
  const numCopies = Math.max(1, copies || 1);

  // 203 DPI = ~8 dots per mm
  const totalDotsW = Math.round(widthMm * 8);
  const totalDotsH = Math.round(heightMm * 8);

  // Sanitize texts to prevent TSPL syntax breaking
  const cleanStoreName = (item.storeName || "").replace(/["\r\n]/g, "").trim();
  const cleanItemName = (item.name || "Item").replace(/["\r\n]/g, "").trim();
  const cleanBarcode = (item.barcode || "").replace(/["\r\n]/g, "").trim() || "00000000";

  // Only show MRP at centre, remove selling price
  const mrpValue = item.mrp && item.mrp > 0 ? item.mrp : item.price;
  const mrpStr = `MRP: Rs. ${mrpValue.toFixed(2)}`;

  // Outer horizontal margin & center gap between columns in dots
  const outerMargin = Math.max(8, Math.round(totalDotsW * 0.02));
  const middleGap = Math.max(8, Math.round(totalDotsW * 0.03));

  const halfWidth = Math.floor(totalDotsW / 2);
  const col1Left = outerMargin;
  const col1Right = halfWidth - Math.floor(middleGap / 2);
  const col1Width = Math.max(1, col1Right - col1Left);
  const col1Center = Math.round((col1Left + col1Right) / 2);

  const col2Left = halfWidth + Math.ceil(middleGap / 2);
  const col2Right = totalDotsW - outerMargin;
  const col2Width = Math.max(1, col2Right - col2Left);
  const col2Center = Math.round((col2Left + col2Right) / 2);

  const columns = [
    { left: col1Left, right: col1Right, width: col1Width, center: col1Center },
    { left: col2Left, right: col2Right, width: col2Width, center: col2Center },
  ];

  // Dynamic layout calculations based on label height & column width
  const isSmallLabel = heightMm < 28;
  const fontForName = col1Width < 220 || isSmallLabel ? "1" : "2";
  const charWidthName = fontForName === "1" ? 8 : 12;
  const maxNameChars = Math.max(8, Math.floor((col1Width - 8) / charWidthName));
  const displayName = cleanItemName.slice(0, maxNameChars);

  // Barcode dimensions: 2-column requires narrow width = 1 to fit columns
  const barcodeHeight = isSmallLabel
    ? Math.max(26, Math.round(totalDotsH * 0.22))
    : Math.max(32, Math.min(50, Math.round(totalDotsH * 0.26)));

  const approxBcWidth = Math.min(col1Width - 4, cleanBarcode.length * 8 + 35);
  const narrowWidth = 1;
  const wideWidth = 1;

  // MRP font selection (Font "2" if space allows, otherwise Font "1")
  const fontForMrp = col1Width < 220 || isSmallLabel ? "1" : "2";
  const charWidthMrp = fontForMrp === "1" ? 8 : 12;
  const mrpWidth = mrpStr.length * charWidthMrp;

  const commands: string[] = [
    `SIZE ${widthMm} mm, ${heightMm} mm`,
    `GAP ${gapMm} mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
  ];

  // Render both columns on each row
  columns.forEach((col) => {
    let currentY = 12;

    // 1. Store Header (if height permits and store name exists)
    if (!isSmallLabel && cleanStoreName) {
      const maxStoreChars = Math.max(8, Math.floor((col.width - 8) / 8));
      const displayStore = cleanStoreName.slice(0, maxStoreChars);
      const storeX = Math.max(col.left, Math.round(col.center - (displayStore.length * 8) / 2));
      commands.push(`TEXT ${storeX},${currentY},"1",0,1,1,"${displayStore}"`);
      currentY += 18;
    }

    // 2. Product Name (centered)
    const nameX = Math.max(col.left, Math.round(col.center - (displayName.length * charWidthName) / 2));
    commands.push(`TEXT ${nameX},${currentY},"${fontForName}",0,1,1,"${displayName}"`);
    currentY += fontForName === "1" ? 18 : 24;

    // 3. Barcode (Code 128) (centered)
    const bcX = Math.max(col.left, Math.round(col.center - approxBcWidth / 2));
    commands.push(
      `BARCODE ${bcX},${currentY},"128",${barcodeHeight},1,0,${narrowWidth},${wideWidth},"${cleanBarcode}"`
    );

    // Height offset after barcode + text (human_readable=1 adds ~18 dots)
    currentY += barcodeHeight + 22;

    // 4. MRP at centre (Selling price removed)
    if (currentY < totalDotsH - 10) {
      const mrpX = Math.max(col.left, Math.round(col.center - mrpWidth / 2));
      commands.push(`TEXT ${mrpX},${currentY},"${fontForMrp}",0,1,1,"${mrpStr}"`);
    }
  });

  // Calculate rows to print: 2 columns per row
  const numRows = Math.max(1, Math.ceil(numCopies / 2));
  commands.push(`PRINT ${numRows},1`);
  commands.push("");

  return commands.join("\r\n");
}

/**
 * Sends calibration command (~T) to the target TSPL label printer.
 * Crucial for synchronizing gap sensor on stock replacement or size change.
 */
export async function calibratePrinter(
  options?: Partial<LabelSettings>
): Promise<string> {
  const currentSettings = await getLabelSettings();
  const widthMm = options?.widthMm ?? currentSettings.widthMm;
  const heightMm = options?.heightMm ?? currentSettings.heightMm;
  const gapMm = options?.gapMm ?? currentSettings.gapMm;
  const printerName = options?.printerName ?? currentSettings.printerName;

  const tspl = generateCalibrationTSPL(widthMm, heightMm, gapMm);

  console.log("[TSPL] Sending calibration sequence to printer:", printerName || "default");
  console.log("[TSPL] Calibration commands:\n", tspl);

  try {
    const res = await invoke<string>("print_raw_tspl", {
      printerName: printerName || undefined,
      tsplString: tspl,
    });
    return res || "Printer calibrated successfully.";
  } catch (err: any) {
    console.error("[TSPL] Calibration failed:", err);
    throw new Error(err?.message || String(err));
  }
}

/**
 * Prints a barcode label for a product using raw TSPL passthrough.
 */
export async function printBarcodeLabel(
  item: BarcodeLabelItem,
  copies: number = 1,
  overrideSettings?: Partial<LabelSettings>
): Promise<string> {
  if (!item.barcode || !item.barcode.trim()) {
    throw new Error(`Product "${item.name}" does not have a barcode to print.`);
  }

  const currentSettings = await getLabelSettings();
  const effectiveSettings: LabelSettings = {
    printerName: overrideSettings?.printerName ?? currentSettings.printerName,
    widthMm: overrideSettings?.widthMm ?? currentSettings.widthMm,
    heightMm: overrideSettings?.heightMm ?? currentSettings.heightMm,
    gapMm: overrideSettings?.gapMm ?? currentSettings.gapMm,
  };

  // If store name not provided, try to fetch from active store
  if (!item.storeName) {
    try {
      const store = await getActiveOrFirstStore();
      if (store?.name) {
        item.storeName = store.name;
      }
    } catch {
      // ignore
    }
  }

  const tsplString = generateItemLabelTSPL(item, effectiveSettings, copies);

  console.log(`[TSPL] Printing ${copies} label(s) for "${item.name}" on printer:`, effectiveSettings.printerName || "default");

  try {
    const res = await invoke<string>("print_raw_tspl", {
      printerName: effectiveSettings.printerName || undefined,
      tsplString: tsplString,
    });
    return res || "Label printed successfully.";
  } catch (err: any) {
    console.error("[TSPL] Printing failed:", err);
    throw new Error(err?.message || String(err));
  }
}
