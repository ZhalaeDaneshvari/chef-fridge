import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Loader2, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let html5QrcodeScanner: Html5QrcodeScanner | null = null;

    const startScanner = async () => {
      try {
        // Check for camera permissions first
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately, we just wanted to check permission

        html5QrcodeScanner = new Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            defaultZoomValueIfSupported: 2
          },
          /* verbose= */ false
        );

        html5QrcodeScanner.render(
          (decodedText) => {
            onScan(decodedText);
            if (html5QrcodeScanner) {
              html5QrcodeScanner.clear().catch(err => console.error("Failed to clear scanner", err));
            }
          },
          (errorMessage) => {
            // Silently ignore errors during scanning
          }
        );
        
        scannerRef.current = html5QrcodeScanner;
      } catch (err) {
        console.error("Camera access error:", err);
        setError("Camera access denied. Please enable camera permissions in your browser settings.");
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/80 backdrop-blur-md p-6">
      <div className="bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-3 bg-stone-100 text-stone-600 rounded-full hover:bg-stone-200 transition-all z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-stone-900 text-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Camera className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-serif font-light text-stone-900">Scan Barcode</h3>
            <p className="text-stone-500 text-sm font-light italic">Point your camera at the product barcode</p>
          </div>

          <div id="reader" className="overflow-hidden rounded-3xl border-2 border-dashed border-stone-200"></div>

          {error && (
            <p className="text-red-500 text-sm text-center font-light">{error}</p>
          )}

          <button
            onClick={onClose}
            className="w-full py-4 bg-stone-100 text-stone-600 rounded-2xl font-medium hover:bg-stone-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
