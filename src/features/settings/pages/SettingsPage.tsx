import React, { useState, useEffect } from "react";
import {
  getActiveOrFirstStore,
  updateStore,
} from "../../stores/services/storeService";
import { Store } from "../../stores/types";
import {
  getAvailablePrinters,
  PrinterDevice,
  printReceiptEscPos,
  printBarcodeLabelEscPos,
} from "../../../services/escposService";
import {
  calibratePrinter,
  printTestLabel,
  validateLabelSettings,
  saveLabelSettingsToStorage,
  DEFAULT_LABEL_SETTINGS,
} from "../../../services/tsplService";
import { generateQrSvg, generateUpiUri } from "../../../utils/qrCodeGenerator";
import { generateCode128Svg } from "../../../utils/code128";

export const SettingsPage: React.FC = () => {
  const [store, setStore] = useState<Store | null>(null);
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  // Store Profile State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tagline, setTagline] = useState("");
  const [promoText, setPromoText] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [fssai, setFssai] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // UPI State
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [showUpiQr, setShowUpiQr] = useState(true);

  // Layout & Customization Toggles
  const [showHeader, setShowHeader] = useState(true);
  const [showCustomer, setShowCustomer] = useState(true);
  const [showSavings, setShowSavings] = useState(true);
  const [showTax, setShowTax] = useState(true);
  const [showReturnPolicy, setShowReturnPolicy] = useState(true);
  const [mandatoryBillNote, setMandatoryBillNote] = useState(true);
  const [returnPolicy, setReturnPolicy] = useState(
    "Exchange within 7 days with original bill."
  );
  const [receiptFooter, setReceiptFooter] = useState(
    "Thank you for shopping with us!\nPlease visit again!"
  );

  // Thermal POS Receipt Printer State
  const [defaultPrinter, setDefaultPrinter] = useState("");
  const [paperWidth, setPaperWidth] = useState<number>(80);
  const [showBarcode, setShowBarcode] = useState(true);

  // Barcode Label Printer (DCode DC421 Pro TSPL) State
  const [barcodePrinter, setBarcodePrinter] = useState("");
  const [labelWidth, setLabelWidth] = useState<number>(50);
  const [labelHeight, setLabelHeight] = useState<number>(25);
  const [labelColumns, setLabelColumns] = useState<number>(2);
  const [labelColumnGap, setLabelColumnGap] = useState<number>(2);
  const [labelRowGap, setLabelRowGap] = useState<number>(2);
  const [labelPadding, setLabelPadding] = useState<number>(2);
  const [labelOffsetX, setLabelOffsetX] = useState<number>(0);
  const [labelOffsetY, setLabelOffsetY] = useState<number>(0);
  const [duplicateOdd, setDuplicateOdd] = useState<boolean>(false);

  // Testing & Calibration State
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingLabelPrint, setTestingLabelPrint] = useState(false);
  const [testingPosLabelPrint, setTestingPosLabelPrint] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const [activeStore, printerList] = await Promise.all([
        getActiveOrFirstStore(),
        getAvailablePrinters(),
      ]);

      setPrinters(printerList);

      if (activeStore) {
        setStore(activeStore);
        setName(activeStore.name || "");
        setCode(activeStore.code || "");
        setTagline(activeStore.tagline || "");
        setPromoText(activeStore.promo_text || "");
        setAddress(activeStore.address || "");
        setPhone(activeStore.phone || "");
        setEmail(activeStore.email || "");
        setGstin(activeStore.gstin || "");
        setFssai(activeStore.fssai || "");
        setLogoUrl(activeStore.logo_url || "");
        setReturnPolicy(
          activeStore.return_policy || "Exchange within 7 days with original bill."
        );
        setUpiId(activeStore.upi_id || "");
        setUpiName(activeStore.upi_name || activeStore.name || "");
        setShowUpiQr(activeStore.show_upi_qr !== 0 && activeStore.show_upi_qr !== false);
        setShowHeader(activeStore.show_header !== 0 && activeStore.show_header !== false);
        setShowCustomer(activeStore.show_customer !== 0 && activeStore.show_customer !== false);
        setShowSavings(activeStore.show_savings !== 0 && activeStore.show_savings !== false);
        setShowTax(activeStore.show_tax !== 0 && activeStore.show_tax !== false);
        setShowReturnPolicy(
          activeStore.show_return_policy !== 0 && activeStore.show_return_policy !== false
        );
        setMandatoryBillNote(
          activeStore.mandatory_bill_note !== 0 && activeStore.mandatory_bill_note !== false
        );
        setDefaultPrinter(
          activeStore.default_printer ||
            (typeof localStorage !== "undefined"
              ? localStorage.getItem("selected_pos_printer") || ""
              : "")
        );
        setPaperWidth(activeStore.paper_width || 80);
        setShowBarcode(activeStore.show_barcode !== 0 && activeStore.show_barcode !== false);
        setReceiptFooter(
          activeStore.receipt_footer ||
            "Thank you for shopping with us!\nPlease visit again!"
        );

        // Barcode Label settings (DCode DC421 Pro TSPL)
        const loadedBPrinter =
          activeStore.barcode_printer ||
          (typeof localStorage !== "undefined"
            ? localStorage.getItem("selected_barcode_printer") || ""
            : "");
        const loadedW = activeStore.label_width_mm || 50;
        const loadedH = activeStore.label_height_mm || 25;
        const loadedCols = activeStore.label_columns || 2;
        const loadedColGap = activeStore.label_column_gap_mm !== undefined && activeStore.label_column_gap_mm !== null ? activeStore.label_column_gap_mm : 2;
        const loadedRowGap = activeStore.label_row_gap_mm !== undefined && activeStore.label_row_gap_mm !== null ? activeStore.label_row_gap_mm : (activeStore.label_gap_mm ?? 2);
        const loadedPadding = activeStore.label_padding_mm !== undefined && activeStore.label_padding_mm !== null ? activeStore.label_padding_mm : 2;
        const loadedOffX = activeStore.label_offset_x_dots ?? 0;
        const loadedOffY = activeStore.label_offset_y_dots ?? 0;
        const loadedDup = Boolean(activeStore.label_duplicate_odd);

        setBarcodePrinter(loadedBPrinter);
        setLabelWidth(loadedW);
        setLabelHeight(loadedH);
        setLabelColumns(loadedCols);
        setLabelColumnGap(loadedColGap);
        setLabelRowGap(loadedRowGap);
        setLabelPadding(loadedPadding);
        setLabelOffsetX(loadedOffX);
        setLabelOffsetY(loadedOffY);
        setDuplicateOdd(loadedDup);
      }
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Failed to load store settings.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setStatusMsg({ type: "error", text: "Store Name cannot be empty." });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      if (!store?.id) {
        throw new Error("No active store found to update.");
      }

      const validation = validateLabelSettings({
        labelWidthMm: labelWidth,
        labelHeightMm: labelHeight,
        columns: labelColumns,
        columnGapMm: labelColumnGap,
      });

      if (!validation.valid) {
        setStatusMsg({ type: "error", text: validation.error || "Invalid label dimensions." });
        setSaving(false);
        return;
      }

      const res = await updateStore(store.id, {
        name: name.trim(),
        code: code.trim() || null,
        tagline: tagline.trim() || null,
        promo_text: promoText.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        gstin: gstin.trim() || null,
        fssai: fssai.trim() || null,
        logo_url: logoUrl.trim() || null,
        return_policy: returnPolicy.trim() || null,
        upi_id: upiId.trim() || null,
        upi_name: upiName.trim() || name.trim(),
        show_upi_qr: showUpiQr,
        show_header: showHeader,
        show_customer: showCustomer,
        show_savings: showSavings,
        show_tax: showTax,
        show_return_policy: showReturnPolicy,
        mandatory_bill_note: mandatoryBillNote,
        default_printer: defaultPrinter || null,
        paper_width: paperWidth,
        show_barcode: showBarcode,
        receipt_footer: receiptFooter.trim() || null,
        barcode_printer: barcodePrinter || null,
        label_width_mm: labelWidth,
        label_height_mm: labelHeight,
        label_gap_mm: labelRowGap,
        label_columns: labelColumns,
        label_column_gap_mm: labelColumnGap,
        label_row_gap_mm: labelRowGap,
        label_padding_mm: labelPadding,
        label_offset_x_dots: labelOffsetX,
        label_offset_y_dots: labelOffsetY,
        label_duplicate_odd: duplicateOdd,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to save settings.");
      }

      saveLabelSettingsToStorage({
        printerName: barcodePrinter || undefined,
        labelWidthMm: labelWidth,
        labelHeightMm: labelHeight,
        columns: labelColumns,
        columnGapMm: labelColumnGap,
        rowGapMm: labelRowGap,
        paddingMm: labelPadding,
        offsetXDots: labelOffsetX,
        offsetYDots: labelOffsetY,
        duplicateOdd: duplicateOdd,
      });

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("active_store_id", String(store.id));
        if (defaultPrinter) localStorage.setItem("selected_pos_printer", defaultPrinter);
        else localStorage.removeItem("selected_pos_printer");
        localStorage.setItem("pos_paper_width", String(paperWidth));
      }

      setStatusMsg({
        type: "success",
        text: `✓ Store info & printer settings saved successfully!`,
      });

      await loadSettings();
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Failed to save settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRecalibrate() {
    setCalibrating(true);
    setStatusMsg({ type: "info", text: "Sending AUTODETECT calibration sequence to label printer..." });

    try {
      const res = await calibratePrinter(barcodePrinter || undefined);

      setStatusMsg({
        type: "success",
        text: `✓ ${res || "Printer gap/media sensor calibrated successfully!"}`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: `Calibration failed: ${err?.message || err}`,
      });
    } finally {
      setCalibrating(false);
    }
  }

  async function handleTestLabelPrint() {
    setTestingLabelPrint(true);
    setStatusMsg({ type: "info", text: "Sending test label with border box to TSPL printer..." });

    try {
      const res = await printTestLabel({
        printerName: barcodePrinter || undefined,
        labelWidthMm: labelWidth,
        labelHeightMm: labelHeight,
        columns: labelColumns,
        columnGapMm: labelColumnGap,
        rowGapMm: labelRowGap,
        paddingMm: labelPadding,
        offsetXDots: labelOffsetX,
        offsetYDots: labelOffsetY,
      });

      setStatusMsg({
        type: "success",
        text: `✓ ${res || "Test label printed successfully!"}`,
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: `Test label print failed: ${err?.message || err}`,
      });
    } finally {
      setTestingLabelPrint(false);
    }
  }

  async function handleTestLabelOnPosPrinter() {
    setTestingPosLabelPrint(true);
    setStatusMsg({ type: "info", text: "Printing test barcode label to your ESC/POS Thermal Receipt printer..." });

    try {
      const sampleItem = {
        name: "Amul Butter 500g Pack",
        barcode: "8901234567890",
        price: 260.0,
        mrp: 290.0,
        storeName: name.trim() || "Retail Sathi",
      };

      const res = await printBarcodeLabelEscPos(sampleItem, {
        printerName: defaultPrinter || undefined,
        paperWidth: paperWidth as 58 | 80,
      });

      if (res.success) {
        setStatusMsg({
          type: "success",
          text: "✓ Barcode label printed to your POS thermal printer successfully! Check print & scan quality.",
        });
      } else {
        setStatusMsg({
          type: "error",
          text: `POS label print failed: ${res.message}`,
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: `Failed to print to POS printer: ${err?.message || err}`,
      });
    } finally {
      setTestingPosLabelPrint(false);
    }
  }

  async function handleTestPrint() {
    setTestingPrint(true);
    setStatusMsg({ type: "info", text: "Sending test 80mm layout to ESC/POS printer..." });

    try {
      const testSale = {
        id: 99999,
        invoice_no: `TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        customer_name: "John Doe",
        customer_phone: "9876543210",
        total_amount: 320,
        discount: 45,
        tax_amount: 14.5,
        grand_total: 275,
        payment_mode: "Cash",
        paid_amount: 275,
        cash_paid: 275,
        due_amount: 0,
        created_at: new Date().toLocaleString(),
        items: [
          {
            product_id: 1,
            product_name: "Amul Butter Pasteurised 500g Pack",
            barcode: "8901234567890",
            price: 260,
            quantity: 1,
            mrp: 290,
            total_price: 260,
          },
          {
            product_id: 2,
            product_name: "Britannia Marie Gold 150g",
            barcode: "8901234567891",
            price: 15,
            quantity: 1,
            mrp: 30,
            total_price: 15,
          },
        ],
      };

      const res = await printReceiptEscPos(testSale, {
        printerName: defaultPrinter || undefined,
        paperWidth: paperWidth as 58 | 80,
        showBarcode: showBarcode,
        showUpiQr: showUpiQr,
        storeInfo: {
          name: name.trim() || "Retail Sathi Supermarket",
          code: code.trim() || undefined,
          tagline: tagline.trim() || undefined,
          promo_text: promoText.trim() || undefined,
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          gstin: gstin.trim() || undefined,
          fssai: fssai.trim() || undefined,
          logo_url: logoUrl.trim() || undefined,
          return_policy: returnPolicy.trim() || undefined,
          upi_id: upiId.trim() || undefined,
          upi_name: upiName.trim() || name.trim() || undefined,
          receipt_footer: receiptFooter.trim() || undefined,
          show_barcode: showBarcode,
          show_upi_qr: showUpiQr,
          show_header: showHeader,
          show_customer: showCustomer,
          show_savings: showSavings,
          show_tax: showTax,
          show_return_policy: showReturnPolicy,
          mandatory_bill_note: mandatoryBillNote,
          paper_width: paperWidth,
        },
      });

      if (res.success) {
        setStatusMsg({
          type: "success",
          text: "✓ 80mm test receipt printed successfully to the thermal printer!",
        });
      } else {
        setStatusMsg({
          type: "error",
          text: res.message || "Test print failed.",
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Failed to trigger test print.",
      });
    } finally {
      setTestingPrint(false);
    }
  }

  // Live Previews
  const sampleUpiUri = upiId.trim()
    ? generateUpiUri({
        upiId: upiId.trim(),
        payeeName: upiName.trim() || name.trim() || "Store",
        amount: 275,
        invoiceNo: "INV-PREVIEW",
      })
    : "";

  const sampleQrSvg = sampleUpiUri
    ? generateQrSvg(sampleUpiUri, { size: 110, margin: 1 })
    : "";

  const sampleBarcodeSvg = generateCode128Svg("INV-2026-0001", {
    height: 36,
    moduleWidth: 1.3,
    showText: true,
  });

  if (loading) {
    return <div className="loading">Loading store settings & printer devices...</div>;
  }

  return (
    <div
      className="settings-page-wrapper"
      style={{
        flex: 1,
        height: "100%",
        overflowY: "auto",
        padding: "20px 24px 60px 24px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: "1080px", margin: "0 auto" }}>
        <div className="page-header" style={{ marginBottom: "20px" }}>
          <div>
            <h2>Store & 80mm Thermal Receipt Settings</h2>
            <p className="hint-text">
            Configure store branding, tax details, dynamic UPI payment QR, and professional 80mm thermal layout
          </p>
        </div>
        <button
          type="button"
          className="btn secondary-btn"
          onClick={handleTestPrint}
          disabled={testingPrint}
          style={{ display: "flex", alignItems: "center", gap: "6px" }}
        >
          <span>{testingPrint ? "⏳ Printing..." : "🖨️ Test 80mm Print"}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "20px",
            fontSize: "0.95rem",
            fontWeight: 600,
            background:
              statusMsg.type === "success"
                ? "#ecfdf5"
                : statusMsg.type === "error"
                ? "#fef2f2"
                : "#eff6ff",
            color:
              statusMsg.type === "success"
                ? "#047857"
                : statusMsg.type === "error"
                ? "#b91c1c"
                : "#1d4ed8",
            border: `1px solid ${
              statusMsg.type === "success"
                ? "#a7f3d0"
                : statusMsg.type === "error"
                ? "#fecaca"
                : "#bfdbfe"
            }`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontWeight: "bold" }}
          >
            ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSaveSettings}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          {/* Section 1: Store Branding & Header */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
              🏢 Store Branding & Header
            </h3>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                Store Name *
              </label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Retail Sathi Supermarket"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div className="form-group">
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Store Tagline
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Fresh & Daily Groceries"
                />
              </div>

              <div className="form-group">
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Promo Text
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value)}
                  placeholder="e.g. Best Prices Everyday"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                Store Address
              </label>
              <textarea
                className="input-field"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Commercial Street, Market Area"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div className="form-group">
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Phone / Mobile
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div className="form-group">
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. store@retailsathi.com"
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div className="form-group">
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  GSTIN Number
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="e.g. 29AAAAA0000A1Z5"
                />
              </div>

              <div className="form-group">
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  FSSAI License No.
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={fssai}
                  onChange={(e) => setFssai(e.target.value)}
                  placeholder="e.g. 10019043000000"
                />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Store Logo (printed above store name on receipt)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Store logo preview"
                      style={{ maxHeight: "60px", maxWidth: "140px", objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "2px" }}
                    />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        // Downscale to keep stored data small
                        const img = new Image();
                        img.onload = () => {
                          const scale = Math.min(1, 400 / Math.max(img.width, img.height));
                          const c = document.createElement("canvas");
                          c.width = Math.round(img.width * scale);
                          c.height = Math.round(img.height * scale);
                          const cx = c.getContext("2d");
                          if (cx) {
                            cx.fillStyle = "#ffffff";
                            cx.fillRect(0, 0, c.width, c.height);
                            cx.drawImage(img, 0, 0, c.width, c.height);
                            setLogoUrl(c.toDataURL("image/png"));
                          } else {
                            setLogoUrl(reader.result as string);
                          }
                        };
                        img.src = reader.result as string;
                      };
                      reader.readAsDataURL(file);
                      e.target.value = "";
                    }}
                  />
                  {logoUrl && (
                    <button type="button" className="btn" onClick={() => setLogoUrl("")}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Payment & Dynamic UPI QR */}
          <div className="card" style={{ padding: "20px" }}>
            <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
              💳 Payment & Dynamic UPI QR
            </h3>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                UPI ID (VPA)
              </label>
              <input
                type="text"
                className="input-field"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. store@okhdfcbank or 9876543210@paytm"
              />
            </div>

            <div className="form-group" style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                UPI Payee / Business Name
              </label>
              <input
                type="text"
                className="input-field"
                value={upiName}
                onChange={(e) => setUpiName(e.target.value)}
                placeholder="e.g. Retail Sathi Supermarket"
              />
            </div>

            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={showUpiQr}
                  onChange={(e) => setShowUpiQr(e.target.checked)}
                />
                Print Dynamic UPI QR Code on Receipts
              </label>
            </div>

            {/* UPI QR Preview */}
            {upiId.trim() && showUpiQr && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "6px",
                  padding: "12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  DYNAMIC UPI QR PREVIEW
                </div>
                <div
                  dangerouslySetInnerHTML={{ __html: sampleQrSvg }}
                  style={{ display: "inline-block", background: "white", padding: "6px", borderRadius: "4px", border: "1px solid #e2e8f0" }}
                />
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "4px" }}>
                  Auto-generates exact payable amount for GPay, PhonePe, Paytm & BHIM
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Receipt Sections & Layout Customization */}
        <div className="card" style={{ marginTop: "20px", padding: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#0f172a", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
            ⚙️ 80mm Receipt Layout & Section Visibility
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={showHeader}
                    onChange={(e) => setShowHeader(e.target.checked)}
                  />
                  Show Store Header & Branding
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={showCustomer}
                    onChange={(e) => setShowCustomer(e.target.checked)}
                  />
                  Show Customer Details (Name, Phone)
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={showSavings}
                    onChange={(e) => setShowSavings(e.target.checked)}
                  />
                  Show Savings Banner ("*** YOU HAVE SAVED ₹X ***")
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={showTax}
                    onChange={(e) => setShowTax(e.target.checked)}
                  />
                  Show Tax Breakdown (Taxable & Inclusive GST)
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={showBarcode}
                    onChange={(e) => setShowBarcode(e.target.checked)}
                  />
                  Print Code 128 Barcode below Bill Number
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={mandatoryBillNote}
                    onChange={(e) => setMandatoryBillNote(e.target.checked)}
                  />
                  Show Mandatory Notice ("Barcode & Bill is mandatory for exchange")
                </label>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Thermal Receipt Printer
                </label>
                <select
                  className="input-field"
                  value={defaultPrinter}
                  onChange={(e) => setDefaultPrinter(e.target.value)}
                >
                  <option value="">Auto-Detect POS Printer (Default)</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.is_default ? "(System Default)" : ""} [{p.status}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Paper Width
                </label>
                <select
                  className="input-field"
                  value={paperWidth}
                  onChange={(e) => setPaperWidth(Number(e.target.value))}
                >
                  <option value={80}>80mm / 3 inch (48 Columns) - Standard Professional POS</option>
                  <option value={58}>58mm / 2 inch (32 Columns) - Compact POS</option>
                </select>
              </div>
            </div>

            <div>
              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Return / Exchange Policy
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={returnPolicy}
                  onChange={(e) => setReturnPolicy(e.target.value)}
                  placeholder="e.g. Exchange within 7 days with original bill."
                />
              </div>

              <div className="form-group" style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                  Receipt Footer Message
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Thank you for shopping with us! Please visit again."
                />
              </div>

              {/* Barcode Preview */}
              {showBarcode && (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px dashed #cbd5e1",
                    borderRadius: "6px",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                    CODE 128 INVOICE BARCODE
                  </div>
                  <div
                    dangerouslySetInnerHTML={{ __html: sampleBarcodeSvg }}
                    style={{ display: "inline-block", background: "white", padding: "4px", borderRadius: "4px" }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
            <button
              type="submit"
              className="btn primary-btn"
              disabled={saving}
              style={{ minWidth: "160px" }}
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            <button
              type="button"
              className="btn secondary-btn"
              onClick={handleTestPrint}
              disabled={testingPrint}
            >
              {testingPrint ? "⏳ Testing Print..." : "🖨️ Test 80mm Receipt"}
            </button>
          </div>
        </div>

        {/* Section 4: Label Printer (DCode DC421 Pro TSPL) */}
        <div className="card" style={{ marginTop: "20px", padding: "20px" }}>
          {(() => {
            const validation = validateLabelSettings({
              labelWidthMm: labelWidth,
              labelHeightMm: labelHeight,
              columns: labelColumns,
              columnGapMm: labelColumnGap,
            });

            return (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "10px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, color: "#0f172a" }}>
                      🏷️ Label Printer (DCode DC421 Pro TSPL)
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                      Raw TSPL byte stream via Windows spooler (RAW datatype). 203 DPI (8 dots/mm), max print width 104mm.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn secondary-btn"
                      onClick={handleRecalibrate}
                      disabled={calibrating}
                      title="Send AUTODETECT media calibration command to printer"
                      style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                    >
                      {calibrating ? "⏳ Calibrating..." : "🔄 Calibrate Media"}
                    </button>
                    <button
                      type="button"
                      className="btn secondary-btn"
                      onClick={handleTestLabelPrint}
                      disabled={testingLabelPrint || !validation.valid}
                      title="Prints a sample row with border box so alignment can be checked"
                      style={{ fontSize: "0.85rem", padding: "6px 12px", background: "#f0fdf4", borderColor: "#86efac", color: "#166534", fontWeight: 600 }}
                    >
                      {testingLabelPrint ? "⏳ Printing..." : "🖨️ Print Test Label"}
                    </button>
                  </div>
                </div>

                {!validation.valid && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      marginBottom: "16px",
                      color: "#b91c1c",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ {validation.error}
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  <div>
                    <div className="form-group" style={{ marginBottom: "14px" }}>
                      <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                        Installed Windows Printer (RAW Spooler)
                      </label>
                      <select
                        className="input-field"
                        value={barcodePrinter}
                        onChange={(e) => setBarcodePrinter(e.target.value)}
                      >
                        <option value="">Select DCode DC421 Pro or installed printer...</option>
                        {printers.map((p) => (
                          <option key={`label-p-${p.name}`} value={p.name}>
                            {p.name} {p.is_default ? "(System Default)" : ""} [{p.status}]
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
                        Select your <strong>DCode DC421 Pro</strong> (USB Windows printer).
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Single Label Width (mm)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={104}
                          className="input-field"
                          value={labelWidth}
                          onChange={(e) => setLabelWidth(Number(e.target.value))}
                          placeholder="50"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Single Label Height (mm)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={200}
                          className="input-field"
                          value={labelHeight}
                          onChange={(e) => setLabelHeight(Number(e.target.value))}
                          placeholder="25"
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Columns
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          className="input-field"
                          value={labelColumns}
                          onChange={(e) => setLabelColumns(Number(e.target.value))}
                          placeholder="2"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Column Gap (mm)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.5}
                          className="input-field"
                          value={labelColumnGap}
                          onChange={(e) => setLabelColumnGap(Number(e.target.value))}
                          placeholder="2"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Row Gap (mm)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.5}
                          className="input-field"
                          value={labelRowGap}
                          onChange={(e) => setLabelRowGap(Number(e.target.value))}
                          placeholder="2"
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Safe Padding (mm)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          className="input-field"
                          value={labelPadding}
                          onChange={(e) => setLabelPadding(Number(e.target.value))}
                          placeholder="2"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Offset X (dots)
                        </label>
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          className="input-field"
                          value={labelOffsetX}
                          onChange={(e) => setLabelOffsetX(Number(e.target.value))}
                          placeholder="0"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
                          Offset Y (dots)
                        </label>
                        <input
                          type="number"
                          min={-100}
                          max={100}
                          className="input-field"
                          value={labelOffsetY}
                          onChange={(e) => setLabelOffsetY(Number(e.target.value))}
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: "14px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={duplicateOdd}
                          onChange={(e) => setDuplicateOdd(e.target.checked)}
                        />
                        Duplicate odd item on last column instead of leaving it blank
                      </label>
                    </div>

                    <div
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #e2e8f0",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        fontSize: "0.8rem",
                        color: "#334155",
                      }}
                    >
                      <strong>📐 Roll Specs:</strong> Total Roll Width = {labelColumns} × {labelWidth}mm + {(labelColumns - 1)} × {labelColumnGap}mm = <strong>{validation.totalWidthMm.toFixed(1)}mm</strong> (Max 104mm).
                    </div>
                  </div>

                  {/* Live On-Screen Preview */}
                  <div>
                    <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>
                      Live On-Screen Preview ({labelColumns}-Column | {labelWidth}mm × {labelHeight}mm)
                    </label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${Math.min(2, labelColumns)}, 1fr)`,
                        gap: "10px",
                        background: "#f8fafc",
                        padding: "12px",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      {[1, 2].map((col) => (
                        <div
                          key={col}
                          style={{
                            background: "#ffffff",
                            border: "2px solid #334155",
                            borderRadius: "4px",
                            padding: `${labelPadding * 2}px`,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            justifyContent: "center",
                            boxSizing: "border-box",
                            width: "100%",
                            minHeight: "135px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                              width: "100%",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.88rem",
                                fontWeight: 900,
                                color: "#0f172a",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                width: "100%",
                                letterSpacing: "0.4px",
                                textAlign: "left",
                                marginBottom: "10px",
                              }}
                            >
                              {name.trim() || "RETAIL SATHI"}
                            </div>

                            <div
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 800,
                                color: "#0f172a",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                width: "100%",
                                lineHeight: "1.2",
                                textAlign: "left",
                                marginBottom: "3px",
                              }}
                            >
                              Amul Butter 500g
                            </div>

                            <div
                              dangerouslySetInnerHTML={{
                                __html: generateCode128Svg("8901234567890", {
                                  height: 36,
                                  moduleWidth: 1.6,
                                  showText: false,
                                  align: "left",
                                }),
                              }}
                              style={{ width: "100%", display: "flex", justifyContent: "flex-start", alignItems: "center", margin: "1px 0 2px 0" }}
                            />

                            <div
                              style={{
                                textAlign: "left",
                                width: "100%",
                                fontSize: "0.95rem",
                                fontWeight: 900,
                                color: "#000000",
                                letterSpacing: "0.2px",
                                marginTop: "1px",
                              }}
                            >
                              MRP Rs.290.00
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </form>
      </div>
    </div>
  );
};
