import React, { useEffect, useState, useRef } from 'react';
import { Dialog } from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { QrCode, Camera, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (token: string) => void;
  isLoading?: boolean;
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  isLoading = false
}: QrScannerModalProps) {
  const { t } = useTranslation();
  const [manualToken, setManualToken] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen && isCameraActive) {
      setCameraError(null);
      try {
        const scanner = new Html5QrcodeScanner(
          'qr-reader-box',
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true
          },
          false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            if (decodedText) {
              onScanSuccess(decodedText.trim());
              try {
                scanner.clear();
              } catch {}
            }
          },
          (errorMessage) => {
            // Non-critical scan failure per frame
          }
        );
      } catch (err: any) {
        setCameraError(err?.message || 'Unable to start camera.');
      }
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(() => {});
        } catch {}
        scannerRef.current = null;
      }
    };
  }, [isOpen, isCameraActive, onScanSuccess]);

  const handleClose = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear().catch(() => {});
      } catch {}
    }
    setIsCameraActive(false);
    setCameraError(null);
    setManualToken('');
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualToken.trim()) {
      onScanSuccess(manualToken.trim());
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          <span>{t('attendance.scanQrTitle')}</span>
        </div>
      }
      description={t('attendance.scanQrInstruction')}
      maxWidth="md"
    >
      <div className="flex flex-col gap-5 py-2">
        {/* Camera Scanner View */}
        {isCameraActive ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-900 border-2 border-brand-500/60 shadow-lg relative flex items-center justify-center">
              <div id="qr-reader-box" className="w-full h-full" />
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 p-4 flex flex-col items-center justify-center text-center text-rose-400 gap-2 z-10">
                  <AlertCircle className="w-8 h-8" />
                  <span className="text-xs font-semibold">{cameraError}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCameraActive(false)}
                    className="mt-2 text-white border-white/20"
                  >
                    {t('attendance.useManualToken') || 'Use Manual Code'}
                  </Button>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCameraActive(false)}
              className="text-xs"
            >
              {t('attendance.switchToManual') || 'Switch to Manual Input'}
            </Button>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shadow-inner">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                {t('attendance.scanUsingCamera') || 'Scan Using Camera'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xs">
                {t('attendance.scanCameraHint') || 'Point your device camera at the session QR code on the projector'}
              </p>
            </div>
            <Button size="sm" onClick={() => setIsCameraActive(true)}>
              <Camera className="w-4 h-4" />
              <span>{t('attendance.activateCamera') || 'Activate Camera'}</span>
            </Button>
          </div>
        )}

        {/* Manual Token Input */}
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
            <KeyRound className="w-3.5 h-3.5 text-brand-500" />
            <span>{t('attendance.orManualCode') || 'Or Enter Session Code Manually'}</span>
          </div>

          <Input
            placeholder="e.g. 8K42-99AB-34CD"
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value.toUpperCase())}
            disabled={isLoading}
            className="font-mono text-center tracking-widest text-base font-bold"
          />

          <div className="flex justify-end gap-2 mt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isLoading} disabled={!manualToken.trim()}>
              {t('attendance.confirmAttendance')}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
