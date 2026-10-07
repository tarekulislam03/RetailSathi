
<div align="center">

<h1>Retail Sathi</h1>

<h3>Enterprise Offline-First POS & Retail Store Management System</h3>

English | [Documentation](./README.md)

<!-- badges -->

[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue.svg)](#system-requirements)
[![Architecture](https://img.shields.io/badge/architecture-Offline--First%20%2B%20Cloud%20Sync-003B57.svg)](#multi-counter--offline-first-architecture)
[![Database](https://img.shields.io/badge/database-Embedded%20SQLite%20%2B%20Supabase-3ECF8E?logo=sqlite&logoColor=white)](#multi-counter--offline-first-architecture)
[![UI Engine](https://img.shields.io/badge/interface-High--DPI%20Touch%20%26%20Keyboard-FFC131.svg)](#keyboard-shortcuts-reference)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

</div>

<br />

**Retail Sathi is an all-in-one retail management and point of sale (POS) desktop system designed for supermarkets, grocery chains, hardware stores, and retail outlets. It combines local checkout speed with automated cloud synchronization, customer dues tracking, and financial analytics.**

---

## Business Value & Core Modules

### 1. High-Speed POS & Billing Counter
* **Sub-Second Barcode Scanning:** Immediate product resolution via barcode, batch number, or product name with keyboard-first operation.
* **Flexible Payment Options:** Process single or split transactions (Cash, UPI, Card, Store Credit) in a single checkout session.
* **Instant Tax Invoice Receipts:** Generate GST-compliant thermal invoices with itemized tax breakdowns and savings summaries.
* **Live Stock Validation:** Prevents cashier overselling by validating inventory levels in real time during billing.

### 2. Inventory & Supply Chain Management
* **Batch & Expiry Tracking:** Manage inventory batches, track expiration timelines, and maintain audit integrity.
* **Low Stock & Reorder Alerts:** Automated alerts notify store managers when products fall below safe thresholds.
* **Direct Supplier Purchases:** Log inward purchase shipments, automatically reconcile vendor prices against selling MRP, and update stock counts instantly.
* **Complete Stock Ledger:** Comprehensive audit trail tracking every unit movement (Purchases, Sales, Direct Adjustments, and Returns).

### 3. Customer Ledger & Credit (Dues) System
* **Customer Balance & Credit Accounts:** Record outstanding customer dues directly during checkout without interrupting the billing flow.
* **Settlement & Receipt History:** Settle partial or full dues with dedicated settlement logs and customer statements.
* **Customer Loyalty Points:** Automatically reward customers with loyalty points based on purchase volumes to drive repeat business.

### 4. Sales Intelligence & GST Tax Reporting
* **Real-Time Financial Dashboard:** Monitor daily revenue, monthly sales volume, gross margins, and net profits at a glance.
* **Tax Compliance (GST) Breakdown:** Separate taxable amounts, CGST/SGST/IGST rates, and tax collected across custom date ranges.
* **Salesforce & Delivery Tracking:** Assign sales representatives and delivery personnel to POS orders and track percentage commissions automatically.

### 5. Multi-Counter & Offline-First Reliability
* **Zero Internet Downtime:** Cashiers can bill customers uninterrupted during network outages; all data is stored locally in high-speed embedded storage.
* **Bidirectional Cloud Sync:** When internet connectivity is restored, all transactions, inventory adjustments, and customer records synchronize across all store terminals in the background.
* **Live Product Catalog Refresh:** Price updates, name corrections, and stock changes made by administrators update cashier screens in real time.

### 6. Role-Based Access & Store Security
* **Cashier Restricted Access:** Cashier staff are restricted strictly to the POS Billing screen, preventing unauthorized viewing of supplier costs, profit margins, or administrative settings.
* **Administrator Portal:** Secure management hub for staff credentials, inventory additions, vendor management, and store analytics.

---

## System Workflows

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          RETAIL SATHI WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
   [ CASHIER TERMINAL ]                                [ ADMIN DASHBOARD ]
   • Barcode Scanner & Search                          • Inventory & Stock Ledger
   • Cart & Live Price Calculation                     • Vendor Purchases & Bills
   • Cash / UPI / Split Payments                       • Customer Credit (Dues)
   • Tax Invoice Print (F9)                            • Sales & Profit Analytics
   • Offline Local Storage                             • User Access Control
           │                                                   │
           └─────────────────────────┬─────────────────────────┘
                                     ▼
                      [ BACKGROUND CLOUD SYNC ]
                      • Automatic 4-second sync loop
                      • Multi-counter data reconciliation
                      • Automatic background updates
```

---

## Quick Start Guide

### Step 1: System Requirements
* **Operating System:** Windows 10/11 (64-bit), Ubuntu/Debian Linux, or macOS.
* **Runtime:** Node.js (v18+) & Rust toolchain (`>= 1.75`).
* **Hardware:** Any standard POS terminal, laptop, or desktop PC (supports touchscreens and thermal printers).

### Step 2: Setup & Installation

```bash
# Clone the repository
git clone https://github.com/tarekulislam03/RetailSathi.git
cd RetailSathi

# Install dependencies
npm install

# Setup store database configuration
cp .env.example .env
```

Set your cloud database credentials in `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
GITHUB_TOKEN=your_github_token
GITHUB_RELEASE_REPO=tarekulislam03/RetailSathi
```

### Step 3: Launch Application

```bash
# Launch POS in operational mode
npm run tauri dev
```

### Step 4: Generate Production Installer

```bash
# Build standalone Windows / Linux installer package
TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/retailsathi.key npx tauri build

# Publish signed update to store network (Optional)
npm run release:publish
```

---

## Keyboard Shortcuts Reference

| Shortcut | Action | Description |
|---|---|---|
| `F2` | Focus Search | Instantly focuses the barcode / product search bar from anywhere on screen |
| `F9` / `Enter` | Complete Sale | Finalizes transaction, records payment, and opens printable tax invoice |
| `Escape` | Close / Clear | Dismisses open modals or resets current product dropdown |
| `Tab` | Field Navigation | Seamlessly shifts focus across quantity, payment amounts, and buttons |

---

## License

Distributed under the **MIT License**. See `LICENSE` for details.

---

<div align="center">
  <sub>Built for reliable store operations, rapid checkout speed, and enterprise retail synchronization.</sub>
</div>


