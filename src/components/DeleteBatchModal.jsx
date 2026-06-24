"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';

export default function DeleteBatchModal({ isOpen, onClose, batchName, onConfirm }) {
  const [confirmCode, setConfirmCode] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef(null);

  // Generate a random 3-digit code whenever the modal opens or batchName changes
  useEffect(() => {
    if (isOpen) {
      const code = Math.floor(100 + Math.random() * 900).toString();
      setConfirmCode(code);
      setUserInput('');
      setError('');
      setIsDeleting(false);
      
      // Auto focus input helper
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, batchName]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (userInput !== confirmCode) {
      setError('The confirmation code does not match.');
      return;
    }
    setIsDeleting(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to delete batch. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className="w-full max-w-md overflow-hidden glass-modal rounded-3xl border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50">
          <div>
            <h3 className="text-lg font-bold uppercase text-black">Delete Batch</h3>
            <p className="text-xs text-gray-500">This action is permanent and cannot be undone</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-black transition-colors"
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

          <div className="space-y-3">
            <p className="text-xs text-[#52647c] leading-relaxed">
              Are you sure you want to delete the batch <strong className="text-black font-extrabold">"{batchName}"</strong>? This will permanently delete all associated items from the database.
            </p>
            
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Required Confirmation Code</span>
              <span className="text-2xl font-black text-black tracking-widest">{confirmCode}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Enter confirmation code</label>
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

          {/* Action Buttons */}
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-sm font-bold text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={userInput !== confirmCode || isDeleting}
              className="flex-1 py-3.5 rounded-2xl bg-[#e11d48] hover:bg-[#be123c] disabled:bg-gray-200 text-sm font-bold text-white disabled:text-gray-400 flex items-center justify-center gap-1.5 transition-colors"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Delete Batch</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
