import type { ExpoConfig } from 'expo/config';

/**
 * SmartSpend AI — Expo app configuration (iOS-first, Android-ready).
 * Public identifiers come from EXPO_PUBLIC_* / build env (see .env.example).
 */
const IOS_BUNDLE_ID = process.env.IOS_BUNDLE_ID ?? 'my.smartspend.ai';
const GOOGLE_IOS_URL_SCHEME = process.env.GOOGLE_IOS_URL_SCHEME; // reversed iOS client id, e.g. com.googleusercontent.apps.123-abc

const config: ExpoConfig = {
  name: 'SmartSpend AI',
  slug: 'smartspend-ai',
  scheme: 'smartspend',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: IOS_BUNDLE_ID,
    buildNumber: '1',
    supportsTablet: false,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSCameraUsageDescription: 'SmartSpend AI uses the camera to photograph receipts and invoices so their details can be recorded.',
      NSPhotoLibraryUsageDescription: 'SmartSpend AI lets you import receipt photos and screenshots from your library.',
      NSFaceIDUsageDescription: 'SmartSpend AI uses Face ID to protect your financial records.',
      CFBundleAllowMixedLocalizations: true,
      CFBundleLocalizations: ['en', 'ms'],
      ITSAppUsesNonExemptEncryption: false,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherFinancialInfo', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
        { NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID', NSPrivacyCollectedDataTypeLinked: true, NSPrivacyCollectedDataTypeTracking: false, NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'] },
      ],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'my.smartspend.ai',
    adaptiveIcon: { backgroundColor: '#0F766E', foregroundImage: './assets/android-icon-foreground.png', backgroundImage: './assets/android-icon-background.png', monochromeImage: './assets/android-icon-monochrome.png' },
    permissions: ['CAMERA', 'USE_BIOMETRIC'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 160, resizeMode: 'contain', backgroundColor: '#FFFFFF', dark: { backgroundColor: '#0A1222' } }],
    'expo-secure-store',
    'expo-sharing',
    'expo-localization',
    'expo-web-browser',
    'expo-font',
    'expo-apple-authentication',
    ['expo-camera', { cameraPermission: 'SmartSpend AI uses the camera to photograph receipts and invoices so their details can be recorded.', recordAudioAndroid: false }],
    ['expo-image-picker', { photosPermission: 'SmartSpend AI lets you import receipt photos and screenshots from your library.' }],
    ['expo-local-authentication', { faceIDPermission: 'SmartSpend AI uses Face ID to protect your financial records.' }],
    ['react-native-document-scanner-plugin', { cameraPermission: 'SmartSpend AI uses the camera to scan receipts and invoices.' }],
    ...(GOOGLE_IOS_URL_SCHEME ? [['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }] as [string, unknown]] : []),
  ],
  experiments: { typedRoutes: false },
  extra: { eas: { projectId: process.env.EAS_PROJECT_ID } },
};

export default config;
