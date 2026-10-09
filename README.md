# Danny's Heaven Ventures Inventory & POS

A fast, reliable inventory and point-of-sale application built for Danny's Heaven Ventures (electronics, smartphones, and accessories retail in Takoradi - Acalema, Ghana).

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Start the development server**:
   ```bash
   npm run dev
   ```
3. Open the local URL (defaults to `http://localhost:5173`) in your browser.

---

## Key Features

* **Point of Sale (POS)**:
  * **Global Barcode & IMEI Scanner**: Supports handheld hardware USB/Bluetooth barcode scanners. Scanning instantly matches product barcodes, SKUs, or individual in-stock IMEI units and adds them to the checkout cart.
  * **Quick Cash Denominations**: 1-click cash tender buttons (+GH₵10, +GH₵20, +GH₵50, +GH₵100, +GH₵200, Full Cash, Full MoMo) with instant change calculation.
  * **Thermal Receipt Printing**: 80mm ESC/POS compatible thermal receipt layout.
* **Dual-Layer Offline Storage**:
  * Records are kept simultaneously in browser `localStorage` and `IndexedDB`. If browser cache is cleared, data auto-recovers from IndexedDB.
  * Export & restore full JSON backups anytime via **Data & Backup**.
* **Offline & Online Cloud Sync (Supabase / PostgreSQL)**:
  * **100% Offline-Resilient**: Cashiers at the shop can register sales, adjust stock, scan barcodes, and accept payments with zero downtime even when internet is completely disconnected.
  * **Automated Offline Queue**: Offline transactions are queued safely in IndexedDB/LocalStorage and automatically pushed to the cloud once internet reconnects.
  * **Remote Owner Access**: The owner can open the app on a mobile phone, tablet, or home computer to view live sales, gross profit, cash in drawer, MoMo collections, and debtors in real time.
  * **Real-time Live Updates**: Supabase Realtime automatically syncs store activities across all connected devices within milliseconds.
  * **1-Click Cloud Setup**: Easily configured in the UI under **Data & Backup** (or via `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`).
* **Authentication & Roles**:
  * Default owner sign-in: **`owner`** / **`change-me`** (quick-fill button available on login screen).
  * Staff accounts, roles (Owner/Admin, Sales Associate, Inventory Manager), and password resets managed under **Team**.
* **PWA Ready**:
  * Installable as a standalone desktop or mobile web app.

---

## Available Scripts

* **`npm run dev`** — Launch local development server with Hot Module Replacement (HMR).
* **`npm test`** — Run Vitest unit tests.
* **`npm run build`** — Build optimized production assets.
* **`npm run lint`** — Check for code quality and syntax issues.
* **`npm run typecheck`** — Run TypeScript compiler check against `jsconfig.json`.
