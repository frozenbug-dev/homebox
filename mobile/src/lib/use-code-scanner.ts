import { isScannedCode, useObjectOutput } from 'react-native-vision-camera'

/**
 * Camera output that reports the text of codes it sees (iOS: AVFoundation via
 * VisionCamera's object output; UPC-A arrives as EAN-13 with a leading 0).
 */
export function useCodeScanner(onCodes: (values: string[]) => void) {
  return useObjectOutput({
    types: ['qr', 'data-matrix', 'ean-13', 'ean-8', 'upc-e', 'code-128'],
    onObjectsScanned: (objects) => {
      onCodes(objects.filter(isScannedCode).map((c) => c.value).filter((v): v is string => !!v))
    },
  })
}
