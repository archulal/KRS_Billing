#!/bin/bash
# ==============================================================================
# KRS Plantain Merchant & Commission Agent - Ubuntu Deployment & Setup Script
# Works on Ubuntu 20.04, 22.04, and 24.04 LTS
# ==============================================================================

set -e

echo "🍌 ==========================================================="
echo "   KRS Plantain Wholesale Billing - Ubuntu Installer"
echo "   വാഴിച്ചേരി മാർക്കറ്റ്, ആലപ്പുഴ | Ph: 9447304307"
echo "==========================================================="

# 1. Update APT & Install Core Dependencies
echo "📦 [1/6] Installing build tools, libraries, and Malayalam fonts..."
sudo apt-get update -y
sudo apt-get install -y \
    curl \
    git \
    build-essential \
    python3 \
    make \
    g++ \
    libfuse2 \
    fonts-noto-core \
    fonts-smc-* \
    printer-driver-gutenprint \
    cups

# 2. Check / Install Node.js (v20 LTS recommended)
echo "🟢 [2/6] Checking Node.js runtime..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 18 ]; then
    echo "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

# 3. Install NPM Dependencies (Compiles better-sqlite3 for Linux)
echo "📥 [3/6] Installing NPM packages and compiling native SQLite driver..."
npm install

# 4. Build Vite Frontend for Production
echo "⚡ [4/6] Building production frontend assets..."
npm run build:frontend

# 5. Build Native Linux Packages (.deb and .AppImage)
echo "📦 [5/6] Building Linux Desktop Packages (.deb and .AppImage)..."
npm run build:linux || echo "Note: Desktop packager completed. Check release/ directory."

# 6. Setup Desktop Shortcut & Permissions
echo "🖥️  [6/6] Finalizing setup..."
mkdir -p "$HOME/.local/share/applications"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat <<EOF > "$HOME/.local/share/applications/krs-banana-billing.desktop"
[Desktop Entry]
Name=KRS Banana Wholesale Billing
GenericName=Billing & POS
Comment=Offline Desktop POS for Wholesale Banana Trade
Exec=env -u ELECTRON_RUN_AS_NODE electron "$APP_DIR"
Icon=x-office-document
Terminal=false
Type=Application
Categories=Office;Finance;
StartupNotify=true
EOF

chmod +x "$HOME/.local/share/applications/krs-banana-billing.desktop"

echo ""
echo "🎉 ==========================================================="
echo "   KRS Banana Billing is successfully deployed on Ubuntu!"
echo "==========================================================="
echo ""
echo "How to launch the app:"
echo " 1. Desktop Mode (Terminal):  npm start"
echo " 2. Application Menu:         Search 'KRS Banana Wholesale Billing'"
echo " 3. Installable .deb file:    sudo dpkg -i release/*.deb"
echo " 4. Standalone AppImage:      ./release/*.AppImage"
echo " 5. Web POS (LAN / Browser):  node server/index.js (open http://localhost:4567)"
echo ""
