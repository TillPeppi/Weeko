/**
 * Web barcode scanner: getUserMedia + the browser BarcodeDetector API
 * (Chromium). expo-camera cannot scan barcodes on web. Browsers without
 * BarcodeDetector (Firefox/Safari) get a hint to type the barcode instead —
 * the manual field next to the scanner always works.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Muted } from '@/components/ui/Text';

export interface BarcodeScannerProps {
  onScanned: (barcode: string) => void;
}

interface DetectedBarcode {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike;
}

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as Record<string, unknown>).BarcodeDetector;
  return typeof ctor === 'function' ? (ctor as unknown as BarcodeDetectorCtor) : null;
}

export function BarcodeScanner({ onScanned }: BarcodeScannerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<'unsupported' | 'camera' | null>(
    getDetectorCtor() ? null : 'unsupported'
  );

  useEffect(() => {
    const ctor = getDetectorCtor();
    if (!ctor) return;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let done = false;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        setError('camera');
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => setError('camera'));
      const detector = new ctor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });
      timer = setInterval(() => {
        void detector
          .detect(video)
          .then((codes) => {
            if (done || codes.length === 0 || !codes[0].rawValue) return;
            done = true;
            onScanned(codes[0].rawValue);
          })
          .catch(() => {
            /* frame not ready yet — keep polling */
          });
      }, 400);
    })();

    return () => {
      done = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <View className="rounded-xl border border-border dark:border-border-dark p-4">
        <Muted>
          {t(error === 'unsupported' ? 'food.add.scannerWebUnsupported' : 'food.add.cameraPermission')}
        </Muted>
      </View>
    );
  }

  return (
    <View className="h-56 overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </View>
  );
}
