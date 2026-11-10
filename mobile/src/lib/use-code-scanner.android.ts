import { useBarcodeScannerOutput, type Barcode } from 'react-native-vision-camera-barcode-scanner'

/** Camera output that reports the text of codes it sees (Android: ML Kit). */
export function useCodeScanner(onCodes: (values: string[]) => void) {
  return useBarcodeScannerOutput({
    barcodeFormats: ['qr-code', 'data-matrix', 'ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128'],
    outputResolution: 'preview',
    onBarcodeScanned: (codes: Barcode[]) => {
      onCodes(codes.map((c) => c.rawValue).filter((v): v is string => !!v))
    },
    onError: (e) => console.warn('barcode scanner', e),
  })
}
