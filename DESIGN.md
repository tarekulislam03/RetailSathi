# Retail Sathi — Windows 7 Aero Classic Design System Specification

## 1. Overview & Aesthetics Goal
**Retail Sathi** follows a **Windows 7 Aero Classic Desktop** theme engineered specifically for desktop POS (Point of Sale), inventory, and retail management. 

Key design objectives:
- **High-Density Desktop Layout**: Maximizes screen real estate on desktop screens without unnecessary whitespace or excessive padding gaps between adjacent panels.
- **Crisp Border Line Separators**: Uses explicit steel blue (`#7092be`) 1px border lines to divide panels, sidebars, cards, and tables instead of rounded floating cards with wide gap margins.
- **Glassy & Glossy Gradients**: Employs authentic 2-stage Windows 7 vertical linear gradients for primary buttons, window titlebars, navigation items, and table headers.
- **Indian Rupee Formatting**: Standardized currency formatting (`₹0.00`) across all transaction totals, prices, and stats.

---

## 2. Color System & Design Tokens

```css
:root {
  /* Core Backgrounds */
  --w7-bg: #d9e4f1;
  --w7-window-bg: #ffffff;
  --w7-panel-bg: #f0f4f9;
  
  /* Borders */
  --w7-border: #7092be;
  --w7-border-light: #b9cde5;
  --w7-border-dark: #1a5695;
  
  /* Typography */
  --w7-text: #000000;
  --w7-text-headers: #103c6b;
  --w7-text-title: #154273;
  --w7-text-muted: #4d5c6d;
  
  /* Gradients */
  --w7-primary-grad: linear-gradient(to bottom, #3988e3 0%, #2976d3 49%, #1b64be 50%, #1555a6 100%);
  --w7-primary-hover: linear-gradient(to bottom, #509bf5 0%, #3e87e4 49%, #2e75cf 50%, #2064b8 100%);
  
  --w7-btn-grad: linear-gradient(to bottom, #f2f7fc 0%, #e1edfd 49%, #d0e3fc 50%, #e6f1fe 100%);
  --w7-btn-hover: linear-gradient(to bottom, #fdfefe 0%, #eef5fe 49%, #dbeafd 50%, #edf5fe 100%);
  --w7-btn-active: linear-gradient(to bottom, #d0e0f5 0%, #c4d9f3 100%);
  
  --w7-header-grad: linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, rgba(220,233,247,0.9) 100%);
  --w7-modal-header-grad: linear-gradient(to bottom, #dbe9f9 0%, #b8d4f4 49%, #9dc3ed 50%, #bce0fd 100%);
  --w7-sidebar-active: linear-gradient(to bottom, #dce9f8 0%, #b8d4f4 49%, #a2c8f0 50%, #c4defe 100%);
  --w7-table-th: linear-gradient(to bottom, #f7f9fc 0%, #e4ecf5 49%, #d2e1f2 50%, #e5eff9 100%);
  --w7-table-hover: linear-gradient(to bottom, #edf5fe 0%, #d2e4fc 100%);
  
  --radius: 0px;
}
```

---

## 3. Typography & Text Hierarchy
- **Font Family**: `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif`
- **Application Title**: `1.4rem`, bold (`700`), color `#154273`, white text drop shadow.
- **Section Headers (h2)**: `1.05rem`, bold (`700`), color `#103c6b`.
- **Card Subheaders (h3)**: `0.92rem` - `0.95rem`, bold (`700`), color `#103c6b`.
- **Base Body Text**: `0.88rem`, line height `1.4`.
- **Tags & Barcodes**: `0.85rem`, monospace, styled with `#f0f4f8` background and `#7092be` border.

---

## 4. UI Components & Patterns

### 4.1 Header Banner (`.header`)
- Full width top bar containing company logo, app title, subtitle, and a real-time digital clock/date gadget.
- Glassy translucent blue background (`--w7-header-grad`) with a bottom `#7092be` border line.

### 4.2 Left Navigation Pane (`.sidebar`)
- Fixed width (`180px`), vertical navigation pane with direct links to feature pages.
- Active tab uses `--w7-sidebar-active` glossy gradient with dark blue border `#1d579c`.

### 4.3 POS / Billing Layout (`.pos-layout`)
- Split screen workspace:
  - **Left Section (`.pos-left`)**: Taller Search Bar card at top + Full height Order Items Cart table.
  - **Right Section (`.pos-right`)**: Summary & Checkout panel (Customer details, Discount, Tax, Payment method radio buttons, and Grand Total).
- Zero gaps between sections; separated by solid `#7092be` vertical and horizontal borders.

### 4.4 Data Tables (`.product-table`)
- High-contrast, dense data grid layout.
- Headers (`<thead>`): Glassy gray-blue gradient (`--w7-table-th`), bold text, 1px right border.
- Alternating/Hover rows: Highlighted with soft blue gradient (`--w7-table-hover`) on cursor hover.
- Badges & Tags: Barcode tags (`.barcode-tag`), price tags (`.price-tag`), stock level indicators.

### 4.5 Modals & Dialog Windows (`.modal-backdrop` & `.modal-content`)
- **Backdrop**: Semi-transparent dark overlay (`rgba(10, 25, 45, 0.45)`) with a light backdrop blur (`backdrop-filter: blur(2px)`).
- **Dialog Window**: Container with `#f0f4f9` background, solid `#1a5695` border, and subtle drop shadow (`0 8px 24px rgba(0,0,0,0.4)`).
- **Header**: Glassy titlebar (`--w7-modal-header-grad`) featuring title and red close button (`.close-btn`).
- **Footer Actions**: `#e8eff7` background bar with right-aligned Cancel and Primary action buttons.

---

## 5. Keyboard & Input Accessibility Rules
1. **Billing Search Bar Focus**: Focus defaults to the `#quickSearch` bar on Billing page mount and automatically refocuses after scanning/adding products.
2. **Smooth Multi-Tasking**: Focus is not stolen when users are actively typing into other input fields (Customer Name, Qty, Discounts, Modal forms).
3. **Refocus Trapping**: Clicking outside input controls or pressing `Enter` blurs the active input and restores cursor focus to the product search bar.
4. **Shortcut Keys**: Pressing `F2` or `Esc` anywhere on the billing page instantly refocuses the search bar.
5. **Modal Navigation**: Pressing `Enter` in modal form fields advances focus to the next input field.

---

## 6. Architecture & Code Structure
- **Feature-Based Architecture**:
  - `src/features/billing/`: POS billing components, search dropdown, cart table, checkout panel, receipt modal, and billing service.
  - `src/features/inventory/`: Inventory table, stock stats grid, product edit modal, and inventory service.
  - `src/features/purchases/`: Stock purchase directory, purchase stats, purchase add modal, details modal, and purchase service.
  - `src/features/sales/`: Sales history directory table and analytics KPI grid.
  - `src/services/database.ts`: SQLite database layer and schema migrations.
  - `src/components/layout/`: Shared header, sidebar, and main layout wrappers.

## 7. Do not use emojis
