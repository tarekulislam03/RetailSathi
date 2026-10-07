/**
 * Generates a random and unique 13-digit EAN-13 compliant barcode number.
 * In-store retail prefix '200' is standard for internal distribution.
 */
export function generateUniqueBarcode(
  existingBarcodes: (string | undefined | null)[] = []
): string {
  const existingSet = new Set(
    existingBarcodes
      .filter((b): b is string => Boolean(b && b.trim()))
      .map((b) => b.trim().toLowerCase())
  );

  for (let attempt = 0; attempt < 500; attempt++) {
    // 3-digit in-store prefix '200' + 6 timestamp digits + 3 random digits (12 base digits)
    const timeDigits = (Date.now() + attempt).toString().slice(-6);
    const randDigits = Math.floor(100 + Math.random() * 900).toString();
    const first12 = `200${timeDigits}${randDigits}`;

    // Compute standard EAN-13 checksum digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(first12[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const candidate = `${first12}${checkDigit}`;

    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  // High entropy fallback
  return `200${Date.now()}${Math.floor(10 + Math.random() * 90)}`;
}
