#!/bin/bash

# Comprehensive Android Reset Script
# This script clears all caches and rebuilds the Android app

set -e

echo "🧹 Starting comprehensive Android reset..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop Metro bundler if running
echo -e "${YELLOW}📱 Step 1: Stopping Metro bundler...${NC}"
pkill -f "react-native" || true
pkill -f "metro" || true
sleep 2

# Step 2: Clear Metro bundler cache
echo -e "${YELLOW}🧹 Step 2: Clearing Metro bundler cache...${NC}"
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/haste-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true

# Step 3: Clear watchman
echo -e "${YELLOW}🧹 Step 3: Clearing Watchman...${NC}"
watchman watch-del-all 2>/dev/null || echo "Watchman not installed or no watches"

# Step 4: Clear node_modules and reinstall
echo -e "${YELLOW}📦 Step 4: Clearing node_modules...${NC}"
rm -rf node_modules
rm -f package-lock.json
echo -e "${GREEN}✓ node_modules removed${NC}"

# Step 5: Clear Android build artifacts
echo -e "${YELLOW}🔨 Step 5: Clearing Android build cache...${NC}"
cd android || { echo -e "${RED}❌ android directory not found${NC}"; exit 1; }

# Clean Gradle
./gradlew clean 2>/dev/null || echo "Gradle clean failed (might be first run)"

# Remove build directories
rm -rf app/build
rm -rf build
rm -rf .gradle
rm -rf app/.cxx

cd ..

# Step 6: Reinstall dependencies
echo -e "${YELLOW}📦 Step 6: Reinstalling dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 7: Uninstall app from device/emulator
echo -e "${YELLOW}📱 Step 7: Uninstalling app from device/emulator...${NC}"
adb uninstall com.medicore 2>/dev/null || echo "App not installed or device not connected"
echo -e "${GREEN}✓ App uninstalled${NC}"

# Step 8: Clear Android app data (if app exists)
echo -e "${YELLOW}🧹 Step 8: Clearing Android app data...${NC}"
adb shell pm clear com.medicore 2>/dev/null || echo "Could not clear app data"

# Step 9: Rebuild and run
echo -e "${GREEN}🚀 Step 9: Rebuilding and running app...${NC}"
echo -e "${YELLOW}This will take a few minutes...${NC}"

cd android
./gradlew clean
cd ..

# Run the app with reset cache
echo -e "${GREEN}✅ Reset complete! Starting Metro with reset cache...${NC}"
echo -e "${YELLOW}💡 In a new terminal, run: npm run android${NC}"
echo -e "${YELLOW}💡 Or run this script with --run flag to auto-start${NC}"

# Start Metro with reset cache in background
npm start -- --reset-cache &
METRO_PID=$!

# Wait a bit for Metro to start
sleep 5

# If --run flag is passed, also run android
if [[ "$1" == "--run" ]]; then
  echo -e "${GREEN}🚀 Auto-starting Android build...${NC}"
  npm run android
fi

echo -e "${GREEN}✅ All done! Metro is running with reset cache.${NC}"
echo -e "${YELLOW}💡 If issues persist, try:${NC}"
echo -e "   1. Restart your computer"
echo -e "   2. Check Android Studio > File > Invalidate Caches / Restart"
echo -e "   3. Ensure emulator/device is running: adb devices"

