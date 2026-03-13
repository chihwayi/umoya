import type { ExpoConfig } from 'expo/config';

function requireSemver(version: string): string {
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid MEDICORE_APP_VERSION "${version}". Expected semver (e.g. 1.2.3 or 1.2.3-beta.1).`);
  }
  return version;
}

function requirePositiveInt(value: string, key: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid ${key} "${value}". Expected a positive integer.`);
  }
  return number;
}

function requireBuildNumber(value: string): string {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid MEDICORE_IOS_BUILD_NUMBER "${value}". Expected a positive integer string.`);
  }
  return String(number);
}

const appVersion = requireSemver(process.env.MEDICORE_APP_VERSION || process.env.npm_package_version || '1.0.0');
const iosBuildNumber = requireBuildNumber(process.env.MEDICORE_IOS_BUILD_NUMBER || '1');
const androidVersionCode = requirePositiveInt(process.env.MEDICORE_ANDROID_VERSION_CODE || '1', 'MEDICORE_ANDROID_VERSION_CODE');
const serviceBaseUrl = process.env.EXPO_PUBLIC_SERVICE_BASE_URL || 'http://localhost:3000';
const bundleIdentifier = process.env.MEDICORE_BUNDLE_ID || 'com.medicore.mobile';
const androidPackage = process.env.MEDICORE_ANDROID_PACKAGE || 'com.medicore.mobile';
const releaseChannel = process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development';
const releaseEnvironment = process.env.EXPO_PUBLIC_RELEASE_ENV || process.env.NODE_ENV || 'development';

const config: ExpoConfig = {
  name: 'MediCore Mobile',
  slug: 'medicore-mobile',
  scheme: 'medicore',
  version: appVersion,
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#080E1A'
  },
  ios: {
    bundleIdentifier,
    buildNumber: iosBuildNumber,
    supportsTablet: true
  },
  android: {
    package: androidPackage,
    versionCode: androidVersionCode,
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#080E1A'
    }
  },
  runtimeVersion: {
    policy: 'appVersion'
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-notifications',
    [
      'expo-local-authentication',
      {
        faceIDPermission: 'Use Face ID to unlock MediCore clinical data.'
      }
    ],
    '@sentry/react-native/expo'
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    serviceBaseUrl,
    releaseChannel,
    releaseEnvironment
  }
};

export default config;
