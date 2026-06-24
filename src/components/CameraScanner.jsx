"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, AlertCircle, RefreshCw, ShieldOff, VideoOff, Settings } from 'lucide-react';

// Classify DOMException / html5-qrcode errors into user-friendly categories
function parseCameraError(err) {
  const name = err?.name || '';
  const message = (err?.message || '').toLowerCase();

  if (name === 'NotAllowedError' || message.includes('permission') || message.includes('not allowed')) {
    return {
      type: 'permission',
      title: 'Camera Access Denied',
      detail: 'Your browser blocked camera access. Please allow it and try again.',
      icon: 'shield',
    };
  }

  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    message.includes('not found') ||
    message.includes('no camera') ||
    message.includes('requested device not found')
  ) {
    return {
      type: 'notfound',
      title: 'No Camera Detected',
      detail: 'This device does not have an accessible camera. Use a device with a camera or switch to keyboard mode.',
      icon: 'nocam',
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError' || message.includes('in use') || message.includes('could not start')) {
    return {
      type: 'inuse',
      title: 'Camera Is In Use',
      detail: 'Another application is currently using the camera. Close it and retry.',
      icon: 'inuse',
    };
  }

  if (name === 'OverconstrainedError' || message.includes('overconstrained')) {
    return {
      type: 'constrained',
      title: 'Camera Not Compatible',
      detail: 'The rear camera could not be accessed. Try retrying — the front camera may be used instead.',
      icon: 'alert',
    };
  }

  return {
    type: 'generic',
    title: 'Failed to Access Camera',
    detail: err?.message || 'An unexpected error occurred while starting the camera.',
    icon: 'alert',
  };
}

export default function CameraScanner({ onScan, isActive }) {
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [cameraError, setCameraError] = useState(null); // parseCameraError result object
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
    setHasCameraPermission(null);

    try {
      // Small delay to ensure the DOM element with containerId is rendered
      await new Promise(resolve => setTimeout(resolve, 300));

      const element = document.getElementById(containerId);
      if (!element) {
        throw new Error('Scanner container not found in DOM');
      }

      // Clear any previous html5-qrcode children to avoid "already started" errors
      element.innerHTML = '';

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

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
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame-level error — fires constantly while searching; suppress logs
        }
      );

      setHasCameraPermission(true);
    } catch (err) {
      console.error('Camera Init Error:', err);
      setHasCameraPermission(false);
      setCameraError(parseCameraError(err));
    } finally {
      setIsInitializing(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        // Ignore stop errors — scanner may have already been stopped
      } finally {
        scannerRef.current = null;
      }
    }
  };

  const handleScanSuccess = (text) => {
    if (!text) return;

    const now = Date.now();
    if (
      scanThrottleRef.current &&
      scanThrottleRef.current.text === text &&
      now - scanThrottleRef.current.time < 2000
    ) {
      return;
    }

    scanThrottleRef.current = { text, time: now };
    onScan(text);
  };

  const handleRetry = async () => {
    await stopScanner();
    startScanner();
  };

  // Permission denied specific UI
  if (!isInitializing && hasCameraPermission === false && cameraError?.type === 'permission') {
    return (
      <div className="w-full">
        <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-3xl bg-gray-900 border border-gray-700/40 shadow-lg flex flex-col items-center justify-center p-6 text-center gap-4">
          {/* Icon */}
          <div className="h-16 w-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
            <ShieldOff className="w-7 h-7 text-orange-400" />
          </div>

          {/* Title & subtitle */}
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">Camera Access is Blocked</p>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[220px] mx-auto">
              Your browser denied camera permission. Follow the steps below to enable it:
            </p>
          </div>

          {/* Step-by-step guide */}
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-left space-y-2">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">How to enable</p>
            <div className="flex items-start gap-2">
              <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-[11px] text-gray-300 leading-snug">Click the 🔒 lock / camera icon in your browser's address bar</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-[11px] text-gray-300 leading-snug">Set <strong className="text-white">Camera</strong> to <strong className="text-green-400">Allow</strong></p>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-4 w-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-[11px] text-gray-300 leading-snug">Click <strong className="text-white">"Try Again"</strong> below to retry</p>
            </div>
          </div>

          {/* Retry button */}
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/30"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
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

  return (
    <div className="w-full">
      <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-3xl bg-black border border-gray-200/20 shadow-lg">
        {/* Camera viewport managed by html5-qrcode */}
        <div id={containerId} className="w-full h-full object-cover"></div>

        {/* Laser Scanner Effect Overlay — only shown when camera is live */}
        {isActive && hasCameraPermission && !isInitializing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-12">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/50 shadow-[0_0_6px_rgba(239,68,68,0.3)]"></div>
            <div className="absolute top-10 left-10 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-md"></div>
            <div className="absolute top-10 right-10 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-md"></div>
            <div className="absolute bottom-10 left-10 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-md"></div>
            <div className="absolute bottom-10 right-10 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-md"></div>
          </div>
        )}

        {/* Initializing State */}
        {isInitializing && (
          <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center text-white space-y-3 p-6 text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            <p className="text-sm font-semibold">Initializing Camera...</p>
            <p className="text-xs text-gray-500">Allow camera access if prompted by your browser</p>
          </div>
        )}

        {/* Error State (non-permission errors) */}
        {!isInitializing && hasCameraPermission === false && cameraError && cameraError.type !== 'permission' && (
          <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-white space-y-4 p-6 text-center">
            <div className="h-14 w-14 rounded-full bg-red-500 border border-red-500 flex items-center justify-center">
              {cameraError.icon === 'nocam' ? (
                <VideoOff className="w-6 h-6 text-white" />
              ) : (
                <AlertCircle className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm uppercase font-bold text-white">{cameraError.title}</p>
            </div>
            {/* Only show Retry for recoverable errors */}
            {cameraError.type !== 'notfound' && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-gray-100 active:scale-95 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
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
