/**
 * Native store packaging (iOS / Android).
 * After `npm run build`:
 *   npx cap add ios && npx cap add android
 *   npm run cap:sync
 * Then open Xcode / Android Studio for App Store / Play submission.
 */
const config = {
  appId: "com.circled.payments",
  appName: "Circle",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#F4EFE6",
    },
  },
};

export default config;
