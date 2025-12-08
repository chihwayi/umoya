# Mobile App Development Guide

This guide contains all the essential commands for developing and running the React Native mobile app.

## Table of Contents
- [Starting the Android Emulator](#starting-the-android-emulator)
- [Starting Metro Bundler](#starting-metro-bundler)
- [Building and Running the App](#building-and-running-the-app)
- [Common Workflows](#common-workflows)
- [Troubleshooting](#troubleshooting)

---

## Starting the Android Emulator

### List Available Emulators
```bash
emulator -list-avds
```

### Start Emulator
```bash
emulator -avd Medium_Phone_API_36.1 -no-snapshot-load
```

**Note:** Replace `Medium_Phone_API_36.1` with your emulator name from the list above.

### Check if Emulator is Running
```bash
adb devices
```

You should see something like:
```
List of devices attached
emulator-5554    device
```

### Wait for Emulator to Boot
```bash
adb wait-for-device
adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done; echo "Boot completed"'
```

---

## Starting Metro Bundler

### Start Metro Bundler (with cache reset)
```bash
cd mobile-app
npm start -- --reset-cache
```

### Start Metro Bundler (normal)
```bash
cd mobile-app
npm start
```

### Check if Metro is Running
```bash
curl http://localhost:8081/status
```

Should return: `packager-status:running`

### Stop Metro Bundler
```bash
lsof -ti:8081 | xargs kill -9
```

Or press `Ctrl+C` in the terminal where Metro is running.

---

## Building and Running the App

### Quick Run (Recommended)
This builds, installs, and launches the app automatically:
```bash
cd mobile-app
npm run android
```

### Build Only (Without Installing)
```bash
cd mobile-app/android
./gradlew assembleDebug
```

The APK will be created at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Clean Build
```bash
cd mobile-app/android
./gradlew clean
./gradlew assembleDebug
```

### Install APK Manually
```bash
cd mobile-app
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Uninstall App
```bash
adb uninstall com.medicore.mobile
```

### Launch App (After Installation)
```bash
adb shell am start -n com.medicore.mobile/.MainActivity
```

---

## Common Workflows

### Development Workflow (Two Terminals)

**Terminal 1 - Metro Bundler:**
```bash
cd mobile-app
npm start
```

**Terminal 2 - Build and Run:**
```bash
cd mobile-app
npm run android
```

### Full Clean Rebuild (When Things Go Wrong)
```bash
cd mobile-app

# Clean everything
rm -rf android/app/build android/.gradle .metro-cache node_modules/.cache

# Clean Gradle
cd android && ./gradlew clean && cd ..

# Rebuild and run
npm run android
```

### Quick Reload After Code Changes
- **In Metro terminal:** Press `R` twice
- **On device/emulator:** Shake device (or `Ctrl+M` / `Cmd+M` on Mac) → Select "Reload"

### Rebuild After Native Code Changes
If you modified Java/Kotlin files, AndroidManifest.xml, or build.gradle:
```bash
cd mobile-app/android
./gradlew clean assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.medicore.mobile/.MainActivity
```

---

## Port Forwarding

### Set Up Port Forwarding (Required for Metro Connection)
```bash
adb reverse tcp:8081 tcp:8081
```

### Check Port Forwarding
```bash
adb reverse --list
```

### Clear All Port Forwarding
```bash
adb reverse --remove-all
```

---

## Troubleshooting

### Emulator Not Connecting
```bash
# Restart ADB server
adb kill-server
adb start-server
adb devices
```

### Metro Not Connecting
1. Check if Metro is running: `curl http://localhost:8081/status`
2. Set up port forwarding: `adb reverse tcp:8081 tcp:8081`
3. Restart Metro with cache reset: `npm start -- --reset-cache`

### Build Errors
```bash
# Clean everything and rebuild
cd mobile-app
rm -rf android/app/build android/.gradle .metro-cache
cd android && ./gradlew clean && cd ..
npm run android
```

### App Crashes on Launch
1. Check Metro bundler is running
2. Check port forwarding is set up
3. Check device/emulator is connected: `adb devices`
4. Check logs: `adb logcat | grep -i "medicore\|error"`

### Clear All Caches
```bash
cd mobile-app
rm -rf .metro-cache node_modules/.cache android/app/build android/.gradle
```

### Reinstall Dependencies
```bash
cd mobile-app
rm -rf node_modules
npm install
```

---

## Useful ADB Commands

### View App Logs
```bash
adb logcat | grep -i "medicore"
```

### Clear App Data
```bash
adb shell pm clear com.medicore.mobile
```

### Force Stop App
```bash
adb shell am force-stop com.medicore.mobile
```

### Open Dev Menu
```bash
adb shell input keyevent 82
```

### Take Screenshot
```bash
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

---

## Project Structure

```
medicore/
├── mobile-app/              # React Native app
│   ├── android/            # Android native code
│   ├── src/                # React Native source code
│   ├── package.json        # Dependencies
│   └── metro.config.js     # Metro bundler config
└── MOBILE_APP_GUIDE.md     # This file
```

---

## Notes

- **Monorepo Setup:** This app is in an npm workspace monorepo. React dependencies are configured to resolve from `mobile-app/node_modules` to avoid duplicate React instances.
- **Metro Config:** The Metro bundler is configured to prevent React hoisting issues. See `mobile-app/metro.config.js` for details.
- **Gradle Config:** Android build is configured for monorepo structure with paths adjusted for workspace hoisting.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start emulator | `emulator -avd Medium_Phone_API_36.1` |
| Start Metro | `cd mobile-app && npm start` |
| Run app | `cd mobile-app && npm run android` |
| Clean build | `cd mobile-app/android && ./gradlew clean` |
| Port forwarding | `adb reverse tcp:8081 tcp:8081` |
| Check devices | `adb devices` |
| Reload app | Press `R` twice in Metro terminal |

---

*Last updated: December 2025*
