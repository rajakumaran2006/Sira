"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, RefreshCw } from 'lucide-react';

export default function CameraScanner({ onScan, isActive }) {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const scannerRef = useRef(null);
  const containerId = 'sira-camera-viewport';
  const scanThrottleRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      stopScanner();
      return;
    }

    startScanner();

    return () => {
      stopScanner();
    };
  }, [isActive]);

  const startScanner = async () => {
    setIsInitializing(true);
    setCameraError(null);
    
    try {
      // Small delay to ensure the DOM element with containerId is rendered
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error('Scanner container not found in DOM');
      }

      // Initialize scanner
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      // Request camera permissions and start
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.7;
            return { width: size, height: size };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Success callback
          handleScanSuccess(decodedText);
        },
        () => {
          // Error callback (fired constantly during search, ignore to prevent console flood)
        }
      );
      
      setHasCameraPermission(true);
    } catch (err) {
      console.error('Camera Init Error:', err);
      setHasCameraPermission(false);
      setCameraError(err.message || 'Failed to access camera.');
    } finally {
      setIsInitializing(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Failed to stop camera scanner:', err);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  const handleScanSuccess = (text) => {
    if (!text) return;
    
    // Simple throttle: don't scan the same item multiple times in 2 seconds
    const now = Date.now();
    if (scanThrottleRef.current && scanThrottleRef.current.text === text && now - scanThrottleRef.current.time < 2000) {
      return;
    }
    
    scanThrottleRef.current = { text, time: now };
    onScan(text);
  };

  const handleRetry = () => {
    stopScanner().then(() => startScanner());
  };

  return (
    <div className="w-full">
      <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-3xl bg-black border border-gray-200/20 shadow-lg">
        {/* The target camera div */}
        <div id={containerId} className="w-full h-full object-cover"></div>

        {/* Laser Scanner Effect Overlay */}
        {isActive && hasCameraPermission && !isInitializing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-12">
            <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-scan-laser"></div>
            
            {/* Camera Reticle Corners */}
            <div className="absolute top-10 left-10 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-md"></div>
            <div className="absolute top-10 right-10 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-md"></div>
            <div className="absolute bottom-10 left-10 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-md"></div>
            <div className="absolute bottom-10 right-10 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-md"></div>
          </div>
        )}

        {/* Loading Indicator */}
        {isInitializing && (
          <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-white space-y-3 p-6 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-sm font-semibold">Initializing Camera Feed...</p>
            <p className="text-xs text-gray-500">Allow camera access if prompted by browser</p>
          </div>
        )}

        {/* No Camera Permission / Error State */}
        {!isInitializing && (hasCameraPermission === false || cameraError) && (
          <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-white space-y-4 p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
              <CameraOff className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Camera Access Blocked</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[200px] mx-auto">
                Please grant camera permissions or use the Simulator button below.
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Permission</span>
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 text-center">
        <p className="text-xs font-medium text-gray-400 flex items-center justify-center gap-1.5">
          <Camera className="w-3.5 h-3.5" />
          <span>Point camera at a barcode or QR code</span>
        </p>
      </div>
    </div>
  );
}
