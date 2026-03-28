# Sprint 05 Build Attempts Evidence (2026-03-13)

## Android preview (CI mode)
Command:
`npm --prefix ./mobile-app run build:android:preview:ci`

Result:
- Build queued successfully.
- Build logs URL:
  - https://expo.dev/accounts/devoopzw/projects/medicore-mobile/builds/e65ce228-3b97-4797-ac41-c80a9329d4f4

## iOS preview (CI mode)
Command:
`npm --prefix ./mobile-app run build:ios:preview:ci`

Result:
- Failed before queueing due missing internal distribution credentials for non-interactive mode.
- Error summary:
  - "EAS CLI couldn't find any credentials suitable for internal distribution. Run this command again in interactive mode."

## iOS preview (interactive credential setup attempt)
Command:
`npx -y eas-cli build --platform ios --profile preview`

Result:
- Apple login and 2FA succeeded.
- Credential setup still failed due Apple account lacking a developer team association.
- Error summary:
  - "You have no team associated with your Apple account, cannot proceed. (Do you have a paid Apple Developer account?)"

## Conclusion
- Android preview build path is operational.
- iOS preview remains blocked until the Apple ID is added to a paid Apple Developer Program team.
