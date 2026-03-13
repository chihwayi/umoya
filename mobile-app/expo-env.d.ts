declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SERVICE_BASE_URL?: string;
    MEDICORE_APP_VERSION?: string;
    MEDICORE_IOS_BUILD_NUMBER?: string;
    MEDICORE_ANDROID_VERSION_CODE?: string;
    MEDICORE_BUNDLE_ID?: string;
    MEDICORE_ANDROID_PACKAGE?: string;
  }
}
