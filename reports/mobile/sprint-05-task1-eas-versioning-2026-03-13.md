# Sprint 05 Task 1 Evidence: EAS Profiles + Release Versioning

Date: 2026-03-13
Branch: `codex/mobile-sprint-05-store-ready-builds`

## Delivered
- Replaced static Expo config with typed dynamic config: `mobile-app/app.config.ts`
- Added EAS build profiles: `mobile-app/eas.json`
- Added release version validation script: `mobile-app/scripts/release-version-check.mjs`
- Added release/build helper scripts in `mobile-app/package.json`
- Updated mobile README with Sprint 05 build + version workflow.

## Versioning strategy
- Semantic app version source:
  - default: `mobile-app/package.json` (`version`)
  - optional override: `MEDICORE_APP_VERSION`
- iOS build number:
  - `MEDICORE_IOS_BUILD_NUMBER` (positive integer string)
- Android version code:
  - `MEDICORE_ANDROID_VERSION_CODE` (positive integer)

## Build profile model
- `development`: internal dev-client build channel
- `preview`: internal beta channel with auto-increment build numbers
- `production`: store release channel with auto-increment build numbers

## Verification commands
```bash
npm --prefix ./mobile-app run release:check
npm --prefix ./mobile-app run lint
npm --prefix ./mobile-app run typecheck
npm --prefix ./mobile-app run test
npm --prefix ./mobile-app run doctor
npm --prefix ./mobile-app run test:e2e
cd mobile-app && npx expo config --type public
```

All checks passed in this run.
