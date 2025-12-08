# Metro Bundler Troubleshooting Guide

## Issue: Bundling Freezing at 25%

### ✅ **Solution Applied:**
1. ✅ Stopped Metro bundler
2. ✅ Cleared all caches (.metro-cache, node_modules/.cache)
3. ✅ Cleared Android build cache
4. ✅ Restarted Metro with `--reset-cache` flag
5. ✅ Metro is now running with fresh cache

### **If Still Freezing:**

#### **Option 1: Restart Emulator**
```bash
# Kill emulator
adb emu kill

# Restart emulator
emulator -avd Medium_Phone_API_36.1 -no-snapshot-load &

# Wait for boot, then reconnect
adb wait-for-device
adb reverse tcp:8081 tcp:8081
```

#### **Option 2: Full Clean Restart**
```bash
cd mobile-app

# Stop everything
pkill -f "react-native start"
pkill -f "metro"
pkill -f "emulator"

# Clear all caches
rm -rf node_modules/.cache
rm -rf .metro-cache
rm -rf android/app/build
rm -rf android/.gradle

# Restart Metro
npm start -- --reset-cache

# In another terminal, restart emulator and app
emulator -avd Medium_Phone_API_36.1 -no-snapshot-load &
adb wait-for-device
adb reverse tcp:8081 tcp:8081
npm run android
```

#### **Option 3: Increase Node Memory**
```bash
# Set Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Then start Metro
npm start -- --reset-cache
```

#### **Option 4: Check for Syntax Errors**
```bash
# Check for TypeScript errors
cd mobile-app
npx tsc --noEmit

# Check for linting errors
npm run lint
```

### **Common Causes:**
1. **Corrupted cache** - ✅ Fixed with cache clear
2. **Memory issues** - Try increasing Node memory
3. **Syntax errors** - Check for compilation errors
4. **Port conflicts** - Ensure port 8081 is free
5. **Watchman issues** - Clear watchman cache

### **Current Status:**
- ✅ Metro restarted with fresh cache
- ⚠️ Emulator needs to be restarted
- ✅ Port forwarding will be reconfigured when emulator is back

### **Next Steps:**
1. Restart emulator if it disconnected
2. Wait for Metro to finish initial bundling
3. Reload app on emulator (shake device → Reload)

---

**Metro is now running with a clean cache. The bundling should complete successfully!**

