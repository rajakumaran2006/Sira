"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2 } from 'lucide-react';

export default function DeleteSelectedModal({ isOpen, onClose, count, onConfirm, isLoading = false }) {
  const [confirmCode, setConfirmCode] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Generate a random 3-digit code when the modal opens (or item count changes)
  useEffect(() => {
    if (isOpen) {
      const code = Math.floor(100 + Math.random() * 900).toString();
      setConfirmCode(code);
      setUserInput('');
      setError('');

      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    }
  }, [isOpen, count]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userInput !== confirmCode) {
      setError('The confirmation code does not match.');
      return;
    }
    onConfirm();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-opacity duration-300">
      <div
        className="w-full max-w-md overflow-hidden glass-modal rounded-3xl border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50">
          <div>
            <h3 className="text-lg font-bold text-black uppercase">
              {isLoading ? 'Deleting Records…' : 'Delete Selected'}
            </h3>
            <p className="text-xs text-gray-500">
              {isLoading
                ? `Removing ${count} record${count !== 1 ? 's' : ''}, please wait…`
                : `Remove ${count} record${count !== 1 ? 's' : ''} from inventory`}
            </p>
          </div>
          {/* Disable X while deleting is in progress */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 border border-red-100 text-[#e11d48] text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* While deleting — show a progress indicator instead of the form fields */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-[#e11d48]" />
              <p className="text-sm uppercase font-bold text-gray-700">
                Deleting {count} record{count !== 1 ? 's' : ''}…
              </p>
              <p className="text-xs text-gray-400 text-center">
                This may take a moment. Do not close the page.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <p className="text-xs text-[#52647c] leading-relaxed">
                  Are you sure you want to delete{' '}
                  <strong className="text-black font-extrabold">
                    {count} selected record{count !== 1 ? 's' : ''}
                  </strong>
                  ? These items and their status logs will be removed permanently and cannot be
                  recovered.
                </p>

                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Required Confirmation Code
                  </span>
                  <span className="text-2xl font-black text-black tracking-widest">{confirmCode}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Enter confirmation code
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="e.g., 123"
                  value={userInput}
                  onChange={(e) => {
                    setUserInput(e.target.value);
                    if (error) setError('');
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#e11d48]/20 focus:border-[#e11d48] text-center text-sm font-black tracking-widest transition-all duration-200"
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          {!isLoading && (
            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 text-sm font-bold text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={userInput !== confirmCode}
                className="flex-1 py-3.5 rounded-2xl bg-[#e11d48] hover:bg-[#be123c] disabled:bg-gray-200 text-sm font-bold text-white disabled:text-gray-400 flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Delete {count}</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>,
    document.body
  );
}
