# Retail Sathi v0.2.3 - Day-Wise Sales & Profit Reports, Real Profit Sync & Label MRP Refinements

### 🚀 Key Features & Enhancements
- **Day-Wise Sales & Profitability Ledger**: Added a dedicated Day-Wise view in the Manage Sales & Profit Reports modal. Cashiers and store owners can now toggle between Monthly and Day-Wise views, view sales, costs, discounts, and margins for each day, or drill into any month with one-click "Days ➔".
- **Real Monthly Profit Synchronization**: Realigned dashboard "Monthly Profit" calculation with the Manage Sales & Profit ledger to ensure numbers always match identically.
- **Sale Items Deduplication & Cost Protection**: Added multi-layer safeguards in the sync engine and sales service to prevent duplicated line items from inflating cost calculations.
- **Product Label MRP Font Optimization**: Increased MRP font size and weight on product labels and print templates for improved scan readability and clarity.

---

# Retail Sathi v0.2.2 - Hold & Resume Bills, Scannable EAN-13 Barcodes & Checkout Click Protection

### 🚀 Key Features & Enhancements
- **Hold & Resume Bill (Cart Parking)**: Cashiers can park in-progress bills with `F6` or the "Hold Bill" button to quickly serve other customers. Parked carts persist across page changes, reloads, and sessions. Access the parked bills manager anytime with `F7` or the "Held Bills" badge button with one-click Resume, item inspection, and Discard actions.
- **Scannable EAN-13 Invoice Barcodes**: Upgraded receipt invoice barcodes to ISO/IEC 15420 compliant EAN-13 on 80mm & 58mm thermal rolls and on-screen invoice summaries. Eliminates thermal ink bleed and ensures instant 100% first-pass reads on standard retail laser and image scanners.
- **Strict Double-Click & Rapid-Scan Protection**: Hardened the Complete Sale button with synchronous locks, click-suppression, and disabled pointer-events to strictly accept a single click and prevent duplicate sales. Barcode scanner rapid newline bounces are also throttled.
- **Print Bill & Invoice Summary Modal Backdrop Lock**: Disabled background clicks on the Print Bill / Invoice Summary modal to prevent accidental dismissals. The modal can now only be closed via the explicit `✕` cross button or `Close` button.
- **Windows 7 Aero Return Modal**: Aligned the Sales Return modal (`F4`) with the signature Windows 7 Aero glass UI styling, including smooth translucency, refined borders, and consistent typography.

---
*Retail Sathi Automatic Online Update System*
