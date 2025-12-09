# Quick Ways to Reload Your React Native App

## ✅ Method 1: ADB Command (Easiest - No Metro Terminal Needed)
```bash
cd mobile-app
npm run reload
```
**OR directly:**
```bash
adb shell input text "RR"
```

## ✅ Method 2: In Android Emulator
- Press `R` **twice quickly** (or `RR`)
- This reloads the JavaScript bundle

## ✅ Method 3: Developer Menu
1. Press `Ctrl+M` (Windows/Linux) or `Cmd+M` (Mac) in emulator
2. OR Shake device (physical device)
3. Select **"Reload"** from the menu

## ✅ Method 4: Metro Terminal (If Visible)
If you can see the Metro bundler terminal:
- Press `r` - Reload app
- Press `d` - Open developer menu
- Press `j` - Open debugger

## 🔍 Finding Metro Terminal
Metro might be running in a background terminal. To find it:
- Check all terminal windows/tabs
- Look for output like "Metro waiting on port 8081"
- Or restart Metro in a visible terminal:
  ```bash
  cd mobile-app
  npm start
  ```

## 🚀 Quick Reload Script
I've added `npm run reload` to your package.json - just run:
```bash
cd mobile-app
npm run reload
```

This sends the reload command directly to your emulator!
