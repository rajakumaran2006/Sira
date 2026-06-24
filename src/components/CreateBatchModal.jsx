"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, FileSpreadsheet, AlertCircle, Loader } from 'lucide-react';
import { createBatch } from '../utils/api';

export default function CreateBatchModal({ isOpen, onClose, onBatchCreated }) {
  const [batchName, setBatchName] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const fileInputRef = useRef(null);

  if (!isOpen || !mounted) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setError('');
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    const validExtensions = ['csv', 'tsv', 'xls', 'xlsx'];
    
    if (!validExtensions.includes(extension)) {
      setError('Invalid file type. Please upload a CSV, TSV, XLS, or XLSX file.');
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    // Auto-populate batch name from file name (sans extension) if name is empty
    if (!batchName) {
      const nameWithoutExt = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
      setBatchName(nameWithoutExt.replace(/[-_]/g, ' '));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setError('Please enter a batch name.');
      return;
    }
    if (!file) {
      setError('Please upload an inventory spreadsheet.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const newBatch = await createBatch(batchName.trim(), file);
      onBatchCreated(newBatch);
      // Reset and close
      setBatchName('');
      setFile(null);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to upload batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className="w-full max-w-md overflow-hidden glass-modal rounded-3xl border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/50">
          <div>
            <h3 className="text-lg font-bold uppercase text-black">Create New Batch</h3>
            <p className="text-xs text-gray-500">Seed verification room with inventory spreadsheet</p>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Batch Name</label>
            <input
              type="text"
              placeholder="e.g., Library Audit June 2026"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200/80 bg-white/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent text-sm transition-all duration-200"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Inventory Sheet (CSV, TSV, Excel)</label>
            
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                isDragging 
                  ? 'border-black bg-black/5' 
                  : file 
                    ? 'border-green-500/50 bg-green-50/10' 
                    : 'border-gray-200 hover:border-gray-400 bg-white/40'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv,.tsv,.xls,.xlsx"
                className="hidden"
                disabled={loading}
              />
              
              {file ? (
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-green-50 flex items-center justify-center border border-green-100">
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black truncate max-w-[250px]">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="px-3 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 hover:text-black transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className="h-12 w-12 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-100 text-gray-400">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black">Drag & drop your file here</p>
                    <p className="text-xs text-gray-400">or click to browse from device</p>
                  </div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-widest pt-2">Supports CSV, TSV, XLS, XLSX</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3.5 rounded-2xl border border-gray-200 hover:bg-gray-50 text-sm font-bold text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file || !batchName}
              className="flex-1 py-3.5 rounded-2xl bg-black hover:bg-black/90 disabled:bg-gray-200 text-sm font-bold text-white disabled:text-gray-400 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Upload & Create</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
