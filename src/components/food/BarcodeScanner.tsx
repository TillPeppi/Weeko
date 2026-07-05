/**
 * Native barcode scanner (expo-camera). The web variant lives in
 * BarcodeScanner.web.tsx (browser BarcodeDetector — expo-camera does not scan
 * on web). Fires `onScanned` once per mount-cycle; parent decides what's next.
 */
import { useRef } from 'react';
import { View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Muted } from '@/components/ui/Text';

export interface BarcodeScannerProps {
  onScanned: (barcode: string) => void;
}

export function BarcodeScanner({ onScanned }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const locked = useRef(false);

  if (!permission?.granted) {
    return (
      <View className="items-center gap-3 rounded-xl border border-border dark:border-border-dark p-4">
        <Muted className="text-center">{t('food.add.cameraPermission')}</Muted>
        <Button
          title={t('food.add.grantPermission')}
          variant="secondary"
          size="sm"
          onPress={() => void requestPermission()}
        />
      </View>
    );
  }

  return (
    <View className="h-56 overflow-hidden rounded-xl">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
        }}
        onBarcodeScanned={({ data }) => {
          if (locked.current || !data) return;
          locked.current = true;
          onScanned(data);
        }}
      />
    </View>
  );
}
