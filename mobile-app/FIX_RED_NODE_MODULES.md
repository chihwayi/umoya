# Fix Red Node Modules Folders in IDE

## Quick Fixes (Try in Order)

### 1. Reload TypeScript Server (VS Code/Cursor)
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type: `TypeScript: Restart TS Server`
- Press Enter

### 2. Reload Window
- Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
- Type: `Developer: Reload Window`
- Press Enter

### 3. Clear IDE Cache
```bash
# Close IDE first, then:
cd mobile-app
rm -rf .vscode .idea node_modules/.cache
```

### 4. Reinstall Dependencies
```bash
cd mobile-app
rm -rf node_modules package-lock.json
npm install
```

### 5. Rebuild Native Modules (if still red after above)
```bash
cd mobile-app

# For Android
cd android
./gradlew clean
cd ..

# Reinstall
npm install

# Restart Metro bundler
npm start -- --reset-cache
```

## Why This Happens

These are **native React Native modules** that require:
- Native iOS/Android code compilation
- Proper linking in native projects
- IDE TypeScript server to index them

The red folders are usually **cosmetic** - the packages work fine at runtime. However, if you're getting actual TypeScript errors, follow the fixes above.

## Verify They Work

Even if folders are red, test if packages work:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
// If this doesn't show an error, packages are fine
```

## If Still Red After All Fixes

The red folders are likely just IDE visual indicators and won't affect functionality. As long as:
- ✅ Packages are in package.json
- ✅ npm install completes successfully
- ✅ No runtime errors
- ✅ TypeScript compiles without errors

Then you can safely ignore the red folders.


