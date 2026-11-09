/**
 * The ML Kit barcode plugin is Android-only here: iOS scans codes with
 * VisionCamera's built-in object output (AVFoundation) instead. ML Kit's iOS
 * framework has no arm64 simulator slice, and its podspec excludes arm64
 * simulators for the whole app, so linking it breaks Apple Silicon simulators.
 */
module.exports = {
  dependencies: {
    'react-native-vision-camera-barcode-scanner': {
      platforms: { ios: null },
    },
  },
}
