# KRS Plantain Merchant & Commission Agent
### കെ.ആർ.എസ് പ്ലാന്റയിൻ മർച്ചന്റ് & കമ്മീഷൻ ഏജന്റ്
**വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ - 688001 | Ph: +91 94473 04307**

An offline-first standalone desktop billing and Point-of-Sale (POS) application tailored for Kerala wholesale plantain trade.

Built with **Electron**, **React (Vite)**, **Tailwind CSS**, **Node.js + Express**, and **SQLite (better-sqlite3)**.

---

## 🍌 Key Features

### 1. Authentic KRS Signboard Branding & Custom Logo
- **Theme**: Styled in the signature **Emerald Jade / Plantain Green** palette (`#156b46`) matching the physical KRS outdoor signboard.
- **Banana Tree Emblem**: Hand-stamped Kerala banana tree with bunch (വാഴക്കുല & വാഴച്ചുണ്ട്) featured on the desktop header and printed invoices.
- **Bilingual Interface**: Seamless toggle between **English** and **മലയാളം** for screen UI and printed receipts.

### 2. A4 Half Size Invoicing & Dynamic UPI QR Code
- **A4 Half Size (A5: 148 × 210 mm) Default**: Optimized for continuous ink-tank printers like **Canon PIXMA G3000 series**.
- **Dynamic "Scan & Pay" QR Code**: Pre-fills the exact bill amount, invoice number, and HDFC Vyapar UPI VPA (`Vyapar.178760240373@hdfcbank`). Scannable by Google Pay, PhonePe, Paytm, BHIM, and all UPI apps.
- **Order Notice**: Replaced generic terms with **"🍃 Banana Leaves are sold based on order"** / **"🍃 വാഴയിലകൾ ഓർഡർ അനുസരിച്ച് നൽകുന്നതാണ്"**.

### 3. Stem & Bunch Waste Live Calculations
$$\text{Total Stem Waste (kg)} = \text{Bunches} \times \text{Waste per Bunch (kg)}$$
$$\text{Net Weight (Billable Weight)} = \text{Gross Weight} - \text{Total Stem Waste}$$
$$\text{Line Subtotal (₹)} = \text{Net Weight} \times \text{Editable Rate per kg}$$
- Rate per kg and Stem waste per bunch auto-fill on variety selection and remain immediately editable per row.

### 4. Varieties (Default Kerala Varieties)
| English Name | Malayalam Name | Default Rate/kg | Default Stem Waste/Bunch |
|:---|:---|:---:|:---:|
| **Ethan** | ഏത്തൻ | ₹48.00 | 0.50 kg |
| **Robusta** | റോബസ്റ്റ | ₹30.00 | 0.60 kg |
| **Poovan** | പൂവൻ | ₹36.00 | 0.40 kg |
| **Njalipoovan** | ഞാലിപ്പൂവൻ | ₹52.00 | 0.35 kg |
| **Palayankodan** | പാളയൻകോടൻ | ₹24.00 | 0.45 kg |

---

## ⌨️ POS Keyboard Shortcuts
- `F1`: POS Billing Screen
- `F2`: Bills History
- `F3`: Customers Directory (with frequent walk-ins promotion)
- `F4`: Banana Varieties Configuration
- `F5`: Settings (WhatsApp sender number & connection)
- `Alt + A`: Add Line Item row
- `Alt + C`: Clear current bill
- `F9` or `Ctrl + S`: Save & Print Invoice

---

## 📲 Send PDF Bills on WhatsApp (Desktop App)

Bills can be shared as a PDF directly to a customer's WhatsApp number. The PDF is generated from the same invoice component used for printing, so it matches the printed bill exactly (including Malayalam text and the UPI QR).

### One-time setup
1. Open the **Settings** tab (`F5`) in the desktop app.
2. Enter the **owner WhatsApp number** — this is the account bills are sent **from**. Use 10 digits or `+91...`.
3. Optionally edit the bill message template (`{bill_number}`, `{amount}`, `{customer}` placeholders) and click **Save Settings**.
4. Click **Connect WhatsApp** and scan the QR code with the owner's phone:
   WhatsApp → **Settings → Linked devices → Link a device**.
5. When the status shows **Connected**, confirm the logged-in number matches the configured owner number. Sending is blocked if they differ.

The QR needs scanning only once; the session is stored under the app data folder (`whatsapp-session`).

### Sending a bill
- **While billing (POS):** tick **Send PDF on WhatsApp after saving** (on by default when WhatsApp is connected). Saving sends the PDF and then prints the invoice; the result appears in a small toast and never blocks printing.
- **Bills History:** click the green **Send on WhatsApp** button on a bill, then click **Send on WhatsApp** in the invoice preview.
- The customer number is taken from the bill (`customer_phone`). If a bill has **no customer phone number**, WhatsApp sending is skipped automatically with a clear notice — printing/cancellation still completes.
- A successful send shows a confirmation in the preview toolbar.

### Bill cancellation
- Cancelling a bill in **Bills History** now sends a short WhatsApp text to the customer from the owner account: bill number, date, amount, and a cancellation note (English + Malayalam).
- If the customer has no phone number, the cancellation still happens and a notice explains that no message was sent.

### Requirements & notes
- Desktop (Electron) mode only. The browser/server POS does not send WhatsApp messages.
- An internet connection is required for WhatsApp Web, even though billing itself stays offline.
- A Chrome/Chromium installation is used when available; otherwise the Chromium bundled with `whatsapp-web.js` is used. On Ubuntu you can set `KRS_CHROME_PATH=/path/to/chromium` before starting the app if auto-detection fails.
- Generated PDFs are kept in `bill-pdfs` under the app data folder.
- WhatsApp Web automation is unofficial; keep the owner's phone linked and avoid sending large batches at once.

---

## 🧪 Development, Test & Production Environments

The app uses `KRS_ENV` (falling back to `NODE_ENV`) to decide whether **demo data** is seeded.

| Environment | How to start | Demo customers | Database |
|:---|:---|:---|:---|
| **Development** | `npm run dev` | ✅ Seeded when tables are empty | Default app-data location |
| **Test** | `npm test` | ✅ Seeded | Disposable temp folder (`KRS_DATA_DIR`) |
| **Production** | `npm start` (desktop) or `npm run start:server` / systemd | ❌ Never seeded | Default app-data location or `KRS_DATA_DIR` |

**Rules**
- The 5 Kerala banana varieties are always seeded — they are required for billing.
- Sample **permanent customers** and **walk-in customers** are seeded only in development/test.
- Production starts with an **empty customer directory**. Add real customers from the **Customers** tab.
- Existing data is never deleted. Seeding only happens when a table is empty, so a database previously used in development keeps its demo customers. For a clean production database, point `KRS_DATA_DIR` at a new folder or remove the demo customers in the app.
- `KRS_DATA_DIR=/path/to/folder` overrides the database location. Use it to keep test/staging data completely separate from shop data.
- `GET /api/health` reports the active environment and database path.

**Quick commands**
```bash
npm run dev            # Development: backend :4567 + Vite :5173 + Electron
npm test               # Isolated test database + full API/billing verification
npm run build:frontend # Build production assets (required before npm start)
npm start              # Production desktop app (KRS_ENV=production)
npm run start:server   # Production web POS server on :4567
```

> ⚠️ Production mode never seeds demo customers, even on a brand-new database.

**Removing demo customers from an existing database**

If a database was previously used in development, its demo customers stay there (production never deletes data automatically). Preview and then remove only the seeded demo rows — bills are never deleted:

```bash
# 1. Point at the database folder used by the app
# macOS (Electron):   "$HOME/Library/Application Support/krs-banana-wholesale-billing/database"
# Linux (Electron):   "$HOME/.config/krs-banana-wholesale-billing/database"
# Windows (Electron): "%APPDATA%\\krs-banana-wholesale-billing\\database"
# Linux web service:  "$HOME/.krs_billing"
export KRS_DATA_DIR="$HOME/Library/Application Support/krs-banana-wholesale-billing/database"

npm run clean:demo              # preview only — changes nothing
npm run clean:demo -- --yes     # delete the demo customers
```

Real customers and all bills are kept. If a demo customer appears on an old bill, only the customer link is cleared; the invoice keeps its stored name.

---

## 🐧 Ubuntu Linux Setup Guide (After Cloning from GitHub)

Follow these steps on your Ubuntu Linux machine (Ubuntu 20.04, 22.04, or 24.04 LTS):

### 1. Clone the Repository
```bash
git clone https://github.com/<YOUR_GITHUB_USERNAME>/<REPO_NAME>.git
cd <REPO_NAME>
```

---

### Option A: 1-Click Automated Setup (Recommended)
We provide an automated setup script that installs all dependencies, Malayalam fonts, build tools, builds production assets, and creates an Ubuntu desktop shortcut:

```bash
chmod +x scripts/install_ubuntu.sh
./scripts/install_ubuntu.sh
```

Once finished, launch the desktop app anytime with:
```bash
npm start
```
*(Or search **"KRS Banana Wholesale Billing"** in the Ubuntu Applications menu).*

> 🏭 **Production mode:** `npm start` runs with `KRS_ENV=production`, so **no demo customers are seeded**. The shop starts with an empty customer list and the default banana varieties.

---

### Option B: Manual Setup Step-by-Step

#### Step 1: Install Ubuntu System Libraries & C++ Compiler
```bash
sudo apt update
sudo apt install -y curl git build-essential python3 make g++ libfuse2 fonts-noto-core fonts-smc-* cups printer-driver-gutenprint
sudo snap install chromium   # used by WhatsApp bill sending (optional but recommended)
```
*(These packages are required to compile `better-sqlite3` native drivers and render Malayalam fonts crisply on screen and in print. Chromium is used by the WhatsApp Web automation for sending PDF bills.)*

#### Step 2: Install Node.js (v20 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
Verify versions:
```bash
node -v   # Should be v20.x or higher
npm -v    # Should be 10.x or higher
```

#### Step 3: Install Project Dependencies
```bash
npm install
```

#### Step 4: Build Production Assets
```bash
npm run build:frontend
```

#### Step 5: Run the Desktop App
```bash
npm start
```

> 🧪 To explore the app with demo customers, run `npm run dev` (development) or `npm test` (isolated test database). `npm start` and packaged builds always run in **production** mode with no demo customers.

---

### 📦 Building Ubuntu `.deb` and `.AppImage` Installers
To generate installable Linux packages:
```bash
npm run build:linux
```
The output files will be in the `release/` folder:
- **Install system-wide `.deb` package:**
  ```bash
  sudo dpkg -i release/krs-banana-wholesale-billing_1.0.0_amd64.deb
  ```
- **Or run standalone `.AppImage`:**
  ```bash
  chmod +x release/*.AppImage
  ./release/*.AppImage
  ```

---

### 🌐 24/7 Web POS Server Mode (Local Shop Wi-Fi / Multi-Device Access)
If you want to bill from counter laptops, tablets, or phones over shop Wi-Fi without running the Electron desktop window:
```bash
sudo cp scripts/krs-billing.service /etc/systemd/system/
sudo nano /etc/systemd/system/krs-billing.service # update User and WorkingDirectory
sudo systemctl daemon-reload
sudo systemctl enable --now krs-billing
```
Access billing in any browser at:
- Counter PC: `http://localhost:4567`
- Other devices on shop Wi-Fi: `http://<UBUNTU_IP_ADDRESS>:4567`

> 🏭 The systemd unit sets `NODE_ENV=production` and `KRS_ENV=production`, so the web POS also starts with **no demo customers**.

To run a separate **test/staging** instance with demo data (never touching shop data):
```bash
KRS_ENV=test PORT=4568 KRS_DATA_DIR=/tmp/krs-test-db node server/index.js
# Open http://localhost:4568
```

---

### 🖨️ Canon PIXMA G3000 Series Printer Configuration
1. Connect printer via USB or connect it to your shop Wi-Fi router.
2. Open **Ubuntu Settings** → **Printers** → Click **Add Printer**.
3. Select **Canon PIXMA G3000 series**.
4. Set default paper size to **A5** (or A4 Half Size) in print options.


