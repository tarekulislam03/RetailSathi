# Retail Sathi v0.2.7 - Customer Loyalty Points, Lucky Draw Tracker & Uppercase Normalization

### 🚀 Key Features & Enhancements
- **Updated Loyalty Points Formula (1 pt per ₹100)**:
  - Adjusted loyalty point accrual to **1 point for every ₹100 spent** across all sales.
  - Automatically recalculates and updates existing customer points retroactively based on their purchase history.
- **Active Points & Lifetime Points Architecture**:
  - Re-labeled total cumulative points as **Lifetime Points**.
  - Added **Active Points** tracking (`points % 10`) that resets every 10 points.
- **Interactive Lucky Draw Management**:
  - Added **Eligible Lucky Draw** counter granting 1 draw entry every time 10 points are accumulated.
  - Added interactive **Lucky Draw Used** controls in the Customer Directory with real-time `+` / `-` adjustments.
  - Automatically reconciles remaining eligible draws as `floor(Lifetime Points / 10) - Used Draws`.
- **Customer Name Uppercase Normalization**:
  - All customer names are now permanently normalized to **UPPERCASE** upon creation, editing, and POS billing.
  - Added startup migration to automatically convert all legacy customer records to uppercase.

---

# Retail Sathi v0.2.6 - Inventory Reorder Sheet & Sales Payment KPIs

### 🚀 Key Features & Enhancements
- **Low Stock Reorder List & POS Thermal Printing**:
  - Upgraded the "Manage Low Stock" feature in Inventory to an interactive **Reorder List** modal (`ReorderListModal`).
  - Cashiers and inventory managers can select low-stock or out-of-stock products, view stock levels and reorder thresholds, and customize order quantities.
  - Direct raw ESC/POS thermal printing with automatic roll width optimization (**80mm Standard** and **58mm Compact**) and device autodetect.
  - Preserves exact user selection order ("first selected, printed first") and formats items with prominent product descriptions and clear order quantities.
- **Sales Report Payment Breakdown KPIs (Cash & UPI)**:
  - Added dedicated KPI cards to the Sales History & Analytics dashboard to track **Cash Received** and **UPI Received** separately.
  - Accurate payment parsing across single-mode cash/UPI payments, split payments (`Cash: ₹...`, `UPI: ₹...`), credit/due sales, and direct payments.
  - Dynamic filter synchronization: applying date presets (Today, Yesterday, This Month) or search filters immediately updates the Cash and UPI receipt cards and status banner.

---

# Retail Sathi v0.2.5 - Checkout Review Modal & Local Device Printer Isolation

### 🚀 Key Features & Enhancements
- **Interactive "Checkout" Review Workflow**:
  - Replaced immediate bill finalization with an intuitive **"Checkout"** review modal (`CheckoutInvoiceModal`).
  - Cashiers can inspect complete customer details, item breakdowns, MRP/rates, savings, taxes, and payment splits prior to saving.
  - Added dedicated **"Save Only"** (record transaction without physical printout) and **"Print Bill"** (record transaction and print thermal receipt) actions.
  - Safe exit protection: Closing the modal with `✕` or `Cancel` keeps all cart items, quantities, and customer details completely intact without resetting or clearing data.
- **Hardware Printer Isolation (Device-Specific Local Storage)**:
  - POS thermal receipt printer, roll paper width (58mm/80mm), and barcode label printer settings are now stored strictly in each computer's local SQLite database (`device_settings`) and `localStorage`.
  - Printer hardware settings are completely isolated and excluded from cloud synchronization with Supabase, preventing multi-terminal stores from overwriting differing hardware setups across machines.
  - Robust printer fallback: Automatically detects available devices on the machine and falls back to system defaults if a previously configured printer is unplugged or offline, preventing print failures.

---

# Retail Sathi v0.2.4 - Billing Caret Lock, Cart Auto-Scroll & Last Item Highlight

### 🚀 Key Features & Enhancements
- **Billing Caret Lock & Continuous Scanner Readiness**: Ensured caret focus is continuously locked on the product search bar for zero-delay barcode scanning.
  - Cart item removals (via row "Remove" button or "Clear Cart") automatically restore caret focus to product search.
  - Quantity `+` and `-` stepper buttons prevent button focus theft on click (`onMouseDown` default suppression) and immediately refocus product search.
  - Direct quantity editing allows natural backspacing without accidentally deleting the item mid-typing.
  - Decimal rates and MRP modifications are preserved cleanly without cursor jumps, and pressing `Enter`, `Tab`, or blurring immediately returns the caret to product search.
- **Auto-Scrolling Cart List**: When cart items grow beyond the visible cart window, the container automatically and smoothly scrolls to the bottom so newly scanned and added items are always in full view.
- **Last Cart Item Highlight**: Added a subtle, clean sky-blue background highlight (`#e0f2fe`) for the entire row of the last added cart item so cashiers can instantly spot the most recently added item.

---

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
