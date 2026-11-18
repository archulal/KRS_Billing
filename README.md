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
- `Alt + A`: Add Line Item row
- `Alt + C`: Clear current bill
- `F9` or `Ctrl + S`: Save & Print Invoice

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

---

### Option B: Manual Setup Step-by-Step

#### Step 1: Install Ubuntu System Libraries & C++ Compiler
```bash
sudo apt update
sudo apt install -y curl git build-essential python3 make g++ libfuse2 fonts-noto-core fonts-smc-* cups printer-driver-gutenprint
```
*(These packages are required to compile `better-sqlite3` native drivers and render Malayalam fonts crisply on screen and in print).*

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

---

### 🖨️ Canon PIXMA G3000 Series Printer Configuration
1. Connect printer via USB or connect it to your shop Wi-Fi router.
2. Open **Ubuntu Settings** → **Printers** → Click **Add Printer**.
3. Select **Canon PIXMA G3000 series**.
4. Set default paper size to **A5** (or A4 Half Size) in print options.


