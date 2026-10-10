import { describe, it, expect } from "vitest";
import {
  buildLabelRow,
  buildLabelJob,
  isValidEan13,
  validateLabelSettings,
  sanitizeTsplText,
  DEFAULT_LABEL_SETTINGS,
  LabelSettings,
} from "../services/tsplService";

describe("TSPL Label Generator for DCode DC421 Pro", () => {
  const testSettings: LabelSettings = {
    ...DEFAULT_LABEL_SETTINGS,
    labelWidthMm: 50,
    labelHeightMm: 25,
    columns: 2,
    columnGapMm: 2,
    rowGapMm: 2,
    paddingMm: 2,
  };

  it("should validate dimensions under 104mm max print width", () => {
    // 2 * 50 + 2 = 102mm <= 104mm
    const res = validateLabelSettings(testSettings);
    expect(res.valid).toBe(true);
    expect(res.totalWidthMm).toBe(102);

    // 2 * 60 + 2 = 122mm > 104mm
    const invalidRes = validateLabelSettings({ ...testSettings, labelWidthMm: 60 });
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.error).toContain("exceeds maximum allowed print width of 104mm");
  });

  it("should correctly identify valid 13-digit EAN numbers", () => {
    expect(isValidEan13("8901450001246")).toBe(true);
    expect(isValidEan13("8902080003075")).toBe(true);
    expect(isValidEan13("8901450001247")).toBe(false); // Invalid check digit
    expect(isValidEan13("123456")).toBe(false); // Too short
    expect(isValidEan13("TEST123456789")).toBe(false); // Non-digit
  });

  it("should sanitize text for TSPL syntax safety", () => {
    expect(sanitizeTsplText('Parle "G" 100g \r\n\t')).toBe('Parle \\"G\\" 100g');
    expect(sanitizeTsplText("Price ₹50")).toBe("Price  50"); // non-ASCII stripped to space
  });

  it("should generate valid TSPL commands for 2-column row with Code128", () => {
    const products = [
      {
        name: "Tata Salt 1kg",
        barcode: "TATASALT1KG",
        price: 28,
        mrp: 30,
        storeName: "RETAIL SATHI",
      },
      {
        name: "Aashirvaad Atta 5kg",
        barcode: "ATTA5KG",
        price: 250,
        mrp: 275,
        storeName: "RETAIL SATHI",
      },
    ];

    const tspl = buildLabelRow(products, testSettings);

    expect(tspl).toContain("SIZE 102.0 mm,25.0 mm");
    expect(tspl).toContain("GAP 2.0 mm,0 mm");
    expect(tspl).toContain("DIRECTION 1");
    expect(tspl).toContain("REFERENCE 0,0");
    expect(tspl).toContain("CLS");
    expect(tspl).toContain('BARCODE');
    expect(tspl).toContain('"128"');
    expect(tspl).toContain("MRP Rs.30.00");
    expect(tspl).toContain("MRP Rs.275.00");
    expect(tspl).toContain("PRINT 1,1");
    expect(tspl.endsWith("\r\n")).toBe(true);
  });

  it("should handle 13-digit EAN barcode type", () => {
    const products = [
      {
        name: "Denver Deodorant 150ml",
        barcode: "8901450001246",
        price: 199,
        mrp: 210,
      },
      null,
    ];

    const tspl = buildLabelRow(products, testSettings);

    expect(tspl).toContain('"EAN13"');
    expect(tspl).toContain('"8901450001246"');
  });

  it("should truncate very long product names with .. to fit safe area", () => {
    const products = [
      {
        name: "Super Deluxe Extra Long Grain Premium Basmati Biryani Rice 5kg Pack",
        barcode: "RICE5KG",
        price: 450,
        mrp: 500,
      },
    ];

    const tspl = buildLabelRow(products, testSettings);
    expect(tspl).toContain("..");
  });

  it("should handle odd quantities and leave last label empty or duplicated as per setting", () => {
    const items = [
      {
        item: {
          name: "Amul Butter 100g",
          barcode: "BUTTER100",
          price: 56,
          mrp: 60,
        },
        quantity: 3, // Odd quantity: requires 2 rows (3 labels)
      },
    ];

    // Default: leave last label empty
    const tsplOddEmpty = buildLabelJob(items, { ...testSettings, duplicateOdd: false });
    const printMatches = tsplOddEmpty.match(/PRINT 1,1/g);
    expect(printMatches?.length).toBe(2); // 2 rows printed
    const barcodeMatches = tsplOddEmpty.match(/BARCODE/g);
    expect(barcodeMatches?.length).toBe(3); // Exactly 3 labels printed

    // Duplicate odd: duplicates the 3rd label on the 4th position
    const tsplOddDup = buildLabelJob(items, { ...testSettings, duplicateOdd: true });
    const barcodeMatchesDup = tsplOddDup.match(/BARCODE/g);
    expect(barcodeMatchesDup?.length).toBe(4); // 4 labels printed
  });
});
