# Fast Refresh Guide - Quick Development Tips

## ✅ What Works with Fast Refresh (No Rebuild Needed)

**Most changes apply automatically:**
- ✅ JavaScript/TypeScript code changes
- ✅ Component styling changes
- ✅ State management logic
- ✅ Function implementations
- ✅ UI component updates
- ✅ Navigation changes
- ✅ Redux/state updates

## 🔄 How to Reload Without Full Rebuild

### Method 1: Shake Device/Emulator
1. **Android Emulator**: Press `Ctrl+M` (Windows/Linux) or `Cmd+M` (Mac)
2. **Physical Device**: Shake the device
3. Select **"Reload"** from the menu

### Method 2: Keyboard Shortcut
- **Android Emulator**: Press `R` twice quickly (or `RR`)
- **iOS Simulator**: Press `Cmd+R`

### Method 3: Metro Bundler Commands
In the Metro bundler terminal:
- Press `r` - Reload the app
- Press `d` - Open developer menu
- Press `j` - Open debugger

### Method 4: ADB Command (Android)
```bash
adb shell input keyevent 82  # Opens dev menu
# Then select "Reload"
```

Or directly reload:
```bash
adb shell input text "RR"  # Double R reloads
```

## 🚫 When Full Rebuild IS Required

You **must** rebuild when:
- ❌ Adding/removing native dependencies (`npm install <package>`)
- ❌ Changing native code (Android/iOS)
- ❌ Modifying `android/` or `ios/` config files
- ❌ Changing `package.json` scripts
- ❌ First time after `npm install`
- ❌ Metro bundler cache is corrupted

## 🛠️ Quick Commands Reference

### Soft Reload (Fast Refresh)
```bash
# In Metro bundler terminal, press 'r'
# OR shake device and select "Reload"
# OR press R twice in emulator
```

### Clear Cache & Reload (When Fast Refresh Fails)
```bash
# Stop Metro
pkill -f "react-native"

# Clear cache and restart
cd mobile-app
rm -rf node_modules/.cache
npx react-native start --reset-cache

# In another terminal, reload app
adb shell input text "RR"
```

### Full Rebuild (Only When Necessary)
```bash
cd mobile-app/android
./gradlew clean
cd ..
npx react-native run-android --no-packager
```

## 💡 Pro Tips

1. **Keep Metro Running**: Always keep `npx react-native start` running in a terminal
2. **Use Fast Refresh**: Most changes should work with just a reload (R twice)
3. **Check Metro Logs**: If changes don't appear, check Metro bundler for errors
4. **Enable Fast Refresh**: It's enabled by default in React Native 0.61+
5. **Component State**: Fast Refresh preserves component state when possible

## 🔍 Troubleshooting Fast Refresh

If Fast Refresh isn't working:

1. **Check Metro Connection**: Look for "Connected" in Metro bundler
2. **Reload Manually**: Press `R` twice or shake device → Reload
3. **Clear Metro Cache**: `npx react-native start --reset-cache`
4. **Check for Syntax Errors**: Fast Refresh stops on errors
5. **Restart Metro**: Stop (`Ctrl+C`) and restart Metro bundler

## 📱 Development Workflow

**Recommended daily workflow:**

1. **Start Metro once** (keep it running):
   ```bash
   cd mobile-app
   npx react-native start
   ```

2. **Make code changes** in your editor

3. **Reload app** (choose one):
   - Press `R` twice in emulator
   - Shake device → Reload
   - Press `r` in Metro terminal

4. **Only rebuild** when:
   - Adding native dependencies
   - Changing native configs
   - First time setup

This saves **tons of time** compared to full rebuilds!
