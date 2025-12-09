# Complete Android Reset Instructions

If your React Native app changes aren't showing up, follow these steps:

## Quick Reset (Recommended)

```bash
cd mobile-app
npm run reset
```

This will:
- Stop Metro bundler
- Clear all caches
- Remove node_modules
- Clean Android build
- Uninstall app from device
- Reinstall dependencies
- Rebuild everything

## Manual Reset Steps

If the script doesn't work, do these manually:

### 1. Stop Metro Bundler
```bash
# Kill any running Metro processes
pkill -f metro
pkill -f react-native
```

### 2. Clear Metro Cache
```bash
# Clear Metro cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
rm -rf $TMPDIR/react-*
```

### 3. Clear Watchman (if installed)
```bash
watchman watch-del-all
```

### 4. Clear Node Modules
```bash
cd mobile-app
rm -rf node_modules
rm -f package-lock.json
npm install
```

### 5. Clear Android Build
```bash
cd android
./gradlew clean
rm -rf app/build
rm -rf build
rm -rf .gradle
rm -rf app/.cxx
cd ..
```

### 6. Uninstall App
```bash
# Uninstall from device/emulator
adb uninstall com.medicore

# Clear app data
adb shell pm clear com.medicore
```

### 7. Rebuild
```bash
# Start Metro with reset cache
npm start -- --reset-cache

# In another terminal, run Android
npm run android
```

## Nuclear Option (If Nothing Works)

1. **Close Android Studio completely**
2. **Invalidate Android Studio Caches:**
   - Android Studio > File > Invalidate Caches / Restart
   - Select "Invalidate and Restart"

3. **Delete all caches:**
```bash
cd mobile-app
rm -rf node_modules
rm -rf android/app/build
rm -rf android/build
rm -rf android/.gradle
rm -rf ~/.gradle/caches/
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
rm -rf $TMPDIR/react-*
```

4. **Reinstall everything:**
```bash
npm install
cd android && ./gradlew clean && cd ..
```

5. **Restart your computer** (seriously, sometimes this helps)

6. **Rebuild:**
```bash
npm start -- --reset-cache
# In another terminal:
npm run android
```

## Troubleshooting

### App still not updating?

1. **Check if device is connected:**
   ```bash
   adb devices
   ```

2. **Force reload on device:**
   - Shake device or press `Ctrl+M` (Windows) / `Cmd+M` (Mac) in emulator
   - Select "Reload"

3. **Check Metro bundler is running:**
   - Should see "Metro waiting on port 8081"
   - If not, run: `npm start -- --reset-cache`

4. **Check app package name:**
   - Make sure it's `com.medicore` in `android/app/build.gradle`

5. **Check if changes are in the code:**
   - Add a `console.log('TEST')` in your code
   - Check Metro logs to see if it appears

### Still not working?

- Restart your computer
- Reinstall Android Studio
- Check React Native version compatibility
- Check if you're editing the right files
