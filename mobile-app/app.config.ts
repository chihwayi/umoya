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
const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@medicore.africa';
const supportPhone = process.env.EXPO_PUBLIC_SUPPORT_PHONE || '+263000000000';
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '3593d35c-2442-4af9-b109-bb4437510697';

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
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false
    },
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
  updates: {
    url: `https://u.expo.dev/${easProjectId}`
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
    releaseEnvironment,
    supportEmail,
    supportPhone,
    eas: {
      projectId: easProjectId
    }
  }
};

export default config;
